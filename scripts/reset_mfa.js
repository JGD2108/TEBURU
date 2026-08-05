const { Client } = require('pg');

const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Obtener el ID del usuario
    const res = await client.query('SELECT id FROM auth.users WHERE email = $1', ['tabaduque93@gmail.com']);
    
    if (res.rows.length > 0) {
      const userId = res.rows[0].id;
      
      // Eliminar desafíos MFA
      await client.query('DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = $1)', [userId]);
      
      // Eliminar factores MFA
      await client.query('DELETE FROM auth.mfa_factors WHERE user_id = $1', [userId]);
      
      // Asegurarse de que no haya AAL requerido temporalmente
      await client.query('DELETE FROM auth.mfa_amr_claims WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = $1)', [userId]);
      
      console.log('Factores MFA eliminados exitosamente para ' + userId);
    } else {
      console.log('Usuario no encontrado.');
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
