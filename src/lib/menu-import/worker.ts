import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { analyzePdf, createPdfAnalysisProvider } from './provider';
import type { AnalysisResult, Confidence, ExtractedImage, PdfAnalysisProvider } from './types';

const AUTO_ASSIGN_IMAGE_CONFIDENCE: Confidence = 'high';
const MAX_ATTEMPTS = 3;

type Job = { id: string; restaurant_id: string; source_storage_path: string };
export type SourceReader = (path: string) => Promise<Uint8Array>;
export type ImportAssetWriter = (job: { id: string; restaurantId: string }, asset: ExtractedImage) => Promise<string>;

function confidenceScore(value: Confidence) { return value === 'high' ? 0.95 : value === 'medium' ? 0.65 : 0.25; }

/** Claims one job with SKIP LOCKED, so concurrent workers cannot process it twice. */
async function claimJob(client: PoolClient): Promise<Job | undefined> {
  const result = await client.query<Job>(`WITH candidate AS (
    SELECT id FROM menu_import_jobs
    WHERE status = 'pending' OR (status = 'failed' AND COALESCE((provider_metadata->>'attempt_count')::int, 0) < $1)
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE menu_import_jobs job SET status = 'processing',
    provider_metadata = jsonb_set(job.provider_metadata, '{attempt_count}', to_jsonb(COALESCE((job.provider_metadata->>'attempt_count')::int, 0) + 1)),
    failure_reason = NULL, updated_at = now()
  FROM candidate WHERE job.id = candidate.id
  RETURNING job.id, job.restaurant_id, job.source_storage_path`, [MAX_ATTEMPTS]);
  return result.rows[0];
}

async function persistDraft(client: PoolClient, job: Job, result: AnalysisResult, writeAsset?: ImportAssetWriter) {
  const categories = new Map<string, string>();
  for (const item of result.items) {
    let categoryId = categories.get(item.category);
    if (!categoryId) {
      const created = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_categories (import_job_id, restaurant_id, name, source_page, confidence)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`, [job.id, job.restaurant_id, item.category, item.page, confidenceScore(item.confidence.category)]);
      categoryId = created.rows[0].id; categories.set(item.category, categoryId);
    }
    const draft = await client.query<{ id: string }>(`INSERT INTO menu_import_draft_items
      (import_job_id, restaurant_id, draft_category_id, name, description, price, field_confidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`, [job.id, job.restaurant_id, categoryId, item.name, item.description ?? null, item.price ?? null, JSON.stringify(item.confidence)]);
    await client.query(`INSERT INTO menu_import_source_evidence (id, import_job_id, draft_item_id, page_number, excerpt)
      VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), job.id, draft.rows[0].id, item.page, item.name]);
  }
  for (const suggestion of result.suggestions) {
    const asset = result.images[suggestion.assetIndex];
    if (!asset || !writeAsset) continue;
    const storagePath = await writeAsset({ id: job.id, restaurantId: job.restaurant_id }, asset);
    await client.query(`INSERT INTO menu_import_image_suggestions (id, import_job_id, restaurant_id, storage_path, mime_type, association_confidence, approved)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), job.id, job.restaurant_id, storagePath, asset.mimeType, confidenceScore(suggestion.confidence),
      suggestion.confidence === AUTO_ASSIGN_IMAGE_CONFIDENCE]);
  }
}

export async function processNextMenuImport(reader: SourceReader, provider: PdfAnalysisProvider = createPdfAnalysisProvider(), writeAsset?: ImportAssetWriter): Promise<string | null> {
  const client = await getPoolClient();
  let job: Job | undefined;
  try {
    await client.query('BEGIN'); job = await claimJob(client);
    if (!job) { await client.query('COMMIT'); return null; }
    logger.info('menu_import.analysis_started', { importId: job.id, restaurantId: job.restaurant_id });
    const pdf = await reader(job.source_storage_path);
    const result = await analyzePdf(pdf, provider);
    await persistDraft(client, job, result, writeAsset);
    await client.query(`UPDATE menu_import_jobs SET status = 'needs_review', updated_at = now() WHERE id = $1`, [job.id]);
    await client.query('COMMIT');
    logger.info('menu_import.analysis_ready_for_review', { importId: job.id, restaurantId: job.restaurant_id });
    return job.id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (job) {
      await client.query(`UPDATE menu_import_jobs SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1`, [job.id, error instanceof Error ? error.message.slice(0, 1000) : 'Unknown analysis failure']);
      logger.error('menu_import.analysis_failed', error, { importId: job.id, restaurantId: job.restaurant_id });
    }
    throw error;
  } finally { client.release(); }
}
