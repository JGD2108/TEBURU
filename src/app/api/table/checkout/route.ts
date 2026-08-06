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
    const ownership = await client.query(
      `SELECT id FROM tables WHERE id = $1 AND ($2::text = 'admin' OR assigned_waiter_id = $3)`,
      [tableId, staff.role, staff.userId]
    );
    if (!ownership.rows[0]) throw new Error('FORBIDDEN_TABLE');
    await client.query(`UPDATE sessions SET status = 'closed', ended_at = now() WHERE table_id = $1 AND status = 'active'`, [tableId]);
    await client.query(`UPDATE guest_access_tokens gat SET revoked_at = now() FROM sessions s WHERE gat.session_id = s.id AND s.table_id = $1 AND gat.revoked_at IS NULL`, [tableId]);
    await client.query(`UPDATE tables SET status = 'available', current_session_id = NULL, access_code = NULL, needs_attention = false WHERE id = $1`, [tableId]);
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Checkout API error:', error);
    return NextResponse.json({ error: error instanceof Error && error.message === 'FORBIDDEN_TABLE' ? 'Mesa no encontrada o no asignada' : 'No se pudo cerrar la mesa' }, { status: error instanceof Error && error.message === 'FORBIDDEN_TABLE' ? 403 : 500 });
  } finally {
    client?.release();
  }
}
