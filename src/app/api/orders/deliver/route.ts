import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    const { order_id } = await request.json();
    if (typeof order_id !== 'string') {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }
    client = await getPoolClient();
    await client.query('BEGIN');
    const delivered = await client.query(
      `UPDATE orders o SET status = 'delivered'
       FROM sessions s
       WHERE o.id = $1 AND o.status = 'ready' AND s.id = o.session_id
         AND ($2::text = 'admin' OR s.waiter_id = $3)
       RETURNING o.id`,
      [order_id, staff.role, staff.userId]
    );
    if (!delivered.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'El pedido no está listo o ya fue entregado' }, { status: 409 });
    }
    await client.query(
      `UPDATE order_items SET delivered_at = now()
       WHERE order_id = $1 AND kitchen_status = 'ready'`,
      [order_id]
    );
    await client.query(
      `INSERT INTO order_events (order_id, actor_staff_id, event_type, from_status, to_status)
       VALUES ($1, $2, 'order_delivered', 'ready', 'delivered')`,
      [order_id, staff.userId]
    );
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Order delivery error:', error);
    return NextResponse.json({ error: 'No se pudo confirmar la entrega' }, { status: 500 });
  } finally {
    client?.release();
  }
}
