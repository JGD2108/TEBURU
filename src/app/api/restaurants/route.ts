import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getPoolClient, query } from '@/lib/db';
import { isAuthorizationFailure, requirePlatformAdmin } from '@/lib/auth';

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function POST(request: Request) {
  const platformAdmin = await requirePlatformAdmin(request);
  if (isAuthorizationFailure(platformAdmin)) return platformAdmin;

  let createdAuthUserId: string | null = null;
  let client;
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const safeSlug = typeof body.slug === 'string' && slugify(body.slug) || slugify(name);
    const adminName = typeof body.admin_name === 'string' ? body.admin_name.trim() : '';
    const adminEmail = typeof body.admin_email === 'string' ? body.admin_email.trim().toLowerCase() : '';
    const tableCount = Number(body.table_count);
    const tableCapacity = Number(body.table_capacity);
    if (name.length < 2 || !safeSlug || adminName.length < 2 || !/^\S+@\S+\.\S+$/.test(adminEmail) ||
        typeof body.admin_password !== 'string' || body.admin_password.length < 12 ||
        !Number.isInteger(tableCount) || tableCount < 1 || tableCount > 100 ||
        !Number.isInteger(tableCapacity) || tableCapacity < 1 || tableCapacity > 30) {
      return NextResponse.json({ error: 'Completa el restaurante, administrador, contraseÃ±a y mesas con datos vÃ¡lidos.' }, { status: 400 });
    }

    const supabase = authAdmin();
    if (!supabase) return NextResponse.json({ error: 'Supabase Auth Admin no estÃ¡ configurado' }, { status: 503 });
    const created = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: body.admin_password,
      email_confirm: true,
      user_metadata: { name: adminName, role: 'admin' },
    });
    if (created.error || !created.data.user) {
      const duplicate = created.error?.message.toLowerCase().includes('already');
      return NextResponse.json({ error: duplicate ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear el acceso del administrador.' }, { status: duplicate ? 409 : 502 });
    }
    createdAuthUserId = created.data.user.id;

    client = await getPoolClient();
    await client.query('BEGIN');
    const restaurant = await client.query<{ id: string; name: string; slug: string }>(
      `INSERT INTO restaurants (name, slug, primary_color, contact_email, phone, address, currency, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, slug`,
      [name, safeSlug, typeof body.primary_color === 'string' ? body.primary_color : '#ff4757',
        typeof body.contact_email === 'string' ? body.contact_email.trim() || null : null,
        typeof body.phone === 'string' ? body.phone.trim() || null : null,
        typeof body.address === 'string' ? body.address.trim() || null : null,
        typeof body.currency === 'string' ? body.currency : 'USD',
        typeof body.timezone === 'string' ? body.timezone : 'America/Bogota']
    );
    const restaurantId = restaurant.rows[0].id;
    await client.query(
      'INSERT INTO restaurant_settings (restaurant_id, name, primary_color) VALUES ($1, $2, $3)',
      [restaurantId, name, typeof body.primary_color === 'string' ? body.primary_color : '#ff4757']
    );
    await client.query(
      "INSERT INTO staff (user_id, restaurant_id, name, email, role) VALUES ($1, $2, $3, $4, 'admin')",
      [createdAuthUserId, restaurantId, adminName, adminEmail]
    );
    await client.query(
      `INSERT INTO tables (restaurant_id, table_number, capacity, status)
       SELECT $1, number, $3, 'available' FROM generate_series(1, $2) AS number`,
      [restaurantId, tableCount, tableCapacity]
    );
    await client.query('COMMIT');
    return NextResponse.json({ data: restaurant.rows[0] }, { status: 201 });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    if (createdAuthUserId) await authAdmin()?.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    console.error('Restaurant provisioning error:', error);
    return NextResponse.json({ error: 'No se pudo crear el restaurante. Revisa que el identificador no estÃ© en uso.' }, { status: 409 });
  } finally {
    client?.release();
  }
}

export async function GET(request: Request) {
  const staff = await requirePlatformAdmin(request);
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query(`SELECT r.id, r.name, r.slug, r.status, r.created_at, r.contact_email, r.phone, r.address,
      count(DISTINCT s.id)::int AS staff_count, count(DISTINCT t.id)::int AS table_count,
      count(DISTINCT mi.id)::int AS menu_item_count
    FROM restaurants r
    LEFT JOIN staff s ON s.restaurant_id = r.id
    LEFT JOIN tables t ON t.restaurant_id = r.id
    LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
    GROUP BY r.id ORDER BY r.created_at DESC`);
  return NextResponse.json({ data: rows });
}
