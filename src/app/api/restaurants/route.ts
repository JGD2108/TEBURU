import { NextResponse } from 'next/server';
import { getPoolClient, query } from '@/lib/db';
import { isAuthorizationFailure, requireAuthenticatedUser, requirePlatformAdmin } from '@/lib/auth';

function slugify(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser(request);
  if (isAuthorizationFailure(user)) return user;
  const { name, slug, primary_color } = await request.json();
  const safeSlug = typeof slug === 'string' && slugify(slug) || (typeof name === 'string' && slugify(name));
  if (typeof name !== 'string' || name.trim().length < 2 || !safeSlug) return NextResponse.json({ error: 'Nombre de restaurante inválido' }, { status: 400 });
  let client;
  try {
    client = await getPoolClient(); await client.query('BEGIN');
    const restaurant = await client.query<{ id: string; name: string; slug: string }>(
      'INSERT INTO restaurants (name, slug, primary_color) VALUES ($1, $2, $3) RETURNING id, name, slug', [name.trim(), safeSlug, typeof primary_color === 'string' ? primary_color : null]
    );
    await client.query('INSERT INTO restaurant_settings (restaurant_id, name, primary_color) VALUES ($1, $2, $3)', [restaurant.rows[0].id, name.trim(), typeof primary_color === 'string' ? primary_color : null]);
    await client.query('INSERT INTO staff (user_id, restaurant_id, name, email, role) VALUES ($1, $2, $3, $4, $5)', [user.id, restaurant.rows[0].id, user.email ?? name.trim(), user.email ?? null, 'admin']);
    await client.query('COMMIT');
    return NextResponse.json({ data: restaurant.rows[0] }, { status: 201 });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: 'No se pudo crear el restaurante. El identificador puede estar en uso.' }, { status: 409 });
  } finally { client?.release(); }
}

export async function GET(request: Request) {
  const staff = await requirePlatformAdmin(request);
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query(`SELECT r.id, r.name, r.slug, r.status, r.created_at, count(s.id)::int AS staff_count
    FROM restaurants r LEFT JOIN staff s ON s.restaurant_id = r.id GROUP BY r.id ORDER BY r.created_at DESC`);
  return NextResponse.json({ data: rows });
}
