import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPoolClient, requireRole, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { getPoolClient: vi.fn().mockResolvedValue(client), requireRole: vi.fn(), client };
});

vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));

import { POST } from './route';

const requestFor = (body: unknown) => new Request('http://localhost/api/orders/deliver', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/orders/deliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'staff-1', name: 'Waiter', role: 'waiter' });
    getPoolClient.mockResolvedValue(client);
  });

  it('records pickup only from ready state', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes("UPDATE orders SET status = 'delivered'")
      ? { rows: [{ id: 'order-1' }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor({ order_id: 'order-1' }));
    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('order_delivered'), ['order-1', 'staff-1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects delivery when the order is not ready', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes("UPDATE orders SET status = 'delivered'")
      ? { rows: [], rowCount: 0 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor({ order_id: 'order-1' }));
    expect(response.status).toBe(409);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
