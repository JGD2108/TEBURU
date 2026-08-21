import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  MAX_GENERATE_CONTENT_REQUESTS,
  TEXT_DOCUMENT_SERIALIZER_VERSION,
  TEXT_ONLY_API_VERSION,
  TEXT_ONLY_DEFAULT_MODEL,
  TEXT_ONLY_MAX_OUTPUT_TOKENS,
  TEXT_ONLY_RESPONSE_SCHEMA,
  TextOnlyRequestBudget,
  adaptTextMenuDocument,
  applyTextValidation,
  buildTextOnlyRequest,
  classifyTextOnly,
  decodeTextMenuDocument,
  executeTextOnlyEvaluation,
  extractTextDocument,
  pageEvaluationReport,
  preflightTextDocument,
  reconcileTextDocument,
  serializeTextDocument,
  validateTextStructure,
  type TextDocument,
  type TextMenuDocument,
} from './text-only-evaluation';

const FIXTURE_PATH = 'docs/pdf_menu_examples/Menu Subarashii.pdf';
const FIXTURE_SHA256 = '200363208d92a1ea2cd1814a25237e8283bdd81ea46301ec82966d5a4cd4f387';

function sourceDocument(pages = 3): TextDocument {
  return {
    serializerVersion: TEXT_DOCUMENT_SERIALIZER_VERSION,
    pages: Array.from({ length: pages }, (_, index) => ({
      pageNumber: index + 1,
      items: [
        { index: 0, rawText: `SECTION ${index + 1}`, text: `SECTION ${index + 1}`, separator: 'line-break', hasEOL: true },
        { index: 1, rawText: `Independent dish ${index + 1} prepared with local ingredients`, text: `Independent dish ${index + 1} prepared with local ingredients`, separator: 'space', hasEOL: false },
        { index: 2, rawText: '$10', text: '$10', separator: 'line-break', hasEOL: true },
        { index: 3, rawText: 'A careful description for this independent menu product.', text: 'A careful description for this independent menu product.', separator: 'unknown', hasEOL: null },
      ],
      text: '',
    })),
  };
}

function transportDocument(pages = 3): TextMenuDocument {
  return {
    pages: Array.from({ length: pages }, (_, index) => ({
      pageNumber: index + 1,
      sections: [{ title: `SECTION ${index + 1}`, items: [{ name: `Independent dish ${index + 1}`, description: 'Prepared with local ingredients', rawPrice: '$10', priceAssociation: 'certain', descriptionAssociation: 'certain' }] }],
    })),
  };
}

function responseFor(value: unknown, options: { status?: number; finishReason?: string; usage?: boolean } = {}) {
  return new Response(JSON.stringify({
    candidates: [{ finishReason: options.finishReason ?? 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
    usageMetadata: options.usage === false ? undefined : { promptTokenCount: 120, candidatesTokenCount: 80, totalTokenCount: 200 },
  }), { status: options.status ?? 200 });
}

describe('text-only native extraction and preflight', () => {
  it('extracts every fixture page in source order with PDF.js native text only', async () => {
    const pdf = new Uint8Array(await readFile(FIXTURE_PATH));
    const document = await extractTextDocument(pdf);
    const preflight = preflightTextDocument(document, { pdf, expectedPages: 28 });
    expect(pdf.byteLength).toBe(7_049_549);
    expect(preflight.pdfSha256).toBe(FIXTURE_SHA256);
    expect(document.pages).toHaveLength(28);
    expect(document.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 28 }, (_, index) => index + 1));
    expect(document.pages.every((page) => page.items.every((item, index) => item.index === index && typeof item.rawText === 'string'))).toBe(true);
    expect(preflightTextDocument(document, { pdf, expectedPages: 28 }).pdfSha256).toBe(FIXTURE_SHA256);
    expect(preflight.status).toBe('ready');
  }, 30_000);

  it('serializes explicit page and item boundaries deterministically', () => {
    const document = sourceDocument(1);
    const serialized = serializeTextDocument(document);
    expect(serialized).toContain('=== PAGE 1 ===');
    expect(serialized).toContain('0|line-break|SECTION 1');
    expect(serialized.indexOf('SECTION 1')).toBeLessThan(serialized.indexOf('Independent dish 1'));
    expect(serializeTextDocument(document)).toBe(serialized);
  });

  it('does not make a provider call for insufficient native text', async () => {
    const empty: TextDocument = { serializerVersion: TEXT_DOCUMENT_SERIALIZER_VERSION, pages: [{ pageNumber: 1, items: [], text: '' }] };
    let calls = 0;
    const report = await executeTextOnlyEvaluation({ textDocument: empty, apiKey: 'test-key', fetcher: async () => { calls += 1; return responseFor({ pages: [] }); } });
    expect(report.preflight?.status).toBe('not_evaluable');
    expect(report.errorClass).toBe('NOT_EVALUABLE');
    expect(report.requestCount).toBe(0);
    expect(calls).toBe(0);
  });

  it('records empty source pages as coverage rather than dropping them', () => {
    const document = sourceDocument(5); document.pages[4] = { pageNumber: 5, items: [], text: '' };
    const preflight = preflightTextDocument(document);
    expect(preflight.emptyPages).toEqual([5]);
    expect(preflight.coverage[4]).toMatchObject({ pageNumber: 5, characters: 0, quality: 'empty' });
    expect(preflight.status).toBe('ready');
  });
});

describe('text-only Gemini contract and guard', () => {
  it('sends exactly one text part with structured output and no visual/PDF evidence', () => {
    const request = buildTextOnlyRequest(sourceDocument());
    const encoded = JSON.stringify(request.body);
    expect(request.body.contents).toHaveLength(1);
    expect(request.body.contents[0].parts).toHaveLength(1);
    expect(request.body.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: TEXT_ONLY_MAX_OUTPUT_TOKENS, responseJsonSchema: TEXT_ONLY_RESPONSE_SCHEMA });
    expect(encoded).not.toMatch(/inlineData|application\/pdf|ocr|nativeText|selectedText|bbox|coordinate|confidence/i);
    expect(encoded).toContain('=== PAGE 1 ===');
  });

  it('uses the dedicated text-only default and accepts only a direct, spike-scoped override', async () => {
    const accepted = await executeTextOnlyEvaluation({ textDocument: sourceDocument(), apiKey: 'test-key', fetcher: async () => responseFor(transportDocument()) });
    expect(accepted.model).toBe(TEXT_ONLY_DEFAULT_MODEL);
    const overridden = await executeTextOnlyEvaluation({ textDocument: sourceDocument(), apiKey: 'test-key', model: 'text-only-test-model', fetcher: async () => responseFor(transportDocument()) });
    expect(overridden.model).toBe('text-only-test-model');
  });

  it('enforces a one-request budget before a second request can start', () => {
    const budget = new TextOnlyRequestBudget();
    budget.consume();
    expect(budget.count).toBe(MAX_GENERATE_CONTENT_REQUESTS);
    expect(budget.remaining).toBe(0);
    expect(() => budget.consume()).toThrow('TEXT_ONLY_REQUEST_BUDGET_EXHAUSTED');
  });
});

describe('strict DTO, canonical IDs, structural and semantic validation', () => {
  it('rejects provider IDs and unknown DTO fields while accepting the strict contract', () => {
    expect(decodeTextMenuDocument(transportDocument())).toMatchObject(transportDocument());
    expect(decodeTextMenuDocument({ pages: [{ pageNumber: 1, sections: [{ items: [{ name: 'Dish', id: 'provider-id' }] }] }] })).toBeUndefined();
    expect(decodeTextMenuDocument({ pages: [{ pageNumber: 1, sections: [{ items: [{ name: 'Dish', bbox: { x: 0 } }] }] }] })).toBeUndefined();
    expect(decodeTextMenuDocument({ pages: [{ pageNumber: 1, sections: [{ items: [{ name: 'Dish', priceAssociation: 'guess' }] }] }] })).toBeUndefined();
  });

  it('keeps legacy recordings decodable outside V5 while V5 mode requires bounded advisory metadata', () => {
    const legacy = transportDocument(1);
    expect(decodeTextMenuDocument(legacy)).toMatchObject(legacy);
    expect(decodeTextMenuDocument(legacy, { requireProviderDecision: true })).toBeUndefined();
    const advised = transportDocument(1);
    advised.pages[0].sections[0].items[0].providerDecision = {
      recommendation: 'approve', decisionConfidence: 0.9, decisionReasons: ['CLEAR_EXTRACTION'],
    };
    expect(decodeTextMenuDocument(advised, { requireProviderDecision: true })).toMatchObject(advised);
  });

  it('reports missing, duplicate, unordered, unexpected, and malformed response pages before reconciliation', () => {
    expect(validateTextStructure(transportDocument(3), 3).structuralValid).toBe(true);
    expect(validateTextStructure(transportDocument(2), 3).missingPages).toEqual([3]);
    const duplicate = transportDocument(3); duplicate.pages[2].pageNumber = 2;
    expect(validateTextStructure(duplicate, 3).duplicatedPages).toEqual([2]);
    const unordered = transportDocument(3); [unordered.pages[1], unordered.pages[2]] = [unordered.pages[2], unordered.pages[1]];
    expect(validateTextStructure(unordered, 3).outOfOrderPages).toEqual([2]);
    expect(validateTextStructure({ pages: [{ pageNumber: 1, sections: 'nope' }] }, 1).malformedPages).toEqual([1]);
    expect(validateTextStructure({ pages: [{ pageNumber: 2, sections: [] }] }, 1).unexpectedPages).toEqual([2]);
  });

  it('assigns all canonical IDs locally and retains raw prices separately from normalized prices', () => {
    const dto = transportDocument(1); dto.pages[0].sections[0].items[0].priceVariants = [{ label: 'Large', raw: '12,50' }];
    const document = adaptTextMenuDocument(dto); const section = document.pages[0].sections[0]; const item = section.items[0];
    expect(section.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(item.itemId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(item.candidateId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(item.rawPrice).toBe('$10');
    expect(item.price?.raw).toBe('$10');
    expect(item.variants?.[0]).toMatchObject({ raw: '12,50', amount: 12.5, currency: null, label: 'Large' });
  });

  it('keeps continuity only from the immediately preceding page and lets clear headings win', () => {
    const dto: TextMenuDocument = { pages: [
      { pageNumber: 1, sections: [{ title: 'STARTERS', items: [{ name: 'One' }] }] },
      { pageNumber: 2, sections: [{ continuesPrevious: true, items: [{ name: 'Two' }] }, { title: 'CURRENT HEADING', continuesPrevious: true, items: [{ name: 'Three' }] }] },
      { pageNumber: 4, sections: [{ continuesPrevious: true, items: [{ name: 'Four' }] }] },
    ] };
    const reconciled = reconcileTextDocument(adaptTextMenuDocument(dto));
    expect(reconciled.pages[1].sections[0].title).toBe('STARTERS');
    expect(reconciled.pages[1].sections[1].title).toBe('CURRENT HEADING');
    expect(reconciled.pages[2].sections[0].title).toBeUndefined();
  });

  it('classifies text-only invalid, review, and valid candidates without visual signals', () => {
    const dto: TextMenuDocument = { pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [
      { name: '$30' },
      { name: 'Pasta $12 $14' },
      { name: 'Soup / Salad / Bread with a very long combined product title' },
      { name: 'Follow us @menu' },
      { name: 'this is an isolated description fragment with punctuation.' },
      { name: 'Ambiguous dish', rawPrice: '$9', priceAssociation: 'ambiguous' },
      { name: 'Clean dish', rawPrice: '$8', priceAssociation: 'certain' },
      { name: 'Clean dish', rawPrice: '$8', priceAssociation: 'certain' },
      { name: 'No section dish' },
    ] }] }] };
    dto.pages[0].sections.push({ items: [dto.pages[0].sections[0].items.pop()!] });
    const items = applyTextValidation(adaptTextMenuDocument(dto)).pages[0].sections[0].items;
    expect(items[0].validation).toMatchObject({ status: 'invalid', reasons: ['PRICE_ONLY_NAME'] });
    expect(items[1].validation).toMatchObject({ status: 'invalid', reasons: ['MULTIPLE_PRICES_IN_NAME'] });
    expect(items[2].validation).toMatchObject({ status: 'review', reasons: ['MERGED_NAME'] });
    expect(items[3].validation).toMatchObject({ status: 'invalid', reasons: ['DECORATIVE_CONTENT'] });
    expect(items[4].validation).toMatchObject({ status: 'review', reasons: ['DESCRIPTION_FRAGMENT'] });
    expect(items[5].validation).toMatchObject({ status: 'review', reasons: ['AMBIGUOUS_PRICE'] });
    expect(items[6].validation?.status).toBe('review');
    expect(items[6].validation?.reasons).toContain('DUPLICATE_ITEM');
    expect(applyTextValidation(adaptTextMenuDocument(dto)).pages[0].sections[1].items[0].validation).toMatchObject({ status: 'review', reasons: ['MISSING_SECTION'] });
    const emptyName = applyTextValidation(adaptTextMenuDocument({ pages: [{ pageNumber: 1, sections: [{ title: 'FOOD', items: [{ name: '' }] }] }] }));
    expect(emptyName.pages[0].sections[0].items[0].validation).toMatchObject({ status: 'invalid', reasons: ['EMPTY_NAME'] });
  });
});

describe('recorded evaluation reports are terminal, redacted, and non-persistent', () => {
  it('decodes a complete response once, applies text semantic validation, and reports server-side data', async () => {
    let calls = 0; let body = '';
    const report = await executeTextOnlyEvaluation({ textDocument: sourceDocument(), apiKey: 'test-key', fetcher: async (_input, init) => { calls += 1; body = String(init?.body); return responseFor(transportDocument()); } });
    expect(calls).toBe(1);
    expect(report.endpoint).toBe(`https://generativelanguage.googleapis.com/${TEXT_ONLY_API_VERSION}/models/${TEXT_ONLY_DEFAULT_MODEL}:generateContent`);
    expect(body).not.toMatch(/inlineData|application\/pdf|bbox|ocr/i);
    expect(report.requestCount).toBe(1);
    expect(report.httpStatus).toBe(200);
    expect(report.structural.structuralValid).toBe(true);
    expect(report.fullTextDocumentValid).toBe(true);
    expect(report.metrics).toMatchObject({ totalItems: 3, valid: 3, review: 0, invalid: 0 });
    expect(report.document?.pages[0].sections[0].id).not.toBe('provider-id');
    expect(report.inputTokens).toBe(120);
    expect(report.classification).toBe('A');
  });

  it('does not retry provider errors, timeouts, malformed output, truncation, or schema errors', async () => {
    for (const response of [
      new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'AIzaSecretKey must not leak' } }), { status: 429 }),
      new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'bad request' } }), { status: 400 }),
      new Response(JSON.stringify({ error: { status: 'INTERNAL', message: 'provider failure' } }), { status: 500 }),
      new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'provider unavailable' } }), { status: 503 }),
      new Response('not-json', { status: 200 }),
      responseFor(transportDocument(), { finishReason: 'MAX_TOKENS' }),
      responseFor({ pages: [{ pageNumber: 1, sections: [{ items: [{ name: 'x', unknown: true }] }] }] }),
    ]) {
      let calls = 0;
      const report = await executeTextOnlyEvaluation({ textDocument: sourceDocument(), apiKey: 'test-key', fetcher: async () => { calls += 1; return response; } });
      expect(calls).toBe(1);
      expect(report.requestCount).toBe(1);
      expect(report.classification).toBe('D');
      if (report.finishReason === 'MAX_TOKENS') expect(report.fullTextDocumentValid).toBe(false);
      expect(report.errorMessage ?? '').not.toContain('AIzaSecretKey');
    }
    const timeout = await executeTextOnlyEvaluation({ textDocument: sourceDocument(), apiKey: 'test-key', fetcher: async () => { throw new Error('request timeout'); } });
    expect(timeout.requestCount).toBe(1);
    expect(timeout.errorClass).toBe('TIMEOUT');
  });

  it('classifies A/B/C/D centrally and exposes target-page reports only from evaluation data', () => {
    expect(classifyTextOnly({ httpStatus: 200, structuralValid: true, metrics: { totalSections: 1, totalItems: 100, valid: 100, review: 0, invalid: 0, validationReasonCounts: {} } })).toBe('A');
    expect(classifyTextOnly({ httpStatus: 200, structuralValid: true, metrics: { totalSections: 1, totalItems: 100, valid: 75, review: 25, invalid: 0, validationReasonCounts: {} } })).toBe('B');
    expect(classifyTextOnly({ httpStatus: 200, structuralValid: true, metrics: { totalSections: 1, totalItems: 100, valid: 40, review: 40, invalid: 20, validationReasonCounts: {} } })).toBe('C');
    expect(classifyTextOnly({ httpStatus: 200, structuralValid: false, metrics: { totalSections: 1, totalItems: 1, valid: 1, review: 0, invalid: 0, validationReasonCounts: {} } })).toBe('D');
    const report = pageEvaluationReport(applyTextValidation(adaptTextMenuDocument(transportDocument(20))), sourceDocument(20), [2, 3, 4, 5, 6, 9, 19, 20]);
    expect(report.map((page) => page.page)).toEqual([2, 3, 4, 5, 6, 9, 19, 20]);
    expect(report.every((page) => page.itemCount === 1 && page.sourceTextQuality !== 'empty')).toBe(true);
  });

  it('keeps the spike free of production evaluator imports and fixture assertions in source logic', async () => {
    const moduleSource = await readFile('src/lib/menu-import/text-only-evaluation.ts', 'utf8');
    expect(moduleSource).not.toMatch(/from ['"]\.\/(?:provider|worker|dispatcher|full-document-evaluation|visual-analysis)['"]/);
    expect(moduleSource).not.toContain('MENU_IMPORT_GEMINI_MODEL');
    expect(moduleSource).not.toContain('gemini-3.7-flash');
  });
});
