import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { getPoolClient, query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

export async function GET(request: Request, context: RouteContext<'/api/admin/menu-import/[id]'>) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id } = await context.params;
    const imported = await query(`SELECT id, status, source_filename, source_size_bytes, failure_reason, source_sha256, analyzer_version, analysis_execution_id, analysis_attempt_count, analysis_lease_expires_at, created_at, updated_at, published_at FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]);
    if (!imported.rows[0]) return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Importación no encontrada.', 404);
    const [categories, items, evidence, images, priceVariants, metadata] = await Promise.all([
      query(`SELECT * FROM menu_import_draft_categories WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY sort_order, name`, [id, staff.restaurantId]),
      query(`SELECT * FROM menu_import_draft_items WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY created_at`, [id, staff.restaurantId]),
      query(`SELECT e.* FROM menu_import_source_evidence e JOIN menu_import_draft_items i ON i.id = e.draft_item_id WHERE e.import_job_id = $1 AND i.restaurant_id = $2`, [id, staff.restaurantId]),
      query(`SELECT * FROM menu_import_image_suggestions WHERE import_job_id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]),
      query(`SELECT v.* FROM menu_import_draft_price_variants v WHERE v.import_job_id = $1 AND v.restaurant_id = $2 ORDER BY v.draft_item_id, v.sort_order`, [id, staff.restaurantId]),
      query(`SELECT * FROM menu_import_document_metadata WHERE import_job_id = $1 AND restaurant_id = $2`, [id, staff.restaurantId]),
    ]);
    const lineage = await query(`SELECT analysis_execution_id, attempt, status, source_sha256, analyzer_version,
      structure_provider, structure_model, structure_fallback_reason, prompt_version, page_count, provider_call_count,
      retry_count, duration_ms, input_tokens, output_tokens, suspicious_pages, extracted_item_count, review_item_count,
      fallback_reasons, started_at, completed_at, error_code
      FROM menu_import_analysis_runs WHERE import_job_id = $1 AND restaurant_id = $2 ORDER BY attempt DESC`, [id, staff.restaurantId]);
    // Deliberately return nullable draft fields and raw evidence: review must not
    // manufacture a category, currency, or zero price for an incomplete item.
    const draft = { categories: categories.rows, items: items.rows, evidence: evidence.rows, priceVariants: priceVariants.rows, metadata: metadata.rows[0] ?? null, imageSuggestions: images.rows };
    return jsonSuccess(request, { import: imported.rows[0], draft, lineage: lineage.rows }, {}, { import: imported.rows[0], draft, lineage: lineage.rows });
  } catch (error) { logger.error('menu_import.get_failed', error); return jsonError(request, 'INTERNAL_ERROR', 'No se pudo cargar la importación.', 500); }
}

export async function DELETE(request: Request, context: RouteContext<'/api/admin/menu-import/[id]'>) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
  const { id } = await context.params;
  const client = await getPoolClient();
  let paths: string[] = [];
  try {
    await client.query('BEGIN');
    const locked = await client.query<{ status: string; source_storage_path: string }>(
      'SELECT status, source_storage_path FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [id, staff.restaurantId]);
    const job = locked.rows[0];
    if (!job) { await client.query('ROLLBACK'); return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Importación no encontrada.', 404); }
    if (job.status === 'processing' || job.status === 'published') {
      await client.query('ROLLBACK');
      return jsonError(request, 'INVALID_REQUEST', 'La importación no puede eliminarse en su estado actual.', 409);
    }
    const suggestions = await client.query<{ storage_path: string }>(
      'SELECT storage_path FROM menu_import_image_suggestions WHERE import_job_id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
    const prefix = `restaurants/${staff.restaurantId}/`;
    paths = [job.source_storage_path, ...suggestions.rows.map(({ storage_path }) => storage_path)].filter((path) => path.startsWith(prefix));
    await client.query('DELETE FROM menu_import_upload_authorizations WHERE import_job_id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
    const deleted = await client.query('DELETE FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
    if (!deleted.rowCount) throw new Error('Menu import disappeared while deleting');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('menu_import.delete_failed', error, { importId: id, restaurantId: staff.restaurantId });
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudo eliminar la importación.', 500);
  } finally { client.release(); }

  // The committed database deletion is authoritative; private object cleanup is best effort.
  const storage = menuImportStorage();
  if (storage && paths.length) {
    const removal = await storage.storage.from(menuImportBucket).remove([...new Set(paths)]);
    if (removal.error) logger.warn('menu_import.delete_storage_cleanup_failed', { importId: id, restaurantId: staff.restaurantId, pathCount: paths.length });
  }
  return jsonSuccess(request, { deleted: true, id });
}
