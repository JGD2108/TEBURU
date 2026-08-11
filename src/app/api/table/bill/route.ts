import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';

export async function GET(request: Request) {
  const guest = await requireGuestSession(request);
  if (isGuestFailure(guest)) return guest;
  const { rows } = await query<{ id: string; name: string; own_total: number }>(
    `SELECT su.id, su.name, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float8 AS own_total
     FROM session_users su LEFT JOIN orders o ON o.user_id = su.id AND o.status <> 'cancelled'
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE su.session_id = $1 GROUP BY su.id, su.name ORDER BY su.joined_at`, [guest.sessionId]
  );
  const total = rows.reduce((sum, guestRow) => sum + Number(guestRow.own_total), 0);
  return NextResponse.json({ data: { guests: rows, total } });
}
