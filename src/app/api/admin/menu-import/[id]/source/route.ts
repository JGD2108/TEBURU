import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { jsonAuthorizationError, jsonError, jsonSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

export async function GET(request: Request, context: RouteContext<'/api/admin/menu-import/[id]/source'>) {
  try {
    const staff = await requireRole(request, 'admin');
    if (isAuthorizationFailure(staff)) return jsonAuthorizationError(request, staff.status);
    const { id } = await context.params;
    const { rows } = await query<{ source_storage_path: string }>('SELECT source_storage_path FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
    if (!rows[0]) return jsonError(request, 'IMPORT_UPLOAD_NOT_FOUND', 'Documento no encontrado.', 404);
    const storage = menuImportStorage();
    if (!storage) return jsonError(request, 'IMPORT_STORAGE_UNAVAILABLE', 'El almacenamiento no está configurado.', 503);
    const signed = await storage.storage.from(menuImportBucket).createSignedUrl(rows[0].source_storage_path, 300);
    if (signed.error || !signed.data) return jsonError(request, 'IMPORT_FINALIZATION_FAILED', 'No se pudo abrir el documento.', 502);
    const data = { url: signed.data.signedUrl, expiresIn: 300 };
    return jsonSuccess(request, data, {}, data);
  } catch (error) { logger.error('menu_import.source_failed', error); return jsonError(request, 'INTERNAL_ERROR', 'No se pudo abrir el documento.', 500); }
}
