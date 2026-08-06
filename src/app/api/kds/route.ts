import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT 
        o.id as order_id,
        o.status,
        o.created_at,
        t.table_number,
        su.name as customer_name,
        (
          SELECT json_agg(json_build_object(
            'quantity', oi.quantity,
            'menu_item', mi.name,
            'notes', oi.notes
          ))
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          WHERE oi.order_id = o.id
        ) as items
      FROM orders o
      JOIN sessions s ON o.session_id = s.id
      JOIN tables t ON s.table_id = t.id
      JOIN session_users su ON o.user_id = su.id
      WHERE o.status IN ('pending', 'preparing')
      ORDER BY o.created_at ASC;
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("KDS API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
