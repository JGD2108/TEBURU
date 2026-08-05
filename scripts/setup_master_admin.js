const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    const email = 'tabaduque93@gmail.com';
    const rawPass = 'Kosher2018_';

    // 1. Asegurar pgcrypto
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // 2. Verificar si el usuario ya existe
    const res = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    let userId;

    if (res.rows.length > 0) {
      // Actualizar la contraseña
      userId = res.rows[0].id;
      await client.query(`
        UPDATE auth.users 
        SET encrypted_password = crypt($1, gen_salt('bf'))
        WHERE id = $2
      `, [rawPass, userId]);
      console.log('Contraseña actualizada para el usuario existente.');
    } else {
      // Insertar nuevo usuario (por si acaso no existe o se borró)
      const insertRes = await client.query(`
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
          recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
          created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')), now(),
          now(), now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        ) RETURNING id;
      `, [email, rawPass]);
      
      // Además, instertar en auth.identities
      userId = insertRes.rows[0].id;
      await client.query(`
        INSERT INTO auth.identities (
          id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $1, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now(), now()
        );
      `, [userId, email]);
      console.log('Nuevo usuario creado exitosamente.');
    }

    // 3. Asegurar rol de admin en la tabla staff
    await client.query(`
      INSERT INTO public.staff (user_id, name, role) 
      VALUES ($1, 'Master Admin', 'admin')
      ON CONFLICT (user_id) DO UPDATE SET role = 'admin', name = 'Master Admin';
    `, [userId]);
    console.log('Rol de Master Admin asignado.');

    // 4. Crear trigger para evitar que este usuario sea eliminado
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_master_admin_deletion()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.email = 'tabaduque93@gmail.com' THEN
          RAISE EXCEPTION 'Operación denegada: No se puede eliminar la cuenta administradora maestra del sistema.';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Intentar dropear el trigger si existe y luego crearlo
    await client.query(`DROP TRIGGER IF EXISTS prevent_master_admin_del_trigger ON auth.users;`);
    await client.query(`
      CREATE TRIGGER prevent_master_admin_del_trigger
      BEFORE DELETE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_master_admin_deletion();
    `);

    console.log('Bloqueo de eliminación aplicado exitosamente.');

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
