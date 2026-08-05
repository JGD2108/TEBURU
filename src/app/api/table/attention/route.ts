import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { table_id, needs_attention } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    await query(`
      UPDATE tables 
      SET needs_attention = $1 
      WHERE id = $2
    `, [Boolean(needs_attention), table_id]);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update Attention Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
