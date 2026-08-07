import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, requireRole } = vi.hoisted(() => ({ query: vi.fn(), requireRole: vi.fn() }));
vi.mock('@/lib/db', () => ({ query }));
vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));

import { POST } from './route';

describe('POST /api/kitchen/stations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'admin-1', name: 'Admin', role: 'admin' });
  });

  it('requires an administrator', async () => {
    requireRole.mockResolvedValue(new Response(null, { status: 403 }));
    const response = await POST(new Request('http://localhost/api/kitchen/stations', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('validates SLA thresholds before writing', async () => {
    const response = await POST(new Request('http://localhost/api/kitchen/stations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sushi', warning_minutes: 15, critical_minutes: 10 }),
    }));
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
