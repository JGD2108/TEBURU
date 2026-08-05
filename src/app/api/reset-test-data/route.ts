import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    // Iniciar transacción
    await client.query('BEGIN');

    // 1. Eliminar items de los pedidos
    await client.query('DELETE FROM order_items;');

    // 2. Eliminar pedidos
    await client.query('DELETE FROM orders;');

    // 3. Eliminar usuarios de las sesiones (clientes)
    await client.query('DELETE FROM session_users;');

    // 4. Eliminar las sesiones de las mesas
    await client.query('DELETE FROM sessions;');

    // 5. Reiniciar el estado de todas las mesas
    await client.query(`
      UPDATE tables 
      SET status = 'available', 
          current_session_id = NULL, 
          assigned_waiter_id = NULL, 
          needs_attention = false;
    `);

    // Nota: Mantenemos el staff intacto (tanto admins como meseros/cocina) 
    // para que no tengas que crear cuentas de empleados cada vez que quieras probar.

    await client.query('COMMIT');
    await client.end();

    return NextResponse.json({ success: true, message: "Datos transaccionales limpiados exitosamente. Las mesas están libres." });
  } catch (error: any) {
    console.error("API Reset Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
