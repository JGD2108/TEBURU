import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { menuImportBucket, menuImportStorage } from '@/lib/menu-import-storage';

export async function GET(request: Request, context: RouteContext<'/api/admin/menu-import/[id]/source'>) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { id } = await context.params;
  const { rows } = await query<{ source_storage_path: string }>('SELECT source_storage_path FROM menu_import_jobs WHERE id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
  if (!rows[0]) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  const storage = menuImportStorage();
  if (!storage) return NextResponse.json({ error: 'El almacenamiento no está configurado' }, { status: 503 });
  const signed = await storage.storage.from(menuImportBucket).createSignedUrl(rows[0].source_storage_path, 300);
  if (signed.error || !signed.data) return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 502 });
  return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 });
}
