import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { StaffSession } from '@/lib/auth';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TableForActivation = {
  id: string;
  table_number: number;
  status: string;
  current_session_id: string | null;
  assigned_waiter_id: string | null;
};

export class TableActivationError extends Error {
  constructor(public readonly code: 'INVALID_TABLES' | 'FORBIDDEN_TABLE' | 'TABLE_UNAVAILABLE' | 'MIXED_WAITERS' | 'CODE_GENERATION_FAILED') {
    super(code);
  }
}

export function normalizeTableIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new TableActivationError('INVALID_TABLES');
  const ids = [...new Set(value)];
  if (!ids.every((id) => typeof id === 'string' && uuid.test(id))) throw new TableActivationError('INVALID_TABLES');
  return ids;
}

function newAccessCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function activateTables(client: PoolClient, staff: StaffSession, tableIds: string[]) {
  const { rows: tables } = await client.query<TableForActivation>(
    `SELECT id, table_number, status, current_session_id, assigned_waiter_id
     FROM tables WHERE id = ANY($1::uuid[]) ORDER BY table_number FOR UPDATE`,
    [tableIds]
  );

  if (tables.length !== tableIds.length) throw new TableActivationError('INVALID_TABLES');
  if (staff.role === 'waiter' && tables.some((table) => table.assigned_waiter_id !== staff.userId)) {
    throw new TableActivationError('FORBIDDEN_TABLE');
  }
  if (tables.some((table) => table.status !== 'available' || table.current_session_id !== null)) {
    throw new TableActivationError('TABLE_UNAVAILABLE');
  }

  const waiterIds = new Set(tables.map((table) => table.assigned_waiter_id));
  if (waiterIds.size !== 1) throw new TableActivationError('MIXED_WAITERS');

  const primary = tables[0];
  const waiterId = primary.assigned_waiter_id;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pin = newAccessCode();
    try {
      const created = await client.query<{ id: string }>(
        `INSERT INTO sessions (table_id, status, code, waiter_id)
         VALUES ($1, 'active', $2, $3) RETURNING id`,
        [primary.id, pin, waiterId]
      );
      const sessionId = created.rows[0].id;
      await client.query(
        `INSERT INTO session_tables (session_id, table_id, is_primary)
         SELECT $1, unnest($2::uuid[]), unnest($3::boolean[])`,
        [sessionId, tables.map((table) => table.id), tables.map((table) => table.id === primary.id)]
      );
      await client.query(
        `UPDATE tables
         SET status = 'occupied', current_session_id = $1, access_code = $2, needs_attention = false
         WHERE id = ANY($3::uuid[])`,
        [sessionId, pin, tables.map((table) => table.id)]
      );
      return { sessionId, pin, tables };
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error;
    }
  }
  throw new TableActivationError('CODE_GENERATION_FAILED');
}
