const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Tabla settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        logo_url TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insertar configuración inicial si está vacío
    await client.query(`
      INSERT INTO restaurant_settings (name, logo_url)
      SELECT 'Teburu Sushi Bar', 'https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format&fit=crop&w=400&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM restaurant_settings);
    `);

    console.log("Migración settings exitosa.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
