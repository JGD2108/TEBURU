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
    const rawPrice = body.raw_price === null ? null : typeof body.raw_price === 'string' ? body.raw_price.trim() || null : undefined;
    const currency = body.price_currency === null ? null : typeof body.price_currency === 'string' ? body.price_currency.trim().toUpperCase() || null : undefined;
    const sharedPriceProvenance = body.shared_price_provenance === null ? null : typeof body.shared_price_provenance === 'string' ? body.shared_price_provenance.trim() || null : undefined;
    const variants = Array.isArray(body.price_variants) ? body.price_variants.filter((variant): variant is Record<string, unknown> => Boolean(variant) && typeof variant === 'object' && !Array.isArray(variant)) : undefined;
    const approved = typeof body.approved === 'boolean' ? body.approved : undefined;
    if ((name !== undefined && !name) || (price !== undefined && (!Number.isFinite(price) || (price !== null && price < 0)))) return jsonError(request, 'INVALID_REQUEST', 'Datos de borrador inválidos.', 400);
    const { rows } = await query(`UPDATE menu_import_draft_items i SET name = COALESCE($1, i.name), description = COALESCE($2, i.description), price = COALESCE($3, i.price), raw_price = COALESCE($4, i.raw_price), normalized_currency = COALESCE($5, i.normalized_currency), shared_price_provenance = COALESCE($6, i.shared_price_provenance), draft_category_id = COALESCE($7, i.draft_category_id), review_status = CASE WHEN $8::boolean THEN 'approved' ELSE i.review_status END, updated_at = now() WHERE i.id = $9 AND i.import_job_id = $10 AND i.restaurant_id = $11 AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM menu_import_draft_categories c WHERE c.id = $7 AND c.import_job_id = $10 AND c.restaurant_id = $11)) RETURNING *`, [name ?? null, description ?? null, price ?? null, rawPrice ?? null, currency ?? null, sharedPriceProvenance ?? null, categoryId ?? null, approved ?? false, itemId, id, staff.restaurantId]);
    if (rows[0] && variants) {
      await query('DELETE FROM menu_import_draft_price_variants WHERE draft_item_id = $1 AND import_job_id = $2 AND restaurant_id = $3', [itemId, id, staff.restaurantId]);
      for (const [sortOrder, variant] of variants.entries()) {
        const amount = variant.amount === null || variant.amount === undefined || variant.amount === '' ? null : Number(variant.amount);
        if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return jsonError(request, 'INVALID_REQUEST', 'Datos de precio inválidos.', 400);
        await query(`INSERT INTO menu_import_draft_price_variants (import_job_id, restaurant_id, draft_item_id, label, raw_price, normalized_amount, normalized_currency, sort_order, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, staff.restaurantId, itemId, typeof variant.label === 'string' ? variant.label.trim() || null : null, typeof variant.raw === 'string' ? variant.raw.trim() : '', amount, typeof variant.currency === 'string' ? variant.currency.trim().toUpperCase() || null : null, sortOrder, `${id}|${itemId}|${sortOrder}`]);
      }
    }
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
