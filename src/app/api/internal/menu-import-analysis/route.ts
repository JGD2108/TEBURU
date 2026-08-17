import { randomUUID, timingSafeEqual } from 'node:crypto';
import { jsonError, jsonSuccess, readJsonObject, requestId } from '@/lib/api-response';
import { getPoolClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PDF_MENU_MAX_BYTES } from '@/lib/menu-import';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';
import { processMenuImportExecution } from '@/lib/menu-import/worker';

const ANALYZER_VERSION = 'menu-import-v1';
const LEASE_SECONDS = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WebhookPayload = { type?: unknown; schema?: unknown; table?: unknown; record?: { id?: unknown } };
type Job = { id: string; restaurant_id: string; source_storage_path: string; source_size_bytes: string | number; status: string };

function authorized(request: Request) {
  const expected = process.env.MENU_IMPORT_AUTOMATION_SECRET;
  const supplied = request.headers.get('apikey');
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected); const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function validPayload(value: WebhookPayload | null): value is Required<Pick<WebhookPayload, 'type' | 'schema' | 'table'>> & { record: { id: string } } {
  return value?.type === 'INSERT' && value.schema === 'public' && value.table === 'menu_import_jobs'
    && typeof value.record?.id === 'string' && UUID.test(value.record.id);
}

async function verifyPrivatePdf(job: Job) {
  if (!job.source_storage_path.startsWith(`restaurants/${job.restaurant_id}/`) || !job.source_storage_path.endsWith('.pdf')) return false;
  const expectedSize = Number(job.source_size_bytes);
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > PDF_MENU_MAX_BYTES) return false;
  const storage = menuImportStorage();
  if (!storage) throw new Error('Menu import storage is not configured');
  const object = await storage.storage.from(menuImportBucket).info(job.source_storage_path);
  if (!object.error && object.data) {
    const size = object.data.size;
    const type = object.data.contentType;
    return (size === undefined || size === expectedSize) && (type === undefined || type === 'application/pdf');
  }
  const exists = await storage.storage.from(menuImportBucket).exists(job.source_storage_path);
  return exists.data;
}

async function readPrivatePdf(path: string) {
  const storage = menuImportStorage();
  if (!storage) throw new Error('Menu import storage is not configured');
  const source = await storage.storage.from(menuImportBucket).download(path);
  if (source.error || !source.data) throw source.error ?? new Error('PDF source is missing');
  return new Uint8Array(await source.data.arrayBuffer());
}

export async function POST(request: Request) {
  const correlationId = requestId(request);
  if (!authorized(request)) return jsonError(request, 'AUTHORIZATION_FAILED', 'No autorizado.', 401);
  const payload = await readJsonObject(request) as WebhookPayload | null;
  if (!validPayload(payload)) return jsonError(request, 'INVALID_REQUEST', 'Evento de análisis inválido.', 400);

  const client = await getPoolClient();
  try {
    const jobResult = await client.query<Job>('SELECT id, restaurant_id, source_storage_path, source_size_bytes, status FROM menu_import_jobs WHERE id = $1', [payload.record.id]);
    const job = jobResult.rows[0];
    if (!job) return jsonSuccess(request, { accepted: true, claimed: false, reason: 'unknown_job' });
    if (!(await verifyPrivatePdf(job))) {
      await client.query("UPDATE menu_import_jobs SET status = 'failed', failure_reason = 'INVALID_ANALYSIS_SOURCE', updated_at = now() WHERE id = $1 AND status = 'pending'", [job.id]);
      return jsonError(request, 'IMPORT_UPLOAD_INCOMPLETE', 'El PDF para análisis no es válido.', 422);
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
      WHERE id = $1 AND status = 'pending'
      RETURNING id, restaurant_id, source_storage_path, source_size_bytes, status`, [job.id, executionId, ANALYZER_VERSION, LEASE_SECONDS]);
    const owner = claimed.rows[0];
    if (!owner) { await client.query('COMMIT'); logger.info('menu_import.analysis_duplicate', { requestId: correlationId, importId: job.id }); return jsonSuccess(request, { accepted: true, claimed: false, reason: 'already_claimed' }); }
    await client.query(`INSERT INTO menu_import_analysis_runs (import_job_id, restaurant_id, analysis_execution_id, attempt, status, analyzer_version, lease_expires_at, started_at)
      SELECT id, restaurant_id, analysis_execution_id, analysis_attempt_count, 'claimed', analyzer_version, analysis_lease_expires_at, now()
      FROM menu_import_jobs WHERE id = $1 AND analysis_execution_id = $2`, [owner.id, executionId]);
    await client.query('COMMIT');
    logger.info('menu_import.analysis_claimed', { requestId: correlationId, importId: owner.id, restaurantId: owner.restaurant_id, analysisExecutionId: executionId });
    const outcome = await processMenuImportExecution(executionId, readPrivatePdf);
    return jsonSuccess(request, { accepted: true, claimed: true, outcome, importId: owner.id, analysisExecutionId: executionId }, { status: 202 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('menu_import.analysis_webhook_failed', error, { requestId: correlationId, importId: payload?.record?.id });
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo iniciar el análisis.', 500);
  } finally { client.release(); }
}
