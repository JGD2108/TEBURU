import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_TEST_DATA_RESET !== 'true') {
    return new NextResponse(null, { status: 404 });
  }
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    client = await getPoolClient();
    await client.query('BEGIN');
    await client.query('DELETE FROM order_items;');
    await client.query('DELETE FROM orders;');
    await client.query('DELETE FROM session_users;');
    await client.query('DELETE FROM sessions;');
    await client.query(`
      UPDATE tables
      SET status = 'available', current_session_id = NULL,
          assigned_waiter_id = NULL, needs_attention = false;
    `);
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Datos de prueba eliminados.' });
  } catch (error: unknown) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('API reset error:', error);
    return NextResponse.json({ error: 'No se pudieron limpiar los datos de prueba' }, { status: 500 });
  } finally {
    client?.release();
  }
}
