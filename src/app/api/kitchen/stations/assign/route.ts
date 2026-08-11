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
    const menuItem = await client.query('SELECT 1 FROM menu_items WHERE id = $1 AND restaurant_id = $2', [menu_item_id, staff.restaurantId]);
    if (!menuItem.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Platillo no encontrado' }, { status: 404 });
    }
    if (station_ids.length) {
      const stations = await client.query('SELECT id FROM kitchen_stations WHERE id = ANY($1::uuid[]) AND restaurant_id = $2', [station_ids, staff.restaurantId]);
      if (stations.rowCount !== station_ids.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Una estaciÃ³n no pertenece al restaurante' }, { status: 400 });
      }
    }
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
