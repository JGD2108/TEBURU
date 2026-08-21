import { describe, expect, it } from 'vitest';
import { computeMenuImportMetrics } from './metrics';

describe('menu import structural metrics', () => {
  it('computes quality, source, retry, and continuity counters without provider calls', () => {
    const metrics = computeMenuImportMetrics([
      { name: 'Soup', page: 1, extractionStatus: 'valid', confidence: { category: 'high', name: 'high', description: 'low', price: 'high' } },
      { name: 'Maybe', page: 1, extractionStatus: 'review', confidence: { category: 'low', name: 'medium', description: 'low', price: 'low' } },
      { name: '$30', page: 2, extractionStatus: 'invalid', confidence: { category: 'low', name: 'low', description: 'low', price: 'low' } },
    ], [
      { id: '1', page: 1, stage: 'provider_request', sourceKind: 'gemini-visual', analyzerVersion: 'menu-import-v4-visual' },
      { id: '2', page: 1, stage: 'retry', sourceKind: 'gemini-visual', retryReason: 'MERGED_NAME' },
      { id: '3', page: 1, stage: 'validation', sourceKind: 'gemini-visual', validationStatus: 'valid', parentAttemptId: 'a' },
    ], 2);
    expect(metrics.validItemRate).toBeCloseTo(1 / 3);
    expect(metrics.invalidFragmentRate).toBeCloseTo(1 / 3);
    expect(metrics.recoveryRate).toBe(1);
    expect(metrics.attemptsPerPage).toEqual({ '1': 1 });
  });
});
