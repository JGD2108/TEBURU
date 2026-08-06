import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const staffRoles = ['admin', 'waiter', 'kitchen'] as const;
export type StaffRole = (typeof staffRoles)[number];

export type StaffSession = { userId: string; name: string; role: StaffRole };

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured.');
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireStaff(request: Request): Promise<StaffSession | NextResponse> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });

  try {
    const { data: { user }, error } = await authClient().auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    const { rows } = await query<{ user_id: string; name: string; role: StaffRole }>(
      'SELECT user_id, name, role FROM staff WHERE user_id = $1', [user.id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Personal no autorizado' }, { status: 403 });
    return { userId: rows[0].user_id, name: rows[0].name, role: rows[0].role };
  } catch (error) {
    console.error('Staff authorization error:', error);
    return NextResponse.json({ error: 'No se pudo validar la sesión' }, { status: 401 });
  }
}

export async function requireRole(request: Request, ...roles: StaffRole[]): Promise<StaffSession | NextResponse> {
  const staff = await requireStaff(request);
  if (staff instanceof NextResponse) return staff;
  return roles.includes(staff.role)
    ? staff
    : NextResponse.json({ error: 'No tienes permiso para esta operación' }, { status: 403 });
}

export function isAuthorizationFailure(value: StaffSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
