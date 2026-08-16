import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, query, getPoolClient, ensureMenuImportBucket, menuImportStorage } = vi.hoisted(() => ({
  requireRole: vi.fn(), query: vi.fn(), getPoolClient: vi.fn(), ensureMenuImportBucket: vi.fn(), menuImportStorage: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));
vi.mock('@/lib/db', () => ({ query, getPoolClient }));
vi.mock('@/lib/menu-import-storage', () => ({
  menuImportBucket: 'menu-imports', ensureMenuImportBucket, menuImportStorage,
}));

import { POST as createImport } from './route';
import { GET as getImport } from './[id]/route';
import { GET as getSource } from './[id]/source/route';
import { PATCH as updateDraft } from './[id]/draft-items/[itemId]/route';
import { POST as publish } from './[id]/publish/route';

const staff = { userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-a', isPlatformAdmin: false };
const context = (id = 'import-a', itemId = 'item-a') => ({ params: Promise.resolve({ id, itemId }) });

function uploadRequest(file: File) {
  const form = new FormData(); form.set('file', file);
  return new Request('http://localhost/api/admin/menu-import', { method: 'POST', body: form });
}

describe('PDF menu import APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(staff);
  });

  it('rejects invalid PDF uploads before storage or draft creation', async () => {
    const response = await createImport(uploadRequest(new File(['not a pdf'], 'menu.txt', { type: 'text/plain' })));
    expect(response.status).toBe(400);
    expect(ensureMenuImportBucket).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a restaurant-scoped import for a valid PDF', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    ensureMenuImportBucket.mockResolvedValue({ storage: { from: vi.fn().mockReturnValue({ upload }) } });
    query.mockResolvedValue({ rows: [{ id: 'import-a', status: 'pending' }] });
    const response = await createImport(uploadRequest(new File(['%PDF-1.7'], 'menu.pdf', { type: 'application/pdf' })));
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(expect.stringContaining('restaurants/restaurant-a/sources/'), expect.any(Uint8Array), expect.objectContaining({ contentType: 'application/pdf' }));
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['restaurant-a', 'admin-1', 'menu.pdf']));
  });

  it('does not disclose another restaurant’s draft or source document', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const draftResponse = await getImport(new Request('http://localhost'), context());
    expect(draftResponse.status).toBe(404);
    expect(query.mock.calls[0][1]).toEqual(['import-a', 'restaurant-a']);

    query.mockReset(); query.mockResolvedValueOnce({ rows: [] });
    const sourceResponse = await getSource(new Request('http://localhost'), context());
    expect(sourceResponse.status).toBe(404);
    expect(menuImportStorage).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual(['import-a', 'restaurant-a']);
  });

  it('issues a short-lived source URL only after restaurant authorization', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://private.example/pdf' }, error: null });
    query.mockResolvedValue({ rows: [{ source_storage_path: 'restaurants/restaurant-a/sources/menu.pdf' }] });
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } });
    const response = await getSource(new Request('http://localhost'), context());
    expect(response.status).toBe(200);
    expect(createSignedUrl).toHaveBeenCalledWith('restaurants/restaurant-a/sources/menu.pdf', 300);
  });

  it('keeps draft edits restaurant-scoped and rejects invalid prices', async () => {
    const invalid = await updateDraft(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ price: -1 }) }), context());
    expect(invalid.status).toBe(400);
    expect(query).not.toHaveBeenCalled();

    query.mockResolvedValue({ rows: [{ id: 'item-a', name: 'Arepa', price: '9.5' }] });
    const response = await updateDraft(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: ' Arepa ', price: 9.5, approved: true }) }), context());
    expect(response.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['Arepa', 9.5, 'item-a', 'import-a', 'restaurant-a']));
  });

  it('rolls back publication when an approved item is invalid', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ status: 'needs_review' }] }) // lock job
      .mockResolvedValueOnce({ rows: [{ id: 'item-a' }] }) // invalid items
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    const response = await publish(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ mode: 'append' }) }), context());
    expect(response.status).toBe(422);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls[1][1]).toEqual(['import-a', 'restaurant-a']);
    expect(client.query.mock.calls.some((call: unknown[]) => {
      const [sql] = call as [string, ...unknown[]];
      return sql.includes('INSERT INTO menu_items');
    })).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('appends approved items in one transaction and marks the draft published', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    menuImportStorage.mockReturnValue(null);
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ status: 'needs_review' }] })
      .mockResolvedValueOnce({ rows: [] }) // validation
      .mockResolvedValueOnce({ rows: [{ id: 'item-a', name: 'Arepa', description: null, price: '9.5', category_name: 'Entradas', image_id: null, storage_path: null, mime_type: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'category-a' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'menu-item-a' }] })
      .mockResolvedValueOnce({ rows: [] }) // draft item
      .mockResolvedValueOnce({ rows: [] }) // draft categories
      .mockResolvedValueOnce({ rows: [] }) // job
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const response = await publish(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ mode: 'append' }) }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ published: 1 });
    expect(client.query.mock.calls.some((call: unknown[]) => {
      const [sql, params] = call as [string, unknown[]];
      return sql.includes('INSERT INTO menu_items') && params[0] === 'restaurant-a';
    })).toBe(true);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('cancels publication requests without opening a database transaction', async () => {
    const response = await publish(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ mode: 'replace' }) }), context());
    expect(response.status).toBe(400);
    expect(getPoolClient).not.toHaveBeenCalled();
  });
});
