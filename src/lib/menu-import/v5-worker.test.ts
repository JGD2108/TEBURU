import { describe, expect, it, vi } from 'vitest';

const { getPoolClient } = vi.hoisted(() => ({ getPoolClient: vi.fn() }));
const { analyzeV5Text } = vi.hoisted(() => ({ analyzeV5Text: vi.fn() }));
vi.mock('@/lib/db', () => ({ getPoolClient }));
vi.mock('./v5-text', () => ({ analyzeV5Text }));

import { processMenuImportExecution } from './worker';

const importId = '33333333-3333-4333-8333-333333333333';
const executionId = '44444444-4444-4444-8444-444444444444';
const serverCandidateId = '55555555-5555-4555-8555-555555555555';
const serverItemId = '66666666-6666-4666-8666-666666666666';
const serverSectionId = '77777777-7777-4777-8777-777777777777';
const v5Job = {
  id: importId,
  restaurant_id: 'restaurant-v5',
  source_storage_path: 'restaurants/restaurant-v5/pending/menu.pdf',
  source_size_bytes: 3,
  analyzer_version: 'menu-import-v5-text',
  analysis_execution_id: executionId,
  attempt: 1,
};

function clientForV5() {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockImplementation(async (sql: string) => {
    const statement = String(sql);
    if (statement.includes('FROM menu_import_jobs') && statement.includes("status = 'processing'")) return { rows: [v5Job] };
    if (statement.includes("SELECT 1 FROM menu_import_jobs")) return { rows: [{ '?column?': 1 }] };
    if (statement.includes('SELECT import_job_id FROM menu_import_analysis_runs')) return { rows: [] };
    if (statement.includes('INSERT INTO menu_import_draft_categories')) return { rows: [{ id: 'category-v5' }] };
    if (statement.includes('INSERT INTO menu_import_draft_items')) return { rows: [{ id: 'draft-v5' }] };
    return { rows: [] };
  });
  getPoolClient.mockResolvedValue(client);
  return client;
}

function successOutcome() {
  return {
    kind: 'success' as const,
    restaurantId: 'restaurant-v5',
    attemptId: executionId,
    preflight: { pdfPages: 1 },
    structural: { structuralValid: true },
    invalidCandidates: [{ itemId: '88888888-8888-4888-8888-888888888888', candidateId: '99999999-9999-4999-8999-999999999999', extractionStatus: 'invalid', name: '$30', page: 1, confidence: { category: 'low' as const, name: 'low' as const, description: 'low' as const, price: 'low' as const } }],
    analysis: {
      items: [{ itemId: serverItemId, candidateId: serverCandidateId, extractionStatus: 'review' as const, sectionKey: serverSectionId, category: 'FOOD', name: 'Ambiguous dish', rawPrice: '$9', page: 1, confidence: { category: 'high' as const, name: 'high' as const, description: 'medium' as const, price: 'low' as const }, reviewReasons: [{ code: 'AMBIGUOUS_PRICE' }] }],
      images: [], suggestions: [],
      sections: [{ key: serverSectionId, name: 'FOOD', sortOrder: 0, source: { page: 1 }, confidence: 'high' as const }],
      metrics: { analyzerVersion: 'menu-import-v5-text', model: 'gemini-3.5-flash-lite', promptVersion: 'menu-import-text-only-v1', pageCount: 1, providerCalls: 1, retryCount: 0, fallbackUsage: 0, textualSourceRate: 1, visualSourceRate: 0 },
      structureMetadata: { provider: 'gemini' as const, model: 'gemini-3.5-flash-lite', textualFallbackUsed: false },
      lineage: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', attemptId: executionId, sourceKind: 'unknown' as const, stage: 'provider_request' as const, analyzerVersion: 'menu-import-v5-text', metadata: { evidenceAuthority: 'native-text' } },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', attemptId: executionId, candidateId: '99999999-9999-4999-8999-999999999999', itemId: '88888888-8888-4888-8888-888888888888', sourceKind: 'unknown' as const, stage: 'validation' as const, analyzerVersion: 'menu-import-v5-text', validationStatus: 'invalid' as const, validationReasons: ['PRICE_ONLY_NAME'], metadata: { evidenceAuthority: 'native-text' } },
      ],
    },
  };
}

describe('V5 worker routing and persistence gates', () => {
  it('uses V5 only, persists review candidates, and keeps invalid candidates as lineage issues', async () => {
    const client = clientForV5();
    analyzeV5Text.mockResolvedValueOnce(successOutcome());

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1, 2, 3]))).resolves.toBe('completed');

    expect(analyzeV5Text).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 'restaurant-v5', attemptId: executionId, pdf: new Uint8Array([1, 2, 3]) }));
    const draftItem = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))!;
    expect(draftItem[1]).toEqual(expect.arrayContaining([importId, 'restaurant-v5', 'category-v5', 'Ambiguous dish']));
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))).toHaveLength(1);
    const lineage = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_analysis_lineage_events'));
    expect(lineage.some(([, values]) => Array.isArray(values) && values.includes('validation') && JSON.stringify(values).includes('PRICE_ONLY_NAME'))).toBe(true);
    expect(lineage.some(([, values]) => Array.isArray(values) && JSON.stringify(values).includes('native-text'))).toBe(true);
    expect(JSON.stringify(client.query.mock.calls)).not.toContain('imageHash');
  });

  it('records a V5 provider failure without drafts or an automatic pending retry', async () => {
    const client = clientForV5();
    analyzeV5Text.mockResolvedValueOnce({
      kind: 'failure', restaurantId: 'restaurant-v5', attemptId: executionId,
      preflight: { pdfPages: 1 }, structural: undefined,
      failure: { code: 'PROVIDER_RATE_LIMITED', retryable: true, message: 'V5_TEXT_PROVIDER_RATE_LIMITED' },
      analysis: { items: [], images: [], suggestions: [], sections: [], metrics: { analyzerVersion: 'menu-import-v5-text', model: 'gemini-3.5-flash-lite', providerCalls: 1, fallbackUsage: 0 }, lineage: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', attemptId: executionId, sourceKind: 'unknown', stage: 'provider_request', analyzerVersion: 'menu-import-v5-text', metadata: { evidenceAuthority: 'native-text' } }] },
    });

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).rejects.toThrow('MENU_IMPORT_V5_PROVIDER_RATE_LIMITED');

    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_'))).toBe(false);
    const failureUpdate = client.query.mock.calls.find(([sql, values]) => String(sql).includes('UPDATE menu_import_jobs SET status = $2') && Array.isArray(values) && values.includes('PROVIDER_RATE_LIMITED'))!;
    expect(failureUpdate[1]).toEqual(expect.arrayContaining([importId, 'failed', 'PROVIDER_RATE_LIMITED']));
    expect(client.query.mock.calls.some(([sql, values]) => String(sql).includes('UPDATE menu_import_jobs SET status = $2') && Array.isArray(values) && values.includes('pending'))).toBe(false);
  });
});
