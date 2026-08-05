const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Añadir la columna de ingredientes si no existe
    await client.query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS modifiable_ingredients TEXT;
    `);

    // Actualizar el Ramen con ingredientes de prueba
    await client.query(`
      UPDATE menu_items 
      SET modifiable_ingredients = 'huevo,langostino,pasta,verdura,nori' 
      WHERE name = 'Ramen Tonkotsu Especial';
      
      UPDATE menu_items 
      SET modifiable_ingredients = 'atún,aguacate,sésamo,arroz' 
      WHERE name = 'Sushi Roll Spicy Tuna';
    `);

    console.log("Columna modifiable_ingredients agregada y actualizada con éxito.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
