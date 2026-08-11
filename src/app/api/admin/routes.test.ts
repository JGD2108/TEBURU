import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { requireRole, query } = vi.hoisted(() => ({ requireRole: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@/lib/db', () => ({ query }));

import { GET as getMenu } from './menu/route';
import { GET as getOverview } from './overview/route';
import { GET as getSettings } from './settings/route';
import { GET as getTables } from './tables/route';

describe('admin business APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 }));
  });

  it.each([
    ['menu', getMenu],
    ['overview', getOverview],
    ['settings', getSettings],
    ['tables', getTables],
  ])('rejects anonymous access to %s', async (_name, handler) => {
    const response = await handler(new Request('http://localhost/api/admin'));
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('scopes every overview query to the active restaurant', async () => {
    requireRole.mockResolvedValue({ userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-1', isPlatformAdmin: false });
    query.mockResolvedValue({ rows: [] });
    const response = await getOverview(new Request('http://localhost/api/admin/overview'));
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(3);
    for (const call of query.mock.calls) {
      expect(call[0]).toContain('restaurant_id');
      expect(call[1]).toEqual(['restaurant-1']);
    }
  });
});
