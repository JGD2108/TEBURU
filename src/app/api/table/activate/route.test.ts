import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { requireRole, getPoolClient, activateTables, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { requireRole: vi.fn(), getPoolClient: vi.fn(), activateTables: vi.fn(), client };
});

vi.mock('@/lib/auth', () => ({
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/table-activation', () => ({
  activateTables,
  normalizeTableIds: (value: unknown) => value,
  TableActivationError: class TableActivationError extends Error {},
}));

import { POST } from './route';

const requestFor = (tableIds = ['00000000-0000-0000-0000-000000000001']) => new Request('http://localhost/api/table/activate', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table_ids: tableIds }),
});

describe('POST /api/table/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'waiter-1', name: 'Ada', role: 'waiter' });
    getPoolClient.mockResolvedValue(client);
  });

  it('activates every selected table in one transaction and returns one PIN', async () => {
    activateTables.mockResolvedValue({
      sessionId: 'session-1', pin: '483920',
      tables: [{ id: 'table-1', table_number: 4 }, { id: 'table-2', table_number: 5 }],
    });
    const response = await POST(requestFor(['table-1', 'table-2']));
    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(activateTables).toHaveBeenCalledWith(client, expect.objectContaining({ userId: 'waiter-1' }), ['table-1', 'table-2']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(await response.json()).toMatchObject({ pin: '483920', session_id: 'session-1', tables: [{ table_number: 4 }, { table_number: 5 }] });
  });

  it('does not touch the database when the caller is unauthenticated', async () => {
    requireRole.mockResolvedValue(NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 }));
    const response = await POST(requestFor());
    expect(response.status).toBe(401);
    expect(getPoolClient).not.toHaveBeenCalled();
  });
});
