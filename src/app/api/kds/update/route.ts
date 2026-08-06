import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { expectedOrderStatusForKitchenUpdate } from '@/lib/order-status';

export async function POST(request: Request) {
  try {
    const { order_id, status } = await request.json();

    if (typeof order_id !== 'string' || !order_id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const expectedCurrentStatus = expectedOrderStatusForKitchenUpdate(status);
    if (!expectedCurrentStatus) {
      return NextResponse.json({ error: 'Transición de estado inválida' }, { status: 400 });
    }

    const result = await query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2 AND status = $3
       RETURNING id`,
      [status, order_id, expectedCurrentStatus]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        { error: 'El pedido no existe o ya cambió de estado' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('KDS update error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 });
  }
}
