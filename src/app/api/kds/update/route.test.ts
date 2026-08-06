import { afterEach, describe, expect, it, vi } from 'vitest';

const { getPoolClient, requireRole, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { getPoolClient: vi.fn().mockResolvedValue(client), requireRole: vi.fn(), client };
});

vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/auth', () => ({
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));

import { POST } from './route';

const requestFor = (body: unknown) => new Request('http://localhost/api/kds/update', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/kds/update', () => {
  afterEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: '0d129f3e-9228-4e6a-a532-18ce049f16fd', name: 'Kitchen', role: 'kitchen' });
    getPoolClient.mockResolvedValue(client);
  });

  it('requires an authenticated kitchen session', async () => {
    requireRole.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await POST(requestFor({ item_id: 'item-1', status: 'preparing', version: 0 }));
    expect(response.status).toBe(401);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it('moves a pending item to preparing and writes an event', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT order_id')) return { rows: [{ order_id: 'order-1', kitchen_status: 'pending', version: 0 }], rowCount: 1 };
      if (sql.includes('UPDATE order_items')) return { rows: [{ version: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const response = await POST(requestFor({ item_id: 'item-1', status: 'preparing', version: 0 }));
    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO order_events'), expect.any(Array));
  });

  it('rejects legacy statuses before opening a transaction', async () => {
    const response = await POST(requestFor({ item_id: 'item-1', status: 'cooking', version: 0 }));
    expect(response.status).toBe(400);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it('returns a conflict when the item version is stale', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes('SELECT order_id')
      ? { rows: [{ order_id: 'order-1', kitchen_status: 'pending', version: 2 }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor({ item_id: 'item-1', status: 'preparing', version: 1 }));
    expect(response.status).toBe(409);
  });

  it('changes priority with optimistic locking and audit', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT order_id')) return { rows: [{ order_id: 'order-1', kitchen_status: 'pending', priority: 'normal', version: 0 }], rowCount: 1 };
      if (sql.includes('UPDATE order_items SET priority')) return { rows: [{ version: 1 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const response = await POST(requestFor({ item_id: 'item-1', priority: 'urgent', version: 0 }));
    expect(response.status).toBe(200);
    expect(client.query.mock.calls.some(([, params]) => Array.isArray(params) && params.includes('item_priority_changed'))).toBe(true);
  });
});
