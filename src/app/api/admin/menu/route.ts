import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  const [categories, items] = await Promise.all([
    query('SELECT * FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [staff.restaurantId]),
    query(`SELECT mi.*, json_build_object('name', mc.name) AS category
      FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.restaurant_id = $1 AND mc.restaurant_id = $1 ORDER BY mi.name`, [staff.restaurantId]),
  ]);
  return NextResponse.json({ categories: categories.rows, items: items.rows });
}

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  const body = await request.json();
  const price = Number(body.price);
  if (typeof body.name !== 'string' || !body.name.trim() || typeof body.category_id !== 'string' || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Datos de platillo inválidos' }, { status: 400 });
  }
  const { rows } = await query(
    `INSERT INTO menu_items (restaurant_id, name, description, price, category_id, image_url, modifiable_ingredients)
     SELECT $1, $2, $3, $4, mc.id, $5, $6 FROM menu_categories mc WHERE mc.id = $7 AND mc.restaurant_id = $1 RETURNING *`,
    [staff.restaurantId, body.name.trim(), body.description || null, price, body.image_url || null, body.modifiable_ingredients || null, body.category_id]
  );
  return NextResponse.json({ data: rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el platillo' }, { status: 400 });
  const result = await query('DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2', [id, staff.restaurantId]);
  return result.rowCount
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Platillo no encontrado' }, { status: 404 });
}
