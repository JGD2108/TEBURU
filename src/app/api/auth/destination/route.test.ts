import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuthenticatedUser, query, logger } = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  query: vi.fn(),
  logger: { error: vi.fn() },
}));
vi.mock('@/lib/auth', () => ({
  requireAuthenticatedUser,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@/lib/db', () => ({ query }));
vi.mock('@/lib/logger', () => ({ logger }));

import { GET } from './route';

describe('GET /api/auth/destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
  });

  it('prioritizes the private platform destination', async () => {
    query.mockResolvedValue({ rows: [{ is_platform_admin: true, role: 'admin', restaurant_id: 'restaurant-1' }] });
    const response = await GET(new Request('http://localhost/api/auth/destination'));
    expect((await response.json()).data).toEqual({ destination: '/platform', role: 'platform' });
  });

  it('routes restaurant staff to their role-based dashboard', async () => {
    query.mockResolvedValue({ rows: [{ is_platform_admin: false, role: 'waiter', restaurant_id: 'restaurant-1' }] });
    const response = await GET(new Request('http://localhost/api/auth/destination'));
    expect((await response.json()).data).toEqual({ destination: '/admin', role: 'waiter' });
  });

  it('rejects authenticated accounts without an active membership', async () => {
    query.mockResolvedValue({ rows: [{ is_platform_admin: false, role: null, restaurant_id: null }] });
    const response = await GET(new Request('http://localhost/api/auth/destination'));
    expect(response.status).toBe(403);
  });

  it('returns a structured JSON error when destination lookup fails', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    const response = await GET(new Request('http://localhost/api/auth/destination'));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(payload.error).toEqual(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      message: 'No se pudo determinar el acceso de esta cuenta. Inténtalo de nuevo.',
    }));
    expect(logger.error).toHaveBeenCalledWith('auth.destination_failed', expect.any(Error));
  });
});
