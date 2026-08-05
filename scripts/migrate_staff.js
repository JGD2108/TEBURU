const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Crear tabla staff vinculada a auth.users (sin foreign key dura cross-schema para simplificar MVP si da error de privilegios, pero probaremos referenciar).
    // Nota: en Supabase, referenciar auth.users desde public requiere permisos. Generalmente se puede.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.staff (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
        name TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'waiter', 'kitchen')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log("Tabla staff creada.");

    // Buscar usuarios existentes en auth.users y asignarles admin
    const authUsersRes = await client.query("SELECT id, email FROM auth.users");
    
    if (authUsersRes.rows.length > 0) {
      for (const user of authUsersRes.rows) {
        // Insertar ignorando conflictos
        await client.query(`
          INSERT INTO public.staff (user_id, name, role) 
          VALUES ($1, $2, 'admin')
          ON CONFLICT (user_id) DO NOTHING;
        `, [user.id, user.email.split('@')[0]]);
        console.log(`Asignado rol admin a ${user.email}`);
      }
    } else {
      console.log("No hay usuarios en auth.users todavía.");
    }

    console.log("Migración staff exitosa.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
