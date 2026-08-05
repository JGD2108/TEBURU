import { NextResponse } from 'next/server';
import { Client } from 'pg';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const finalPassword = password || 'Teburu2026_';

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    // 1. Verificar si el usuario ya existe en auth.users
    const userExists = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.end();
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 2. Insertar en auth.users
    const { rows } = await client.query(`
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
      ) RETURNING id;
    `, [email, finalPassword]);

    const userId = rows[0].id;

    // 3. Insertar en auth.identities
    await client.query(`
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $1::text, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now(), now()
      );
    `, [userId, email]);

    // 4. Generar el SHA1 para la tabla pública
    const sha1Password = crypto.createHash('sha1').update(finalPassword).digest('hex');

    // 5. Insertar en public.staff
    await client.query(`
      INSERT INTO staff (user_id, name, role, password_hash, email) VALUES ($1, $2, $3, $4, $5)
    `, [userId, name, role, sha1Password, email]);

    await client.query('COMMIT');
    await client.end();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Staff Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
