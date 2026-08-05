import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  try {
    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    // Query para obtener todas las mesas con su sesión activa y pedidos
    const { rows } = await client.query(`
      SELECT 
        t.id, t.table_number, t.status, t.access_code, t.needs_attention, t.current_session_id,
        (
          SELECT json_agg(json_build_object(
            'order_id', o.id,
            'status', o.status,
            'customer_name', su.name,
            'items', (
              SELECT json_agg(json_build_object(
                'quantity', oi.quantity,
                'menu_item', mi.name
              ))
              FROM order_items oi
              JOIN menu_items mi ON oi.menu_item_id = mi.id
              WHERE oi.order_id = o.id
            )
          ))
          FROM orders o
          JOIN session_users su ON o.user_id = su.id
          WHERE o.session_id = t.current_session_id
        ) as active_orders
      FROM tables t
      ORDER BY t.table_number ASC;
    `);

    await client.end();

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Salon API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
