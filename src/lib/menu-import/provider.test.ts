import { describe, expect, it, vi } from 'vitest';
import {
  analyzePdf,
  buildGeminiRequestBody,
  createGeminiTextStructurer,
  createGeminiVisualStructurer,
  createPdfAnalysisProvider,
  decodeGeminiVisualDocument,
  decodeGeminiItems,
  installNodeCanvasGlobals,
  installPdfJsWorkerHandler,
  parseMenuText,
  renderedDimensions,
  selectPageEvidence,
} from './provider';
import { assignServerIds, bboxIoU, bboxOverlap, createServerIdFactory, DEFAULT_RETRY_BUDGET, mergeRegionalSections, normalizedToPixelBox, pixelToNormalizedBox, reconcileVisualDocument, regionToPageBox, retryInstructions, validateVisualDocument } from './visual-analysis';

const renderedPage = { page: 2, source: 'native' as const, text: 'ENTRADAS\nArepa 10', nativeText: 'ENTRADAS\nArepa 10', image: { mimeType: 'image/jpeg' as const, data: new Uint8Array([1, 2, 3]), width: 800, height: 1200 } };
const visualOutput = { pages: [{ page: 2, sections: [{ id: 'starters', title: 'ENTRADAS', bbox: { x: 0, y: 0, width: 1, height: 0.4 }, items: [{ name: 'Arepa', attributes: ['maíz', 'queso'], rawPrice: '10', price: { raw: '10', amount: 10, currency: null }, variants: [{ label: 'small', raw: '8', amount: 8, currency: null }, { label: 'large', raw: '10', amount: 10, currency: null }], bbox: { x: 0.1, y: 0.1, width: 0.3, height: 0.05 }, confidence: { section: 'high', name: 'high', description: 'low', price: 'high' } }] }] }] };

describe('menu-import visual provider', () => {
  it('installs the Node canvas globals and PDF worker once', () => {
    const original = { DOMMatrix: globalThis.DOMMatrix, ImageData: globalThis.ImageData, Path2D: globalThis.Path2D, worker: (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker };
    const DOMMatrix = class DOMMatrix {} as unknown as typeof globalThis.DOMMatrix;
    const ImageData = class ImageData {} as unknown as typeof globalThis.ImageData;
    const Path2D = class Path2D {} as unknown as typeof globalThis.Path2D;
    try {
      delete (globalThis as Partial<typeof globalThis>).DOMMatrix; delete (globalThis as Partial<typeof globalThis>).ImageData; delete (globalThis as Partial<typeof globalThis>).Path2D; delete (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker;
      installNodeCanvasGlobals({ DOMMatrix, ImageData, Path2D }); installPdfJsWorkerHandler({ WorkerMessageHandler: {} });
      expect(globalThis.DOMMatrix).toBe(DOMMatrix); expect((globalThis as typeof globalThis & { pdfjsWorker?: object }).pdfjsWorker).toBeDefined();
    } finally { Object.assign(globalThis, { DOMMatrix: original.DOMMatrix, ImageData: original.ImageData, Path2D: original.Path2D, pdfjsWorker: original.worker }); }
  });

  it('bounds render dimensions without changing deterministic page numbering', () => {
    expect(renderedDimensions({ width: 2000, height: 4000 }, { maxDimension: 1000, maxPixels: 700000 })).toEqual({ width: 500, height: 1000, scale: expect.any(Number) });
  });

  it('sends a scoped multimodal image and auxiliary text, never the key in the URL', async () => {
    const body = buildGeminiRequestBody([renderedPage], undefined, 1);
    expect(JSON.stringify(body)).toContain('inlineData'); expect(JSON.stringify(body)).toContain('primary evidence'); expect(JSON.stringify(body)).toContain('Arepa 10');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visualOutput) }] } }] })));
    const structurer = createGeminiTextStructurer({ key: 'server-secret', model: 'test', fetch: fetcher });
    await expect(structurer([renderedPage])).resolves.toEqual([expect.objectContaining({ category: 'ENTRADAS', name: 'Arepa', price: 10, page: 2, ingredients: ['maíz', 'queso'] })]);
    expect(String(fetcher.mock.calls[0][0])).not.toContain('server-secret'); expect(fetcher.mock.calls[0][1].headers['x-goog-api-key']).toBe('server-secret');
  });

  it('preserves raw prices, variants, hierarchy and normalized source boxes in the visual decoder', () => {
    const decoded = decodeGeminiVisualDocument(visualOutput, [renderedPage]);
    expect(decoded?.pages[0].sections[0].items[0]).toMatchObject({ name: 'Arepa', rawPrice: '10', price: { amount: 10 }, variants: [{ label: 'small', amount: 8 }, { label: 'large', amount: 10 }] });
  });

  it('rejects malformed page references and uses a generic fallback after provider errors', async () => {
    expect(decodeGeminiItems({ pages: [{ page: 9, sections: [] }] }, [renderedPage])).toBeUndefined();
    const failing = createGeminiTextStructurer({ key: 'secret', maxRateRetries: 0, fetch: vi.fn().mockResolvedValue(new Response('bad', { status: 429 })) });
    const provider = createPdfAnalysisProvider({}, { geminiStructurer: failing });
    await expect(provider.structure([{ ...renderedPage, page: 1, text: 'SPECIALS\nMooncake 17.5' }])).resolves.toEqual([expect.objectContaining({ category: 'SPECIALS', name: 'Mooncake', price: 17.5 })]);
    expect(provider.getStructureMetadata?.()).toMatchObject({ provider: 'local-fallback', fallbackReason: 'GEMINI_RATE_LIMITED', textualFallbackUsed: true });
  });

  it('honors the provider deadline with a safe timeout diagnostic', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const structurer = createGeminiTextStructurer({ key: 'secret', timeoutMs: 1000, sleep: async () => undefined, fetch: fetcher });
    await expect(structurer([renderedPage])).resolves.toBeUndefined();
    expect(structurer.lastFallbackReason).toBe('GEMINI_TIMEOUT'); expect(JSON.stringify(structurer.lastFallbackReason)).not.toContain('secret');
  });

  it('respects Retry-Info for 429 and keeps rate retries separate from semantic retries', async () => {
    const waits: number[] = [];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2.5s' }, { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'requests', quotaId: 'daily', quotaDimensions: { model: 'test' } }] }] } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visualOutput) }] } }] })));
    const structurer = createGeminiVisualStructurer({ key: 'secret', model: 'test', fetch: fetcher, architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', maxRateRetries: 1, sleep: async (milliseconds) => { waits.push(milliseconds); } });
    await expect(structurer([renderedPage])).resolves.toBeDefined();
    expect(waits).toEqual([2500]); expect(structurer.lastProviderTransientRetries).toBe(0); expect(structurer.lastProviderDiagnostics?.[0]).toMatchObject({ status: 429, quotaMetric: 'requests', quotaLimit: 'daily', quotaDimensions: { model: 'test' } });
  });

  it('respects Retry-After headers and uses jittered exponential backoff for 503', async () => {
    const headerWaits: number[] = [];
    const headerFetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visualOutput) }] } }] })));
    const headerStructurer = createGeminiVisualStructurer({ key: 'secret', model: 'test', fetch: headerFetcher, architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', maxRateRetries: 1, sleep: async (milliseconds) => { headerWaits.push(milliseconds); } });
    await expect(headerStructurer([renderedPage])).resolves.toBeDefined();
    expect(headerWaits).toEqual([3000]);

    const backoffWaits: number[] = [];
    const unavailableFetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visualOutput) }] } }] })));
    const unavailableStructurer = createGeminiVisualStructurer({ key: 'secret', model: 'test', fetch: unavailableFetcher, architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', random: () => 0, sleep: async (milliseconds) => { backoffWaits.push(milliseconds); } });
    await expect(unavailableStructurer([renderedPage])).resolves.toBeDefined();
    expect(backoffWaits).toEqual([750]); expect(unavailableStructurer.lastProviderTransientRetries).toBe(1);
  });

  it('keeps V4 provider rate limits out of textual fallback', async () => {
    const failing = createGeminiVisualStructurer({ key: 'secret', model: 'test', architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', maxRateRetries: 0, fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }), { status: 429 })) });
    const provider = createPdfAnalysisProvider({ extractNative: vi.fn().mockResolvedValue({ pages: [renderedPage], images: [] }), ocr: vi.fn().mockResolvedValue([]) }, { geminiVisualStructurer: failing });
    const result = await analyzePdf(new Uint8Array([1]), provider);
    expect(result.items).toEqual([]); expect(result.structureMetadata).toMatchObject({ failureClass: 'provider_rate_limited', fallbackReason: 'GEMINI_RATE_LIMITED' });
  });

  it('does not wait or retry a daily quota exhaustion even when RetryInfo is present', async () => {
    const waits: number[] = [];
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '35s' }] } }), { status: 429 }));
    const structurer = createGeminiVisualStructurer({ key: 'secret', model: 'test', architectureStage: 2, analyzerVersion: 'menu-import-v4-visual', sleep: async (milliseconds) => { waits.push(milliseconds); }, fetch: fetcher });
    await expect(structurer([renderedPage])).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce(); expect(waits).toEqual([]); expect(structurer.lastFallbackReason).toBe('GEMINI_RATE_LIMITED');
  });

  it('chooses OCR only for weak native pages and keeps both as auxiliary evidence', async () => {
    const selected = selectPageEvidence([{ ...renderedPage, text: '' }], [{ page: 2, source: 'ocr', text: 'Arepa 10' }]);
    expect(selected[0]).toMatchObject({ source: 'ocr', text: 'Arepa 10', nativeText: '', ocrText: 'Arepa 10' });
  });

  it('keeps fallback extraction generic and records field confidence', () => {
    expect(parseMenuText([{ page: 4, source: 'native', text: 'SPECIALS\nMooncake - seasonal filling 17.5' }])).toEqual([expect.objectContaining({ category: 'SPECIALS', name: 'Mooncake', price: 17.5, page: 4, confidence: expect.any(Object) })]);
  });

  it('flags decorative/merged/price-only content and reconciles only supported continuation', () => {
    const document = { pages: [{ page: 2, sections: [{ id: 'a', title: 'WELCOME', items: [{ name: '12.00' }, { name: 'A / B / C — 10 12' }] }] }] };
    expect(validateVisualDocument(document, [renderedPage]).map((signal) => signal.code)).toEqual(expect.arrayContaining(['SUSPICIOUS_CATEGORY', 'PRICE_ONLY_NAME', 'MULTIPLE_PRICES_IN_NAME']));
    const reconciled = reconcileVisualDocument({ pages: [{ page: 1, sections: [{ id: 'a', title: 'STARTERS', items: [] }] }, { page: 2, sections: [{ id: 'b', continuationOf: 'a', items: [{ name: 'Soup' }] }] }] });
    expect(reconciled.document.pages[1].sections[0].title).toBe('STARTERS');
  });

  it('uses OCR safely when native text is insufficient', async () => {
    const ocr = vi.fn().mockResolvedValue([{ page: 1, source: 'ocr', text: 'BEBIDAS\nLimonada 8' }]);
    const result = await analyzePdf(new Uint8Array([1]), { extractNative: vi.fn().mockResolvedValue({ pages: [{ page: 1, source: 'native', text: '' }], images: [] }), ocr, structure: async (pages) => parseMenuText(pages), associateImages: vi.fn().mockResolvedValue([]) });
    expect(ocr).toHaveBeenCalledOnce(); expect(result.items[0]).toMatchObject({ name: 'Limonada', page: 1, price: 8 });
  });

  it('keeps Stage 1 text instrumentation separate from Stage 2 image-only primary input', () => {
    const stageOne = JSON.stringify(buildGeminiRequestBody([renderedPage], undefined, 1));
    const stageTwo = JSON.stringify(buildGeminiRequestBody([renderedPage], undefined, 2));
    expect(stageOne).toContain('Arepa 10');
    expect(stageTwo).toContain('VISUAL SOURCE OF TRUTH');
    expect(stageTwo).not.toContain('Arepa 10');
    expect(stageTwo).toContain('inlineData');
    expect(JSON.parse(stageTwo).generationConfig).not.toHaveProperty('temperature');
    expect(JSON.parse(stageOne).generationConfig).toHaveProperty('temperature', 0);
  });

  it('records a server-attributable Stage 1 trace for every decoded candidate', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(visualOutput) }] } }] })));
    const structurer = createGeminiVisualStructurer({ key: 'server-secret', model: 'test', fetch: fetcher, architectureStage: 1, analyzerVersion: 'menu-import-v3-visual' });
    const document = await structurer([renderedPage]);
    const item = document?.pages[0].sections[0].items[0];
    expect(item?.itemId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(item?.candidateId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(structurer.lastLineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'render', page: 2, imageIncluded: true }),
      expect.objectContaining({ stage: 'provider_request', page: 2 }),
      expect.objectContaining({ stage: 'provider_raw', page: 2, rawPayloadHash: expect.any(String) }),
      expect.objectContaining({ stage: 'decode', candidateId: item?.candidateId, itemId: item?.itemId }),
      expect.objectContaining({ stage: 'validation', candidateId: item?.candidateId }),
      expect.objectContaining({ stage: 'reconciliation', candidateId: item?.candidateId }),
    ]));
  });

  it('uses server IDs, deterministic bbox conversions, and spatial merge policy', () => {
    const factory = createServerIdFactory('run');
    const assigned = assignServerIds({ pages: [{ page: 1, sections: [{ id: 'model-repeat', title: 'DRINKS', items: [{ name: 'Tea', bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }] }] }] }, factory);
    expect(assigned.pages[0].sections[0]).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), modelSectionHint: 'model-repeat' });
    expect(assigned.pages[0].sections[0].items[0].itemId).toMatch(/^[0-9a-f-]{36}$/i);
    const normalized = pixelToNormalizedBox({ x: 20, y: 10, width: 40, height: 20 }, 200, 100);
    expect(normalizedToPixelBox(normalized, 200, 100)).toEqual({ x: 20, y: 10, width: 40, height: 20 });
    expect(regionToPageBox({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, { x: 0, y: 0, width: 0.5, height: 1 })).toEqual({ x: 0.25, y: 0.5, width: 0.25, height: 0.5 });
    expect(bboxIoU({ x: 0, y: 0, width: 0.5, height: 0.5 }, { x: 0.25, y: 0, width: 0.5, height: 0.5 })).toBeCloseTo(1 / 3);
    expect(bboxOverlap({ x: 0, y: 0, width: 0.5, height: 0.5 }, { x: 0.25, y: 0, width: 0.5, height: 0.5 })).toBeCloseTo(0.5);
    const merged = mergeRegionalSections([{ id: 'a', title: 'DRINKS', items: [{ name: 'Tea', bbox: { x: 0, y: 0, width: 0.4, height: 0.2 }, validation: { status: 'review', reasons: ['LOW_VISUAL_CONFIDENCE'] } }] }], [{ id: 'b', title: 'DRINKS', items: [{ name: 'Tea', bbox: { x: 0.02, y: 0, width: 0.4, height: 0.2 }, validation: { status: 'valid', reasons: [] } }] }]);
    expect(merged[0].items).toEqual([expect.objectContaining({ validation: { status: 'valid', reasons: [] } })]);
  });

  it('bounds semantic retries and never carries fallback categories across pages', () => {
    expect(DEFAULT_RETRY_BUDGET).toMatchObject({ primary: 1, semanticFullPage: 1, semanticRegional: 2 });
    expect(retryInstructions([{ code: 'MERGED_NAME', severity: 'warning', page: 1 }], 1)).toEqual([]);
    expect(parseMenuText([{ page: 1, source: 'native', text: 'STARTERS\nSoup 7' }, { page: 2, source: 'native', text: 'Tea 3' }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ page: 1, category: 'STARTERS', extractionStatus: 'review' }),
      expect.objectContaining({ page: 2, category: '', extractionStatus: 'review' }),
    ]));
  });

  it('reconciles only adjacent continuation and gives a clear current heading precedence', () => {
    const reconciled = reconcileVisualDocument({ pages: [
      { page: 1, sections: [{ id: 'p1', modelSectionHint: 'model-p1', title: 'STARTERS', items: [] }] },
      { page: 2, sections: [{ id: 'p2', continuationOf: 'model-p1', items: [{ name: 'Soup' }] }, { id: 'new', continuationOf: 'model-p1', title: 'DESSERTS', items: [{ name: 'Cake' }] }] },
      { page: 3, sections: [{ id: 'p3', continuationOf: 'model-p1', items: [{ name: 'Tea' }] }] },
    ] });
    expect(reconciled.document.pages[1].sections[0].title).toBe('STARTERS');
    expect(reconciled.document.pages[1].sections[1].title).toBe('DESSERTS');
    expect(reconciled.document.pages[2].sections[0].title).toBeUndefined();
    expect(reconciled.signals).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'RECONCILIATION_CONFLICT', page: 3 })]));
  });
});
