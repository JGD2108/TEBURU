const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Añadir columna email a staff
    await client.query(`
      ALTER TABLE staff 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
    
    console.log('Migración completa: email añadido a staff.');
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
