import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { order_id, status } = await request.json();
    
    if (!order_id || !status) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!['pending', 'cooking', 'served'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    await query(`
      UPDATE orders 
      SET status = $1 
      WHERE id = $2
    `, [status, order_id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("KDS Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
