import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

type BulkItem = { item_id: string; version: number };
const transitions: Record<string, string> = { preparing: 'pending', ready: 'preparing' };

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'kitchen');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    const { items, status } = await request.json() as { items?: BulkItem[]; status?: string };
    if (!Array.isArray(items) || items.length < 1 || items.length > 100 ||
        typeof status !== 'string' || !transitions[status] ||
        items.some((item) => typeof item.item_id !== 'string' || !Number.isInteger(item.version))) {
      return NextResponse.json({ error: 'Actualización masiva inválida' }, { status: 400 });
    }

    client = await getPoolClient();
    await client.query('BEGIN');
    for (const item of items) {
      const updated = await client.query<{ order_id: string }>(
        `UPDATE order_items
         SET kitchen_status = $1,
             started_at = CASE WHEN $1 = 'preparing' THEN COALESCE(started_at, now()) ELSE started_at END,
             ready_at = CASE WHEN $1 = 'ready' THEN now() ELSE ready_at END,
             version = version + 1
         WHERE id = $2 AND version = $3 AND kitchen_status = $4 RETURNING order_id`,
        [status, item.item_id, item.version, transitions[status]]
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Una comanda cambió; el lote no fue aplicado' }, { status: 409 });
      }
      await client.query(
        `INSERT INTO order_events
           (order_id, order_item_id, actor_staff_id, event_type, from_status, to_status, metadata)
         VALUES ($1, $2, $3, 'item_status_changed', $4, $5, '{"bulk":true}'::jsonb)`,
        [updated.rows[0].order_id, item.item_id, staff.userId, transitions[status], status]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('KDS bulk update error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el lote' }, { status: 500 });
  } finally {
    client?.release();
  }
}
