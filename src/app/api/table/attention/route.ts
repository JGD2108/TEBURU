import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { table_id, needs_attention } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    const client = new Client({
      connectionString: 'postgresql://postgres:qy0x7Kse76ZIBJmG@db.jobdlmjfcxmyzwhkdank.supabase.co:5432/postgres'
    });
    
    await client.connect();

    await client.query(`
      UPDATE tables 
      SET needs_attention = $1 
      WHERE id = $2
    `, [Boolean(needs_attention), table_id]);

    await client.end();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update Attention Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
