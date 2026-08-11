import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const tableId = new URL(request.url).searchParams.get('table_id');
  if (!tableId) return NextResponse.json({ error: 'Falta la mesa' }, { status: 400 });
  const restaurant = await query<{ restaurant_id: string }>(
    "SELECT t.restaurant_id FROM tables t JOIN restaurants r ON r.id = t.restaurant_id WHERE t.id = $1 AND r.status = 'active'", [tableId]
  );
  if (!restaurant.rows[0]) return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
  const [categories, items] = await Promise.all([
    query('SELECT id, name, name_en, name_ja, sort_order FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order, name', [restaurant.rows[0].restaurant_id]),
    query(`SELECT mi.id, mi.name, mi.name_en, mi.name_ja, mi.description, mi.description_en, mi.description_ja,
      mi.price, mi.image_url, mi.modifiable_ingredients, json_build_object('name', mc.name) AS category
      FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.is_available = true AND mi.restaurant_id = $1 AND mc.restaurant_id = $1 ORDER BY mi.name`, [restaurant.rows[0].restaurant_id]),
  ]);
  return NextResponse.json({ categories: categories.rows, items: items.rows });
}
