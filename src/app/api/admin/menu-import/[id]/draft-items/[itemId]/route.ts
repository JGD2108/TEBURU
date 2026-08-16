import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess, readJsonObject } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function PATCH(request: Request, context: RouteContext<'/api/admin/menu-import/[id]/draft-items/[itemId]'>) {
  try {
    const staff = await requireRole(request, 'admin'); if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id, itemId } = await context.params; const body = await readJsonObject(request);
    if (!body) return jsonError(request, 'INVALID_REQUEST', 'Datos de borrador inválidos.', 400);
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const description = typeof body.description === 'string' ? body.description.trim() || null : undefined;
    const price = body.price === null ? null : body.price === undefined ? undefined : Number(body.price);
    const categoryId = typeof body.category_id === 'string' ? body.category_id : undefined;
    const approved = typeof body.approved === 'boolean' ? body.approved : undefined;
    if ((name !== undefined && !name) || (price !== undefined && (!Number.isFinite(price) || (price !== null && price < 0)))) return jsonError(request, 'INVALID_REQUEST', 'Datos de borrador inválidos.', 400);
    const { rows } = await query(`UPDATE menu_import_draft_items i SET name = COALESCE($1, i.name), description = COALESCE($2, i.description), price = COALESCE($3, i.price), draft_category_id = COALESCE($4, i.draft_category_id), review_status = CASE WHEN $5::boolean THEN 'approved' ELSE i.review_status END, updated_at = now() WHERE i.id = $6 AND i.import_job_id = $7 AND i.restaurant_id = $8 AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM menu_import_draft_categories c WHERE c.id = $4 AND c.import_job_id = $7 AND c.restaurant_id = $8)) RETURNING *`, [name ?? null, description ?? null, price ?? null, categoryId ?? null, approved ?? false, itemId, id, staff.restaurantId]);
    return rows[0] ? jsonSuccess(request, { item: rows[0] }, {}, { item: rows[0] }) : jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Borrador no encontrado.', 404);
  } catch (error) { logger.error('menu_import.draft_update_failed', error); return jsonError(request, 'INTERNAL_ERROR', 'No se pudo actualizar el borrador.', 500); }
}
export async function DELETE(request: Request, context: RouteContext<'/api/admin/menu-import/[id]/draft-items/[itemId]'>) {
  try {
    const staff = await requireRole(request, 'admin'); if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id, itemId } = await context.params;
    const result = await query(`UPDATE menu_import_draft_items SET review_status = 'excluded', updated_at = now() WHERE id = $1 AND import_job_id = $2 AND restaurant_id = $3 AND review_status <> 'published'`, [itemId, id, staff.restaurantId]);
    return result.rowCount ? jsonSuccess(request, { success: true }, {}, { success: true }) : jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Borrador no encontrado.', 404);
  } catch (error) { logger.error('menu_import.draft_delete_failed', error); return jsonError(request, 'INTERNAL_ERROR', 'No se pudo quitar el borrador.', 500); }
}
