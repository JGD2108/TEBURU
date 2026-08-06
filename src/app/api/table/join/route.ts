import { NextResponse } from 'next/server';
import { getPoolClient, query } from '@/lib/db';
import { newGuestToken, setGuestCookie } from '@/lib/guest-session';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let client;
  try {
    const { table_id: tableId, code, name } = await request.json();
    if (!uuid.test(tableId) || typeof code !== 'string' || !/^\d{4}$/.test(code) || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Datos de acceso inválidos' }, { status: 400 });
    }
    const tableResult = await query<{ id: string; access_code: string | null; current_session_id: string | null; assigned_waiter_id: string | null }>(
      'SELECT id, access_code, current_session_id, assigned_waiter_id FROM tables WHERE id = $1', [tableId]
    );
    const table = tableResult.rows[0];
    if (!table) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    if (table.access_code !== code) return NextResponse.json({ error: 'PIN incorrecto o la mesa no está habilitada' }, { status: 403 });

    client = await getPoolClient();
    await client.query('BEGIN');
    let sessionId = table.current_session_id;
    if (!sessionId) {
      const created = await client.query(
        `INSERT INTO sessions (table_id, status, code, waiter_id) VALUES ($1, 'active', $2, $3) RETURNING id`,
        [tableId, code, table.assigned_waiter_id]
      );
      sessionId = created.rows[0].id;
      await client.query(`UPDATE tables SET status = 'occupied', current_session_id = $1 WHERE id = $2`, [sessionId, tableId]);
    }
    const guest = await client.query(`INSERT INTO session_users (session_id, name) VALUES ($1, $2) RETURNING id`, [sessionId, name.trim().slice(0, 100)]);
    const accessToken = newGuestToken();
    await client.query(
      `INSERT INTO guest_access_tokens (session_id, session_user_id, token_hash, expires_at)
       VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'), now() + interval '12 hours')`,
      [sessionId, guest.rows[0].id, accessToken]
    );
    await client.query('COMMIT');
    const response = NextResponse.json({ success: true });
    setGuestCookie(response, accessToken);
    return response;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Table join error:', error);
    return NextResponse.json({ error: 'No se pudo abrir la sesión de mesa' }, { status: 500 });
  } finally {
    client?.release();
  }
}
