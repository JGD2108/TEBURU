import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const [categories, items] = await Promise.all([
    query('SELECT id, name, name_en, name_ja, sort_order FROM menu_categories ORDER BY sort_order, name'),
    query(`SELECT mi.id, mi.name, mi.name_en, mi.name_ja, mi.description, mi.description_en, mi.description_ja,
      mi.price, mi.image_url, mi.modifiable_ingredients, json_build_object('name', mc.name) AS category
      FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.is_available = true ORDER BY mi.name`),
  ]);
  return NextResponse.json({ categories: categories.rows, items: items.rows });
}
