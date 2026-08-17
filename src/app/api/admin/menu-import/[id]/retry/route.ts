import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { dispatchMenuImportAnalysis } from '@/lib/menu-import/dispatcher';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
  try {
    const { id } = await context.params;
    const result = await query<{ id: string }>(`UPDATE menu_import_jobs
      SET status = 'pending', failure_reason = NULL, analysis_available_at = now(),
          analysis_lease_expires_at = NULL, updated_at = now()
      WHERE id = $1 AND restaurant_id = $2
        AND (status = 'pending' OR (status = 'failed' AND analysis_attempt_count < 3))
      RETURNING id`, [id, staff.restaurantId]);
    if (!result.rows[0]) return jsonError(request, 'INVALID_REQUEST', 'La importación no puede reintentarse.', 409);
    const dispatched = await dispatchMenuImportAnalysis(id);
    if (!dispatched.accepted) return jsonError(request, 'IMPORT_UPLOAD_INCOMPLETE', 'El PDF para análisis no es válido.', 422);
    return jsonSuccess(request, { queued: dispatched.claimed, id, ...(!dispatched.claimed ? { reason: dispatched.reason } : {}) });
  } catch (error) {
    logger.error('menu_import.retry_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo reintentar la importación.', 500);
  }
}
