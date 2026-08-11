import { NextResponse } from 'next/server';
import { getPoolClient } from '@/lib/db';
import { isAuthorizationFailure, requireRole } from '@/lib/auth';

const nextStatuses: Record<string, string[]> = {
  preparing: ['pending'],
  ready: ['preparing'],
  cancelled: ['pending', 'preparing'],
};
const priorities = ['normal', 'high', 'urgent'] as const;

export async function POST(request: Request) {
  const staff = await requireRole(request, 'admin', 'kitchen');
  if (isAuthorizationFailure(staff)) return staff;

  let client;
  try {
    const { item_id, status, priority, version, reason } = await request.json();
    const isStatusChange = typeof status === 'string' && Boolean(nextStatuses[status]);
    const isPriorityChange = typeof priority === 'string' && priorities.some((value) => value === priority);
    if (typeof item_id !== 'string' || !Number.isInteger(version) ||
        isStatusChange === isPriorityChange ||
        (status === 'cancelled' && (typeof reason !== 'string' || reason.trim().length < 3))) {
      return NextResponse.json({ error: 'Actualización de platillo inválida' }, { status: 400 });
    }

    client = await getPoolClient();
    await client.query('BEGIN');
    const current = await client.query<{
      order_id: string; kitchen_status: string; priority: string; version: number;
    }>('SELECT order_id, kitchen_status, priority, version FROM order_items WHERE id = $1 AND restaurant_id = $2 FOR UPDATE', [item_id, staff.restaurantId]);
    const item = current.rows[0];
    if (!item || item.version !== version || (isStatusChange && !nextStatuses[status].includes(item.kitchen_status))) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'El platillo ya cambió; recarga el KDS' }, { status: 409 });
    }

    const updated = isStatusChange
      ? await client.query<{ version: number }>(
        `UPDATE order_items
         SET kitchen_status = $1,
             started_at = CASE WHEN $1 = 'preparing' THEN COALESCE(started_at, now()) ELSE started_at END,
             ready_at = CASE WHEN $1 = 'ready' THEN now() ELSE ready_at END,
             version = version + 1
         WHERE id = $2 AND version = $3 RETURNING version`,
        [status, item_id, version]
      )
      : await client.query<{ version: number }>(
        'UPDATE order_items SET priority = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING version',
        [priority, item_id, version]
      );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Conflicto de actualización' }, { status: 409 });
    }

    await client.query(
      `INSERT INTO order_events
         (order_id, order_item_id, actor_staff_id, event_type, from_status, to_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      isStatusChange
        ? [item.order_id, item_id, staff.userId, 'item_status_changed', item.kitchen_status, status,
          JSON.stringify(status === 'cancelled' ? { reason: reason.trim() } : {})]
        : [item.order_id, item_id, staff.userId, 'item_priority_changed', item.priority, priority, '{}']
    );
    await client.query('COMMIT');
    return NextResponse.json({ success: true, version: updated.rows[0].version });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('KDS item update error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el platillo' }, { status: 500 });
  } finally {
    client?.release();
  }
}
