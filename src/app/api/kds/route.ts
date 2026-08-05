import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  try {
    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    // Obtener órdenes que están pending o cooking
    const { rows } = await client.query(`
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
      WHERE o.status IN ('pending', 'cooking')
      ORDER BY o.created_at ASC;
    `);

    await client.end();

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("KDS API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
