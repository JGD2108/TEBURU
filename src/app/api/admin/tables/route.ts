import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const [tables, settings] = await Promise.all([
    query('SELECT * FROM tables ORDER BY table_number'),
    query('SELECT logo_url, primary_color FROM restaurant_settings ORDER BY updated_at DESC LIMIT 1'),
  ]);
  return NextResponse.json({ tables: tables.rows, settings: settings.rows[0] ?? null });
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const tableNumber = Number((await request.json()).table_number);
  if (!Number.isInteger(tableNumber) || tableNumber < 1) return NextResponse.json({ error: 'Número de mesa inválido' }, { status: 400 });
  try {
    const { rows } = await query(`INSERT INTO tables (table_number, status) VALUES ($1, 'available') RETURNING *`, [tableNumber]);
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Esta mesa ya existe' }, { status: 409 });
    throw error;
  }
}

export async function DELETE(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta la mesa' }, { status: 400 });
  const result = await query(`DELETE FROM tables WHERE id = $1 AND status = 'available' AND current_session_id IS NULL`, [id]);
  return result.rowCount
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Solo se puede eliminar una mesa disponible' }, { status: 409 });
}
