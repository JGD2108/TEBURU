import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
  try {
    const { id } = await context.params;
    const result = await query<{ id: string }>(`UPDATE menu_import_jobs
      SET status = 'pending', failure_reason = NULL, analysis_available_at = now(),
          analysis_lease_expires_at = NULL, updated_at = now()
      WHERE id = $1 AND restaurant_id = $2 AND status = 'failed' AND analysis_attempt_count < 3
      RETURNING id`, [id, staff.restaurantId]);
    if (!result.rows[0]) return jsonError(request, 'INVALID_REQUEST', 'La importación no puede reintentarse.', 409);

    const secret = process.env.MENU_IMPORT_AUTOMATION_SECRET;
    if (!secret) return jsonError(request, 'INTERNAL_ERROR', 'El análisis automático no está configurado.', 503);
    const triggerUrl = new URL('/api/internal/menu-import-analysis', request.url);
    const trigger = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: secret },
      body: JSON.stringify({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id } }),
    });
    if (!trigger.ok) return jsonError(request, 'INTERNAL_ERROR', 'No se pudo iniciar el reintento.', 502);
    return jsonSuccess(request, { queued: true, id });
  } catch (error) {
    logger.error('menu_import.retry_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo reintentar la importación.', 500);
  }
}
