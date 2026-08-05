import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';

export async function POST() {
  let client;
  try {
    client = await getPoolClient();
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

    await client.query('COMMIT');

    return NextResponse.json({ 
      success: true, 
      message: "Datos transaccionales limpiados exitosamente. Las mesas están libres." 
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error("API Reset Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
