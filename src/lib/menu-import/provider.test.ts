import { describe, expect, it, vi } from 'vitest';
import {
  analyzePdf,
  buildGeminiRequestBody,
  createGeminiTextStructurer,
  createPdfAnalysisProvider,
  decodeGeminiVisualDocument,
  decodeGeminiItems,
  installNodeCanvasGlobals,
  installPdfJsWorkerHandler,
  parseMenuText,
  renderedDimensions,
  selectPageEvidence,
} from './provider';
import { reconcileVisualDocument, validateVisualDocument } from './visual-analysis';

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
    const body = buildGeminiRequestBody([renderedPage]);
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
    const failing = createGeminiTextStructurer({ key: 'secret', fetch: vi.fn().mockResolvedValue(new Response('bad', { status: 429 })) });
    const provider = createPdfAnalysisProvider({}, { geminiStructurer: failing });
    await expect(provider.structure([{ ...renderedPage, page: 1, text: 'SPECIALS\nMooncake 17.5' }])).resolves.toEqual([expect.objectContaining({ category: 'SPECIALS', name: 'Mooncake', price: 17.5 })]);
    expect(provider.getStructureMetadata?.()).toEqual({ provider: 'local-fallback', fallbackReason: 'GEMINI_RATE_LIMITED' });
  });

  it('honors the provider deadline with a safe timeout diagnostic', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const structurer = createGeminiTextStructurer({ key: 'secret', timeoutMs: 1000, fetch: fetcher });
    await expect(structurer([renderedPage])).resolves.toBeUndefined();
    expect(structurer.lastFallbackReason).toBe('GEMINI_TIMEOUT'); expect(JSON.stringify(structurer.lastFallbackReason)).not.toContain('secret');
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
});
