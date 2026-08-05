import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { table_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();
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
    await client.end();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Checkout API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
