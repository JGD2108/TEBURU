import { describe, expect, it, vi } from 'vitest';
import { analyzePdf, parseMenuText } from './provider';

describe('menu-import analysis', () => {
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
      structure: async (document) => parseMenuText(document.pages),
      associateImages: vi.fn().mockResolvedValue([]),
    });
    expect(ocr).toHaveBeenCalledOnce();
    expect(result.items[0]).toMatchObject({ name: 'Limonada', page: 1, price: 8 });
  });

  it('retains uncertain image associations as review-only suggestions', async () => {
    const result = await analyzePdf(new Uint8Array([1]), {
      extractNative: vi.fn().mockResolvedValue({ pages: [{ page: 1, source: 'native', text: 'BEBIDAS\nJugo 7' }], images: [{ page: 1, data: new Uint8Array([1]), mimeType: 'image/png' }] }),
      ocr: vi.fn().mockResolvedValue([]), structure: async (document) => parseMenuText(document.pages),
      associateImages: vi.fn().mockResolvedValue([{ assetIndex: 0, confidence: 'low', reason: 'Layout ambiguous' }]),
    });
    expect(result.suggestions).toEqual([{ assetIndex: 0, confidence: 'low', reason: 'Layout ambiguous' }]);
  });
});
