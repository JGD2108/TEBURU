import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { table_id, waiter_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    const newPin = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    await client.query(`
      UPDATE tables 
      SET access_code = $1, assigned_waiter_id = $2
      WHERE id = $3
    `, [newPin, waiter_id || null, table_id]);

    await client.end();

    return NextResponse.json({ success: true, pin: newPin });

  } catch (error: any) {
    console.error("Generate PIN Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
