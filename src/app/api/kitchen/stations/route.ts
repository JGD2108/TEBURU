import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

const colorPattern = /^#[0-9a-f]{6}$/i;

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin', 'kitchen');
  if (isAuthorizationFailure(staff)) return staff;

  try {
    const { rows: stations } = await query(
      `SELECT ks.id, ks.name, ks.color, ks.sort_order, ks.is_active,
              ks.warning_minutes, ks.critical_minutes,
              COUNT(mis.menu_item_id)::int AS item_count
       FROM kitchen_stations ks
       LEFT JOIN menu_item_stations mis ON mis.station_id = ks.id
       WHERE ($1::boolean OR ks.is_active)
       GROUP BY ks.id
       ORDER BY ks.sort_order, ks.name`,
      [staff.role === 'admin']
    );

    if (staff.role !== 'admin') {
      return NextResponse.json({ success: true, data: { stations } });
    }

    const { rows: menuItems } = await query(
      `SELECT mi.id, mi.name, mi.is_available,
              COALESCE(array_agg(mis.station_id) FILTER (WHERE mis.station_id IS NOT NULL), '{}') AS station_ids
       FROM menu_items mi
       LEFT JOIN menu_item_stations mis ON mis.menu_item_id = mi.id
       GROUP BY mi.id
       ORDER BY mi.name`
    );
    return NextResponse.json({ success: true, data: { stations, menu_items: menuItems } });
  } catch (error) {
    console.error('Kitchen stations read error:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las estaciones' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  try {
    const { name, color = '#ff6b35', sort_order = 0, warning_minutes = 10, critical_minutes = 20 } = await request.json();
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60 ||
        typeof color !== 'string' || !colorPattern.test(color) || !Number.isInteger(sort_order) ||
        !Number.isInteger(warning_minutes) || !Number.isInteger(critical_minutes) ||
        warning_minutes < 1 || critical_minutes <= warning_minutes) {
      return NextResponse.json({ error: 'Datos de estación inválidos' }, { status: 400 });
    }
    const { rows } = await query(
      `INSERT INTO kitchen_stations (name, color, sort_order, warning_minutes, critical_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, color, sort_order, is_active, warning_minutes, critical_minutes`,
      [name.trim(), color, sort_order, warning_minutes, critical_minutes]
    );
    return NextResponse.json({ success: true, data: rows[0] }, { status: 201 });
  } catch (error: unknown) {
    console.error('Kitchen station create error:', error);
    return NextResponse.json({ error: 'No se pudo crear la estación' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  try {
    const { id, name, color, sort_order, is_active, warning_minutes, critical_minutes } = await request.json();
    if (typeof id !== 'string' || typeof name !== 'string' || !name.trim() || name.trim().length > 60 ||
        typeof color !== 'string' || !colorPattern.test(color) || !Number.isInteger(sort_order) ||
        typeof is_active !== 'boolean' || !Number.isInteger(warning_minutes) ||
        !Number.isInteger(critical_minutes) || warning_minutes < 1 || critical_minutes <= warning_minutes) {
      return NextResponse.json({ error: 'Datos de estación inválidos' }, { status: 400 });
    }
    const result = await query(
      `UPDATE kitchen_stations
       SET name = $1, color = $2, sort_order = $3, is_active = $4,
           warning_minutes = $5, critical_minutes = $6, updated_at = now()
       WHERE id = $7 RETURNING id`,
      [name.trim(), color, sort_order, is_active, warning_minutes, critical_minutes, id]
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Kitchen station update error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la estación' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  try {
    const { id } = await request.json();
    if (typeof id !== 'string') return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const openItems = await query(
      `SELECT 1 FROM order_item_stations ois
       JOIN order_items oi ON oi.id = ois.order_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE ois.station_id = $1 AND o.status NOT IN ('delivered', 'cancelled') LIMIT 1`,
      [id]
    );
    if (openItems.rowCount) {
      return NextResponse.json({ error: 'Pausa la estación: todavía tiene platillos abiertos' }, { status: 409 });
    }
    const result = await query('DELETE FROM kitchen_stations WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Estación no encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Kitchen station delete error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar la estación' }, { status: 500 });
  }
}
