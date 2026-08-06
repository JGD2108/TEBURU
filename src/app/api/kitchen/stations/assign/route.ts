import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    const { menu_item_id, station_ids } = await request.json();
    if (typeof menu_item_id !== 'string' || !Array.isArray(station_ids) ||
        station_ids.some((id) => typeof id !== 'string') || new Set(station_ids).size !== station_ids.length) {
      return NextResponse.json({ error: 'Asignación inválida' }, { status: 400 });
    }

    client = await getPoolClient();
    await client.query('BEGIN');
    await client.query('DELETE FROM menu_item_stations WHERE menu_item_id = $1', [menu_item_id]);
    if (station_ids.length) {
      await client.query(
        `INSERT INTO menu_item_stations (menu_item_id, station_id)
         SELECT $1, unnest($2::uuid[])`,
        [menu_item_id, station_ids]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Station assignment error:', error);
    return NextResponse.json({ error: 'No se pudo guardar la asignación' }, { status: 500 });
  } finally {
    client?.release();
  }
}
