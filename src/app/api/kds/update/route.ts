import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { order_id, status } = await request.json();
    
    if (!order_id || !status) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!['pending', 'cooking', 'served'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    // Si status es 'served', también actualizamos la tabla (si la mesa estuviera en 'needs_attention')
    // Aunque usualmente el 'served' solo notifica al mesero.

    await client.query(`
      UPDATE orders 
      SET status = $1 
      WHERE id = $2
    `, [status, order_id]);

    await client.end();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("KDS Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
