import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const { rows } = await query('SELECT * FROM restaurant_settings WHERE restaurant_id = $1', [staff.restaurantId]);
  return NextResponse.json({ data: rows[0] ?? null });
}

export async function PATCH(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;
  const body = await request.json();
  if (typeof body.id !== 'string' || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Ajustes inválidos' }, { status: 400 });
  }
  const { rows } = await query(
    `UPDATE restaurant_settings SET name = $1, logo_url = $2, primary_color = $3, updated_at = now()
     WHERE id = $4 AND restaurant_id = $5 RETURNING *`,
    [body.name.trim(), body.logo_url || null, body.primary_color || null, body.id, staff.restaurantId]
  );
  return rows[0]
    ? NextResponse.json({ data: rows[0] })
    : NextResponse.json({ error: 'Ajustes no encontrados' }, { status: 404 });
}
