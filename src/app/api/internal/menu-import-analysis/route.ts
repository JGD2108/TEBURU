import { timingSafeEqual } from 'node:crypto';
import { jsonError, jsonSuccess, readJsonObject, requestId } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { dispatchMenuImportAnalysis } from '@/lib/menu-import/dispatcher';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type WebhookPayload = { type?: unknown; schema?: unknown; table?: unknown; record?: { id?: unknown } };

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

export async function POST(request: Request) {
  const correlationId = requestId(request);
  if (!authorized(request)) return jsonError(request, 'AUTHORIZATION_FAILED', 'No autorizado.', 401);
  const payload = await readJsonObject(request) as WebhookPayload | null;
  if (!validPayload(payload)) return jsonError(request, 'INVALID_REQUEST', 'Evento de análisis inválido.', 400);
  try {
    const result = await dispatchMenuImportAnalysis(payload.record.id, correlationId);
    if (!result.accepted) return jsonError(request, 'IMPORT_UPLOAD_INCOMPLETE', 'El PDF para análisis no es válido.', 422);
    return jsonSuccess(request, result, { status: result.claimed ? 202 : 200 });
  } catch (error) {
    logger.error('menu_import.analysis_webhook_failed', error, { requestId: correlationId, importId: payload.record.id });
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo iniciar el análisis.', 500);
  }
}
