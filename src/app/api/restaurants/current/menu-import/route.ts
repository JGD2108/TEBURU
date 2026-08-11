import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

type ImportedItem = { name: string; category: string; price: number; description?: string };
export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { items } = await request.json() as { items: ImportedItem[] };
  if (!Array.isArray(items) || !items.length || items.length > 500 || items.some((item) => !item || typeof item.name !== 'string' || typeof item.category !== 'string' || !Number.isFinite(Number(item.price)) || Number(item.price) < 0)) return NextResponse.json({ error: 'El archivo no contiene un menú válido' }, { status: 400 });
  let client;
  try {
    client = await getPoolClient(); await client.query('BEGIN');
    for (const item of items) {
      const category = await client.query<{ id: string }>(`INSERT INTO menu_categories (restaurant_id, name)
        VALUES ($1, $2) ON CONFLICT (restaurant_id, lower(name)) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [staff.restaurantId, item.category.trim()]);
      await client.query(`INSERT INTO menu_items (restaurant_id, category_id, name, description, price)
        VALUES ($1, $2, $3, $4, $5)`, [staff.restaurantId, category.rows[0].id, item.name.trim(), item.description?.trim() || null, Number(item.price)]);
    }
    await client.query('COMMIT'); return NextResponse.json({ imported: items.length });
  } catch {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: 'No se pudo importar el menú' }, { status: 500 });
  } finally { client?.release(); }
}
