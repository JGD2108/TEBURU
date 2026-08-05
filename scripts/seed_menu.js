const { Client } = require('pg');
const connectionString = 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Obtener categorías
    const res = await client.query("SELECT id, name FROM menu_categories");
    const cat = {};
    res.rows.forEach(r => { cat[r.name] = r.id; });
    
    // Si faltan categorías base, las creamos. Asumiré que ya existen por el migrate anterior (Recomendados, Platos Fuertes, Entradas, Bebidas).
    // Agregaré la categoría de Postres si no existe
    if (!cat['Postres']) {
      const pRes = await client.query("INSERT INTO menu_categories (name, sort_order) VALUES ('Postres', 5) RETURNING id, name");
      cat['Postres'] = pRes.rows[0].id;
    }

    console.log("Categorías listas. Insertando 40 platillos de manera masiva...");

    const items = [
      // RECOMENDADOS (10)
      { cat: 'Recomendados', name: 'Wagyu Beef Tataki', desc: 'Finas láminas de corte de res Wagyu sellado, ponzu de trufa, cebollín y ajo crocante.', price: 28.50, img: 'https://images.unsplash.com/photo-1540544660406-6a69dacb2804?auto=format&fit=crop&w=400&q=80', mod: 'sin cebollín' },
      { cat: 'Recomendados', name: 'Omakase Sushi Set', desc: 'Selección del chef de 12 piezas de nigiri premium del día.', price: 35.00, img: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Recomendados', name: 'Tonkotsu Ramen Black', desc: 'Caldo intenso con aceite de ajo negro, chashu braseado, huevo nitamago y nori.', price: 19.50, img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', mod: 'sin huevo,sin cebollín,sin nori,sin cerdo' },
      { cat: 'Recomendados', name: 'Black Cod Miso', desc: 'Bacalao negro marinado en miso dulce y horneado a la perfección.', price: 32.00, img: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Recomendados', name: 'Dragon Roll Especial', desc: 'Langostino tempura, anguila, aguacate, salsa teriyaki y sésamo tostado.', price: 18.00, img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80', mod: 'sin anguila,sin sésamo' },
      { cat: 'Recomendados', name: 'Matcha Tiramisu', desc: 'Fusión italo-japonesa: mascarpone, bizcocho humedecido en matcha de Uji.', price: 9.50, img: 'https://images.unsplash.com/photo-1616429215037-c7cb87a17dd1?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Recomendados', name: 'Sashimi Moriawase (Chef)', desc: '15 cortes de pescado crudo fresco del mercado de Tsukiji.', price: 42.00, img: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Recomendados', name: 'Tori Karaage Premium', desc: 'Muslos de pollo frito al estilo japonés con mayonesa de yuzu.', price: 12.00, img: 'https://images.unsplash.com/photo-1562967914-01efa7e87832?auto=format&fit=crop&w=400&q=80', mod: 'sin mayonesa' },
      { cat: 'Recomendados', name: 'Curry Japonés con Katsu', desc: 'Cerdo empanizado con curry espeso y arroz japonés humeante.', price: 16.50, img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80', mod: 'sin cerdo' },
      { cat: 'Recomendados', name: 'Cocktail Tokyo Drift', desc: 'Gin japonés Roku, yuzu, flor de cerezo y tónica.', price: 14.00, img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', mod: null },
      
      // ENTRADAS (10)
      { cat: 'Entradas', name: 'Edamame Trufado', desc: 'Vainas de soya al vapor con sal marina y aceite de trufa blanca.', price: 6.50, img: 'https://images.unsplash.com/photo-1598463567702-861ed0761a6b?auto=format&fit=crop&w=400&q=80', mod: 'sin trufa' },
      { cat: 'Entradas', name: 'Gyozas Vegetales', desc: 'Empanadillas rellenas de hongos shiitake y repollo.', price: 7.00, img: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Entradas', name: 'Age Dashi Tofu', desc: 'Tofu frito sedoso servido en caldo tentsuyu caliente.', price: 8.50, img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', mod: 'sin cebollín' },
      { cat: 'Entradas', name: 'Tempura Mixto', desc: 'Camarones y vegetales crujientes fritos al estilo tradicional.', price: 14.00, img: 'https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Entradas', name: 'Tako Su', desc: 'Ensalada refrescante de pulpo con pepino en vinagre de arroz dulce.', price: 11.00, img: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80', mod: 'sin pepino' },
      { cat: 'Entradas', name: 'Yakitori de Pollo', desc: 'Brochetas de pollo a la parrilla glaseadas con salsa tare (3 unids).', price: 9.00, img: 'https://images.unsplash.com/photo-1598511796318-7b82ef4c5409?auto=format&fit=crop&w=400&q=80', mod: 'sin salsa' },
      { cat: 'Entradas', name: 'Sopa Miso Tradicional', desc: 'Caldo de dashi con pasta de miso, tofu, wakame y cebollín.', price: 4.50, img: 'https://images.unsplash.com/photo-1606923828941-8eb7b8b48873?auto=format&fit=crop&w=400&q=80', mod: 'sin cebollín,sin tofu' },
      { cat: 'Entradas', name: 'Ensalada de Algas Wakame', desc: 'Algas aliñadas con sésamo y un toque de aceite de ajonjolí.', price: 5.50, img: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=400&q=80', mod: 'sin sésamo' },
      { cat: 'Entradas', name: 'Kushikatsu de Cerdo', desc: 'Brochetas de cerdo rebozadas en panko y fritas, salsa tonkatsu.', price: 10.00, img: 'https://images.unsplash.com/photo-1582450871972-ab5ca641643d?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Entradas', name: 'Bao de Panceta', desc: 'Panecillo al vapor con panceta de cerdo cocida a baja temperatura.', price: 6.00, img: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&w=400&q=80', mod: 'sin pepino,sin maní' },

      // PLATOS FUERTES (10)
      { cat: 'Platos Fuertes', name: 'Udon de Mariscos', desc: 'Fideos udon gruesos en caldo de pescado con camarón, calamar y almejas.', price: 17.50, img: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=400&q=80', mod: 'sin calamar,sin almejas' },
      { cat: 'Platos Fuertes', name: 'Katsudon', desc: 'Tazón de arroz cubierto con chuleta de cerdo frita, huevo revuelto y cebolla.', price: 15.00, img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80', mod: 'sin cebolla,sin huevo' },
      { cat: 'Platos Fuertes', name: 'Yakisoba de Pollo', desc: 'Fideos fritos al wok con pollo, vegetales y salsa yakisoba dulce.', price: 14.50, img: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=400&q=80', mod: 'sin pollo,sin repollo' },
      { cat: 'Platos Fuertes', name: 'Shoyu Ramen Tradicional', desc: 'Ramen a base de caldo de pollo y salsa de soya, ligero y sabroso.', price: 14.00, img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', mod: 'sin huevo,sin bambú' },
      { cat: 'Platos Fuertes', name: 'Spicy Tuna Bowl', desc: 'Tazón de arroz de sushi con atún marinado picante, edamame y nori.', price: 18.00, img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', mod: 'sin picante' },
      { cat: 'Platos Fuertes', name: 'Gyu Don', desc: 'Tazón de arroz con tiras de carne de res finas cocinadas a fuego lento.', price: 16.50, img: 'https://images.unsplash.com/photo-1582450871972-ab5ca641643d?auto=format&fit=crop&w=400&q=80', mod: 'sin cebolla,sin huevo' },
      { cat: 'Platos Fuertes', name: 'Spider Roll (Maki)', desc: 'Cangrejo de caparazón blando crujiente, pepino y aguacate.', price: 16.00, img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80', mod: 'sin pepino' },
      { cat: 'Platos Fuertes', name: 'Sashimi de Salmón (9 cortes)', desc: 'Salmón noruego fresco, servido con wasabi y jengibre.', price: 21.00, img: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Platos Fuertes', name: 'Unagi Don', desc: 'Anguila de agua dulce asada con salsa dulce sobre arroz japonés.', price: 25.00, img: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=400&q=80', mod: 'sin salsa' },
      { cat: 'Platos Fuertes', name: 'Tofu Steak Vegetariano', desc: 'Tofu firme a la plancha con salsa teriyaki de hongos shiitake.', price: 13.50, img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', mod: null },

      // BEBIDAS (5)
      { cat: 'Bebidas', name: 'Cerveza Asahi Dry (Botella)', desc: 'Cerveza japonesa pálida y seca.', price: 5.50, img: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Bebidas', name: 'Sake Caliente (Tokkuri)', desc: 'Jarrita de sake premium servido caliente para compartir.', price: 12.00, img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Bebidas', name: 'Ramune Original', desc: 'Gaseosa japonesa clásica con canica de vidrio.', price: 4.00, img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Bebidas', name: 'Té Verde Matcha Frio', desc: 'Matcha batido con hielo y sin azúcar.', price: 4.50, img: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Bebidas', name: 'Calpis Soda', desc: 'Bebida carbonatada dulce a base de leche cultivada.', price: 4.50, img: 'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=400&q=80', mod: null },
      
      // POSTRES (5)
      { cat: 'Postres', name: 'Mochi Helado de Té Verde', desc: 'Dos esferas de masa de arroz rellenas de helado de matcha.', price: 6.50, img: 'https://images.unsplash.com/photo-1563805042-7684c8e9e533?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Postres', name: 'Dorayaki de Azuki', desc: 'Tortitas japonesas rellenas de pasta de frijol rojo dulce.', price: 5.00, img: 'https://images.unsplash.com/photo-1600109968798-250325b34cc5?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Postres', name: 'Cheesecake Japonés', desc: 'Pastel de queso esponjoso tipo algodón, servido con fresas.', price: 7.50, img: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80', mod: 'sin fresas' },
      { cat: 'Postres', name: 'Taiyaki Clásico', desc: 'Pastelillo con forma de pez horneado, relleno de crema pastelera.', price: 5.50, img: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?auto=format&fit=crop&w=400&q=80', mod: null },
      { cat: 'Postres', name: 'Yuzu Sorbet', desc: 'Sorbete refrescante de cítrico japonés yuzu.', price: 6.00, img: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&q=80', mod: null }
    ];

    let queryVals = [];
    items.forEach(item => {
      const cId = cat[item.cat] || cat['Recomendados'];
      queryVals.push(`('${cId}', '${item.name.replace(/'/g, "''")}', '${item.desc.replace(/'/g, "''")}', ${item.price}, '${item.img}', ${item.mod ? `'${item.mod}'` : 'NULL'})`);
    });

    const queryStr = `
      INSERT INTO menu_items (category_id, name, description, price, image_url, modifiable_ingredients)
      VALUES ${queryVals.join(",\n")}
      ON CONFLICT DO NOTHING;
    `;

    await client.query(queryStr);
    console.log("¡40 Platillos insertados exitosamente!");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}

run();
