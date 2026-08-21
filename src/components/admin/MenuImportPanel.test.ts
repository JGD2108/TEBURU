import { describe, expect, it } from 'vitest';
import { bulkApprovalSummaryText, categoryFilterLayout, draftVersionSnapshot, finalizeImportBody, formatPrice, providerDecisionPresentation, refreshPublishedViews, safeAnalyzerOptions, v5EnabledForOperators } from './MenuImportPanel';
import { groupProjectedItems } from './menu-import-projection';

describe('MenuImportPanel V5 operator flow', () => {
  it('does not infer V5 availability from a visual default', () => {
    expect(safeAnalyzerOptions(undefined)).toEqual([]);
    expect(v5EnabledForOperators(undefined)).toBe(false);
  });

  it('requires the server allow-list to enable V5 for ordinary operators', () => {
    expect(safeAnalyzerOptions([
      { version: 'menu-import-v4-visual', enabled: true },
      { version: 'menu-import-v5-text', enabled: false },
    ])).toEqual(['menu-import-v4-visual']);
    expect(v5EnabledForOperators([{ version: 'menu-import-v4-visual', enabled: true }])).toBe(false);

    const options = [
      { version: 'menu-import-v4-visual', enabled: true },
      { version: 'menu-import-v5-text' },
    ];
    expect(safeAnalyzerOptions(options)).toEqual(['menu-import-v4-visual', 'menu-import-v5-text']);
    expect(v5EnabledForOperators(options)).toBe(true);
  });

  it('always finalizes the normal operator flow with V5 and no selectable model', () => {
    const authorization = { id: 'authorization-id', token: 'upload-token' };
    expect(finalizeImportBody(authorization)).toEqual({ authorizationId: authorization.id, token: authorization.token, analyzerVersion: 'menu-import-v5-text' });
  });

  it('keeps projected categories in source order and supports the All collection', () => {
    const groups = groupProjectedItems(
      [{ id: 'one', category: 'Entradas' }, { id: 'two', category: 'Postres' }, { id: 'three', category: 'Entradas' }],
      (item) => item.category,
      ['Entradas', 'Postres'],
    );
    expect(groups.map((group) => group.name)).toEqual(['Entradas', 'Postres']);
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).toEqual(['one', 'three', 'two']);
  });

  it('has an empty All/category collection when no reviewable items exist', () => {
    expect(groupProjectedItems([], () => 'Unused', ['Entradas', 'Postres'])).toEqual([]);
  });

  it('puts persisted categories first and sorts unlisted categories deterministically', () => {
    const groups = groupProjectedItems(
      [{ id: 'z', category: 'Z' }, { id: 'a', category: 'A' }, { id: 'known', category: 'Entradas' }],
      (item) => item.category,
      ['Entradas'],
    );
    expect(groups.map((group) => group.name)).toEqual(['Entradas', 'A', 'Z']);
  });

  it('uses the displayed draft versions as the atomic bulk-approval precondition', () => {
    expect(draftVersionSnapshot([
      { id: 'one', name: 'Soup', price: 10, updated_at: '2026-08-21T20:00:00.000Z' },
      { id: 'two', name: 'Salad', price: 12, updatedAt: '2026-08-21T20:01:00.000Z' },
    ])).toEqual({ one: '2026-08-21T20:00:00.000Z', two: '2026-08-21T20:01:00.000Z' });
    expect(draftVersionSnapshot([{ id: 'legacy', name: 'Legacy', price: 8 }])).toBeUndefined();
  });

  it('projects nested provider confidence and bounded bulk summaries without treating them as server status', () => {
    expect(providerDecisionPresentation({
      id: 'one', name: 'Soup', price: 10,
      extraction_attributes: { providerDecision: { recommendation: 'review', decisionConfidence: 0.934, decisionReasons: ['AMBIGUOUS_SOURCE'] } },
    })).toEqual({ recommendation: 'review', recommendationLabel: 'revisar', confidencePercent: 93 });
    expect(bulkApprovalSummaryText({ approved: 3, skipped: 2, reasons: ['NOT_VALID', 'PROVIDER_BLOCKING_REASON'] }))
      .toBe('Aprobados: 3. Omitidos: 2. Motivos: NOT_VALID · PROVIDER_BLOCKING_REASON');
  });

  it('keeps category filters responsive and refreshes import before the published menu', async () => {
    expect(categoryFilterLayout.flexWrap).toBe('wrap');
    const calls: string[] = [];
    await refreshPublishedViews('import-a', async (id) => { calls.push(`import:${id}`); }, async () => { calls.push('menu'); });
    expect(calls).toEqual(['import:import-a', 'menu']);
  });

  it('formats heterogeneous persisted prices without assuming a number instance', () => {
    expect(formatPrice({ price: '12.5', normalized_price: null, raw_price: '$12.50', price_currency: null })).toContain('12.50');
    expect(formatPrice({ price: 8, normalized_price: '8.00', raw_price: '8', price_currency: 'USD' })).toMatch(/8/);
    expect(formatPrice({ price: 'not-a-price', normalized_price: null, raw_price: 'market price', price_currency: null })).toBe('Sin normalizar: market price');
    expect(formatPrice({ price: null, normalized_price: null, raw_price: null, price_currency: null })).toBe('Precio ausente');
  });

  it('formats variant prices when amounts arrive as strings or numbers', () => {
    expect(formatPrice({ amount: '10.5', raw: '$10.50', currency: null })).toContain('10.50');
    expect(formatPrice({ normalized_amount: 14, raw: '$14', currency: 'USD' })).toMatch(/14/);
  });
});
