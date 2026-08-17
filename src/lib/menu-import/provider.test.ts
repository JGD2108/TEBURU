import { describe, expect, it, vi } from 'vitest';
import {
  analyzePdf,
  extractEmbeddedImages,
  installNodeCanvasGlobals,
  installPdfJsWorkerHandler,
  parseMenuText,
  textItemsToPageText,
  buildGeminiRequestBody,
  createGeminiTextStructurer,
  createPdfAnalysisProvider,
  decodeGeminiItems,
} from './provider';

describe('menu-import analysis', () => {
  it('installs Node canvas globals before PDF.js is loaded', () => {
    const original = { DOMMatrix: globalThis.DOMMatrix, ImageData: globalThis.ImageData, Path2D: globalThis.Path2D };
    const DOMMatrix = class DOMMatrix {} as unknown as typeof globalThis.DOMMatrix;
    const ImageData = class ImageData {} as unknown as typeof globalThis.ImageData;
    const Path2D = class Path2D {} as unknown as typeof globalThis.Path2D;
    try {
      delete (globalThis as Partial<typeof globalThis>).DOMMatrix;
      delete (globalThis as Partial<typeof globalThis>).ImageData;
      delete (globalThis as Partial<typeof globalThis>).Path2D;
      installNodeCanvasGlobals({ DOMMatrix, ImageData, Path2D });
      expect(globalThis.DOMMatrix).toBe(DOMMatrix);
      expect(globalThis.ImageData).toBe(ImageData);
      expect(globalThis.Path2D).toBe(Path2D);
    } finally {
      Object.assign(globalThis, original);
    }
  });

  it('preloads the PDF.js worker handler for Node fake-worker execution', () => {
    const original = (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker;
    const WorkerMessageHandler = {};
    try {
      delete (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker;
      installPdfJsWorkerHandler({ WorkerMessageHandler });
      expect((globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker?.WorkerMessageHandler).toBe(WorkerMessageHandler);
    } finally {
      (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = original;
    }
  });

  it('skips expensive embedded-image operators by default', async () => {
    const getOperatorList = vi.fn();
    await extractEmbeddedImages(
      { getOperatorList, objs: { get: vi.fn() } },
      { OPS: { paintImageXObject: 85 } },
      [],
      1,
    );
    expect(getOperatorList).not.toHaveBeenCalled();
  });

  it('preserves PDF TextItem line boundaries for menu parsing', () => {
    expect(textItemsToPageText([
      { str: 'ENTRADAS', hasEOL: true },
      { str: 'Arepa 10', hasEOL: true },
      { str: 'BEBIDAS', hasEOL: true },
      { str: 'Jugo 8', hasEOL: false },
    ])).toBe('ENTRADAS\nArepa 10\nBEBIDAS\nJugo 8');
    expect(parseMenuText([{ page: 1, source: 'native', text: textItemsToPageText([
      { str: 'ENTRADAS', hasEOL: true }, { str: 'Arepa 10', hasEOL: true },
      { str: 'BEBIDAS', hasEOL: true }, { str: 'Jugo 8', hasEOL: true },
    ]) }]).map((item) => item.name)).toEqual(['Arepa', 'Jugo']);
  });

  it('keeps source pages and field-level confidence while parsing native menu text', () => {
    expect(parseMenuText([{ page: 2, source: 'native', text: 'ENTRADAS\nArepa de queso - Maíz y queso 12.50' }])).toEqual([{
      category: 'ENTRADAS', name: 'Arepa de queso', description: 'Maíz y queso', price: 12.5, page: 2,
      confidence: { category: 'high', name: 'high', description: 'high', price: 'high' },
    }]);
  });

  it('uses OCR only when native text is insufficient', async () => {
    const ocr = vi.fn().mockResolvedValue([{ page: 1, source: 'ocr', text: 'BEBIDAS\nLimonada 8' }]);
    const result = await analyzePdf(new Uint8Array([1]), {
      extractNative: vi.fn().mockResolvedValue({ pages: [{ page: 1, source: 'native', text: '' }], images: [] }),
      ocr,
      structure: async (pages) => parseMenuText(pages),
      associateImages: vi.fn().mockResolvedValue([]),
    });
    expect(ocr).toHaveBeenCalledOnce();
    expect(result.items[0]).toMatchObject({ name: 'Limonada', page: 1, price: 8 });
  });

  it('retains uncertain image associations as review-only suggestions', async () => {
    const result = await analyzePdf(new Uint8Array([1]), {
      extractNative: vi.fn().mockResolvedValue({ pages: [{ page: 1, source: 'native', text: 'BEBIDAS\nJugo 7' }], images: [{ page: 1, data: new Uint8Array([1]), mimeType: 'image/png' }] }),
      ocr: vi.fn().mockResolvedValue([]), structure: async (pages) => parseMenuText(pages),
      associateImages: vi.fn().mockResolvedValue([{ assetIndex: 0, confidence: 'low', reason: 'Layout ambiguous' }]),
    });
    expect(result.suggestions).toEqual([{ assetIndex: 0, confidence: 'low', reason: 'Layout ambiguous' }]);
  });

  it('sends Gemini only page-numbered text and accepts validated structure', async () => {
    const pages = [{ page: 2, source: 'native' as const, text: 'ENTRADAS\nArepa 10' }];
    const body = buildGeminiRequestBody(pages);
    expect(JSON.stringify(body)).toContain('Arepa 10');
    expect(JSON.stringify(body)).not.toContain('data:image');
    const output = { items: [{ category: 'ENTRADAS', name: 'Arepa', price: 10, page: 2, confidence: { category: 'high', name: 'high', description: 'low', price: 'high' } }] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] })));
    const structurer = createGeminiTextStructurer({ key: 'secret', model: 'test', fetch: fetcher });
    await expect(structurer(pages)).resolves.toEqual(output.items);
    expect(String(fetcher.mock.calls[0][0])).not.toContain('secret');
    expect(fetcher.mock.calls[0][1].headers['x-goog-api-key']).toBe('secret');
  });

  it('rejects invalid Gemini pages, prices, and schema then falls back locally', async () => {
    const pages = [{ page: 1, source: 'native' as const, text: 'BEBIDAS\nJugo 8' }];
    expect(decodeGeminiItems({ items: [{ category: 'BEBIDAS', name: 'Jugo', price: -1, page: 9, confidence: {} }] }, pages)).toBeUndefined();
    const failing = createGeminiTextStructurer({ key: 'secret', fetch: vi.fn().mockResolvedValue(new Response('bad', { status: 429 })) });
    expect(await failing(pages)).toBeUndefined();
    const provider = createPdfAnalysisProvider({}, { geminiStructurer: failing });
    await expect(provider.structure(pages)).resolves.toMatchObject([{ name: 'Jugo', price: 8 }]);
    expect(provider.getStructureMetadata?.()).toEqual({ provider: 'local-fallback', fallbackReason: 'GEMINI_RATE_LIMITED' });
  });

  it('keeps no-key Gemini configuration on the local fallback path', async () => {
    const structurer = createGeminiTextStructurer({});
    await expect(structurer([{ page: 1, source: 'native', text: 'BEBIDAS\nJugo 8' }])).resolves.toBeUndefined();
  });
});
