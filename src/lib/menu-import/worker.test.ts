import { describe, expect, it, vi } from 'vitest';

const { getPoolClient } = vi.hoisted(() => ({ getPoolClient: vi.fn() }));
vi.mock('@/lib/db', () => ({ getPoolClient }));

import { processMenuImportExecution } from './worker';

const importId = '11111111-1111-4111-8111-111111111111';
const executionId = '22222222-2222-4222-8222-222222222222';
const job = { id: importId, restaurant_id: 'restaurant-a', source_storage_path: 'restaurants/restaurant-a/pending/menu.pdf', source_size_bytes: 1, analysis_execution_id: executionId, attempt: 1 };
const provider = {
  extractNative: vi.fn().mockResolvedValue({ pages: [{ page: 1, source: 'native' as const, text: 'ENTRADAS\nArepa 10' }], images: [] }),
  ocr: vi.fn().mockResolvedValue([]),
  structure: vi.fn().mockResolvedValue([{ category: 'ENTRADAS', name: 'Arepa', price: 10, page: 1, confidence: { category: 'high' as const, name: 'high' as const, description: 'low' as const, price: 'high' as const } }]),
  getStructureMetadata: vi.fn().mockReturnValue({ provider: 'gemini' as const, model: 'gemini-test' }),
  associateImages: vi.fn().mockResolvedValue([]),
};

function clientWith(...responses: Array<{ rows: unknown[] }>) {
  const client = { query: vi.fn(), release: vi.fn() };
  responses.forEach((response) => client.query.mockResolvedValueOnce(response));
  getPoolClient.mockResolvedValue(client);
  return client;
}

describe('menu import execution ownership', () => {
  it('writes draft lineage under the claimed job then transitions to needs_review', async () => {
    const client = clientWith(
      { rows: [job] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [{ id: importId }] },
      { rows: [] }, { rows: [{ id: 'category-a' }] }, { rows: [{ id: 'item-a' }] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
    );

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]), provider)).resolves.toBe('completed');

    const category = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_categories'))!;
    const item = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))!;
    const evidence = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_source_evidence'))!;
    expect(category[1]).toEqual(expect.arrayContaining([importId, 'restaurant-a']));
    expect(item[1]).toEqual(expect.arrayContaining([importId, 'restaurant-a', 'category-a']));
    expect(evidence[1]).toEqual(expect.arrayContaining([importId, 'restaurant-a', 'item-a']));
    const structureLineage = client.query.mock.calls.find(([sql]) => String(sql).includes('SET structure_provider'))!;
    expect(structureLineage[1]).toEqual([executionId, 'gemini', 'gemini-test', null]);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("status = 'needs_review'") && String(sql).includes('analysis_execution_id = $2'))).toBe(true);
  });

  it('does not read or write drafts for an expired or stale execution', async () => {
    const client = clientWith({ rows: [] });
    const reader = vi.fn();

    await expect(processMenuImportExecution(executionId, reader, provider)).resolves.toBe('stale');

    expect(reader).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_'))).toBe(false);
  });

  it('schedules a bounded retry while retaining the same job and execution lineage', async () => {
    const client = clientWith({ rows: [job] }, { rows: [] }, { rows: [] }, { rows: [] });

    await expect(processMenuImportExecution(executionId, async () => { throw new Error('timeout'); }, provider)).rejects.toThrow('timeout');

    const runFailure = client.query.mock.calls.find(([sql]) => String(sql).includes('menu_import_analysis_runs') && String(sql).includes("status = 'failed'"))!;
    const retry = client.query.mock.calls.find(([sql]) => String(sql).includes('analysis_available_at') && String(sql).includes('menu_import_jobs'))!;
    expect(runFailure[1]).toEqual(expect.arrayContaining([executionId]));
    expect(retry[1]).toEqual(expect.arrayContaining([importId, 'pending', executionId]));
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_'))).toBe(false);
  });

  it('reuses a completed matching source hash without invoking the provider', async () => {
    const client = clientWith(
      { rows: [job] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [{ id: importId }] },
      { rows: [{ import_job_id: 'old-job' }] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
    );
    const extract = vi.spyOn(provider, 'extractNative');
    extract.mockClear();
    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]), provider)).resolves.toBe('reused');
    expect(extract).not.toHaveBeenCalled();
    const reuseLookup = client.query.mock.calls.find(([sql]) => String(sql).includes('SELECT import_job_id'))!;
    expect(reuseLookup[1]).toEqual(expect.arrayContaining(['restaurant-a', expect.any(String), 'menu-import-v1', importId]));
    expect(client.query.mock.calls.some(([sql, params]) => String(sql).includes('SET status = $2') && Array.isArray(params) && params.includes('reused'))).toBe(true);
    extract.mockRestore();
  });
});
