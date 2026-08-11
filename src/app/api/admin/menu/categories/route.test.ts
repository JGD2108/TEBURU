import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { requireRole, query } = vi.hoisted(() => ({ requireRole: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  requireRole,
  isAuthorizationFailure: (value: unknown) => value instanceof Response,
}));
vi.mock('@/lib/db', () => ({ query }));

import { POST } from './route';

const requestFor = (name: unknown) => new Request('http://localhost/api/admin/menu/categories', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name }),
});

describe('POST /api/admin/menu/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-1', isPlatformAdmin: false });
  });

  it('creates a trimmed category at the end of the menu', async () => {
    query.mockResolvedValue({ rows: [{ id: 'category-1', name: 'Bebidas', sort_order: 3 }], rowCount: 1 });

    const response = await POST(requestFor('  Bebidas  '));

    expect(response.status).toBe(201);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO menu_categories'), ['restaurant-1', 'Bebidas']);
    expect(await response.json()).toMatchObject({ data: { name: 'Bebidas' } });
  });

  it('rejects an empty category name', async () => {
    const response = await POST(requestFor('   '));

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not allow unauthenticated category creation', async () => {
    requireRole.mockResolvedValue(NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 }));

    const response = await POST(requestFor('Bebidas'));

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});
