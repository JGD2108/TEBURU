import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  let client;
  try {
    const { table_id: tableId } = await request.json();
    if (typeof tableId !== 'string') return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    client = await getPoolClient();
    await client.query('BEGIN');
    const session = await client.query<{ id: string }>(
      `SELECT s.id
       FROM tables t JOIN sessions s ON s.id = t.current_session_id
       WHERE t.id = $1 AND s.status = 'active'
         AND ($2::text = 'admin' OR s.waiter_id = $3)
       FOR UPDATE`,
      [tableId, staff.role, staff.userId]
    );
    const sessionId = session.rows[0]?.id;
    if (!sessionId) throw new Error('FORBIDDEN_TABLE');
    await client.query(`UPDATE sessions SET status = 'closed', ended_at = now() WHERE id = $1`, [sessionId]);
    await client.query(`UPDATE guest_access_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL`, [sessionId]);
    await client.query(
      `UPDATE tables SET status = 'available', current_session_id = NULL, access_code = NULL, needs_attention = false
       WHERE current_session_id = $1`,
      [sessionId]
    );
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Checkout API error:', error);
    const forbidden = error instanceof Error && error.message === 'FORBIDDEN_TABLE';
    return NextResponse.json({ error: forbidden ? 'Mesa no encontrada o no asignada' : 'No se pudo cerrar la mesa' }, { status: forbidden ? 403 : 500 });
  } finally {
    client?.release();
  }
}
