import { NextResponse } from 'next/server';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const guest = await requireGuestSession(request);
  if (isGuestFailure(guest)) return guest;

  const { rows } = await query(
    `SELECT su.name AS "user", mi.name AS item, oi.quantity AS qty,
            oi.unit_price::float8 AS price, o.status, oi.kitchen_status AS item_status, oi.notes
     FROM orders o
     JOIN session_users su ON su.id = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.session_id = $1
     ORDER BY o.created_at ASC, oi.id ASC`,
    [guest.sessionId]
  );
  return NextResponse.json({ data: rows });
}
