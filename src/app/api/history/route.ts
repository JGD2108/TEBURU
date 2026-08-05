import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT 
        s.id as session_id,
        t.table_number,
        s.started_at,
        s.ended_at,
        st.name as waiter_name,
        COALESCE(
          (SELECT SUM(oi.quantity * oi.unit_price) 
           FROM orders o 
           JOIN order_items oi ON o.id = oi.order_id 
           WHERE o.session_id = s.id), 0
        ) as total_spent,
        (
          SELECT json_agg(json_build_object(
            'customer_name', su.name,
            'items', (
              SELECT json_agg(json_build_object(
                'quantity', oi.quantity,
                'menu_item', mi.name,
                'price', oi.unit_price
              ))
              FROM order_items oi
              JOIN menu_items mi ON oi.menu_item_id = mi.id
              WHERE oi.order_id = o.id
            )
          ))
          FROM orders o
          JOIN session_users su ON o.user_id = su.id
          WHERE o.session_id = s.id
        ) as orders_detail
      FROM sessions s
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN staff st ON s.waiter_id = st.user_id
      WHERE s.status = 'closed'
      ORDER BY s.ended_at DESC
      LIMIT 100;
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("History API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
