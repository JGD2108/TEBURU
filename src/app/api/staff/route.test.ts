import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, requireRole, createUser, deleteUser } = vi.hoisted(() => ({
  query: vi.fn(), requireRole: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ query }));
vi.mock('@/lib/auth', () => ({
  staffRoles: ['admin', 'waiter', 'kitchen'],
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { createUser, deleteUser } } }),
}));

import { POST } from './route';

const requestFor = (body: unknown) => new Request('http://localhost/api/staff', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/staff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    requireRole.mockResolvedValue({ userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-1', isPlatformAdmin: false });
  });

  it('rejects callers without the admin role before provisioning', async () => {
    requireRole.mockResolvedValue(new Response(null, { status: 403 }));
    const response = await POST(requestFor({ email: 'cook@example.com', password: 'LongPassword_1', name: 'Cook', role: 'kitchen' }));
    expect(response.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('persists the exact Supabase Auth user id', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [{ id: 'staff-1' }], rowCount: 1 });
    createUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    const response = await POST(requestFor({ email: 'COOK@example.com', password: 'LongPassword_1', name: 'Cook', role: 'kitchen' }));
    expect(response.status).toBe(201);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO staff'), ['restaurant-1', 'auth-user-1', 'Cook', 'kitchen', 'cook@example.com']);
  });

  it('removes the Auth user if the staff insert fails', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockRejectedValueOnce(new Error('database failed'));
    createUser.mockResolvedValue({ data: { user: { id: 'auth-user-2' } }, error: null });
    deleteUser.mockResolvedValue({ data: {}, error: null });
    const response = await POST(requestFor({ email: 'waiter@example.com', password: 'LongPassword_1', name: 'Waiter', role: 'waiter' }));
    expect(response.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('auth-user-2');
  });
});
