import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query(
    `SELECT bs.id, bs.status, bs.mode, bs.total, bs.created_at, t.table_number,
      json_agg(json_build_object('name', su.name, 'amount', bsp.amount) ORDER BY su.joined_at) AS participants
     FROM bill_splits bs JOIN sessions s ON s.id = bs.session_id JOIN tables t ON t.id = s.table_id
     JOIN bill_split_participants bsp ON bsp.bill_split_id = bs.id JOIN session_users su ON su.id = bsp.session_user_id
     WHERE bs.restaurant_id = $1 AND bs.status IN ('requested', 'acknowledged')
       AND ($2::text = 'admin' OR s.waiter_id = $3)
     GROUP BY bs.id, t.table_number ORDER BY bs.created_at DESC`, [staff.restaurantId, staff.role, staff.userId]
  );
  return NextResponse.json({ data: rows });
}

export async function PATCH(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  const { id, status } = await request.json();
  if (typeof id !== 'string' || !['acknowledged', 'completed', 'cancelled'].includes(status)) return NextResponse.json({ error: 'Actualización inválida' }, { status: 400 });
  const result = await query(
    `UPDATE bill_splits bs SET status = $1, updated_at = now() FROM sessions s
     WHERE bs.id = $2 AND bs.restaurant_id = $3 AND s.id = bs.session_id
       AND ($4::text = 'admin' OR s.waiter_id = $5) RETURNING bs.id`, [status, id, staff.restaurantId, staff.role, staff.userId]
  );
  return result.rowCount ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
}
