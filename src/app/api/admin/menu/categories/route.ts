import { NextResponse } from 'next/server';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin');
  if (isAuthorizationFailure(staff)) return staff;

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'Escribe un nombre de categoría válido' }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `INSERT INTO menu_categories (name, sort_order)
       VALUES ($1, COALESCE((SELECT MAX(sort_order) + 1 FROM menu_categories), 0))
       RETURNING *`,
      [name]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Esta categoría ya existe' }, { status: 409 });
    }
    throw error;
  }
}
