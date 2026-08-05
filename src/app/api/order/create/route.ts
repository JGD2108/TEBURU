import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { session_id, session_user_id, items } = await request.json();
    
    if (!session_id || !session_user_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan parámetros o el carrito está vacío' }, { status: 400 });
    }

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();
    await client.query('BEGIN');

    // 1. Crear el pedido principal
    const orderRes = await client.query(`
      INSERT INTO orders (session_id, user_id, status) 
      VALUES ($1, $2, 'pending') 
      RETURNING id
    `, [session_id, session_user_id]);
    
    const orderId = orderRes.rows[0].id;

    // 2. Insertar los items
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, notes, unit_price) 
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, item.menu_item_id, item.qty, item.notes || '', item.price]);
    }

    await client.query('COMMIT');
    await client.end();

    return NextResponse.json({ success: true, order_id: orderId });

  } catch (error: any) {
    console.error("Create Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
