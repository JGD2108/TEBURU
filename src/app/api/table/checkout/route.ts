import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';

export async function POST(request: Request) {
  let client;
  try {
    const { table_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    client = await getPoolClient();
    await client.query('BEGIN');

    // Cerrar la sesión activa de la mesa
    await client.query(`
      UPDATE sessions 
      SET status = 'closed', ended_at = now() 
      WHERE table_id = $1 AND status = 'active'
    `, [table_id]);

    // Limpiar la mesa
    await client.query(`
      UPDATE tables 
      SET status = 'available', current_session_id = NULL, access_code = NULL, needs_attention = false 
      WHERE id = $1
    `, [table_id]);

    await client.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error("Checkout API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
