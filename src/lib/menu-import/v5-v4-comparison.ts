export type AnalyzerEvidence = {
  analyzer: 'menu-import-v4-visual' | 'menu-import-v5-text';
  independentItems: number;
  mergedItems: number;
  invalidFragments: number;
  reviewReasons: Record<string, number>;
  categoryLeakageDetections: number;
  providerCalls: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  provenanceEvents: number;
};

export type AnalyzerComparison = {
  v4: AnalyzerEvidence;
  v5: AnalyzerEvidence;
  deltas: Record<'independentItems' | 'mergedItems' | 'invalidFragments' | 'categoryLeakageDetections' | 'providerCalls' | 'provenanceEvents', number>;
};

/** Evidence-only comparison: callers supply already authorized results; it never invokes either analyzer. */
export function compareV5WithV4(v4: AnalyzerEvidence, v5: AnalyzerEvidence): AnalyzerComparison {
  if (v4.analyzer !== 'menu-import-v4-visual' || v5.analyzer !== 'menu-import-v5-text') {
    throw new Error('MENU_IMPORT_COMPARISON_ANALYZER_MISMATCH');
  }
  const delta = (key: keyof Pick<AnalyzerEvidence, 'independentItems' | 'mergedItems' | 'invalidFragments' | 'categoryLeakageDetections' | 'providerCalls' | 'provenanceEvents'>) => v5[key] - v4[key];
  return {
    v4,
    v5,
    deltas: {
      independentItems: delta('independentItems'),
      mergedItems: delta('mergedItems'),
      invalidFragments: delta('invalidFragments'),
      categoryLeakageDetections: delta('categoryLeakageDetections'),
      providerCalls: delta('providerCalls'),
      provenanceEvents: delta('provenanceEvents'),
    },
  };
}
