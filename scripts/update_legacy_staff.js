const { Client } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    const hash = crypto.createHash('sha1').update('Kosher2018_').digest('hex');
    
    // Update the password_hash for all staff who have it null
    await client.query(`
      UPDATE staff 
      SET password_hash = $1 
      WHERE password_hash IS NULL;
    `, [hash]);

    // Fetch emails from auth.users to backfill the email column in staff
    await client.query(`
      UPDATE staff s
      SET email = u.email
      FROM auth.users u
      WHERE s.user_id = u.id AND s.email IS NULL;
    `);
    
    console.log('Migración completa: hash y correos actualizados en staff.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
