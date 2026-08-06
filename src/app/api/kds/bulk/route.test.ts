import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPoolClient, requireRole, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { getPoolClient: vi.fn().mockResolvedValue(client), requireRole: vi.fn(), client };
});

vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));

import { POST } from './route';

const requestFor = (body: unknown) => new Request('http://localhost/api/kds/bulk', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/kds/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'staff-1', name: 'Kitchen', role: 'kitchen' });
    getPoolClient.mockResolvedValue(client);
  });

  it('applies the complete batch in one transaction', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes('UPDATE order_items')
      ? { rows: [{ order_id: 'order-1' }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor({ status: 'preparing', items: [{ item_id: 'item-1', version: 0 }, { item_id: 'item-2', version: 0 }] }));
    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back when one item is stale', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes('UPDATE order_items')
      ? { rows: [], rowCount: 0 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor({ status: 'ready', items: [{ item_id: 'item-1', version: 4 }] }));
    expect(response.status).toBe(409);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
