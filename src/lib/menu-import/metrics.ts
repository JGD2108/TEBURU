import type { AnalysisMetrics, ExtractedMenuItem, LineageEvent } from './types';

/** Deterministic structural metrics used by both CI fixtures and live evaluation. */
export function computeMenuImportMetrics(items: ExtractedMenuItem[], lineage: LineageEvent[], pageCount: number): AnalysisMetrics & Record<string, unknown> {
  const total = items.length;
  const valid = items.filter((item) => item.extractionStatus === 'valid' || !item.extractionStatus).length;
  const invalid = items.filter((item) => item.extractionStatus === 'invalid').length;
  const retries = lineage.filter((event) => event.stage === 'retry').length;
  const recovered = lineage.filter((event) => event.stage === 'validation' && event.validationStatus === 'valid' && event.parentAttemptId).length;
  const regional = lineage.filter((event) => event.sourceKind === 'regional-retry').length;
  const fallback = lineage.filter((event) => event.sourceKind === 'textual-fallback').length;
  const merged = items.filter((item) => item.reviewReasons?.some((reason) => reason.code === 'MERGED_NAME')).length;
  const leakage = lineage.filter((event) => event.reconciliationDecision === 'distant-continuation-rejected').length;
  return {
    analyzerVersion: lineage.find((event) => event.analyzerVersion)?.analyzerVersion,
    pageCount,
    retryCount: retries,
    recoveryRate: retries ? recovered / retries : 0,
    providerTransientRetries: lineage.filter((event) => event.sourceKind === 'provider-transient-retry').length,
    semanticRetries: lineage.filter((event) => event.retryReason && event.sourceKind !== 'provider-transient-retry').length,
    regionalRetries: regional,
    validItemRate: total ? valid / total : 0,
    invalidFragmentRate: total ? invalid / total : 0,
    pagesRequiringReview: new Set(items.filter((item) => item.extractionStatus === 'review').map((item) => item.page)).size,
    averageItemsPerPage: pageCount ? total / pageCount : 0,
    mergedItemDetections: merged,
    categoryLeakageDetections: leakage,
    fallbackUsage: fallback,
    visualSourceRate: total ? (total - fallback) / total : 0,
    textualSourceRate: total ? fallback / total : 0,
    attemptsPerPage: Object.fromEntries(lineage.filter((event) => event.page).reduce((map, event) => map.set(String(event.page), (map.get(String(event.page)) ?? 0) + (event.stage === 'provider_request' ? 1 : 0)), new Map<string, number>())),
  };
}
