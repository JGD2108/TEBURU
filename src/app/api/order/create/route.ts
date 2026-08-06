import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';

export async function POST(request: Request) {
  let client;
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      return NextResponse.json({ error: 'El carrito no es válido' }, { status: 400 });
    }
    const guest = await requireGuestSession(request);
    if (isGuestFailure(guest)) return guest;

    client = await getPoolClient();
    await client.query('BEGIN');
    const orderRes = await client.query(
      `INSERT INTO orders (session_id, user_id, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [guest.sessionId, guest.guestId]
    );

    for (const item of items) {
      if (typeof item?.menu_item_id !== 'string' || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) {
        throw new Error('INVALID_ITEM');
      }
      const menuItem = await client.query<{ price: string }>(
        'SELECT price FROM menu_items WHERE id = $1 AND is_available = true', [item.menu_item_id]
      );
      if (!menuItem.rows[0]) throw new Error('Un artículo ya no está disponible');
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, notes, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderRes.rows[0].id, item.menu_item_id, item.qty, typeof item.notes === 'string' ? item.notes.slice(0, 500) : '', menuItem.rows[0].price]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ success: true, order_id: orderRes.rows[0].id });
  } catch (error: unknown) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Create order error:', error);
    return NextResponse.json({ error: error instanceof Error && error.message === 'INVALID_ITEM' ? 'Un artículo del pedido no es válido' : 'No se pudo crear el pedido' }, { status: error instanceof Error && error.message === 'INVALID_ITEM' ? 400 : 500 });
  } finally {
    client?.release();
  }
}
