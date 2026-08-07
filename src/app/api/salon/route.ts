import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  try {
    const { rows } = await query(`
      SELECT t.id, t.table_number, t.capacity, t.status, t.access_code, t.needs_attention,
        t.current_session_id, t.assigned_waiter_id,
        ARRAY(SELECT grouped.table_number FROM tables grouped WHERE grouped.current_session_id = t.current_session_id ORDER BY grouped.table_number) AS group_table_numbers,
        (
          SELECT json_agg(json_build_object(
            'order_id', o.id, 'status', o.status, 'customer_name', su.name,
            'items', (
              SELECT json_agg(json_build_object('quantity', oi.quantity, 'menu_item', mi.name))
              FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = o.id
            )
          ))
          FROM orders o JOIN session_users su ON o.user_id = su.id
          WHERE o.session_id = t.current_session_id AND o.status NOT IN ('delivered', 'cancelled')
        ) AS active_orders
      FROM tables t
      WHERE ($1::text = 'admin' OR t.assigned_waiter_id = $2)
      ORDER BY t.table_number ASC;
    `, [staff.role, staff.userId]);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error('Salon API error:', error);
    return NextResponse.json({ error: 'No se pudo cargar el salón' }, { status: 500 });
  }
}
