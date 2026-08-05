import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { table_id, waiter_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'Falta el ID de la mesa' }, { status: 400 });
    }

    const newPin = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits

    await query(`
      UPDATE tables 
      SET access_code = $1, assigned_waiter_id = $2
      WHERE id = $3
    `, [newPin, waiter_id || null, table_id]);

    return NextResponse.json({ success: true, pin: newPin });

  } catch (error: any) {
    console.error("Generate PIN Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
