import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { activateTables, normalizeTableIds, TableActivationError } from '@/lib/table-activation';

// Backwards-compatible single-table activation endpoint.
export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;
  let client;
  try {
    const { table_id: tableId } = await request.json();
    client = await getPoolClient();
    await client.query('BEGIN');
    const result = await activateTables(client, staff, normalizeTableIds([tableId]));
    await client.query('COMMIT');
    return NextResponse.json({ success: true, pin: result.pin, session_id: result.sessionId });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof TableActivationError) {
      const status = error.code === 'FORBIDDEN_TABLE' ? 403 : error.code === 'TABLE_UNAVAILABLE' ? 409 : 400;
      return NextResponse.json({ error: error.code === 'FORBIDDEN_TABLE' ? 'Mesa no asignada' : 'La mesa no está disponible' }, { status });
    }
    console.error('Generate PIN error:', error);
    return NextResponse.json({ error: 'No se pudo activar la mesa' }, { status: 500 });
  } finally {
    client?.release();
  }
}
