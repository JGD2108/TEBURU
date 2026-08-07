import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPoolClient, requireRole, client } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { getPoolClient: vi.fn(), requireRole: vi.fn(), client };
});
vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));

import { POST } from './route';

const requestFor = () => new Request('http://localhost/api/table/checkout', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table_id: 'table-1' }),
});

describe('POST /api/table/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'waiter-1', name: 'Waiter', role: 'waiter' });
    getPoolClient.mockResolvedValue(client);
  });

  it('revokes every guest token while closing the table', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes('SELECT id FROM tables')
      ? { rows: [{ id: 'table-1' }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor());
    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE guest_access_tokens'), ['table-1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects a waiter who does not own the table', async () => {
    client.query.mockImplementation(async (sql: string) => sql.includes('SELECT id FROM tables')
      ? { rows: [], rowCount: 0 }
      : { rows: [], rowCount: 1 });
    const response = await POST(requestFor());
    expect(response.status).toBe(403);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
