import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAuthorizationFailure, requirePlatformAdmin } from '@/lib/auth';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformAdmin(request);
  if (isAuthorizationFailure(staff)) return staff;
  const { id } = await context.params;
  const { status } = await request.json();
  if (!['active', 'suspended'].includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  const result = await query('UPDATE restaurants SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status', [status, id]);
  return result.rowCount ? NextResponse.json({ data: result.rows[0] }) : NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
}
