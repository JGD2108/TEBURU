import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const staffRoles = new Set(['admin', 'waiter', 'kitchen']);

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' || password.length < 12 ||
      typeof name !== 'string' ||
      !staffRoles.has(role)
    ) {
      return NextResponse.json(
        { error: 'Nombre, correo, rol válido y contraseña de al menos 12 caracteres son obligatorios' },
        { status: 400 }
      );
    }

    const existing = await query('SELECT id FROM staff WHERE email = $1', [email]);
    if (existing.rowCount) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    await query(
      `INSERT INTO staff (user_id, name, role, password_hash, email)
       VALUES (gen_random_uuid(), $1, $2, crypt($3, gen_salt('bf')), $4)`,
      [name, role, password, email]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('Staff creation error:', error);
    return NextResponse.json({ error: 'No se pudo crear el integrante del personal' }, { status: 500 });
  }
}
