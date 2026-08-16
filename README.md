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

### Recorrido visual local (sin Vercel ni Supabase)

Para revisar la interfaz sin servicios externos, agrega esta variable a `.env.local` y reinicia el servidor:

```env
NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true
```

Después abre [http://localhost:3000/admin/login](http://localhost:3000/admin/login). El selector **DEMO LOCAL** permite recorrer plataforma, administrador, mesero, cocina y comensal. Los datos demo se reinician con el servidor y el modo no debe habilitarse en producción.

## Funcionalidades
- 📊 Dashboard general en tiempo real (Ventas, Ocupación de Mesas)
- 🍳 Monitor de Cocina (KDS - Kitchen Display System)
- 🔔 Panel de Meseros con alertas y llamadas de mesa
- 🪑 Gestor de Mesas con exportación e impresión de etiquetas QR en PDF (A6)
- 📜 Administración de menú, roles de personal e historial de caja
