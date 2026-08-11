import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isGuestFailure, requireGuestSession } from '@/lib/guest-session';
import { splitTotal, type BillSplitMode } from '@/lib/bill-split';

export async function POST(request: Request) {
  const guest = await requireGuestSession(request);
  if (isGuestFailure(guest)) return guest;
  let client;
  try {
    const body = await request.json();
    if (!['own_items', 'equal', 'custom'].includes(body.mode)) return NextResponse.json({ error: 'Modo de división inválido' }, { status: 400 });
    client = await getPoolClient();
    await client.query('BEGIN');
    const guests = await client.query<{ id: string; ownTotal: number }>(
      `SELECT su.id, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float8 AS "ownTotal"
       FROM session_users su LEFT JOIN orders o ON o.user_id = su.id AND o.status <> 'cancelled'
       LEFT JOIN order_items oi ON oi.order_id = o.id WHERE su.session_id = $1 GROUP BY su.id`, [guest.sessionId]
    );
    const restaurant = await client.query<{ restaurant_id: string }>('SELECT restaurant_id FROM sessions WHERE id = $1 FOR SHARE', [guest.sessionId]);
    const total = guests.rows.reduce((sum, row) => sum + Number(row.ownTotal), 0);
    const participants = splitTotal(body.mode as BillSplitMode, guests.rows, total, guest.guestId, body.participants);
    const split = await client.query<{ id: string }>(
      `INSERT INTO bill_splits (restaurant_id, session_id, requested_by, mode, total) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [restaurant.rows[0].restaurant_id, guest.sessionId, guest.guestId, body.mode, total]
    );
    for (const participant of participants) await client.query(
      'INSERT INTO bill_split_participants (bill_split_id, session_user_id, amount) VALUES ($1, $2, $3)', [split.rows[0].id, participant.guestId, participant.amount]
    );
    await client.query('COMMIT');
    return NextResponse.json({ data: { id: split.rows[0].id, total, participants } }, { status: 201 });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error && error.message === 'INVALID_SPLIT' ? 'La división no coincide con el total de la mesa' : 'No se pudo solicitar la cuenta' }, { status: 400 });
  } finally { client?.release(); }
}
