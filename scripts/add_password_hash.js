const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Añadir columna a staff
    await client.query(`
      ALTER TABLE staff 
      ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);
    
    console.log('Migración completa: password_hash añadido a staff.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
