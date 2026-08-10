import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const [tables, settings, waiters] = await Promise.all([
    query('SELECT * FROM tables ORDER BY table_number'),
    query('SELECT logo_url, primary_color FROM restaurant_settings ORDER BY updated_at DESC LIMIT 1'),
    query(`SELECT user_id, name, email FROM staff WHERE role = 'waiter' ORDER BY name NULLS LAST, email`),
  ]);
  return NextResponse.json({ tables: tables.rows, settings: settings.rows[0] ?? null, waiters: waiters.rows });
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { table_number: rawTableNumber, capacity: rawCapacity } = await request.json();
  const tableNumber = Number(rawTableNumber);
  const capacity = Number(rawCapacity);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return NextResponse.json({ error: 'Número y capacidad de mesa inválidos' }, { status: 400 });
  }
  try {
    const { rows } = await query(
      `INSERT INTO tables (table_number, capacity, status) VALUES ($1, $2, 'available') RETURNING *`,
      [tableNumber, capacity]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Esta mesa ya existe' }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { id, assigned_waiter_id: waiterId } = await request.json();
  if (typeof id !== 'string' || (waiterId !== null && typeof waiterId !== 'string')) {
    return NextResponse.json({ error: 'Datos de asignación inválidos' }, { status: 400 });
  }
  if (waiterId) {
    const waiter = await query(`SELECT 1 FROM staff WHERE user_id = $1 AND role = 'waiter'`, [waiterId]);
    if (!waiter.rowCount) return NextResponse.json({ error: 'Mesero no encontrado' }, { status: 404 });
  }
  const updated = await query(
    `WITH target AS (
       SELECT current_session_id FROM tables WHERE id = $2
     ), transferred_session AS (
       UPDATE sessions SET waiter_id = $1
       WHERE id = (SELECT current_session_id FROM target)
       RETURNING id
     )
     UPDATE tables SET assigned_waiter_id = $1
     WHERE id = $2 OR current_session_id = (SELECT id FROM transferred_session)
     RETURNING *`,
    [waiterId, id]
  );
  return updated.rowCount
    ? NextResponse.json({ data: updated.rows[0] })
    : NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
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
