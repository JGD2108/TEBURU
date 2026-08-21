import { describe, expect, it } from 'vitest';
import { isTextOnlyV5Analyzer, nativeTextProvenance, projectMenuImport, shouldShowSourceGeometry } from './menu-import-projection';

describe('projectMenuImport', () => {
  it('keeps explicit valid and review entries separate', () => {
    const result = projectMenuImport({ items: [
      { id: 'valid', validation_status: 'valid' as const },
      { id: 'review', validationStatus: 'review' as const },
    ] }, () => false);

    expect(result.validItems.map((item) => item.id)).toEqual(['valid']);
    expect(result.reviewItems.map((item) => item.id)).toEqual(['review']);
    expect(result.issues).toEqual([]);
  });

  it('never promotes an invalid retry-exhausted fragment into a draft item', () => {
    const result = projectMenuImport({ items: [{ id: 'price-fragment', extraction_status: 'invalid' as const, retry_exhausted: true }] }, () => false);

    expect(result.validItems).toEqual([]);
    expect(result.reviewItems).toEqual([]);
    expect(result.issues).toEqual([expect.objectContaining({ id: 'price-fragment', retry_exhausted: true })]);
  });

  it('keeps incomplete legacy rows editable for review and accepts supplied invalid-fragment diagnostics', () => {
    const result = projectMenuImport({
      items: [{ id: 'legacy-incomplete' }],
      invalidFragments: [{ candidateId: 'fragment-a', rawValue: '$30', validationReasons: ['PRICE_ONLY_NAME'] }],
    }, () => true);

    expect(result.reviewItems.map((item) => item.id)).toEqual(['legacy-incomplete']);
    expect(result.issues).toEqual([expect.objectContaining({ candidateId: 'fragment-a' })]);
  });

  it('keeps V5 review candidates editable while invalid fragments remain issue-only', () => {
    const result = projectMenuImport({
      items: [{ id: 'ambiguous-price', extraction_status: 'review' as const }, { id: 'price-only', extraction_status: 'invalid' as const }],
    }, () => false);

    expect(result.reviewItems.map((item) => item.id)).toEqual(['ambiguous-price']);
    expect(result.validItems).toEqual([]);
    expect(result.issues).toEqual([expect.objectContaining({ id: 'price-only' })]);
  });

  it('suppresses V5 geometry and exposes only allow-listed native-text provenance', () => {
    expect(isTextOnlyV5Analyzer('menu-import-v5-text')).toBe(true);
    expect(shouldShowSourceGeometry('menu-import-v5-text')).toBe(false);
    expect(shouldShowSourceGeometry('menu-import-v4-visual')).toBe(true);
    expect(nativeTextProvenance({
      inputKind: 'native_pdf_text', fallbackUsage: 'none', serializerVersion: 'v1', textDocumentHash: 'safe-hash', textCharacters: 123, apiKey: 'never-render', authorization: 'never-render',
    })).toEqual({ inputKind: 'native_pdf_text', fallbackUsage: 'none', serializerVersion: 'v1', textDocumentHash: 'safe-hash', textCharacters: 123 });
  });
});
