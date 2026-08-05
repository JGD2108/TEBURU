# Teburu (テーブル) Restaurant OS

Plataforma web integral para la gestión de restaurantes y pedidos digitales interactivos mediante códigos QR en mesa.

## Requisitos de Configuración

1. Crear un archivo `.env.local` en la raíz con las siguientes variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<TU_PROYECTO>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_ANON_KEY_JWT>
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<PROYECTO>.supabase.co:5432/postgres
```

2. Ejecutar el script SQL de inicialización `src/lib/schema.sql` en el SQL Editor de tu proyecto de Supabase.

3. Habilitar la réplica en tiempo real (Realtime Replication) para las tablas `orders` y `tables` desde la consola de Supabase.

## Ejecución en Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

- **Clientes (Mesa)**: Escanean su QR o navegan a `/t/<TABLE_UUID>`
- **Administración y Staff**: Acceso en `/admin/login`

## Funcionalidades
- 📊 Dashboard general en tiempo real (Ventas, Ocupación de Mesas)
- 🍳 Monitor de Cocina (KDS - Kitchen Display System)
- 🔔 Panel de Meseros con alertas y llamadas de mesa
- 🪑 Gestor de Mesas con exportación e impresión de etiquetas QR en PDF (A6)
- 📜 Administración de menú, roles de personal e historial de caja
