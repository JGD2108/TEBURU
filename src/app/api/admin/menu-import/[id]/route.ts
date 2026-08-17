import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request, context: RouteContext<'/api/admin/menu-import/[id]'>) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id } = await context.params;
    const imported = await query(`SELECT id, status, source_filename, source_size_bytes, failure_reason, source_sha256, analyzer_version, analysis_execution_id, analysis_attempt_count, analysis_lease_expires_at, created_at, updated_at, published_at FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]);
    if (!imported.rows[0]) return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Importación no encontrada.', 404);
    const [categories, items, evidence, images] = await Promise.all([
      query(`SELECT * FROM menu_import_draft_categories WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY sort_order, name`, [id, staff.restaurantId]),
      query(`SELECT * FROM menu_import_draft_items WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY created_at`, [id, staff.restaurantId]),
      query(`SELECT e.* FROM menu_import_source_evidence e JOIN menu_import_draft_items i ON i.id = e.draft_item_id WHERE e.import_job_id = $1 AND i.restaurant_id = $2`, [id, staff.restaurantId]),
      query(`SELECT * FROM menu_import_image_suggestions WHERE import_job_id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]),
    ]);
    const lineage = await query(`SELECT analysis_execution_id, attempt, status, source_sha256, analyzer_version, started_at, completed_at, error_code
      FROM menu_import_analysis_runs WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY attempt DESC`, [id, staff.restaurantId]);
    const draft = { categories: categories.rows, items: items.rows, evidence: evidence.rows, imageSuggestions: images.rows };
    return jsonSuccess(request, { import: imported.rows[0], draft, lineage: lineage.rows }, {}, { import: imported.rows[0], draft, lineage: lineage.rows });
  } catch (error) { logger.error('menu_import.get_failed', error); return jsonError(request, 'INTERNAL_ERROR', 'No se pudo cargar la importación.', 500); }
}
