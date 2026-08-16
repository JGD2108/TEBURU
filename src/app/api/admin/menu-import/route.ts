import { randomUUID } from 'node:crypto';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validatePdfUpload } from '@/lib/menu-import';
import { ensureMenuImportBucket, menuImportBucket } from '@/lib/menu-import-storage';

export async function GET(request: Request) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { rows } = await query(`SELECT id, status, source_filename, source_size_bytes, failure_reason, created_at, updated_at, published_at
      FROM menu_import_jobs WHERE restaurant_id = $1 ORDER BY created_at DESC`, [staff.restaurantId]);
    return jsonSuccess(request, { imports: rows }, {}, { imports: rows });
  } catch (error) {
    logger.error('menu_import.list_failed', error);
    return jsonError(request, 'INTERNAL_ERROR', 'No se pudieron cargar las importaciones. Inténtalo nuevamente.', 500);
  }
}

/** Legacy small-file path retained during direct-upload rollout. */
export async function POST(request: Request) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    let file: FormDataEntryValue | null;
    try { file = (await request.formData()).get('file'); }
    catch { return jsonError(request, 'IMPORT_UPLOAD_INVALID', 'Selecciona un archivo PDF válido.', 400); }
    if (!(file instanceof File)) return jsonError(request, 'IMPORT_UPLOAD_INVALID', 'Selecciona un archivo PDF.', 400);
    const invalid = validatePdfUpload(file);
    const content = new Uint8Array(await file.arrayBuffer());
    if (invalid || String.fromCharCode(...content.slice(0, 4)) !== '%PDF') return jsonError(request, 'IMPORT_UPLOAD_INVALID', invalid ?? 'El archivo no es un PDF válido.', 400);
    const storage = await ensureMenuImportBucket();
    if (!storage) return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'La importación está temporalmente no disponible.', 503);
    const path = `restaurants/${staff.restaurantId}/sources/${randomUUID()}.pdf`;
    const uploaded = await storage.storage.from(menuImportBucket).upload(path, content, { contentType: 'application/pdf', upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { rows } = await query(`INSERT INTO menu_import_jobs (restaurant_id, created_by, source_storage_path, source_filename, source_size_bytes)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, status, source_filename, source_size_bytes, created_at`, [staff.restaurantId, staff.userId, path, file.name.slice(0, 255), file.size]);
    return jsonSuccess(request, { import: rows[0] }, { status: 201 }, { import: rows[0] });
  } catch (error) {
    logger.error('menu_import.legacy_upload_failed', error);
    return jsonError(request, 'IMPORT_JOB_CREATION_FAILED', 'No se pudo guardar el PDF para analizarlo.', 502);
  }
}
