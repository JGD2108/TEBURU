import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { analyzePdf, createPdfAnalysisProvider } from './provider';
import type { AnalysisResult, Confidence, ExtractedImage, PdfAnalysisProvider } from './types';

export const ANALYZER_VERSION = process.env.MENU_IMPORT_ANALYZER_VERSION || 'menu-import-v1';
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const ANALYSIS_TIMEOUT_MS = 120 * 1000;
const AUTO_ASSIGN_IMAGE_CONFIDENCE: Confidence = 'high';
const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Job = { id: string; restaurant_id: string; source_storage_path: string; source_size_bytes?: number | string };
type Execution = Job & { analysis_execution_id: string; attempt: number };
export type SourceReader = (path: string) => Promise<Uint8Array>;
export type ImportAssetWriter = (job: { id: string; restaurantId: string; executionId?: string }, asset: ExtractedImage) => Promise<string>;

function confidenceScore(value: Confidence) { return value === 'high' ? 0.95 : value === 'medium' ? 0.65 : 0.25; }

function sha256(value: Uint8Array) { return createHash('sha256').update(value).digest('hex'); }

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

async function claimNextExecution(client: PoolClient): Promise<Execution | undefined> {
  const executionId = randomUUID();
  const result = await client.query<Execution>(`UPDATE menu_import_jobs
    SET status = 'processing', analysis_execution_id = $1, analyzer_version = $2,
        analysis_attempt_count = analysis_attempt_count + 1,
        analysis_lease_expires_at = now() + ($3 * interval '1 millisecond'),
        analysis_available_at = now(), failure_reason = NULL, updated_at = now()
    WHERE id = (SELECT id FROM menu_import_jobs
      WHERE status = 'pending' AND analysis_available_at <= now()
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, restaurant_id, source_storage_path, source_size_bytes, analysis_execution_id`,
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
      analysis_execution_id, analysis_attempt_count AS attempt
    FROM menu_import_jobs
    WHERE analysis_execution_id = $1 AND status = 'processing'
      AND analysis_lease_expires_at > now()`, [executionId]);
  return result.rows[0];
}

async function persistDraft(client: PoolClient, job: Execution, result: AnalysisResult, writeAsset?: ImportAssetWriter) {
  const categories = new Map<string, string>();
  for (const item of result.items) {
    const categoryName = item.category.trim() || 'Uncategorized';
    let categoryId = categories.get(categoryName.toLowerCase());
    if (!categoryId) {
      const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_categories
        (import_job_id, restaurant_id, name, source_page, confidence)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (import_job_id, lower(name)) DO UPDATE SET name = EXCLUDED.name
        RETURNING id`, [job.id, job.restaurant_id, categoryName, item.page, confidenceScore(item.confidence.category)]);
      categoryId = created.rows[0].id; categories.set(categoryName.toLowerCase(), categoryId);
    }
    const itemKey = sha256(new TextEncoder().encode(`${job.id}|${categoryId}|${item.name}|${item.description ?? ''}|${item.price ?? ''}`));
    const draft = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_items
      (import_job_id, restaurant_id, draft_category_id, name, description, price, field_confidence, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
      ON CONFLICT (import_job_id, idempotency_key) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [job.id, job.restaurant_id, categoryId, item.name, item.description ?? null, item.price ?? null, JSON.stringify(item.confidence), itemKey]);
    const evidenceKey = sha256(new TextEncoder().encode(`${job.id}|${draft.rows[0].id}|${item.page}|${item.name}`));
    await client.query(`INSERT INTO menu_import_source_evidence
      (id, import_job_id, restaurant_id, draft_item_id, page_number, excerpt, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (import_job_id, idempotency_key) DO NOTHING`,
      [randomUUID(), job.id, job.restaurant_id, draft.rows[0].id, item.page, item.name, evidenceKey]);
  }
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
}

async function reusePriorDraft(client: PoolClient, job: Execution, sourceHash: string): Promise<boolean> {
  const prior = await client.query<{ import_job_id: string }>(`SELECT import_job_id FROM menu_import_analysis_runs
    WHERE restaurant_id = $1 AND source_sha256 = $2 AND analyzer_version = $3
      AND status IN ('completed','reused') AND import_job_id <> $4
    ORDER BY completed_at DESC NULLS LAST LIMIT 1`, [job.restaurant_id, sourceHash, ANALYZER_VERSION, job.id]);
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

export async function processMenuImportExecution(executionId: string, reader: SourceReader, provider: PdfAnalysisProvider = createPdfAnalysisProvider(), writeAsset?: ImportAssetWriter): Promise<MenuImportExecutionOutcome> {
  const client = await getPoolClient();
  let job: Execution | undefined;
  try {
    job = await loadExecution(client, executionId);
    if (!job) return 'stale';
    await client.query(`UPDATE menu_import_analysis_runs SET status = 'processing', updated_at = now() WHERE analysis_execution_id = $1`, [executionId]);
    logger.info('menu_import.analysis_started', { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId, attempt: job.attempt });
    const pdf = await withTimeout(reader(job.source_storage_path));
    const sourceHash = sha256(pdf);
    await client.query('UPDATE menu_import_jobs SET source_sha256 = $2, updated_at = now() WHERE id = $1 AND analysis_execution_id = $3', [job.id, sourceHash, executionId]);
    await client.query('UPDATE menu_import_analysis_runs SET source_sha256 = $2, updated_at = now() WHERE analysis_execution_id = $1', [executionId, sourceHash]);

    await client.query('BEGIN');
    const stillOwner = await client.query('SELECT 1 FROM menu_import_jobs WHERE id = $1 AND status = \'processing\' AND analysis_execution_id = $2 AND analysis_lease_expires_at > now()', [job.id, executionId]);
    if (!stillOwner.rows[0]) { await client.query('ROLLBACK'); return 'stale'; }
    const reused = await reusePriorDraft(client, job, sourceHash);
    if (!reused) {
      const result = await withTimeout(analyzePdf(pdf, provider));
      await persistDraft(client, job, result, writeAsset);
    }
    await client.query(`UPDATE menu_import_analysis_runs SET status = $2, completed_at = now(), updated_at = now() WHERE analysis_execution_id = $1`, [executionId, reused ? 'reused' : 'completed']);
    await client.query(`UPDATE menu_import_jobs SET status = 'needs_review', analysis_lease_expires_at = NULL, updated_at = now() WHERE id = $1 AND status = 'processing' AND analysis_execution_id = $2`, [job.id, executionId]);
    await client.query('COMMIT');
    logger.info(reused ? 'menu_import.analysis_reused' : 'menu_import.analysis_ready_for_review', { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId });
    return reused ? 'reused' : 'completed';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (job) {
      const reason = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown analysis failure';
      const terminal = job.attempt >= MAX_ATTEMPTS;
      const next = terminal ? 'failed' : 'pending';
      await client.query(`UPDATE menu_import_analysis_runs SET status = 'failed', error_code = 'ANALYSIS_FAILED', error_reason = $3, completed_at = now(), updated_at = now()
        WHERE import_job_id = $2 AND analysis_execution_id = $1`, [executionId, job.id, reason]);
      await client.query(`UPDATE menu_import_jobs SET status = $2, failure_reason = 'ANALYSIS_FAILED', analysis_available_at = CASE WHEN $2 = 'pending' THEN now() + (($3)::int * interval '10 seconds') ELSE now() END, analysis_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND status = 'processing' AND analysis_execution_id = $4`, [job.id, next, Math.min(job.attempt, 3), executionId]);
      logger.error(terminal ? 'menu_import.analysis_failed' : 'menu_import.analysis_retry_scheduled', error, { importId: job.id, restaurantId: job.restaurant_id, analysisExecutionId: executionId, attempt: job.attempt });
    }
    throw error;
  } finally { client.release(); }
}

/** Entry point used by the event consumer after it has committed the claim. */
export async function processClaimedMenuImport(_jobId: string, executionId: string, reader: SourceReader, provider: PdfAnalysisProvider = createPdfAnalysisProvider()): Promise<MenuImportExecutionOutcome> {
  return processMenuImportExecution(executionId, reader, provider);
}

/** Backwards-compatible queue entry point for local/manual workers. */
export async function processNextMenuImport(reader: SourceReader, provider: PdfAnalysisProvider = createPdfAnalysisProvider(), writeAsset?: ImportAssetWriter): Promise<string | null> {
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
