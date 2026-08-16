import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, query, getPoolClient, ensureMenuImportBucket, menuImportStorage } = vi.hoisted(() => ({
  requireRole: vi.fn(), query: vi.fn(), getPoolClient: vi.fn(), ensureMenuImportBucket: vi.fn(), menuImportStorage: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));
vi.mock('@/lib/db', () => ({ query, getPoolClient }));
vi.mock('@/lib/menu-import-storage', () => ({
  menuImportBucket: 'menu-imports', ensureMenuImportBucket, menuImportStorage,
}));

import { GET as listImports, POST as createImport } from './route';
import { GET as getImport } from './[id]/route';
import { GET as getSource } from './[id]/source/route';
import { PATCH as updateDraft } from './[id]/draft-items/[itemId]/route';
import { POST as publish } from './[id]/publish/route';
import { POST as authorizeUpload } from './upload-authorizations/route';
import { POST as finalizeUpload } from './finalize/route';
import { GET as publicSettings } from '@/app/api/public/settings/route';

const staff = { userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-a', isPlatformAdmin: false };
const context = (id = 'import-a', itemId = 'item-a') => ({ params: Promise.resolve({ id, itemId }) });

function uploadRequest(file: File) {
  const form = new FormData(); form.set('file', file);
  return new Request('http://localhost/api/admin/menu-import', { method: 'POST', body: form });
}

function jsonRequest(url: string, body: unknown, requestId = 'request-1') {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify(body),
  });
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
    expect(await response.json()).toEqual(expect.objectContaining({ data: { published: 1 }, published: 1, requestId: expect.any(String) }));
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

describe('deployment-safe menu import upload APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue(staff);
  });

  it('keeps public settings valid JSON and reports import readiness without a table id', async () => {
    menuImportStorage.mockReturnValue(null);
    const response = await publicSettings(new Request('http://localhost/api/public/settings', { headers: { 'x-request-id': 'settings-1' } }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      data: null,
      importReadiness: expect.objectContaining({
        available: false,
        code: 'IMPORT_STORAGE_UNAVAILABLE',
        maxPdfBytes: 20 * 1024 * 1024,
      }),
      requestId: 'settings-1',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an invalid upload authorization request with the JSON error envelope', async () => {
    const response = await authorizeUpload(jsonRequest('http://localhost/api/admin/menu-import/upload-authorizations', {
      filename: 'menu.pdf', size: 0, contentType: 'application/pdf',
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'IMPORT_UPLOAD_INVALID', requestId: 'request-1' }),
    });
    expect(ensureMenuImportBucket).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns a JSON database-unavailable response when the import-list query fails', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

    const response = await listImports(new Request('http://localhost/api/admin/menu-import', {
      headers: { 'x-request-id': 'list-db-down-1' },
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'IMPORT_DATABASE_UNAVAILABLE', requestId: 'list-db-down-1' }),
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM menu_import_jobs'), ['restaurant-a']);
  });

  it('does not query PostgreSQL when storage credentials or the private bucket are unavailable', async () => {
    ensureMenuImportBucket.mockRejectedValueOnce(new Error('Bucket not found'));

    const response = await authorizeUpload(jsonRequest('http://localhost/api/admin/menu-import/upload-authorizations', {
      filename: 'menu.pdf', size: 100, contentType: 'application/pdf',
    }, 'storage-bucket-1'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'IMPORT_STORAGE_UNAVAILABLE', requestId: 'storage-bucket-1' }),
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('reproduces a missing authorization migration after a successful storage handshake', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example/upload', token: 'storage-token' }, error: null });
    ensureMenuImportBucket.mockResolvedValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUploadUrl }) } });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    query.mockRejectedValueOnce(Object.assign(
      new Error('relation "menu_import_upload_authorizations" does not exist'),
      { code: '42P01' },
    ));

    const response = await authorizeUpload(jsonRequest('http://localhost/api/admin/menu-import/upload-authorizations', {
      filename: 'menu.pdf', size: 100, contentType: 'application/pdf',
    }, 'missing-migration-1'));

    // The route has reached the database only after creating the signed storage URL.
    // Production logs therefore distinguish this from a missing key/bucket failure.
    expect(createSignedUploadUrl).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO menu_import_upload_authorizations'), expect.any(Array));
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toEqual({
      error: expect.objectContaining({ code: 'IMPORT_DATABASE_UNAVAILABLE', requestId: 'missing-migration-1' }),
    });
    expect(JSON.stringify(payload)).not.toContain('42P01');
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('"databaseCode":"42P01"'));
    errorLog.mockRestore();
  });

  it('authorizes a configured-limit PDF through a small control request', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example/upload', token: 'storage-token' }, error: null });
    ensureMenuImportBucket.mockResolvedValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUploadUrl }) } });
    query.mockResolvedValue({ rows: [{ expires_at: '2030-01-01T00:00:00.000Z' }] });
    const body = { filename: 'large-menu.pdf', size: 20 * 1024 * 1024, contentType: 'application/pdf' };

    const response = await authorizeUpload(jsonRequest('http://localhost/api/admin/menu-import/upload-authorizations', body));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(JSON.stringify(body).length).toBeLessThan(200);
    expect(payload.data.authorization).toEqual(expect.objectContaining({
      uploadUrl: 'https://storage.example/upload', uploadToken: 'storage-token', maxBytes: 20 * 1024 * 1024, contentType: 'application/pdf',
    }));
    expect(createSignedUploadUrl).toHaveBeenCalledWith(expect.stringContaining('restaurants/restaurant-a/pending/'));
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['restaurant-a', 'admin-1', 'large-menu.pdf', 20 * 1024 * 1024]));
  });

  it('does not finalize a missing or cross-restaurant authorization', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    const response = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-b', token: 'token-b' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.objectContaining({ code: 'IMPORT_UPLOAD_INVALID' }) });
    expect(client.query.mock.calls[1][1]).toEqual(['auth-b', 'restaurant-a']);
    expect(menuImportStorage).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects an expired authorization without creating an import job', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'auth-a', token_hash: createHash('sha256').update('token-a').digest('hex'), expires_at: '2000-01-01T00:00:00.000Z', import_job_id: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-a', token: 'token-a' }));

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: expect.objectContaining({ code: 'IMPORT_UPLOAD_EXPIRED' }) });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_jobs'))).toBe(false);
  });

  it('returns the stable incomplete-upload error when the authorized object is absent', async () => {
    const token = 'token-a';
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'auth-a', storage_path: 'restaurants/restaurant-a/pending/auth-a.pdf', source_filename: 'menu.pdf', expected_size_bytes: 100, expires_at: '2030-01-01T00:00:00.000Z', token_hash: createHash('sha256').update(token).digest('hex'), import_job_id: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const list = vi.fn().mockResolvedValue({ data: [], error: null });
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ list }) } });

    const response = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-a', token }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: expect.objectContaining({ code: 'IMPORT_UPLOAD_INCOMPLETE' }) });
    expect(list).toHaveBeenCalledWith('restaurants/restaurant-a/pending', { search: 'auth-a.pdf' });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_jobs'))).toBe(false);
  });

  it('returns the stable incomplete-upload error when object metadata differs from its authorization', async () => {
    const token = 'token-a';
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'auth-a', storage_path: 'restaurants/restaurant-a/pending/auth-a.pdf', source_filename: 'menu.pdf', expected_size_bytes: 100, expires_at: '2030-01-01T00:00:00.000Z', token_hash: createHash('sha256').update(token).digest('hex'), import_job_id: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const list = vi.fn().mockResolvedValue({ data: [{ name: 'auth-a.pdf', metadata: { size: 99, mimetype: 'application/pdf' } }], error: null });
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ list }) } });

    const response = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-a', token }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: expect.objectContaining({ code: 'IMPORT_UPLOAD_INCOMPLETE' }) });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_jobs'))).toBe(false);
  });

  it('creates once and returns the same import when finalization is retried', async () => {
    const token = 'token-a';
    const record = { id: 'auth-a', storage_path: 'restaurants/restaurant-a/pending/auth-a.pdf', source_filename: 'menu.pdf', expected_size_bytes: 100, expires_at: '2030-01-01T00:00:00.000Z', token_hash: createHash('sha256').update(token).digest('hex'), import_job_id: null };
    const importJob = { id: 'import-a', status: 'pending', source_filename: 'menu.pdf', source_size_bytes: 100, created_at: '2026-01-01T00:00:00.000Z' };
    const firstClient = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValueOnce(firstClient);
    firstClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [record] })
      .mockResolvedValueOnce({ rows: [importJob] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ list: vi.fn().mockResolvedValue({ data: [{ name: 'auth-a.pdf', metadata: { size: 100, mimetype: 'application/pdf' } }] }) }) } });

    const initial = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-a', token }));
    expect(initial.status).toBe(201);
    expect(await initial.json()).toEqual({ data: { import: importJob }, requestId: 'request-1' });

    const retryClient = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValueOnce(retryClient);
    retryClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...record, import_job_id: 'import-a' }] })
      .mockResolvedValueOnce({ rows: [importJob] })
      .mockResolvedValueOnce({ rows: [] });
    const retry = await finalizeUpload(jsonRequest('http://localhost/api/admin/menu-import/finalize', { authorizationId: 'auth-a', token }));

    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ data: { import: importJob }, requestId: 'request-1' });
    expect(retryClient.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_jobs'))).toBe(false);
  });
});
