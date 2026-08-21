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
  client.query.mockImplementation(async (sql: string, values?: unknown[]) => {
    const statement = String(sql);
    if (statement.includes('FROM menu_import_jobs') && statement.includes("status = 'processing'")) return { rows: [v5Job] };
    if (statement.includes("SELECT 1 FROM menu_import_jobs")) return { rows: [{ '?column?': 1 }] };
    if (statement.includes('SELECT import_job_id FROM menu_import_analysis_runs')) return { rows: [] };
    if (statement.includes('INSERT INTO menu_import_draft_categories')) {
      const normalized = String(values?.[2] ?? 'v5').trim().toLowerCase();
      return { rows: [{ id: normalized === 'food' ? 'category-v5' : `category-${normalized}` }] };
    }
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

  it('persists advisory V5 evidence without altering the server review gate', async () => {
    const client = clientForV5();
    const outcome = successOutcome();
    (outcome.analysis.items[0] as Record<string, unknown>).providerDecision = {
      recommendation: 'approve', decisionConfidence: 0.97, decisionReasons: ['COMPLETE_ITEM'],
    };
    analyzeV5Text.mockResolvedValueOnce(outcome);

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');

    const draftItem = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))!;
    expect(JSON.parse(String(draftItem[1][13]))).toEqual(expect.objectContaining({
      providerDecision: expect.objectContaining({ recommendation: 'approve', decisionConfidence: 0.97 }),
    }));
    expect(draftItem[1]).toEqual(expect.arrayContaining(['review']));
    const persistence = client.query.mock.calls.find(([sql, values]) =>
      String(sql).includes('INSERT INTO menu_import_analysis_lineage_events') && JSON.stringify(values).includes('providerDecision'))!;
    expect(JSON.stringify(persistence[1])).toContain('COMPLETE_ITEM');
  });

  function projectionOutcome(items: Array<Record<string, unknown>>, sections: Array<Record<string, unknown>>) {
    const base = successOutcome();
    const projectedSections = sections.map((section, index) => ({
      key: `section-${index}`,
      name: 'SUSHI',
      sortOrder: index,
      source: { page: index + 1 },
      confidence: 'high' as const,
      ...section,
    }));
    return {
      ...base,
      invalidCandidates: [],
      analysis: {
        ...base.analysis,
        items: items.map((item, index) => ({
          itemId: `66666666-6666-4666-8666-6666666666${String(index).padStart(2, '0')}`,
          candidateId: `55555555-5555-4555-8555-5555555555${String(index).padStart(2, '0')}`,
          extractionStatus: 'valid' as const,
          confidence: { category: 'high' as const, name: 'high' as const, description: 'low' as const, price: 'high' as const },
          ...item,
        })),
        sections: projectedSections,
        lineage: [
          ...base.analysis.lineage,
          ...projectedSections.map((section, index) => ({
            id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(index).padStart(2, '0')}`,
            attemptId: executionId,
            sectionId: section.key,
            page: section.source.page,
            sourceKind: 'synthetic' as const,
            stage: 'projection' as const,
            analyzerVersion: 'menu-import-v5-text',
          })),
        ],
      },
    };
  }

  it('persists one SUSHI category for identical sections and all valid items', async () => {
    const client = clientForV5();
    const firstSectionId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const secondSectionId = 'bbbbbbbb-2222-4222-8222-222222222222';
    const outcome = projectionOutcome([
      { sectionKey: firstSectionId, category: 'SUSHI', name: 'Salmon roll', page: 1 },
      { sectionKey: secondSectionId, category: 'SUSHI', name: 'Tuna roll', page: 2 },
      { sectionKey: secondSectionId, category: 'SUSHI', name: 'Ebi roll', page: 2 },
    ], [
      { key: firstSectionId, name: 'SUSHI', source: { page: 1 } },
      { key: secondSectionId, name: 'SUSHI', source: { page: 2 } },
    ]);
    analyzeV5Text.mockResolvedValueOnce(outcome);

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');
    const categories = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_categories'));
    expect(categories).toHaveLength(1);
    expect(categories[0][1]).toEqual(expect.arrayContaining(['SUSHI', firstSectionId, 1]));
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items')).map(([, values]) => values[2])).toEqual(['category-sushi', 'category-sushi', 'category-sushi']);
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))).toHaveLength(3);
    const evidencePages = client.query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO menu_import_source_evidence'))
      .map(([, values]) => values[4]);
    expect(evidencePages).toEqual([1, 2, 2]);
    const persistedSectionIds = client.query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO menu_import_analysis_lineage_events'))
      .map(([, values]) => values[11])
      .filter(Boolean);
    expect(persistedSectionIds).toEqual(expect.arrayContaining([firstSectionId, secondSectionId]));
    const metricsUpdate = client.query.mock.calls.find(([sql]) => String(sql).includes('structural_metrics = $16::jsonb'))!;
    expect(JSON.parse(String(metricsUpdate[1][15]))).toEqual(expect.objectContaining({
      categorySectionsObserved: 2,
      draftCategoriesProjected: 1,
      categoryDeduplications: 1,
    }));
  });

  it('normalizes category whitespace and case to one category, while keeping SUSHI and TEMPURA separate', async () => {
    const client = clientForV5();
    analyzeV5Text.mockResolvedValueOnce(projectionOutcome([
      { sectionKey: 'section-0', category: 'SUSHI', name: 'A', page: 1 },
      { sectionKey: 'section-1', category: ' Sushi ', name: 'B', page: 2 },
      { sectionKey: 'section-2', category: 'sushi', name: 'C', page: 3 },
      { sectionKey: 'section-3', category: 'TEMPURA', name: 'D', page: 4 },
    ], [
      { key: 'section-0', name: 'SUSHI', source: { page: 1 } },
      { key: 'section-1', name: ' Sushi ', source: { page: 2 } },
      { key: 'section-2', name: 'sushi', source: { page: 3 } },
      { key: 'section-3', name: 'TEMPURA', source: { page: 4 } },
    ]));

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');
    const categories = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_categories'));
    expect(categories).toHaveLength(2);
    expect(categories.map(([, values]) => values[4])).toEqual(['section-0', 'section-3']);
    expect(categories.map(([, values]) => values[2])).toEqual(['SUSHI', 'TEMPURA']);
    expect(client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items')).map(([, values]) => values[2])).toEqual(['category-sushi', 'category-sushi', 'category-sushi', 'category-tempura']);
    const metricsUpdate = client.query.mock.calls.find(([sql]) => String(sql).includes('structural_metrics = $16::jsonb'))!;
    expect(JSON.parse(String(metricsUpdate[1][15]))).toEqual(expect.objectContaining({
      categorySectionsObserved: 4,
      draftCategoriesProjected: 2,
      categoryDeduplications: 2,
    }));
  });

  it('retains page lineage and review status, and excludes invalid candidates from drafts', async () => {
    const client = clientForV5();
    const outcome = projectionOutcome([
      { category: 'SUSHI', name: 'Page one', page: 1, extractionStatus: 'review', reviewReasons: [{ code: 'AMBIGUOUS_PRICE' }] },
      { category: 'SUSHI', name: '$30', page: 2, extractionStatus: 'invalid' },
      { category: 'SUSHI', name: 'Page three', page: 3, extractionStatus: 'valid' },
    ], []);
    analyzeV5Text.mockResolvedValueOnce(outcome);

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');
    const items = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'));
    expect(items).toHaveLength(2);
    expect(items.map(([, values]) => values[3])).toEqual(['Page one', 'Page three']);
    expect(items[0][1]).toEqual(expect.arrayContaining([1, 'review']));
    expect(items[1][1]).toEqual(expect.arrayContaining([3, 'valid']));
    expect(client.query.mock.calls.some(([sql, values]) => String(sql).includes('INSERT INTO menu_import_source_evidence') && Array.isArray(values) && values.includes(1))).toBe(true);
    expect(client.query.mock.calls.some(([sql, values]) => String(sql).includes('INSERT INTO menu_import_source_evidence') && Array.isArray(values) && values.includes(3))).toBe(true);
  });

  it('uses idempotent category and item persistence and keeps V4 routing independent', async () => {
    const client = clientForV5();
    const replay = projectionOutcome([{ category: 'SUSHI', name: 'A', page: 1 }], []);
    analyzeV5Text.mockResolvedValueOnce(replay).mockResolvedValueOnce(replay);
    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');
    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).resolves.toBe('completed');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('ON CONFLICT (import_job_id, lower(name))'))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('ON CONFLICT (import_job_id, idempotency_key)'))).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('menu_import_draft_items') && String(sql).includes('extraction_status'))).toBe(true);
    const replayItems = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'));
    expect(replayItems).toHaveLength(2);
    expect(replayItems[0][1][20]).toBe(replayItems[1][1][20]);
  });

  it('still fails the execution for a genuine category persistence error', async () => {
    const client = clientForV5();
    const normalQuery = client.query.getMockImplementation()!;
    client.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (String(sql).includes('INSERT INTO menu_import_draft_categories')) throw new Error('database unavailable');
      return normalQuery(sql, values);
    });
    analyzeV5Text.mockResolvedValueOnce(projectionOutcome([
      { category: 'SUSHI', name: 'A', page: 1 },
    ], []));

    await expect(processMenuImportExecution(executionId, async () => new Uint8Array([1]))).rejects.toThrow('database unavailable');

    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO menu_import_draft_items'))).toBe(false);
    const failure = client.query.mock.calls.find(([sql, values]) =>
      String(sql).includes('UPDATE menu_import_jobs SET status = $2')
      && Array.isArray(values)
      && values.includes('ANALYSIS_FAILED'));
    expect(failure?.[1]).toEqual(expect.arrayContaining([importId, 'failed', 'ANALYSIS_FAILED']));
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
