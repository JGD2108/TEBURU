const { Client } = require('pg');

const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Actualizar contraseñas en auth.users a Kosher2018_ para todos los usuarios que no sean el admin principal si lo prefieres, o para todos.
    // El usuario pidió que a "los dos usuarios de staff que tengo" les ponga Kosher2018_. 
    // Actualizaremos auth.users basándonos en la tabla public.staff.
    
    await client.query(`
      UPDATE auth.users
      SET encrypted_password = crypt('Kosher2018_', gen_salt('bf'))
      WHERE email IN ('tadashi@sistra.com.co', 'tabaduque93@gmail.com');
    `);
    
    console.log('Contraseñas de auth.users actualizadas correctamente.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
