const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Add access_code to tables
    await client.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS access_code VARCHAR(10);
    `);
    
    console.log('Migración completa: access_code añadido a tables.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
