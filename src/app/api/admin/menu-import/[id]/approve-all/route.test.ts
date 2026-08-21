import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireRole, getPoolClient } = vi.hoisted(() => ({ requireRole: vi.fn(), getPoolClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireRole, isAuthorizationFailure: (value: unknown) => value instanceof Response }));
vi.mock('@/lib/db', () => ({ getPoolClient }));

import { GET, POST } from './route';

const staff = { userId: 'admin-1', name: 'Admin', role: 'admin', restaurantId: 'restaurant-a', isPlatformAdmin: false };
const context = { params: Promise.resolve({ id: 'import-a' }) };
const updatedAt = '2026-08-21T20:00:00.000Z';
type DraftFixture = {
  id: string; draft_category_id: string; name: string; price: string;
  extraction_status: string; review_status: string; review_reasons: unknown[];
  updated_at: Date; extraction_attributes: Record<string, unknown>;
};
const eligible: DraftFixture = {
  id: '11111111-1111-4111-8111-111111111111', draft_category_id: '22222222-2222-4222-8222-222222222222', name: 'Arepa', price: '12.00',
  extraction_status: 'valid', review_status: 'pending', review_reasons: [], updated_at: new Date(updatedAt),
  extraction_attributes: { providerDecision: { recommendation: 'approve', decisionConfidence: 0.95, decisionReasons: ['CLEAR_EXTRACTION'] } },
};

function request(versions?: Record<string, string>) {
  return new Request('http://localhost/api/admin/menu-import/import-a/approve-all', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'approve-all-1' }, body: JSON.stringify(versions ? { draftVersions: versions } : {}),
  });
}

function clientFor(drafts = [eligible]) {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM menu_import_jobs')) return { rows: [{ status: 'needs_review', analyzer_version: 'menu-import-v5-text', analysis_execution_id: '33333333-3333-4333-8333-333333333333' }] };
    if (sql.includes('FROM menu_import_draft_items')) return { rows: drafts };
    if (sql.includes('UPDATE menu_import_draft_items')) return { rowCount: 1, rows: [] };
    return { rows: [], rowCount: 1 };
  });
  getPoolClient.mockResolvedValue(client);
  return client;
}

describe('POST /api/admin/menu-import/[id]/approve-all', () => {
  beforeEach(() => { vi.clearAllMocks(); requireRole.mockResolvedValue(staff); process.env.MENU_IMPORT_ASSISTED_APPROVAL_ENABLED = 'true'; });

  it('requires an administrator', async () => {
    requireRole.mockResolvedValue(new Response(null, { status: 403 }));
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(403);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant imports without reading drafts', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    getPoolClient.mockResolvedValue(client);
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(404);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('menu_import_draft_items'))).toBe(false);
    expect(client.query.mock.calls[1][1]).toEqual(['import-a', 'restaurant-a']);
  });

  it('approves only currently eligible V5 drafts and records a bounded audit summary', async () => {
    const review = { ...eligible, id: '44444444-4444-4444-8444-444444444444', extraction_status: 'review', review_reasons: [{ code: 'AMBIGUOUS_PRICE' }] };
    const client = clientFor([eligible, review]);
    const response = await POST(request({ [eligible.id]: updatedAt, [review.id]: updatedAt }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ approved: 1, skipped: 1, skipReasons: expect.arrayContaining(['NOT_VALID']) }) }));
    const update = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE menu_import_draft_items'))!;
    expect(update[1]).toEqual(['import-a', 'restaurant-a', [eligible.id]]);
    const audit = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_analysis_lineage_events'))!;
    expect(JSON.parse(audit[1][4])).toEqual(expect.objectContaining({ bulkApproval: expect.objectContaining({ actorId: 'admin-1', approved: 1, skipped: 1, policyVersion: 'assisted-approval-v1' }) }));
    expect(client.query.mock.calls.some(([sql]) => /menu_(items|categories)|menu_import_image_suggestions/.test(String(sql)))).toBe(false);
  });

  it('leaves every draft unchanged on a stale snapshot while auditing the conflict', async () => {
    const client = clientFor();
    const response = await POST(request({ [eligible.id]: '2020-01-01T00:00:00.000Z' }), context);
    expect(response.status).toBe(409);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE menu_import_draft_items'))).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_analysis_lineage_events'))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => String(sql) === 'COMMIT')).toBe(true);
  });

  it('is idempotent for an already-approved draft', async () => {
    const client = clientFor([{ ...eligible, review_status: 'approved' }]);
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ approved: 0, skipped: 1, skipReasons: ['ALREADY_APPROVED'] }) }));
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE menu_import_draft_items'))).toBe(false);
  });

  it('rolls back if a concurrent update prevents the all-or-nothing approval', async () => {
    const client = clientFor();
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 1 };
      if (sql.includes('FROM menu_import_jobs')) return { rows: [{ status: 'needs_review', analyzer_version: 'menu-import-v5-text', analysis_execution_id: '33333333-3333-4333-8333-333333333333' }] };
      if (sql.includes('FROM menu_import_draft_items')) return { rows: [eligible] };
      if (sql.includes('UPDATE menu_import_draft_items')) return { rowCount: 0, rows: [] };
      return { rows: [], rowCount: 1 };
    });
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(500);
    expect(client.query.mock.calls.some(([sql]) => String(sql) === 'ROLLBACK')).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => String(sql) === 'COMMIT')).toBe(false);
  });

  it('requires a valid draft-version precondition before opening a transaction', async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(400);
    expect(getPoolClient).not.toHaveBeenCalled();
  });

  it('replays the recorded result for the same actor, import, and draft-version snapshot', async () => {
    const client = clientFor();
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 1 };
      if (sql.includes('FROM menu_import_jobs')) return { rows: [{ status: 'needs_review', analyzer_version: 'menu-import-v5-text', analysis_execution_id: '33333333-3333-4333-8333-333333333333' }] };
      if (sql.includes('FROM menu_import_analysis_lineage_events')) return { rows: [{ bulk_approval: {
        policyVersion: 'assisted-approval-v1', confidenceThreshold: 0.9, approved: 2, skipped: 1,
        reasons: [{ reason: 'NOT_VALID', count: 1 }],
      } }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: {
      approved: 2, skipped: 1, skipReasons: ['NOT_VALID'], policyVersion: 'assisted-approval-v1', confidenceThreshold: 0.9,
    }, requestId: 'approve-all-1' });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('menu_import_draft_items'))).toBe(false);
  });

  it('issues a restaurant-scoped optional draft-version precondition', async () => {
    const client = clientFor();
    const response = await GET(new Request('http://localhost/api/admin/menu-import/import-a/approve-all'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ enabled: true, eligibleImport: true, draftVersions: { [eligible.id]: updatedAt } }) }));
    expect(client.query.mock.calls[0][1]).toEqual(['import-a', 'restaurant-a']);
  });

  it('fails closed while the server-side assisted-approval flag is disabled', async () => {
    delete process.env.MENU_IMPORT_ASSISTED_APPROVAL_ENABLED;
    const response = await POST(request({ [eligible.id]: updatedAt }), context);
    expect(response.status).toBe(409);
    expect(getPoolClient).not.toHaveBeenCalled();
  });
});
