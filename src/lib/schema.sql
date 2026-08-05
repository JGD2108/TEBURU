-- Teburu: Initial Database Schema (PostgreSQL for Supabase)

-- 1. Tables (Mesas del restaurante)
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sessions (Sesión activa de una mesa)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE, -- Código corto generado por el mesero para que los clientes entren
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paying', 'closed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Agregar la sesión actual a la mesa
ALTER TABLE tables ADD COLUMN current_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- 3. Session Users (Comensales conectados a una sesión)
CREATE TABLE session_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Menu Categories
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT, -- Soporte Multi-idioma
    name_ja TEXT,
    sort_order INTEGER DEFAULT 0
);

-- 5. Menu Items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_en TEXT,
    name_ja TEXT,
    description TEXT,
    description_en TEXT,
    description_ja TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true
);

-- 6. Orders (Pedidos grupales o individuales dentro de la sesión)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES session_users(id), -- Quién lo pidió
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Order Items (Platillos dentro del pedido)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    notes TEXT
);

-- Habilitar Row Level Security (RLS) en Supabase para proteger los datos en tiempo real
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Por ahora, creamos políticas de lectura/escritura abiertas (para desarrollo MVP)
-- NOTA: Estas políticas deben ser restringidas en producción.
CREATE POLICY "Public Access" ON tables FOR ALL USING (true);
CREATE POLICY "Public Access" ON sessions FOR ALL USING (true);
CREATE POLICY "Public Access" ON session_users FOR ALL USING (true);
CREATE POLICY "Public Access" ON menu_categories FOR ALL USING (true);
CREATE POLICY "Public Access" ON menu_items FOR ALL USING (true);
CREATE POLICY "Public Access" ON orders FOR ALL USING (true);
CREATE POLICY "Public Access" ON order_items FOR ALL USING (true);
