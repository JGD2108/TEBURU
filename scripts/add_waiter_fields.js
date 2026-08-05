const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Add columns to tables
    await client.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID REFERENCES staff(user_id);
    `);
    
    await client.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT false;
    `);
    
    console.log('Migración completa: assigned_waiter_id y needs_attention añadidos a tables.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
