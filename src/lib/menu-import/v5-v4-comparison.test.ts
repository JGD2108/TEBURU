import { describe, expect, it } from 'vitest';
import { compareV5WithV4 } from './v5-v4-comparison';

describe('V5 versus V4 evidence comparison', () => {
  it('compares supplied evidence without invoking a model or changing defaults', () => {
    const report = compareV5WithV4(
      { analyzer: 'menu-import-v4-visual', independentItems: 20, mergedItems: 3, invalidFragments: 2, reviewReasons: { MERGED_NAME: 3 }, categoryLeakageDetections: 0, providerCalls: 28, provenanceEvents: 100 },
      { analyzer: 'menu-import-v5-text', independentItems: 21, mergedItems: 1, invalidFragments: 1, reviewReasons: { AMBIGUOUS_PRICE: 2 }, categoryLeakageDetections: 0, providerCalls: 1, provenanceEvents: 35 },
    );
    expect(report.deltas).toEqual(expect.objectContaining({ independentItems: 1, mergedItems: -2, invalidFragments: -1, providerCalls: -27 }));
  });

  it('rejects evidence with an analyzer identity mismatch', () => {
    expect(() => compareV5WithV4(
      { analyzer: 'menu-import-v5-text', independentItems: 1, mergedItems: 0, invalidFragments: 0, reviewReasons: {}, categoryLeakageDetections: 0, providerCalls: 1, provenanceEvents: 1 },
      { analyzer: 'menu-import-v4-visual', independentItems: 1, mergedItems: 0, invalidFragments: 0, reviewReasons: {}, categoryLeakageDetections: 0, providerCalls: 1, provenanceEvents: 1 },
    )).toThrow('MENU_IMPORT_COMPARISON_ANALYZER_MISMATCH');
  });
});
