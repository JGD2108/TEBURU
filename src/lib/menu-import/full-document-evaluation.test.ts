import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { FULL_DOCUMENT_API_VERSION, FULL_DOCUMENT_CLASSIFICATION_POLICY, FULL_DOCUMENT_MAX_OUTPUT_TOKENS, FULL_DOCUMENT_MIME, FULL_DOCUMENT_MODEL, FULL_DOCUMENT_RESPONSE_SCHEMA, GenerateContentRequestBudget, SUBARASHII_FIXTURE, buildFullDocumentRequest, classifyFullDocument, emptyMetrics, executeFullDocumentEvaluation, fixturePageReport, preflightFullDocumentPdf, readFullDocumentPdf, validateFullDocumentStructure, verifyFullDocumentPayload } from './full-document-evaluation';
import { VISUAL_RESPONSE_SCHEMA } from './provider';

function documentWithPages(pages = 28) { return { pages: Array.from({ length: pages }, (_, index) => ({ page: index + 1, sections: [{ id: `provider-${index + 1}`, title: 'SECTION', items: [{ name: `Item ${index + 1}`, description: 'Description', rawPrice: '$10', confidence: { name: 'high' } }] }] })) }; }
function responseFor(document: unknown, options: { finishReason?: string; status?: number } = {}) { return new Response(JSON.stringify({ candidates: [{ finishReason: options.finishReason ?? 'STOP', content: { parts: [{ text: JSON.stringify(document) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 } }), { status: options.status ?? 200 }); }
const fakeCount = async () => 28;

describe('full-document evaluation preflight', () => {
  it('validates the known fixture without detaching the outbound PDF buffer', async () => {
    const pdf = new Uint8Array(await readFile('docs/pdf_menu_examples/Menu Subarashii.pdf'));
    const preflight = await preflightFullDocumentPdf(pdf, { expected: SUBARASHII_FIXTURE });
    expect(preflight.pdfBytes).toBe(SUBARASHII_FIXTURE.bytes);
    expect(preflight.pdfPages).toBe(28);
    expect(preflight.pdfSha256).toBe(SUBARASHII_FIXTURE.sha256);
    expect(preflight.requestPdfPayloadSha256).toBe(preflight.pdfSha256);
    expect(pdf.byteLength).toBe(SUBARASHII_FIXTURE.bytes);
  });

  it('rejects missing and empty PDFs before a request', async () => {
    await expect(readFullDocumentPdf('docs/pdf_menu_examples/missing.pdf')).rejects.toThrow('FULL_DOCUMENT_PREFLIGHT_PDF_NOT_FOUND');
    await expect(preflightFullDocumentPdf(new Uint8Array(), { countPages: fakeCount })).rejects.toThrow('FULL_DOCUMENT_PREFLIGHT_EMPTY_PDF');
  });

  it('rejects fixture hash/page mismatches', async () => {
    await expect(preflightFullDocumentPdf(new Uint8Array([1, 2, 3]), { countPages: fakeCount, expected: { pages: 27 } })).rejects.toThrow('FULL_DOCUMENT_PREFLIGHT_PAGE_COUNT_MISMATCH');
    await expect(preflightFullDocumentPdf(new Uint8Array([1, 2, 3]), { countPages: fakeCount, expected: { sha256: 'wrong' } })).rejects.toThrow('FULL_DOCUMENT_PREFLIGHT_HASH_MISMATCH');
  });

  it('detects Base64 and outgoing inline-data payload corruption', () => {
    const original = new Uint8Array([1, 2, 3]); const request = buildFullDocumentRequest(original);
    request.data = Buffer.from([1, 2]).toString('base64');
    expect(() => verifyFullDocumentPayload(original, request)).toThrow('FULL_DOCUMENT_PREFLIGHT_BASE64_BYTES_MISMATCH');
    const request2 = buildFullDocumentRequest(original);
    (request2.body.contents[0].parts[1] as { inlineData: { data: string } }).inlineData.data = Buffer.from([3, 2, 1]).toString('base64');
    expect(() => verifyFullDocumentPayload(original, request2)).toThrow('FULL_DOCUMENT_PREFLIGHT_REQUEST_PDF_HASH_MISMATCH');
  });

  it('builds only the required native-PDF request contract', () => {
    const request = buildFullDocumentRequest(new Uint8Array([1, 2, 3])); const parts = request.body.contents[0].parts;
    expect(parts).toHaveLength(2); expect(parts[1]).toMatchObject({ inlineData: { mimeType: FULL_DOCUMENT_MIME } });
    expect(JSON.stringify(request.body)).not.toMatch(/ocr|nativeText|selectedText/i);
    expect(request.body.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: FULL_DOCUMENT_MAX_OUTPUT_TOKENS });
    expect(FULL_DOCUMENT_RESPONSE_SCHEMA).toBe(VISUAL_RESPONSE_SCHEMA);
  });
});

describe('full-document request guard and structural validation', () => {
  it('blocks a second request locally', () => {
    const budget = new GenerateContentRequestBudget(); budget.consume(); expect(budget.count).toBe(1);
    expect(() => budget.consume()).toThrow('FULL_DOCUMENT_REQUEST_BUDGET_EXHAUSTED');
  });

  it('detects missing, duplicate, ordered, and malformed page shapes', () => {
    expect(validateFullDocumentStructure(documentWithPages(28), 28).structuralValid).toBe(true);
    const missing = validateFullDocumentStructure(documentWithPages(27), 28); expect(missing.missingPages).toEqual([28]); expect(missing.structuralValid).toBe(false);
    const duplicate = documentWithPages(28); duplicate.pages[27].page = 27; expect(validateFullDocumentStructure(duplicate, 28).duplicatedPages).toEqual([27]);
    const unordered = documentWithPages(28); [unordered.pages[1], unordered.pages[2]] = [unordered.pages[2], unordered.pages[1]]; expect(validateFullDocumentStructure(unordered, 28).outOfOrderPages).toEqual([2]);
    const malformed = { pages: [{ page: 1, sections: 'not-array' }] }; expect(validateFullDocumentStructure(malformed, 1).malformedPages).toEqual([1]);
    const malformedBox = documentWithPages(1); (malformedBox.pages[0].sections[0].items[0] as Record<string, unknown>).bbox = { x: 1, y: 0, width: 1, height: 1 }; expect(validateFullDocumentStructure(malformedBox, 1).malformedPages).toEqual([1]);
  });
});

describe('full-document execution with recorded responses', () => {
  it('decodes a complete recorded document, assigns IDs, and applies semantic validation without persistence', async () => {
    let calls = 0; let endpoint = ''; const report = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1, 2, 3]), apiKey: 'test-key', countPages: fakeCount, fetcher: async (input) => { calls += 1; endpoint = String(input); return responseFor(documentWithPages()); } });
    expect(calls).toBe(1); expect(endpoint).toBe(`https://generativelanguage.googleapis.com/${FULL_DOCUMENT_API_VERSION}/models/${FULL_DOCUMENT_MODEL}:generateContent`); expect(report.requestCount).toBe(1); expect(report.structural.structuralValid).toBe(true); expect(report.fullDocumentExtractionValid).toBe(true); expect(report.metrics.valid).toBe(28); expect(report.document?.pages[0].sections[0].id).not.toBe('provider-1'); expect(report.classification).toBe('A');
  });

  it('does not retry terminal provider, malformed JSON, or truncated results', async () => {
    let calls = 0; const error = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1]), apiKey: 'test-key', countPages: fakeCount, fetcher: async () => { calls += 1; return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'limit' } }), { status: 429 }); } });
    expect(calls).toBe(1); expect(error.errorClass).toBe('QUOTA'); expect(error.requestCount).toBe(1);
    const malformed = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1]), apiKey: 'test-key', countPages: fakeCount, fetcher: async () => new Response('not json') }); expect(malformed.errorClass).toBe('OUTPUT/SCHEMA');
    const truncated = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1]), apiKey: 'test-key', countPages: fakeCount, fetcher: async () => responseFor(documentWithPages(), { finishReason: 'MAX_TOKENS' }) }); expect(truncated.classification).toBe('D');
  });

  it('keeps semantic status separate from structural completeness', async () => {
    const incomplete = documentWithPages(27); incomplete.pages[0].sections[0].items[0].name = '$30';
    const report = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1]), apiKey: 'test-key', countPages: fakeCount, fetcher: async () => responseFor(incomplete) });
    expect(report.structural.structuralValid).toBe(false); expect(report.metrics.invalid).toBe(1); expect(report.classification).toBe('D');
  });

  it('centralizes A/B/C/D classification', () => {
    const metrics = emptyMetrics(); metrics.totalItems = 100; expect(classifyFullDocument({ httpStatus: 200, structuralValid: true, metrics })).toBe('A');
    metrics.review = Math.ceil(FULL_DOCUMENT_CLASSIFICATION_POLICY.maxReviewRateForA * 100) + 1; expect(classifyFullDocument({ httpStatus: 200, structuralValid: true, metrics })).toBe('B');
    metrics.invalid = Math.ceil(FULL_DOCUMENT_CLASSIFICATION_POLICY.maxInvalidRateForB * 100) + 1; expect(classifyFullDocument({ httpStatus: 200, structuralValid: true, metrics })).toBe('C');
    expect(classifyFullDocument({ httpStatus: 200, finishReason: 'MAX_TOKENS', structuralValid: true, metrics })).toBe('D');
  });

  it('reports fixture target pages only from evaluation data', async () => {
    const report = await executeFullDocumentEvaluation({ pdf: new Uint8Array([1]), apiKey: 'test-key', countPages: fakeCount, fetcher: async () => responseFor(documentWithPages()) });
    expect(fixturePageReport(report.document).map((page) => page.page)).toEqual([2, 3, 4, 5, 6, 9, 19, 20]);
  });
});
