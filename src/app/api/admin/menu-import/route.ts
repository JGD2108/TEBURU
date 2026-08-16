import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { menuImportBucket, ensureMenuImportBucket } from '@/lib/menu-import-storage';
import { validatePdfUpload } from '@/lib/menu-import';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query(`SELECT id, status, source_filename, source_size_bytes, failure_reason, created_at, updated_at, published_at
    FROM menu_import_jobs WHERE restaurant_id = $1 ORDER BY created_at DESC`, [staff.restaurantId]);
  return NextResponse.json({ imports: rows });
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const file = (await request.formData()).get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Selecciona un archivo PDF' }, { status: 400 });
  const invalid = validatePdfUpload(file);
  const content = new Uint8Array(await file.arrayBuffer());
  if (invalid || String.fromCharCode(...content.slice(0, 4)) !== '%PDF') return NextResponse.json({ error: invalid ?? 'El archivo no es un PDF válido' }, { status: 400 });
  try {
    const storage = await ensureMenuImportBucket();
    if (!storage) return NextResponse.json({ error: 'El almacenamiento de importaciones no está configurado' }, { status: 503 });
    const path = `restaurants/${staff.restaurantId}/sources/${randomUUID()}.pdf`;
    const uploaded = await storage.storage.from(menuImportBucket).upload(path, content, { contentType: 'application/pdf', upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { rows } = await query(`INSERT INTO menu_import_jobs (restaurant_id, created_by, source_storage_path, source_filename, source_size_bytes)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, status, source_filename, source_size_bytes, created_at`, [staff.restaurantId, staff.userId, path, file.name.slice(0, 255), file.size]);
    return NextResponse.json({ import: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Menu PDF upload error:', error);
    return NextResponse.json({ error: 'No se pudo guardar el PDF para analizarlo' }, { status: 502 });
  }
}
