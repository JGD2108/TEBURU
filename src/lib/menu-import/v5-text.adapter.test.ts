import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  V5_TEXT_API_VERSION,
  V5_TEXT_DEFAULT_MODEL,
  V5_TEXT_MAX_OUTPUT_TOKENS,
  V5_TEXT_SERIALIZER_VERSION,
  V5_TEXT_TIMEOUT_MS,
  analyzeV5Text,
  extractV5NativeText,
  serializeV5NativeText,
  type TextDocument,
} from './v5-text';

function nativeDocument(pages = 2): TextDocument {
  return {
    serializerVersion: V5_TEXT_SERIALIZER_VERSION,
    pages: Array.from({ length: pages }, (_, index) => ({
      pageNumber: index + 1,
      items: [
        { index: 0, rawText: `FOOD ${index + 1}`, text: `FOOD ${index + 1}`, separator: 'line-break', hasEOL: true },
        { index: 1, rawText: `Dish ${index + 1}`, text: `Dish ${index + 1}`, separator: 'space', hasEOL: false },
        { index: 2, rawText: '$12', text: '$12', separator: 'unknown', hasEOL: null },
        { index: 3, rawText: 'Prepared from local ingredients every day.', text: 'Prepared from local ingredients every day.', separator: 'line-break', hasEOL: true },
        { index: 4, rawText: 'Each dish is prepared with seasonal ingredients sourced from trusted local growers and cooked fresh to order for every guest.', text: 'Each dish is prepared with seasonal ingredients sourced from trusted local growers and cooked fresh to order for every guest.', separator: 'space', hasEOL: false },
      ],
      text: '',
    })),
  };
}

function providerDecision(
  recommendation: 'approve' | 'review' | 'reject' = 'approve',
  decisionConfidence = 0.95,
  decisionReasons: string[] = ['CLEAR_EXTRACTION', 'COMPLETE_ITEM'],
) {
  return { recommendation, decisionConfidence, decisionReasons };
}

function transportDocument() {
  return {
    pages: [
      { pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: 'Clean dish', rawPrice: '$8', priceAssociation: 'certain', providerDecision: providerDecision() }] }] },
      { pageNumber: 2, sections: [{ continuesPrevious: true, items: [
        { name: 'Ambiguous dish', rawPrice: '$9', priceAssociation: 'ambiguous', providerDecision: providerDecision('approve', 0.99, ['AMBIGUOUS_SOURCE']) },
        { name: '$30', providerDecision: providerDecision('reject', 0.99, ['POSSIBLE_NON_MENU_CONTENT']) },
      ] }] },
    ],
  };
}

function responseFor(value: unknown, options: { status?: number; finishReason?: string } = {}) {
  return new Response(JSON.stringify({
    candidates: [{ finishReason: options.finishReason ?? 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, totalTokenCount: 200 },
  }), { status: options.status ?? 200 });
}

function asSuccess(outcome: Awaited<ReturnType<typeof analyzeV5Text>>) {
  if (outcome.kind !== 'success') throw new Error(`Expected success, received ${outcome.failure.code}: ${outcome.failure.message}`);
  expect(outcome.kind).toBe('success');
  return outcome;
}

function asFailure(outcome: Awaited<ReturnType<typeof analyzeV5Text>>) {
  expect(outcome.kind).toBe('failure');
  if (outcome.kind !== 'failure') throw new Error('Expected failure');
  return outcome;
}

describe('V5 text-only production adapter', () => {
  it('uses PDF.js native extraction for a valid text PDF and retains source item evidence', async () => {
    const pdf = new Uint8Array(await readFile('docs/pdf_menu_examples/Menu Subarashii.pdf'));
    const document = await extractV5NativeText(pdf);

    expect(document.pages).toHaveLength(28);
    expect(document.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 28 }, (_, index) => index + 1));
    expect(document.pages.every((page) => page.items.every((item, index) => (
      item.index === index && typeof item.rawText === 'string' && ['space', 'line-break', 'unknown'].includes(item.separator)
    )))).toBe(true);
  }, 30_000);

  it('serializes native text deterministically without inventing sparse hasEOL layout', () => {
    const document = nativeDocument(1);
    const serialized = serializeV5NativeText(document);

    expect(serialized).toContain('=== PAGE 1 ===');
    expect(serialized).toContain('0|line-break|FOOD 1');
    expect(serialized).toContain('2|unknown|$12');
    expect(serialized.indexOf('FOOD 1')).toBeLessThan(serialized.indexOf('Dish 1'));
    expect(serializeV5NativeText(document)).toBe(serialized);
  });

  it('marks an image-only/scanned document non-evaluable with zero provider requests and no draft items', async () => {
    const scanned: TextDocument = {
      serializerVersion: V5_TEXT_SERIALIZER_VERSION,
      pages: [{ pageNumber: 1, items: [], text: '' }],
    };
    let calls = 0;
    const outcome = await analyzeV5Text({
      restaurantId: 'restaurant-scanned',
      textDocument: scanned,
      apiKey: 'test-key',
      fetcher: async () => { calls += 1; return responseFor({ pages: [] }); },
    });

    const failure = asFailure(outcome);
    expect(failure.failure.code).toBe('TEXT_NOT_EVALUABLE');
    expect(failure.analysis.items).toEqual([]);
    expect(calls).toBe(0);
  });

  it('rejects invalid PDF uploads before provider access', async () => {
    let calls = 0;
    const outcome = await analyzeV5Text({
      restaurantId: 'restaurant-invalid-upload',
      pdf: new Uint8Array([0, 1, 2, 3]),
      apiKey: 'test-key',
      fetcher: async () => { calls += 1; return responseFor(transportDocument()); },
    });

    const failure = asFailure(outcome);
    expect(failure.failure.code).toBe('PDF_TEXT_EXTRACTION_FAILED');
    expect(failure.analysis.items).toEqual([]);
    expect(calls).toBe(0);
  });

  it('makes one v1beta text-only request, projects review candidates, and excludes invalid candidates from normal drafts', async () => {
    let calls = 0;
    let requestBody = '';
    let requestUrl = '';
    const outcome = await analyzeV5Text({
      restaurantId: 'restaurant-a',
      textDocument: nativeDocument(),
      apiKey: 'AIzaNeverPersistThis',
      fetcher: async (url, init) => {
        calls += 1;
        requestUrl = String(url);
        requestBody = String(init?.body);
        return responseFor(transportDocument());
      },
    });

    const success = asSuccess(outcome);
    expect(calls).toBe(1);
    expect(requestUrl).toBe(`https://generativelanguage.googleapis.com/${V5_TEXT_API_VERSION}/models/${V5_TEXT_DEFAULT_MODEL}:generateContent`);
    expect(requestBody).toContain('=== PAGE 1 ===');
    expect(requestBody).toContain(`"maxOutputTokens":${V5_TEXT_MAX_OUTPUT_TOKENS}`);
    expect(requestBody).not.toMatch(/inlineData|application\/pdf|image|ocr|bbox|coordinate/i);
    expect(success.analysis.metrics).toMatchObject({ providerCalls: 1, retryCount: 0, fallbackUsage: 0, textualSourceRate: 1, visualSourceRate: 0 });
    expect(success.analysis.images).toEqual([]);
    expect(success.analysis.suggestions).toEqual([]);
    expect(success.analysis.items).toHaveLength(2);
    expect(success.invalidCandidates).toHaveLength(1);
    expect(success.invalidCandidates[0]).toMatchObject({ name: '$30', extractionStatus: 'invalid' });
    const review = success.analysis.items.find((item) => item.name === 'Ambiguous dish');
    expect(review).toMatchObject({ extractionStatus: 'review', rawPrice: '$9', price: undefined, category: 'FOOD' });
    expect(review?.reviewReasons).toContainEqual({ code: 'AMBIGUOUS_PRICE' });
    expect(review?.confidence.price).toBe('low');
    expect(success.analysis.items.find((item) => item.name === 'Clean dish')).toMatchObject({
      extractionStatus: 'valid',
      providerDecision: providerDecision(),
      assistedApproval: { eligible: true, policyVersion: 'assisted-approval-v1', confidenceThreshold: 0.9 },
    });
    expect(review?.assistedApproval).toMatchObject({ eligible: false, blockingReasons: expect.arrayContaining(['NOT_VALID', 'HAS_VALIDATION_REASONS']) });
    expect(success.analysis.metrics).toMatchObject({ providerRecommendationCounts: { approve: 2, reject: 1 }, assistedApprovalEligibleCount: 1 });
    expect(review?.candidateId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(success.analysis.lineage?.every((event) => !('imageHash' in event) && !('imageIncluded' in event))).toBe(true);
    expect(JSON.stringify(success.analysis.lineage)).not.toContain('AIzaNeverPersistThis');
  });

  it('keeps reordered multi-column evidence uncertain and preserves arbitrary price variants', async () => {
    const reordered: TextDocument = {
      serializerVersion: V5_TEXT_SERIALIZER_VERSION,
      pages: [{ pageNumber: 1, items: [
        { index: 0, rawText: 'LUNCH', text: 'LUNCH', separator: 'line-break', hasEOL: true },
        { index: 1, rawText: 'Soup', text: 'Soup', separator: 'space', hasEOL: false },
        { index: 2, rawText: 'Regular 10 Large 14', text: 'Regular 10 Large 14', separator: 'unknown', hasEOL: null },
        { index: 3, rawText: 'Salad', text: 'Salad', separator: 'space', hasEOL: false },
        { index: 4, rawText: '12', text: '12', separator: 'line-break', hasEOL: true },
        { index: 5, rawText: 'Fresh vegetables, herbs, dressing, and seasonal ingredients prepared to order every day.', text: 'Fresh vegetables, herbs, dressing, and seasonal ingredients prepared to order every day.', separator: 'space', hasEOL: false },
        { index: 6, rawText: 'The source order remains intentionally unreconstructed because native text alone cannot safely recover visual columns or aligned price relationships.', text: 'The source order remains intentionally unreconstructed because native text alone cannot safely recover visual columns or aligned price relationships.', separator: 'space', hasEOL: false },
        { index: 7, rawText: 'Column evidence one', text: 'Column evidence one', separator: 'space', hasEOL: false },
        { index: 8, rawText: 'Column evidence two', text: 'Column evidence two', separator: 'space', hasEOL: false },
        { index: 9, rawText: 'Column evidence three', text: 'Column evidence three', separator: 'space', hasEOL: false },
      ], text: '' }],
    };
    const response = { pages: [{ pageNumber: 1, sections: [{ title: 'LUNCH', items: [
      { name: 'Soup', priceVariants: [{ label: 'Regular', raw: '10' }, { label: 'Large', raw: '14' }], priceAssociation: 'certain', providerDecision: providerDecision() },
      { name: 'Salad', rawPrice: '12', priceAssociation: 'ambiguous', providerDecision: providerDecision('review', 0.8, ['AMBIGUOUS_SOURCE']) },
    ] }] }] };
    const outcome = asSuccess(await analyzeV5Text({ restaurantId: 'restaurant-columns', textDocument: reordered, apiKey: 'test-key', fetcher: async () => responseFor(response) }));

    const soup = outcome.analysis.items.find((item) => item.name === 'Soup');
    const salad = outcome.analysis.items.find((item) => item.name === 'Salad');
    expect(soup?.priceVariants).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Regular', raw: '10' }), expect.objectContaining({ label: 'Large', raw: '14' })]));
    expect(salad).toMatchObject({ extractionStatus: 'review', rawPrice: '12', price: undefined });
    expect(salad?.reviewReasons).toContainEqual({ code: 'AMBIGUOUS_PRICE' });
  });

  it('rejects malformed and structurally incomplete analysis output without fallback drafts or retries', async () => {
    const malformed = await analyzeV5Text({
      restaurantId: 'restaurant-malformed',
      textDocument: nativeDocument(),
      apiKey: 'test-key',
      fetcher: async () => new Response('not-json', { status: 200 }),
    });
    const malformedFailure = asFailure(malformed);
    expect(malformedFailure.failure.code).toBe('MALFORMED_PROVIDER_RESPONSE');
    expect(malformedFailure.analysis.items).toEqual([]);

    let calls = 0;
    const structural = await analyzeV5Text({
      restaurantId: 'restaurant-structural',
      textDocument: nativeDocument(),
      apiKey: 'test-key',
      fetcher: async () => {
        calls += 1;
        return responseFor({ pages: [transportDocument().pages[0]] });
      },
    });
    const structuralFailure = asFailure(structural);
    expect(structuralFailure.failure.code).toBe('STRUCTURAL_VALIDATION_FAILED');
    expect(structuralFailure.structural?.missingPages).toEqual([2]);
    expect(structuralFailure.analysis.items).toEqual([]);
    expect(calls).toBe(1);
  });

  it('strictly rejects missing, unknown, and out-of-range advisory metadata without a second request', async () => {
    const malformedDocuments = [
      { pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: 'Dish', rawPrice: '$8', providerDecision: providerDecision('approve', 0.9, ['UNKNOWN_REASON']) }] }] }, transportDocument().pages[1]] },
      { pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: 'Dish', rawPrice: '$8', providerDecision: providerDecision('approve', 1.01) }] }] }, transportDocument().pages[1]] },
      { pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: 'Dish', rawPrice: '$8', providerDecision: { ...providerDecision(), recommendation: 'maybe' } }] }] }, transportDocument().pages[1]] },
      { pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: 'Dish', rawPrice: '$8' }] }] }, transportDocument().pages[1]] },
    ];
    for (const document of malformedDocuments) {
      let calls = 0;
      const outcome = await analyzeV5Text({ restaurantId: 'restaurant-strict-advice', textDocument: nativeDocument(), apiKey: 'test-key', fetcher: async () => { calls += 1; return responseFor(document); } });
      expect(asFailure(outcome).failure.code).toBe('STRUCTURAL_VALIDATION_FAILED');
      expect(calls).toBe(1);
    }
  });

  it('maps rate limits, provider outages, and timeouts to sanitized, retryable failures', async () => {
    for (const response of [
      new Response(JSON.stringify({ error: { message: 'AIzaSecret must not leak' } }), { status: 429 }),
      new Response(JSON.stringify({ error: { message: 'service unavailable' } }), { status: 503 }),
    ]) {
      const outcome = await analyzeV5Text({ restaurantId: 'restaurant-provider-failure', textDocument: nativeDocument(), apiKey: 'test-key', fetcher: async () => response });
      const failure = asFailure(outcome);
      expect(failure.failure.retryable).toBe(true);
      expect(failure.analysis.items).toEqual([]);
      expect(failure.failure.message).not.toContain('AIzaSecret');
    }
    const timeout = await analyzeV5Text({
      restaurantId: 'restaurant-timeout',
      textDocument: nativeDocument(),
      apiKey: 'test-key',
      fetcher: async () => { throw new Error('request timeout'); },
    });
    const timeoutFailure = asFailure(timeout);
    expect(timeoutFailure.failure.code).toBe('PROVIDER_TIMEOUT');
    expect(timeoutFailure.failure.retryable).toBe(true);
    expect(V5_TEXT_TIMEOUT_MS).toBe(60_000);
  });

  it('keeps restaurant-scoped analyses isolated and generates server IDs after decode', async () => {
    const analyze = (restaurantId: string) => analyzeV5Text({
      restaurantId,
      textDocument: nativeDocument(),
      apiKey: 'test-key',
      fetcher: async () => responseFor(transportDocument()),
    });
    const [first, second] = await Promise.all([analyze('restaurant-one'), analyze('restaurant-two')]);

    const firstSuccess = asSuccess(first);
    const secondSuccess = asSuccess(second);
    expect(firstSuccess.restaurantId).toBe('restaurant-one');
    expect(secondSuccess.restaurantId).toBe('restaurant-two');
    expect(firstSuccess.analysis.items[0].itemId).not.toBe(secondSuccess.analysis.items[0].itemId);
    expect(firstSuccess.analysis.sections?.[0].key).not.toBe(secondSuccess.analysis.sections?.[0].key);
  });
});
