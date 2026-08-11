import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const staffRoles = ['admin', 'waiter', 'kitchen'] as const;
export type StaffRole = (typeof staffRoles)[number];

export type StaffSession = { userId: string; name: string; role: StaffRole; restaurantId: string; isPlatformAdmin: boolean };

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured.');
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireAuthenticatedUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
  try {
    const { data: { user }, error } = await authClient().auth.getUser(token);
    return error || !user ? NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }) : user;
  } catch {
    return NextResponse.json({ error: 'No se pudo validar la sesión' }, { status: 401 });
  }
}

export async function requireStaff(request: Request): Promise<StaffSession | NextResponse> {
  const user = await requireAuthenticatedUser(request);
  if (user instanceof NextResponse) return user;
  try {
    const { rows } = await query<{ user_id: string; name: string; role: StaffRole; restaurant_id: string; is_platform_admin: boolean }>(
      `SELECT s.user_id, s.name, s.role, s.restaurant_id,
        EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = s.user_id) AS is_platform_admin
       FROM staff s JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.user_id = $1 AND r.status = 'active' ORDER BY s.created_at LIMIT 1`, [user.id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Personal no autorizado' }, { status: 403 });
    return { userId: rows[0].user_id, name: rows[0].name, role: rows[0].role, restaurantId: rows[0].restaurant_id, isPlatformAdmin: rows[0].is_platform_admin };
  } catch (error) {
    console.error('Staff authorization error:', error);
    return NextResponse.json({ error: 'No se pudo validar la sesión' }, { status: 401 });
  }
}

export async function requirePlatformAdmin(request: Request): Promise<StaffSession | NextResponse> {
  const staff = await requireStaff(request);
  if (staff instanceof NextResponse) return staff;
  return staff.isPlatformAdmin ? staff : NextResponse.json({ error: 'Acceso de plataforma requerido' }, { status: 403 });
}

export async function requireRole(request: Request, ...roles: StaffRole[]): Promise<StaffSession | NextResponse> {
  const staff = await requireStaff(request);
  if (staff instanceof NextResponse) return staff;
  return roles.includes(staff.role)
    ? staff
    : NextResponse.json({ error: 'No tienes permiso para esta operación' }, { status: 403 });
}

export function isAuthorizationFailure(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
