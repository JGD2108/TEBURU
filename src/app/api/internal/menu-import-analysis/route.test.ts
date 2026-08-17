import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPoolClient, menuImportStorage, processMenuImportExecution } = vi.hoisted(() => ({
  getPoolClient: vi.fn(), menuImportStorage: vi.fn(), processMenuImportExecution: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('@/lib/menu-import-storage', () => ({ menuImportBucket: 'menu-imports', menuImportStorage }));
vi.mock('@/lib/menu-import/worker', () => ({ ANALYZER_VERSION: 'menu-import-v1', processMenuImportExecution }));

import { POST } from './route';

const jobId = '11111111-1111-4111-8111-111111111111';
const job = { id: jobId, restaurant_id: '22222222-2222-4222-8222-222222222222', source_storage_path: 'restaurants/22222222-2222-4222-8222-222222222222/pending/menu.pdf', source_size_bytes: '100', status: 'pending' };

function request(body: unknown, secret = 'automation-secret') {
  return new Request('http://localhost/api/internal/menu-import-analysis', {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: secret }, body: JSON.stringify(body),
  });
}

describe('menu import analysis webhook consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MENU_IMPORT_AUTOMATION_SECRET = 'automation-secret';
  });

  it('rejects unauthenticated and malformed browser-style calls before claiming a job', async () => {
    const unauthenticated = await POST(request({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }, 'wrong'));
    expect(unauthenticated.status).toBe(401);
    expect(getPoolClient).not.toHaveBeenCalled();

    const malformed = await POST(request({ type: 'UPDATE', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }));
    expect(malformed.status).toBe(400);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'UPDATE', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } },
    { type: 'INSERT', schema: 'private', table: 'menu_import_jobs', record: { id: jobId } },
    { type: 'INSERT', schema: 'public', table: 'other_table', record: { id: jobId } },
    { type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: 'not-a-uuid' } },
  ])('rejects invalid webhook event %#', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant path or a non-PDF/missing object without claiming', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    client.query.mockResolvedValueOnce({ rows: [{ ...job, source_storage_path: 'restaurants/other/pending/menu.pdf' }] });
    const crossTenant = await POST(request({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }));
    expect(crossTenant.status).toBe(422);
    expect(menuImportStorage).not.toHaveBeenCalled();

    vi.clearAllMocks();
    process.env.MENU_IMPORT_AUTOMATION_SECRET = 'automation-secret';
    const nonPdfClient = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    getPoolClient.mockResolvedValue(nonPdfClient);
    nonPdfClient.query.mockResolvedValueOnce({ rows: [job] });
    const bucket = { info: vi.fn().mockResolvedValue({ data: { size: 100, contentType: 'text/plain' }, error: null }), exists: vi.fn() };
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue(bucket) } });
    const nonPdf = await POST(request({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }));
    expect(nonPdf.status).toBe(422);
    expect(nonPdfClient.query.mock.calls.some(([sql]) => String(sql).includes("status = 'processing'"))).toBe(false);
  });

  it('claims a validated pending job once and executes its exact execution id', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    const info = vi.fn().mockResolvedValue({ data: { size: 100, contentType: 'application/pdf' }, error: null });
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ info }) } });
    client.query.mockResolvedValue({ rows: [] });
    client.query
      .mockResolvedValueOnce({ rows: [job] })
      .mockResolvedValueOnce({ rows: [] }) // stale run recovery
      .mockResolvedValueOnce({ rows: [] }) // stale job recovery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ ...job, status: 'processing' }] })
      .mockResolvedValueOnce({ rows: [] }) // run
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    processMenuImportExecution.mockResolvedValue(jobId);

    const response = await POST(request({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }));

    expect(response.status).toBe(202);
    expect(processMenuImportExecution).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/i), expect.any(Function));
    const claim = client.query.mock.calls.find(([sql]) => String(sql).includes("SET status = 'processing'"))!;
    expect(claim[1]).toEqual(expect.arrayContaining([jobId, expect.stringMatching(/^[0-9a-f-]{36}$/i), 'menu-import-v1']));
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('treats duplicate webhook delivery as a no-op and never starts a second execution', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    menuImportStorage.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ info: vi.fn().mockResolvedValue({ data: { size: 100, contentType: 'application/pdf' }, error: null }) }) } });
    client.query.mockResolvedValue({ rows: [] });
    client.query
      .mockResolvedValueOnce({ rows: [job] })
      .mockResolvedValueOnce({ rows: [] }) // stale run recovery
      .mockResolvedValueOnce({ rows: [] }) // stale job recovery
      .mockResolvedValueOnce({ rows: [] }) // conditional update does not claim
      .mockResolvedValueOnce({ rows: [] });

    const response = await POST(request({ type: 'INSERT', schema: 'public', table: 'menu_import_jobs', record: { id: jobId } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ claimed: false, reason: 'already_claimed' }) }));
    expect(processMenuImportExecution).not.toHaveBeenCalled();
  });
});
