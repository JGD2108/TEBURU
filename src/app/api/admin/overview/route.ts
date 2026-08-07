import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const [tables, waiters, orders] = await Promise.all([
    query(`SELECT t.*, CASE WHEN s.user_id IS NULL THEN NULL ELSE json_build_object('name', s.name) END AS assigned_waiter
      FROM tables t LEFT JOIN staff s ON s.user_id = t.assigned_waiter_id ORDER BY t.table_number`),
    query(`SELECT user_id, name FROM staff WHERE role = 'waiter' ORDER BY name`),
    query(`SELECT o.id, o.status, o.created_at,
      json_build_object('tables', json_build_object('table_number', t.table_number)) AS session,
      COALESCE(json_agg(json_build_object('quantity', oi.quantity, 'menu_items', json_build_object('name', mi.name)))
        FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o JOIN sessions se ON se.id = o.session_id JOIN tables t ON t.id = se.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.status IN ('pending', 'preparing') GROUP BY o.id, t.table_number ORDER BY o.created_at DESC`),
  ]);
  return NextResponse.json({ tables: tables.rows, waiters: waiters.rows, orders: orders.rows });
}

export async function PATCH(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const body = await request.json();
  if (typeof body.table_id !== 'string') return NextResponse.json({ error: 'Mesa inválida' }, { status: 400 });

  if (Object.hasOwn(body, 'assigned_waiter_id')) {
    const waiterId = body.assigned_waiter_id || null;
    if (waiterId) {
      const waiter = await query(`SELECT 1 FROM staff WHERE user_id = $1 AND role = 'waiter'`, [waiterId]);
      if (!waiter.rowCount) return NextResponse.json({ error: 'Mesero inválido' }, { status: 400 });
    }
    await query('UPDATE tables SET assigned_waiter_id = $1 WHERE id = $2', [waiterId, body.table_id]);
  } else if (typeof body.needs_attention === 'boolean') {
    await query('UPDATE tables SET needs_attention = $1 WHERE id = $2', [body.needs_attention, body.table_id]);
  } else return NextResponse.json({ error: 'Cambio inválido' }, { status: 400 });
  return NextResponse.json({ success: true });
}
