import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MENU_IMPORT_ANALYZER_V5, resolveAnalyzerVersion } from './analyzer-version';
import { computeMenuImportMetrics } from './metrics';
import { createMenuImportIdFactory, isServerLineageId, sanitizeLineageEvent } from './lineage';
import { analyzeV5Text, type V5TextFailureResult } from './v5-text';
import type { AnalysisMetrics, AnalysisResult, Confidence, ExtractedImage, ExtractedSection, LineageEvent, PdfAnalysisProvider } from './types';

export const ANALYZER_VERSION = resolveAnalyzerVersion();
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const ANALYSIS_TIMEOUT_MS = 120 * 1000;
const AUTO_ASSIGN_IMAGE_CONFIDENCE: Confidence = 'high';
const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Job = { id: string; restaurant_id: string; source_storage_path: string; source_size_bytes?: number | string; analyzer_version?: string | null };
type Execution = Job & { analysis_execution_id: string; attempt: number };
type StructureLineage = {
  provider: 'gemini' | 'local-fallback';
  model?: string;
  fallbackReason?: string;
  failureClass?: 'provider_rate_limited' | 'visual_semantic_failure';
};
type AnalysisResultWithStructureLineage = AnalysisResult & { structureMetadata?: StructureLineage };
type PersistedItemLink = { item: AnalysisResult['items'][number]; draftItemId: string; candidateId: string; itemId: string };
type CategoryProjectionMetrics = {
  categorySectionsObserved: number;
  draftCategoriesProjected: number;
  categoryDeduplications: number;
};
type PersistedDraft = { items: PersistedItemLink[]; categoryProjection: CategoryProjectionMetrics };
export type SourceReader = (path: string) => Promise<Uint8Array>;
export type ImportAssetWriter = (job: { id: string; restaurantId: string; executionId?: string }, asset: ExtractedImage) => Promise<string>;

function confidenceScore(value: Confidence) { return value === 'high' ? 0.95 : value === 'medium' ? 0.65 : 0.25; }

function sha256(value: Uint8Array) { return createHash('sha256').update(value).digest('hex'); }

function structureLineage(result: AnalysisResultWithStructureLineage): Required<Pick<StructureLineage, 'provider'>> & Omit<StructureLineage, 'provider'> {
  const metadata = result.structureMetadata;
  if (metadata?.provider === 'gemini' && metadata.model?.trim()) {
    return { provider: 'gemini', model: metadata.model.trim().slice(0, 100) };
  }
  return {
    provider: 'local-fallback',
    fallbackReason: metadata?.fallbackReason?.trim().slice(0, 200) || undefined,
  };
}

function analysisMetrics(result: AnalysisResultWithStructureLineage, durationMs: number) {
  const metrics: AnalysisMetrics = result.metrics ?? {};
  const reviewItemCount = result.items.filter((item) => (item.reviewReasons?.length ?? 0) > 0 || (item.validationSignals?.some((signal) => signal.severity !== 'info') ?? false)).length;
  return {
    promptVersion: metrics.promptVersion?.slice(0, 100) ?? null,
    pageCount: metrics.pageCount ?? result.documentMetadata?.pageCount ?? null,
    providerCallCount: Math.max(0, metrics.providerCalls ?? 0), retryCount: Math.max(0, metrics.retryCount ?? 0),
    durationMs: Math.max(0, metrics.durationMs ?? durationMs), inputTokens: metrics.inputTokens ?? null, outputTokens: metrics.outputTokens ?? null,
    totalTokens: metrics.totalTokens ?? null, nativeTextCharacters: metrics.nativeTextCharacters ?? null,
    nonEmptyPages: metrics.nonEmptyPages ?? null, textDocumentHash: metrics.textDocumentHash ?? null,
    suspiciousPages: metrics.suspiciousPages ?? [], extractedItemCount: result.items.length, reviewItemCount,
    fallbackReasons: metrics.fallbackReasons ?? (result.structureMetadata?.fallbackReason ? [result.structureMetadata.fallbackReason] : []),
  };
}

async function withTimeout<T>(work: Promise<T>, timeoutMs = ANALYSIS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('MENU_IMPORT_ANALYSIS_TIMEOUT')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Visual code is loaded only for V3/V4 executions, keeping V5 free of that dependency path. */
async function analyzeVisualPdf(pdf: Uint8Array, provider?: PdfAnalysisProvider) {
  const { analyzePdf, createPdfAnalysisProvider } = await import('./provider');
  return analyzePdf(pdf, provider ?? createPdfAnalysisProvider());
}

async function claimNextExecution(client: PoolClient): Promise<Execution | undefined> {
  const executionId = randomUUID();
  const result = await client.query<Execution>(`UPDATE menu_import_jobs
    SET status = 'processing', analysis_execution_id = $1, analyzer_version = COALESCE(analyzer_version, $2),
        analysis_attempt_count = analysis_attempt_count + 1,
        analysis_lease_expires_at = now() + ($3 * interval '1 millisecond'),
        analysis_available_at = now(), failure_reason = NULL, updated_at = now()
    WHERE id = (SELECT id FROM menu_import_jobs
      WHERE status = 'pending' AND analysis_available_at <= now()
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, restaurant_id, source_storage_path, source_size_bytes, analyzer_version, analysis_execution_id`,
    [executionId, ANALYZER_VERSION, LEASE_MS]);
  const job = result.rows[0];
  if (!job) return undefined;
  const attempt = await client.query<{ attempt: number }>('SELECT analysis_attempt_count AS attempt FROM menu_import_jobs WHERE id = $1', [job.id]);
  await client.query(`INSERT INTO menu_import_analysis_runs
    (import_job_id, restaurant_id, analysis_execution_id, attempt, status, analyzer_version, lease_expires_at, started_at)
    VALUES ($1,$2,$3,$4,'claimed',$5,now() + ($6 * interval '1 millisecond'),now())`,
    [job.id, job.restaurant_id, executionId, attempt.rows[0]?.attempt ?? 1, ANALYZER_VERSION, LEASE_MS]);
  return { ...job, analysis_execution_id: executionId, attempt: attempt.rows[0]?.attempt ?? 1 };
}

async function loadExecution(client: PoolClient, executionId: string): Promise<Execution | undefined> {
  const result = await client.query<Execution>(`SELECT id, restaurant_id, source_storage_path, source_size_bytes,
      analysis_execution_id, analysis_attempt_count AS attempt, analyzer_version
    FROM menu_import_jobs
    WHERE analysis_execution_id = $1 AND status = 'processing'
      AND analysis_lease_expires_at > now()`, [executionId]);
  return result.rows[0];
}

function json(value: unknown) { return JSON.stringify(value ?? []); }
function bbox(value: { x: number; y: number; width: number; height: number } | undefined) { return value ? json(value) : null; }
/** Matches the persisted title representation: worker-trimmed text and the unique index's lower(name). */
function normalizedCategoryName(name: string) { return name.trim().toLowerCase(); }
function safeFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const v5 = message.match(/MENU_IMPORT_V5_([A-Z_]+)/);
  if (v5?.[1]) return v5[1];
  if (message.includes('TIMEOUT')) return 'ANALYSIS_TIMEOUT';
  if (message.includes('RATE_LIMIT')) return 'ANALYSIS_RATE_LIMITED';
  if (message.includes('MALFORMED')) return 'ANALYSIS_MALFORMED_OUTPUT';
  return 'ANALYSIS_FAILED';
}

async function persistSections(client: PoolClient, job: Execution, sections: ExtractedSection[] = []) {
  const ids = new Map<string, string>();
  const sectionKeyToCategory = new Map<string, string>();
  const projected = new Map<string, ExtractedSection>();

  // Canonical section keys are useful lineage, but cannot be the persistence
  // identity: draft categories are uniquely constrained by lower(name).
  for (const section of [...sections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const name = section.name?.trim();
    if (!name) continue;
    const normalized = normalizedCategoryName(name);
    sectionKeyToCategory.set(section.key, normalized);
    if (!projected.has(normalized)) projected.set(normalized, section);
  }

  const categoryIds = new Map<string, string>();
  const visiting = new Set<string>();
  const persistCategory = async (normalized: string): Promise<string | undefined> => {
    const existing = categoryIds.get(normalized);
    if (existing) return existing;
    const section = projected.get(normalized);
    const name = section?.name?.trim();
    if (!section || !name || visiting.has(normalized)) return undefined;
    visiting.add(normalized);
    const parentCategory = section.parentKey ? sectionKeyToCategory.get(section.parentKey) : undefined;
    // Continuations may project to the same title/category as their parent.
    // Never materialize that as a self-referential draft-category row.
    const parentId = parentCategory && parentCategory !== normalized
      ? await persistCategory(parentCategory) ?? null
      : null;
    const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_categories
      (import_job_id, restaurant_id, name, raw_name, extraction_key, parent_draft_category_id, sort_order, confidence, source_page, source_bbox, extraction_attributes, review_reasons)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)
      ON CONFLICT (import_job_id, lower(name)) DO UPDATE SET name = EXCLUDED.name, raw_name = EXCLUDED.raw_name,
        parent_draft_category_id = EXCLUDED.parent_draft_category_id, source_bbox = EXCLUDED.source_bbox,
        extraction_attributes = EXCLUDED.extraction_attributes, review_reasons = EXCLUDED.review_reasons
      RETURNING id`, [job.id, job.restaurant_id, name, section.name ?? null, section.key, parentId, section.sortOrder ?? 0,
      confidenceScore(section.confidence ?? 'low'), section.source?.page ?? null, bbox(section.source?.bbox), json(section.attributes ?? {}), json(section.reviewReasons)]);
    visiting.delete(normalized);
    const id = created.rows[0].id;
    categoryIds.set(normalized, id);
    return id;
  };

  for (const normalized of projected.keys()) await persistCategory(normalized);
  for (const [sectionKey, normalized] of sectionKeyToCategory) {
    const id = categoryIds.get(normalized);
    if (id) ids.set(sectionKey, id);
  }
  // The database expression index is the final authority for name identity.
  // Counting returned IDs also remains accurate if its collation equates a
  // pair that JavaScript normalization did not collapse locally.
  const persistedCategoryCount = new Set(categoryIds.values()).size;
  return {
    ids,
    metrics: {
      categorySectionsObserved: sectionKeyToCategory.size,
      draftCategoriesProjected: persistedCategoryCount,
      categoryDeduplications: sectionKeyToCategory.size - persistedCategoryCount,
    },
  };
}

async function persistDraft(client: PoolClient, job: Execution, result: AnalysisResult, writeAsset?: ImportAssetWriter): Promise<PersistedDraft> {
  // V5 invalid candidates are never draft categories/items. Keeping their
  // section only in lineage prevents an invalid-only page from appearing as a
  // seemingly editable empty category.
  const usedSectionKeys = new Set(result.items.map((item) => item.sectionKey).filter((key): key is string => Boolean(key)));
  const sections = job.analyzer_version === MENU_IMPORT_ANALYZER_V5
    ? result.sections?.filter((section) => usedSectionKeys.has(section.key))
    : result.sections;
  const sectionProjection = await persistSections(client, job, sections);
  const sectionIds = sectionProjection.ids;
  const categories = new Map<string, string>();
  const persisted: PersistedItemLink[] = [];
  const ids = createMenuImportIdFactory();
  for (const item of result.items) {
    if (item.extractionStatus === 'invalid') continue;
    const categoryName = item.category?.trim();
    let categoryId = item.sectionKey ? sectionIds.get(item.sectionKey) : undefined;
    if (!categoryId && categoryName) categoryId = categories.get(normalizedCategoryName(categoryName));
    if (!categoryId && categoryName) {
      const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_categories
        (import_job_id, restaurant_id, name, source_page, confidence)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (import_job_id, lower(name)) DO UPDATE SET name = EXCLUDED.name
        RETURNING id`, [job.id, job.restaurant_id, categoryName, item.source?.page ?? item.page, confidenceScore(item.confidence.category)]);
      categoryId = created.rows[0].id; categories.set(normalizedCategoryName(categoryName), categoryId);
    }
    const itemKey = sha256(new TextEncoder().encode(`${job.id}|${categoryId ?? ''}|${item.rawName ?? item.name ?? ''}|${item.description ?? ''}|${item.rawPrice ?? item.price ?? ''}`));
    const draft = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_items
      (import_job_id, restaurant_id, draft_category_id, name, raw_name, description, raw_description, price, raw_price, normalized_currency, source_page, source_bbox, field_confidence, extraction_attributes, modifiers, options, validation_signals, review_reasons, extraction_status, retry_exhausted, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21)
      ON CONFLICT (import_job_id, idempotency_key) DO UPDATE SET name = EXCLUDED.name, raw_name = EXCLUDED.raw_name, description = EXCLUDED.description, raw_description = EXCLUDED.raw_description, price = EXCLUDED.price, raw_price = EXCLUDED.raw_price, normalized_currency = EXCLUDED.normalized_currency, source_page = EXCLUDED.source_page, source_bbox = EXCLUDED.source_bbox, field_confidence = EXCLUDED.field_confidence, extraction_attributes = EXCLUDED.extraction_attributes, modifiers = EXCLUDED.modifiers, options = EXCLUDED.options, validation_signals = EXCLUDED.validation_signals, review_reasons = EXCLUDED.review_reasons, extraction_status = EXCLUDED.extraction_status, retry_exhausted = EXCLUDED.retry_exhausted RETURNING id`,
      [job.id, job.restaurant_id, categoryId ?? null, item.name?.trim() || null, item.rawName ?? item.name ?? null,
        item.description ?? (item.ingredients?.length ? item.ingredients.join(', ') : null), item.description ?? null, item.price ?? null, item.rawPrice ?? null, item.currency ?? null,
        item.source?.page ?? item.page, bbox(item.source?.bbox), json(item.confidence), json(item.attributes ?? {}), json(item.modifiers), json(item.options), json(item.validationSignals), json(item.reviewReasons), item.extractionStatus ?? 'valid', item.retryExhausted ?? false, itemKey]);
    // Provider identifiers are hints only. The lineage IDs linking persistence are
    // generated here, after decode, and remain authoritative across retries.
    persisted.push({
      item,
      draftItemId: draft.rows[0].id,
      candidateId: isServerLineageId(item.candidateId) ? item.candidateId : ids.candidate(),
      itemId: isServerLineageId(item.itemId) ? item.itemId : ids.item(),
    });
    const sourcePage = item.source?.page ?? item.page;
    const evidenceKey = sha256(new TextEncoder().encode(`${job.id}|${draft.rows[0].id}|${sourcePage}|${item.rawName ?? item.name ?? ''}`));
    await client.query(`INSERT INTO menu_import_source_evidence
      (id, import_job_id, restaurant_id, draft_item_id, page_number, excerpt, source_bbox, evidence_type, region_label, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) ON CONFLICT (import_job_id, idempotency_key) DO NOTHING`,
      [randomUUID(), job.id, job.restaurant_id, draft.rows[0].id, sourcePage, item.rawName ?? item.name ?? null, bbox(item.source?.bbox), 'item', item.source?.region ?? null, evidenceKey]);
    for (const [sortOrder, variant] of (item.priceVariants ?? []).entries()) {
      const key = sha256(new TextEncoder().encode(`${job.id}|${draft.rows[0].id}|${variant.label ?? ''}|${variant.raw}|${sortOrder}`));
      await client.query(`INSERT INTO menu_import_draft_price_variants
        (import_job_id, restaurant_id, draft_item_id, label, raw_price, normalized_amount, normalized_currency, is_shared, source_page, source_bbox, confidence, review_reasons, sort_order, idempotency_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14)
        ON CONFLICT (import_job_id, idempotency_key) DO UPDATE SET raw_price = EXCLUDED.raw_price, normalized_amount = EXCLUDED.normalized_amount, normalized_currency = EXCLUDED.normalized_currency, review_reasons = EXCLUDED.review_reasons`,
        [job.id, job.restaurant_id, draft.rows[0].id, variant.label ?? null, variant.raw, variant.amount ?? null, variant.currency ?? null, variant.shared ?? false, variant.source?.page ?? sourcePage, bbox(variant.source?.bbox), confidenceScore(variant.confidence ?? 'low'), json(item.reviewReasons), sortOrder, key]);
    }
  }
  if (result.documentMetadata) await client.query(`INSERT INTO menu_import_document_metadata
    (import_job_id, restaurant_id, document_title, document_language, document_currency, page_count, price_notes, attributes)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
    ON CONFLICT (import_job_id) DO UPDATE SET document_title = EXCLUDED.document_title, document_language = EXCLUDED.document_language, document_currency = EXCLUDED.document_currency, page_count = EXCLUDED.page_count, price_notes = EXCLUDED.price_notes, attributes = EXCLUDED.attributes, updated_at = now()`,
    [job.id, job.restaurant_id, result.documentMetadata.title ?? null, result.documentMetadata.language ?? null, result.documentMetadata.currency ?? null, result.documentMetadata.pageCount ?? null, json(result.documentMetadata.priceNotes), json(result.documentMetadata.attributes ?? {})]);
  for (const suggestion of result.suggestions) {
    const asset = result.images[suggestion.assetIndex];
    if (!asset || !writeAsset || !ALLOWED_ASSET_TYPES.has(asset.mimeType)) continue;
    const storagePath = await writeAsset({ id: job.id, restaurantId: job.restaurant_id, executionId: job.analysis_execution_id }, asset);
    const imageKey = sha256(new TextEncoder().encode(`${job.id}|${storagePath}`));
    await client.query(`INSERT INTO menu_import_image_suggestions
      (id, import_job_id, restaurant_id, storage_path, mime_type, association_confidence, approved, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (import_job_id, idempotency_key) DO NOTHING`,
      [randomUUID(), job.id, job.restaurant_id, storagePath, asset.mimeType, confidenceScore(suggestion.confidence),
        suggestion.confidence === AUTO_ASSIGN_IMAGE_CONFIDENCE, imageKey]);
  }
  return { items: persisted, categoryProjection: sectionProjection.metrics };
}

/** Store only server-sanitized events; raw response retention stays private and bounded. */
async function persistLineage(client: PoolClient, job: Execution, result: AnalysisResult, persisted: PersistedItemLink[]) {
  const ids = createMenuImportIdFactory();
  const events: LineageEvent[] = [
    ...(result.lineage ?? []),
    ...persisted.map(({ item, draftItemId, candidateId, itemId }) => ({
      id: ids.event(), analysisRunId: job.analysis_execution_id, attemptId: job.analysis_execution_id,
      page: item.source?.page ?? item.page, candidateId, itemId, sourceKind: 'unknown' as const,
      stage: 'persistence' as const, validationStatus: item.extractionStatus,
      validationReasons: item.reviewReasons?.map((reason) => reason.code),
      metadata: { draftItemId },
    })),
  ];
  for (const event of events) {
    const safe = sanitizeLineageEvent({
      ...event,
      // Only values minted by this server are allowed into UUID linkage columns.
      id: ids.event(), analysisRunId: job.analysis_execution_id,
      attemptId: isServerLineageId(event.attemptId) ? event.attemptId : job.analysis_execution_id,
      parentAttemptId: isServerLineageId(event.parentAttemptId) ? event.parentAttemptId : undefined,
      candidateId: isServerLineageId(event.candidateId) ? event.candidateId : undefined,
      itemId: isServerLineageId(event.itemId) ? event.itemId : undefined,
      sectionId: isServerLineageId(event.sectionId) ? event.sectionId : undefined,
      reconciledSectionId: isServerLineageId(event.reconciledSectionId) ? event.reconciledSectionId : undefined,
    });
    await client.query(`INSERT INTO menu_import_analysis_lineage_events
      (id, import_job_id, restaurant_id, analysis_execution_id, event_stage, source_kind, page_number, attempt_id,
       parent_attempt_id, candidate_id, extracted_item_id, section_id, reconciled_section_id, retry_reason, region_id,
       event_data, raw_payload, raw_payload_hash, raw_payload_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19)
      ON CONFLICT (analysis_execution_id, id) DO NOTHING`, [
      safe.id, job.id, job.restaurant_id, job.analysis_execution_id, safe.stage, safe.sourceKind, safe.page ?? null,
      safe.attemptId ?? null, safe.parentAttemptId ?? null, safe.candidateId ?? null, safe.itemId ?? null,
      safe.sectionId ?? null, safe.reconciledSectionId ?? null, safe.retryReason ?? null, safe.regionId ?? null,
      json({ analyzerVersion: safe.analyzerVersion, model: safe.model, region: safe.region, image: {
        mimeType: safe.imageMimeType, width: safe.imageWidth, height: safe.imageHeight, byteSize: safe.imageByteSize,
        hash: safe.imageHash, included: safe.imageIncluded,
      }, auxiliaryTextType: safe.auxiliaryTextType, auxiliaryTextLength: safe.auxiliaryTextLength,
      latencyMs: safe.latencyMs, inputTokens: safe.inputTokens, outputTokens: safe.outputTokens,
      validationStatus: safe.validationStatus, validationReasons: safe.validationReasons,
      reconciliationDecision: safe.reconciliationDecision, metadata: safe.metadata }),
      safe.rawPayload ?? null, safe.rawPayloadHash ?? null, safe.rawPayloadExpiresAt ?? null,
    ]);
  }
}

async function reusePriorDraft(client: PoolClient, job: Execution, sourceHash: string): Promise<boolean> {
  const prior = await client.query<{ import_job_id: string }>(`SELECT import_job_id FROM menu_import_analysis_runs
    WHERE restaurant_id = $1 AND source_sha256 = $2 AND analyzer_version = $3
      AND status IN ('completed','reused') AND import_job_id <> $4
    ORDER BY completed_at DESC NULLS LAST LIMIT 1`, [job.restaurant_id, sourceHash, job.analyzer_version ?? ANALYZER_VERSION, job.id]);
  if (!prior.rows[0]?.import_job_id) return false;
  const oldJob = prior.rows[0].import_job_id;
  const categoryMap = new Map<string, string>();
  const categories = await client.query<{ id: string; name: string; sort_order: number; confidence: number; source_page: number | null }>(
    'SELECT id, name, sort_order, confidence, source_page FROM menu_import_draft_categories WHERE import_job_id = $1', [oldJob]);
  for (const category of categories.rows) {
    const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_categories
      (import_job_id, restaurant_id, name, sort_order, confidence, source_page)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (import_job_id, lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [job.id, job.restaurant_id, category.name, category.sort_order, category.confidence, category.source_page]);
    categoryMap.set(category.id, created.rows[0].id);
  }
  const itemMap = new Map<string, string>();
  const items = await client.query<{ id: string; draft_category_id: string | null; name: string | null; description: string | null; price: number | null; field_confidence: unknown }>(
    'SELECT id, draft_category_id, name, description, price, field_confidence FROM menu_import_draft_items WHERE import_job_id = $1', [oldJob]);
  for (const item of items.rows) {
    const categoryId = item.draft_category_id ? categoryMap.get(item.draft_category_id) ?? null : null;
    const itemKey = sha256(new TextEncoder().encode(`${job.id}|${categoryId ?? ''}|${item.name ?? ''}|${item.description ?? ''}|${item.price ?? ''}`));
    const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_items
      (import_job_id, restaurant_id, draft_category_id, name, description, price, field_confidence, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (import_job_id, idempotency_key) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [job.id, job.restaurant_id, categoryId, item.name, item.description, item.price, item.field_confidence, itemKey]);
    itemMap.set(item.id, created.rows[0].id);
  }
  const evidence = await client.query<{ draft_item_id: string | null; page_number: number; excerpt: string | null }>(
    'SELECT draft_item_id, page_number, excerpt FROM menu_import_source_evidence WHERE import_job_id = $1', [oldJob]);
  for (const row of evidence.rows) {
    const itemId = row.draft_item_id ? itemMap.get(row.draft_item_id) : null;
    if (!itemId) continue;
    const key = sha256(new TextEncoder().encode(`${job.id}|${itemId}|${row.page_number}|${row.excerpt ?? ''}`));
    await client.query(`INSERT INTO menu_import_source_evidence (id, import_job_id, restaurant_id, draft_item_id, page_number, excerpt, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (import_job_id, idempotency_key) DO NOTHING`, [randomUUID(), job.id, job.restaurant_id, itemId, row.page_number, row.excerpt, key]);
  }
  const images = await client.query<{ draft_item_id: string | null; storage_path: string; mime_type: string; association_confidence: number | null; approved: boolean }>(
    'SELECT draft_item_id, storage_path, mime_type, association_confidence, approved FROM menu_import_image_suggestions WHERE import_job_id = $1', [oldJob]);
  for (const image of images.rows) {
    const itemId = image.draft_item_id ? itemMap.get(image.draft_item_id) : null;
    const key = sha256(new TextEncoder().encode(`${job.id}|${image.storage_path}`));
    await client.query(`INSERT INTO menu_import_image_suggestions
      (id, import_job_id, restaurant_id, draft_item_id, storage_path, mime_type, association_confidence, approved, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (import_job_id, idempotency_key) DO NOTHING`,
      [randomUUID(), job.id, job.restaurant_id, itemId, image.storage_path, image.mime_type, image.association_confidence, image.approved, key]);
  }
  return true;
}

/** Processes a job already claimed by the webhook and identified by execution UUID. */
export type MenuImportExecutionOutcome = 'completed' | 'reused' | 'stale';

export async function processMenuImportExecution(executionId: string, reader: SourceReader, provider?: PdfAnalysisProvider, writeAsset?: ImportAssetWriter): Promise<MenuImportExecutionOutcome> {
  const client = await getPoolClient();
  let job: Execution | undefined;
  let v5Failure: V5TextFailureResult | undefined;
  try {
    job = await loadExecution(client, executionId);
    if (!job) return 'stale';
    await client.query(`UPDATE menu_import_analysis_runs SET status = 'processing', updated_at = now() WHERE analysis_execution_id = $1`, [executionId]);
    logger.info('menu_import.analysis_started', { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId, attempt: job.attempt });
    const pdf = await withTimeout(reader(job.source_storage_path));
    const sourceHash = sha256(pdf);
    await client.query('UPDATE menu_import_jobs SET source_sha256 = $2, updated_at = now() WHERE id = $1 AND analysis_execution_id = $3', [job.id, sourceHash, executionId]);
    await client.query('UPDATE menu_import_analysis_runs SET source_sha256 = $2, updated_at = now() WHERE analysis_execution_id = $1', [executionId, sourceHash]);

    // Provider/rendering work is intentionally outside a database transaction:
    // only reconciled observations are committed while the lease is still ours.
    const analysisStartedAt = Date.now();
    let analyzed: AnalysisResultWithStructureLineage;
    if (job.analyzer_version === MENU_IMPORT_ANALYZER_V5) {
      const v5 = await analyzeV5Text({
        restaurantId: job.restaurant_id,
        pdf,
        apiKey: process.env.GEMINI_API_KEY,
        attemptId: executionId,
      });
      if (v5.kind === 'failure') {
        v5Failure = v5;
        throw new Error(`MENU_IMPORT_V5_${v5.failure.code}`);
      }
      analyzed = v5.analysis;
    } else {
      analyzed = await withTimeout(analyzeVisualPdf(pdf, provider)) as AnalysisResultWithStructureLineage;
      if (analyzed.structureMetadata?.failureClass === 'provider_rate_limited') throw new Error('MENU_IMPORT_PROVIDER_RATE_LIMITED');
    }
    await client.query('BEGIN');
    const stillOwner = await client.query('SELECT 1 FROM menu_import_jobs WHERE id = $1 AND status = \'processing\' AND analysis_execution_id = $2 AND analysis_lease_expires_at > now()', [job.id, executionId]);
    if (!stillOwner.rows[0]) { await client.query('ROLLBACK'); return 'stale'; }
    const reused = await reusePriorDraft(client, job, sourceHash);
    if (!reused) {
      const persisted = await persistDraft(client, job, analyzed, writeAsset);
      await persistLineage(client, job, analyzed, persisted.items);
      const lineage = structureLineage(analyzed);
      const metrics = analysisMetrics(analyzed, Date.now() - analysisStartedAt);
      const structuralMetrics = {
        ...computeMenuImportMetrics(analyzed.items, analyzed.lineage ?? [], metrics.pageCount ?? 0),
        ...persisted.categoryProjection,
        totalTokens: metrics.totalTokens,
        nativeTextCharacters: metrics.nativeTextCharacters,
        nonEmptyPages: metrics.nonEmptyPages,
        textDocumentHash: metrics.textDocumentHash,
        fallbackUsage: job.analyzer_version === MENU_IMPORT_ANALYZER_V5 ? false : undefined,
      };
      logger.info('menu_import.structure_provider', { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId, provider: lineage.provider, model: lineage.model, fallbackReason: lineage.fallbackReason });
      await client.query(`UPDATE menu_import_analysis_runs
        SET structure_provider = $2, structure_model = $3, structure_fallback_reason = $4,
          prompt_version = $5, page_count = $6, provider_call_count = $7, retry_count = $8, duration_ms = $9,
          input_tokens = $10, output_tokens = $11, suspicious_pages = $12::jsonb, extracted_item_count = $13,
          review_item_count = $14, fallback_reasons = $15::jsonb, structural_metrics = $16::jsonb, updated_at = now()
        WHERE analysis_execution_id = $1`, [executionId, lineage.provider, lineage.model ?? null, lineage.fallbackReason ?? null,
        metrics.promptVersion, metrics.pageCount, metrics.providerCallCount, metrics.retryCount, metrics.durationMs,
        metrics.inputTokens, metrics.outputTokens, json(metrics.suspiciousPages), metrics.extractedItemCount,
        metrics.reviewItemCount, json(metrics.fallbackReasons), json(structuralMetrics)]);
    }
    await client.query(`UPDATE menu_import_analysis_runs SET status = $2, completed_at = now(), updated_at = now() WHERE analysis_execution_id = $1`, [executionId, reused ? 'reused' : 'completed']);
    await client.query(`UPDATE menu_import_jobs SET status = 'needs_review', analysis_lease_expires_at = NULL, updated_at = now() WHERE id = $1 AND status = 'processing' AND analysis_execution_id = $2`, [job.id, executionId]);
    await client.query('COMMIT');
    logger.info(reused ? 'menu_import.analysis_reused' : 'menu_import.analysis_ready_for_review', { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId });
    return reused ? 'reused' : 'completed';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (job) {
      const failureCode = safeFailureCode(error);
      // V5 has one automatic full-document provider request per execution.
      // A later attempt is an authenticated manual requeue, never a scheduler retry.
      const terminal = job.analyzer_version === MENU_IMPORT_ANALYZER_V5 || job.attempt >= MAX_ATTEMPTS;
      const next = terminal ? 'failed' : 'pending';
      if (v5Failure) {
        await persistLineage(client, job, v5Failure.analysis, []);
        const metrics = v5Failure.analysis.metrics ?? {};
        await client.query(`UPDATE menu_import_analysis_runs
          SET structure_provider = 'gemini', structure_model = $2, prompt_version = $3,
            page_count = $4, provider_call_count = $5, retry_count = 0, duration_ms = $6,
            input_tokens = $7, output_tokens = $8, structural_metrics = $9::jsonb, updated_at = now()
          WHERE analysis_execution_id = $1`, [executionId, metrics.model ?? null, metrics.promptVersion ?? null,
          v5Failure.preflight?.pdfPages ?? null, metrics.providerCalls ?? 0, metrics.durationMs ?? null,
          metrics.inputTokens ?? null, metrics.outputTokens ?? null, json({
            failure: v5Failure.failure.code,
            retryable: v5Failure.failure.retryable,
            preflight: v5Failure.preflight,
            structural: v5Failure.structural,
            fallbackUsage: false,
          })]);
      }
      await client.query(`UPDATE menu_import_analysis_runs SET status = 'failed', error_code = $3, error_reason = $3, completed_at = now(), updated_at = now()
        WHERE import_job_id = $2 AND analysis_execution_id = $1`, [executionId, job.id, failureCode]);
      await client.query(`UPDATE menu_import_jobs SET status = $2, failure_reason = $3, analysis_available_at = CASE WHEN $2 = 'pending' THEN now() + (($4)::int * interval '10 seconds') ELSE now() END, analysis_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND status = 'processing' AND analysis_execution_id = $5`, [job.id, next, failureCode, Math.min(job.attempt, 3), executionId]);
      logger.error(terminal ? 'menu_import.analysis_failed' : 'menu_import.analysis_retry_scheduled', new Error(failureCode), { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId, attempt: job.attempt, failureCode });
    }
    throw error;
  } finally { client.release(); }
}

/** Entry point used by the event consumer after it has committed the claim. */
export async function processClaimedMenuImport(_jobId: string, executionId: string, reader: SourceReader, provider?: PdfAnalysisProvider): Promise<MenuImportExecutionOutcome> {
  return processMenuImportExecution(executionId, reader, provider);
}

/** Backwards-compatible queue entry point for local/manual workers. */
export async function processNextMenuImport(reader: SourceReader, provider?: PdfAnalysisProvider, writeAsset?: ImportAssetWriter): Promise<string | null> {
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const execution = await claimNextExecution(client);
    if (!execution) { await client.query('COMMIT'); return null; }
    await client.query('COMMIT');
    const outcome = await processMenuImportExecution(execution.analysis_execution_id, reader, provider, writeAsset);
    return outcome === 'stale' ? null : execution.id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
