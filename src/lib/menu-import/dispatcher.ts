import { randomUUID } from 'node:crypto';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PDF_MENU_MAX_BYTES } from '@/lib/menu-import';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';
import { ANALYZER_VERSION, processMenuImportExecution } from '@/lib/menu-import/worker';

// Node-only imports make this a server-only boundary. Do not import it from UI code.
const LEASE_SECONDS = 10 * 60;
type Job = { id: string; restaurant_id: string; source_storage_path: string; source_size_bytes: string | number; status: string };
export type MenuImportDispatchResult =
  | { accepted: true; claimed: true; importId: string; analysisExecutionId: string; outcome: Awaited<ReturnType<typeof processMenuImportExecution>> }
  | { accepted: true; claimed: false; reason: 'unknown_job' | 'already_claimed' }
  | { accepted: false; reason: 'invalid_source' };

async function verifyPrivatePdf(job: Job) {
  if (!job.source_storage_path.startsWith(`restaurants/${job.restaurant_id}/`) || !job.source_storage_path.endsWith('.pdf')) return false;
  const expectedSize = Number(job.source_size_bytes);
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > PDF_MENU_MAX_BYTES) return false;
  const storage = menuImportStorage();
  if (!storage) throw new Error('Menu import storage is not configured');
  const object = await storage.storage.from(menuImportBucket).info(job.source_storage_path);
  if (!object.error && object.data) {
    return (object.data.size === undefined || object.data.size === expectedSize)
      && (object.data.contentType === undefined || object.data.contentType === 'application/pdf');
  }
  return (await storage.storage.from(menuImportBucket).exists(job.source_storage_path)).data;
}

async function readPrivatePdf(path: string) {
  const storage = menuImportStorage();
  if (!storage) throw new Error('Menu import storage is not configured');
  const source = await storage.storage.from(menuImportBucket).download(path);
  if (source.error || !source.data) throw source.error ?? new Error('PDF source is missing');
  return new Uint8Array(await source.data.arrayBuffer());
}

/** Reload, validate, then atomically claim a known job. The caller authenticates its boundary. */
export async function dispatchMenuImportAnalysis(jobId: string, correlationId?: string): Promise<MenuImportDispatchResult> {
  const client = await getPoolClient();
  try {
    const found = await client.query<Job>('SELECT id, restaurant_id, source_storage_path, source_size_bytes, status FROM menu_import_jobs WHERE id = $1', [jobId]);
    const job = found.rows[0];
    if (!job) return { accepted: true, claimed: false, reason: 'unknown_job' };
    if (!(await verifyPrivatePdf(job))) {
      await client.query("UPDATE menu_import_jobs SET status = 'failed', failure_reason = 'INVALID_ANALYSIS_SOURCE', updated_at = now() WHERE id = $1 AND status = 'pending'", [job.id]);
      return { accepted: false, reason: 'invalid_source' };
    }
    await client.query(`UPDATE menu_import_analysis_runs SET status = 'failed', error_code = 'LEASE_EXPIRED', error_reason = 'Analysis lease expired', completed_at = now(), updated_at = now()
      WHERE import_job_id = $1 AND status IN ('claimed', 'processing') AND lease_expires_at <= now()`, [job.id]);
    await client.query(`UPDATE menu_import_jobs SET status = 'pending', analysis_available_at = now(), analysis_lease_expires_at = NULL, failure_reason = 'LEASE_EXPIRED', updated_at = now()
      WHERE id = $1 AND status = 'processing' AND analysis_lease_expires_at <= now()`, [job.id]);

    const executionId = randomUUID();
    await client.query('BEGIN');
    const claimed = await client.query<Job>(`UPDATE menu_import_jobs
      SET status = 'processing', analysis_execution_id = $2, analyzer_version = $3,
          analysis_attempt_count = analysis_attempt_count + 1,
          analysis_lease_expires_at = now() + ($4 * interval '1 second'), updated_at = now()
      WHERE id = $1 AND status = 'pending' AND analysis_available_at <= now()
      RETURNING id, restaurant_id, source_storage_path, source_size_bytes, status`, [job.id, executionId, ANALYZER_VERSION, LEASE_SECONDS]);
    const owner = claimed.rows[0];
    if (!owner) {
      await client.query('COMMIT');
      logger.info('menu_import.analysis_duplicate', { requestId: correlationId, importId: job.id });
      return { accepted: true, claimed: false, reason: 'already_claimed' };
    }
    await client.query(`INSERT INTO menu_import_analysis_runs (import_job_id, restaurant_id, analysis_execution_id, attempt, status, analyzer_version, lease_expires_at, started_at)
      SELECT id, restaurant_id, analysis_execution_id, analysis_attempt_count, 'claimed', analyzer_version, analysis_lease_expires_at, now()
      FROM menu_import_jobs WHERE id = $1 AND analysis_execution_id = $2`, [owner.id, executionId]);
    await client.query('COMMIT');
    logger.info('menu_import.analysis_claimed', { requestId: correlationId, importId: owner.id, restaurantId: owner.restaurant_id, analysisExecutionId: executionId });
    const outcome = await processMenuImportExecution(executionId, readPrivatePdf);
    return { accepted: true, claimed: true, outcome, importId: owner.id, analysisExecutionId: executionId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('menu_import.analysis_dispatch_failed', error, { requestId: correlationId, importId: jobId });
    throw error;
  } finally { client.release(); }
}
