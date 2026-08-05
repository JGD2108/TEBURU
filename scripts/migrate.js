const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Conectado a Supabase exitosamente.");

    // Leer el esquema
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/lib/schema.sql'), 'utf8');
    
    console.log("Aplicando esquema (creando tablas)...");
    await client.query(schemaSql);
    console.log("Tablas creadas exitosamente.");

    // Inyectar datos reales de prueba para que los veas en vivo
    console.log("Insertando datos iniciales de prueba (Menú y Mesas)...");
    
    await client.query(`
      -- Insertar una mesa de prueba
      INSERT INTO tables (table_number, status) VALUES (1, 'available') ON CONFLICT (table_number) DO NOTHING;
      
      -- Categorías
      INSERT INTO menu_categories (name, sort_order) VALUES 
        ('Recomendados', 1),
        ('Platos Fuertes', 2),
        ('Entradas', 3),
        ('Bebidas', 4)
      ON CONFLICT DO NOTHING;
    `);

    // Obtener los IDs de las categorías para insertar los productos
    const res = await client.query("SELECT id, name FROM menu_categories");
    const categories = {};
    res.rows.forEach(row => { categories[row.name] = row.id; });

    // Platillos
    await client.query(`
      INSERT INTO menu_items (category_id, name, description, price, image_url, is_available) VALUES 
      ('${categories['Recomendados']}', 'Ramen Tonkotsu Especial', 'Caldo de cerdo intenso cocinado por 12 horas, fideos artesanales, doble chashu.', 18.50, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80', true),
      ('${categories['Platos Fuertes']}', 'Sushi Roll Spicy Tuna', 'Atún picante, aguacate, envuelto en arroz y sésamo.', 12.00, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80', true),
      ('${categories['Entradas']}', 'Gyozas de Cerdo', 'Empanadillas japonesas al vapor y a la plancha (5 pzas).', 6.00, 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=400&q=80', true),
      ('${categories['Bebidas']}', 'Matcha Latte Frío', 'Té verde premium con leche y hielo.', 4.50, 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=400&q=80', true)
      ON CONFLICT DO NOTHING;
    `);
    
    console.log("¡Datos insertados con éxito! Ahora tu base de datos en la nube es real.");

  } catch (error) {
    console.error("Error aplicando migraciones:", error.message);
  } finally {
    await client.end();
  }
}

run();
