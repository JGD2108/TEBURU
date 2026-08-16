import { query } from '@/lib/db';
import { jsonSuccess } from '@/lib/api-response';
import { PDF_MENU_MAX_BYTES } from '@/lib/menu-import';
import { menuImportStorage } from '@/lib/menu-import-storage';

export async function GET(request: Request) {
  const tableId = new URL(request.url).searchParams.get('table_id');
  const importReady = Boolean(menuImportStorage());
  if (!tableId) return jsonSuccess(request, null, {}, {
    importReadiness: importReady
      ? { available: true, maxPdfBytes: PDF_MENU_MAX_BYTES }
      : { available: false, code: 'IMPORT_STORAGE_UNAVAILABLE', message: 'La importación de menús está temporalmente no disponible.', maxPdfBytes: PDF_MENU_MAX_BYTES },
  });
  const { rows } = await query(
    `SELECT rs.name, rs.logo_url, rs.primary_color FROM restaurant_settings rs
     JOIN tables t ON t.restaurant_id = rs.restaurant_id
     JOIN restaurants r ON r.id = rs.restaurant_id WHERE t.id = $1 AND r.status = 'active'`, [tableId]
  );
  return jsonSuccess(request, rows[0] ?? null, {}, {
    importReadiness: importReady
      ? { available: true, maxPdfBytes: PDF_MENU_MAX_BYTES }
      : { available: false, code: 'IMPORT_STORAGE_UNAVAILABLE', message: 'La importación de menús está temporalmente no disponible.', maxPdfBytes: PDF_MENU_MAX_BYTES },
  });
}
