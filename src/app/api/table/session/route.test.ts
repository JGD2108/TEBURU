import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireGuestSession, setGuestCookie, clearGuestCookie } = vi.hoisted(() => ({
  requireGuestSession: vi.fn(), setGuestCookie: vi.fn(), clearGuestCookie: vi.fn(),
}));
vi.mock('@/lib/guest-session', () => ({
  requireGuestSession,
  setGuestCookie,
  clearGuestCookie,
  isGuestFailure: (value: unknown) => value instanceof Response,
}));

import { GET } from './route';

describe('GET /api/table/session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores only the public mobile identity for the requested table', async () => {
    requireGuestSession.mockResolvedValue({ tokenId: 'token-1', sessionId: 'session-1', guestId: 'guest-1', tableId: 'table-1', guestName: 'Ana', rawToken: 'secret-token' });
    const response = await GET(new Request('http://localhost/api/table/session?table_id=table-1'));
    expect(response.status).toBe(200);
    expect(requireGuestSession).toHaveBeenCalledWith(expect.any(Request), 'table-1');
    expect(await response.json()).toEqual({ table_id: 'table-1', name: 'Ana' });
    expect(setGuestCookie).toHaveBeenCalledWith(expect.any(Response), 'secret-token');
  });

  it('returns 401 after expiration or checkout', async () => {
    requireGuestSession.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await GET(new Request('http://localhost/api/table/session?table_id=table-1'));
    expect(response.status).toBe(401);
    expect(clearGuestCookie).toHaveBeenCalledWith(response);
  });
});
