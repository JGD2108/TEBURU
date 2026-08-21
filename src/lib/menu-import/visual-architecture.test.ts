import { describe, expect, it } from 'vitest';
import { buildGeminiRequestBody, decodeGeminiVisualDocument } from './provider';
import { flattenVisualDocument, reconcileVisualDocument, validateVisualDocument } from './visual-analysis';

const page = {
  page: 1,
  source: 'native' as const,
  text: 'STARTERS\nSoup 12\nOCR MUST NOT BE PRIMARY INPUT',
  nativeText: 'STARTERS\nSoup 12\nOCR MUST NOT BE PRIMARY INPUT',
  ocrText: 'STARTERS\nSoup 12\nOCR MUST NOT BE PRIMARY INPUT',
  image: { mimeType: 'image/jpeg' as const, data: new Uint8Array([1, 2, 3]), width: 1000, height: 800 },
};

describe('menu-import-v4 visual architecture contract', () => {
  it('keeps primary Gemini input image-led and excludes native/OCR text dumps', () => {
    const request = JSON.stringify(buildGeminiRequestBody([page]));

    expect(request).toContain('inlineData');
    expect(request).not.toContain('OCR MUST NOT BE PRIMARY INPUT');
    expect(request).not.toContain('nativeText');
    expect(request).not.toContain('ocrText');
  });

  it('preserves independent columns, sections, variants, and raw prices', () => {
    const decoded = decodeGeminiVisualDocument({
      pages: [{ page: 1, sections: [
        { id: 'left', title: 'STARTERS', items: [{ name: 'Soup', rawPrice: '$12', variants: [{ label: 'small', raw: '$12' }, { label: 'large', raw: '$18' }] }] },
        { id: 'right', title: 'MAINS', items: [{ name: 'Rice', rawPrice: '€20', price: { raw: '€20', currency: null } }] },
      ] }],
    }, [page]);

    expect(decoded?.pages[0].sections).toHaveLength(2);
    expect(decoded?.pages[0].sections[0].items[0].variants).toHaveLength(2);
    expect(decoded?.pages[0].sections[1].items[0].price?.raw).toBe('€20');
  });

  it('does not inherit a distant section when the current page has no continuity evidence', () => {
    const result = reconcileVisualDocument({ pages: [
      { page: 1, sections: [{ id: 's1', title: 'STARTERS', items: [] }] },
      { page: 2, sections: [{ id: 's2', items: [{ name: 'Soup' }] }] },
      { page: 3, sections: [{ id: 's3', items: [{ name: 'Rice' }] }] },
    ] });

    expect(result.document.pages[1].sections[0].title).toBeUndefined();
    expect(result.document.pages[2].sections[0].title).toBeUndefined();
  });

  it('flags invalid fragments and malformed spatial evidence deterministically', () => {
    const signals = validateVisualDocument({ pages: [{ page: 1, sections: [{ id: 's', title: 'MAINS', items: [
      { name: '$30' },
      { name: 'Soup', bbox: { x: 0.9, y: 0, width: 0.2, height: 0.1 } },
    ] }] }] }, [page]);

    expect(signals.map((signal) => signal.code)).toEqual(expect.arrayContaining(['PRICE_ONLY_NAME', 'INVALID_BBOX']));
  });

  it('does not project invalid candidates as normal draft items', () => {
    const items = flattenVisualDocument(({ pages: [{ page: 1, sections: [{ id: 's', title: 'MAINS', items: [
      { name: '$30', extractionStatus: 'invalid' },
      { name: 'Soup', extractionStatus: 'valid', price: { raw: '$12', amount: 12 } },
    ] }] }] } as unknown as Parameters<typeof flattenVisualDocument>[0]));

    expect(items.map((item) => item.name)).toEqual(['Soup']);
  });
});
