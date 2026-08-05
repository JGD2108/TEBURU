import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';

export async function POST(request: Request) {
  let client;
  try {
    const { session_id, session_user_id, items } = await request.json();
    
    if (!session_id || !session_user_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan parámetros o el carrito está vacío' }, { status: 400 });
    }

    client = await getPoolClient();
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

    return NextResponse.json({ success: true, order_id: orderId });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error("Create Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
