import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { activateTables, normalizeTableIds, TableActivationError } from '@/lib/table-activation';

const messages = {
  INVALID_TABLES: 'Selecciona entre una y veinte mesas vÃ¡lidas.',
  FORBIDDEN_TABLE: 'Solo puedes activar mesas asignadas a ti.',
  TABLE_UNAVAILABLE: 'Todas las mesas deben estar disponibles antes de activarlas.',
  MIXED_WAITERS: 'Para combinar mesas, todas deben estar asignadas al mismo mesero.',
  CODE_GENERATION_FAILED: 'No se pudo generar un PIN Ãºnico. Intenta nuevamente.',
};

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'waiter');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    const { table_ids: tableIds } = await request.json();
    const ids = normalizeTableIds(tableIds);
    client = await getPoolClient();
    await client.query('BEGIN');
    const result = await activateTables(client, staff, ids);
    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      pin: result.pin,
      session_id: result.sessionId,
      tables: result.tables.map((table) => ({ id: table.id, table_number: table.table_number })),
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof TableActivationError) {
      const status = error.code === 'FORBIDDEN_TABLE' ? 403 : error.code === 'TABLE_UNAVAILABLE' || error.code === 'MIXED_WAITERS' ? 409 : 400;
      return NextResponse.json({ error: messages[error.code] }, { status });
    }
    console.error('Table activation error:', error);
    return NextResponse.json({ error: 'No se pudo activar la mesa' }, { status: 500 });
  } finally {
    client?.release();
  }
}
