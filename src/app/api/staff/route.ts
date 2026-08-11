import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole, staffRoles, type StaffRole } from '@/lib/auth';
import { getPoolClient, query } from '@/lib/db';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query(
    `SELECT id, user_id, name, role, email, created_at FROM staff WHERE restaurant_id = $1 ORDER BY created_at ASC`, [staff.restaurantId]
  );
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const currentStaff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(currentStaff)) return currentStaff;

  let createdAuthUserId: string | null = null;
  try {
    const { email, password, name, role } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (
      !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
      typeof password !== 'string' || password.length < 12 ||
      normalizedName.length < 2 || normalizedName.length > 100 ||
      !staffRoles.includes(role as StaffRole)
    ) {
      return NextResponse.json(
        { error: 'Nombre, correo, rol válido y contraseña de al menos 12 caracteres son obligatorios' },
        { status: 400 }
      );
    }

    const existing = await query('SELECT id FROM staff WHERE restaurant_id = $1 AND lower(email) = $2', [currentStaff.restaurantId, normalizedEmail]);
    if (existing.rowCount) return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });

    const supabaseAdmin = adminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase Auth Admin no está configurado' }, { status: 503 });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: normalizedName, role },
    });
    if (error || !data.user) {
      const duplicate = error?.message.toLowerCase().includes('already');
      return NextResponse.json(
        { error: duplicate ? 'El usuario ya existe en Supabase Auth' : 'No se pudo crear el acceso en Supabase Auth' },
        { status: duplicate ? 409 : 502 }
      );
    }
    createdAuthUserId = data.user.id;

    const inserted = await query(
      `INSERT INTO staff (restaurant_id, user_id, name, role, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, name, role, email, created_at`,
      [currentStaff.restaurantId, data.user.id, normalizedName, role, normalizedEmail]
    );
    return NextResponse.json({ success: true, data: inserted.rows[0] }, { status: 201 });
  } catch (error) {
    if (createdAuthUserId) await adminClient()?.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    console.error('Staff creation error:', error);
    return NextResponse.json({ error: 'No se pudo crear el integrante del personal' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const currentStaff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(currentStaff)) return currentStaff;
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId || userId === currentStaff.userId) {
    return NextResponse.json({ error: 'No puedes eliminar este usuario' }, { status: 400 });
  }
  const supabaseAdmin = adminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase Auth Admin no está configurado' }, { status: 503 });

  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const removed = await client.query('DELETE FROM staff WHERE user_id = $1 AND restaurant_id = $2 RETURNING user_id', [userId, currentStaff.restaurantId]);
    if (!removed.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Staff deletion error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el integrante del personal' }, { status: 500 });
  } finally {
    client.release();
  }
}
