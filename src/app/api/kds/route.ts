import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin', 'kitchen');
  if (isAuthorizationFailure(staff)) return staff;

  const station = new URL(request.url).searchParams.get('station');
  const params: unknown[] = [staff.restaurantId];
  let stationFilter = '';
  if (station === 'unassigned') {
    stationFilter = `AND NOT EXISTS (
      SELECT 1 FROM order_item_stations assignment WHERE assignment.order_item_id = oi.id
    )`;
  } else if (station) {
    if (!uuidPattern.test(station)) return NextResponse.json({ error: 'Estación inválida' }, { status: 400 });
    params.push(station);
    stationFilter = `AND EXISTS (
      SELECT 1 FROM order_item_stations assignment
      WHERE assignment.order_item_id = oi.id AND assignment.station_id = $2
    )`;
  }

  try {
    const { rows } = await query(
      `SELECT oi.id AS item_id, oi.order_id, oi.quantity, oi.notes,
              oi.kitchen_status AS status, oi.priority, oi.version,
              oi.started_at, oi.ready_at, o.created_at,
              t.table_number, su.name AS customer_name, mi.name AS menu_item,
              COALESCE(
                json_agg(json_build_object(
                  'id', ois.station_id,
                  'name', ois.station_name,
                  'color', ois.station_color,
                  'warning_minutes', ois.warning_minutes,
                  'critical_minutes', ois.critical_minutes
                )
                  ORDER BY ois.station_name) FILTER (WHERE ois.station_id IS NOT NULL),
                '[]'::json
              ) AS stations
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN sessions s ON s.id = o.session_id
       JOIN tables t ON t.id = s.table_id
       JOIN session_users su ON su.id = o.user_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN order_item_stations ois ON ois.order_item_id = oi.id
       WHERE oi.kitchen_status IN ('pending', 'preparing', 'ready')
         AND o.status NOT IN ('delivered', 'cancelled')
         AND oi.restaurant_id = $1 AND o.restaurant_id = $1
         ${stationFilter}
       GROUP BY oi.id, o.id, t.table_number, su.name, mi.name
       ORDER BY CASE oi.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                o.created_at, oi.id`,
      params
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('KDS API error:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los platillos' }, { status: 500 });
  }
}
