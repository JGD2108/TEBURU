import { afterEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/lib/db', () => ({ query }));

import { POST } from './route';

const requestFor = (body: unknown) => new Request('http://localhost/api/kds/update', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('POST /api/kds/update', () => {
  afterEach(() => vi.clearAllMocks());

  it('moves a pending order to preparing', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const response = await POST(requestFor({ order_id: 'order-1', status: 'preparing' }));

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('status = $3'), [
      'preparing', 'order-1', 'pending',
    ]);
  });

  it('rejects legacy and out-of-order statuses', async () => {
    const response = await POST(requestFor({ order_id: 'order-1', status: 'cooking' }));

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports a concurrent state change without overwriting it', async () => {
    query.mockResolvedValue({ rowCount: 0 });

    const response = await POST(requestFor({ order_id: 'order-1', status: 'ready' }));

    expect(response.status).toBe(409);
  });
});
