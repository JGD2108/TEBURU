import { createHash, randomUUID } from 'node:crypto';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonError, jsonSuccess, readJsonObject, requestId } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { PDF_MENU_MAX_BYTES } from '@/lib/menu-import';
import { ensureMenuImportBucket, menuImportBucket } from '@/lib/menu-import-storage';

const AUTHORIZATION_TTL_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const correlationId = requestId(request);
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return jsonError(request, 'AUTHORIZATION_FAILED', 'No tienes permiso para importar menús.', 403);
  const body = await readJsonObject(request);
  const filename = typeof body?.filename === 'string' ? body.filename.trim().slice(0, 255) : '';
  const size = typeof body?.size === 'number' ? body.size : 0;
  const contentType = body?.contentType;
  if (!filename || !Number.isSafeInteger(size) || size < 1 || size > PDF_MENU_MAX_BYTES || contentType !== 'application/pdf') {
    return jsonError(request, 'IMPORT_UPLOAD_INVALID', 'Selecciona un PDF de entre 1 byte y 20 MB.', 400);
  }
  try {
    const storage = await ensureMenuImportBucket();
    if (!storage) return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'La importación está temporalmente no disponible. Inténtalo más tarde.', 503);
    const id = randomUUID();
    const token = randomUUID();
    const path = `restaurants/${staff.restaurantId}/pending/${id}.pdf`;
    const signed = await storage.storage.from(menuImportBucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw signed.error ?? new Error('Signed upload URL was not created');
    const { rows } = await query<{ expires_at: string }>(`INSERT INTO menu_import_upload_authorizations
      (id, restaurant_id, created_by, storage_path, source_filename, expected_size_bytes, token_hash, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now() + ($8 * interval '1 second')) RETURNING expires_at`,
      [id, staff.restaurantId, staff.userId, path, filename, size, createHash('sha256').update(token).digest('hex'), AUTHORIZATION_TTL_SECONDS]);
    logger.info('menu_import.upload_authorized', { requestId: correlationId, authorizationId: id, restaurantId: staff.restaurantId, size });
    return jsonSuccess(request, { authorization: { id, objectPath: path, uploadUrl: signed.data.signedUrl, token, expiresAt: rows[0].expires_at, maxBytes: PDF_MENU_MAX_BYTES, contentType: 'application/pdf' } }, { status: 201 });
  } catch (error) {
    logger.error('menu_import.upload_authorization_failed', error, { requestId: correlationId, restaurantId: staff.restaurantId });
    return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'No se pudo preparar la carga del PDF. Inténtalo nuevamente.', 503);
  }
}
