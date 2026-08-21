export type ExtractionStatus = 'valid' | 'review' | 'invalid';

export type ProjectableDraftItem = {
  id: string;
  review_status?: 'pending' | 'approved' | 'excluded' | 'published';
  extraction_status?: ExtractionStatus;
  extractionStatus?: ExtractionStatus;
  validation_status?: ExtractionStatus;
  validationStatus?: ExtractionStatus;
  retry_exhausted?: boolean;
  retryExhausted?: boolean;
};

export type ExtractionIssue = {
  id?: string;
  candidate_id?: string;
  candidateId?: string;
  name?: string | null;
  raw_name?: string | null;
  rawName?: string | null;
  raw_value?: string | null;
  rawValue?: string | null;
  source_page?: number | null;
  sourcePage?: number | null;
  source_bbox?: { x: number; y: number; width: number; height: number } | null;
  sourceBbox?: { x: number; y: number; width: number; height: number } | null;
  validation_reasons?: string[] | null;
  validationReasons?: string[] | null;
  review_reasons?: string[] | null;
  reviewReasons?: string[] | null;
  retry_exhausted?: boolean;
  retryExhausted?: boolean;
};

type ProjectionInput<T extends ProjectableDraftItem> = {
  items: T[];
  extraction_issues?: ExtractionIssue[];
  extractionIssues?: ExtractionIssue[];
  invalid_fragments?: ExtractionIssue[];
  invalidFragments?: ExtractionIssue[];
};

export type MenuImportProjection<T extends ProjectableDraftItem> = {
  validItems: T[];
  reviewItems: T[];
  issues: ExtractionIssue[];
};

function explicitStatus(item: ProjectableDraftItem): ExtractionStatus | undefined {
  return item.validation_status ?? item.validationStatus ?? item.extraction_status ?? item.extractionStatus;
}

/** Keeps legacy draft rows reviewable while honoring explicit visual-validation states. */
export function projectMenuImport<T extends ProjectableDraftItem>(input: ProjectionInput<T>, needsReview: (item: T) => boolean): MenuImportProjection<T> {
  const validItems: T[] = [];
  const reviewItems: T[] = [];
  const invalidItems: ExtractionIssue[] = [];

  for (const item of input.items) {
    if (item.review_status === 'excluded') continue;
    const status = explicitStatus(item);
    if (status === 'invalid') {
      invalidItems.push({
        ...item,
        id: item.id,
        validation_reasons: [],
        retry_exhausted: item.retry_exhausted ?? item.retryExhausted,
      });
    } else if (status === 'review' || (!status && needsReview(item))) {
      reviewItems.push(item);
    } else {
      validItems.push(item);
    }
  }

  const suppliedIssues = [
    ...(input.extraction_issues ?? input.extractionIssues ?? []),
    ...(input.invalid_fragments ?? input.invalidFragments ?? []),
  ];
  const seen = new Set<string>();
  const issues = [...invalidItems, ...suppliedIssues].filter((issue, index) => {
    const key = issue.id ?? issue.candidate_id ?? issue.candidateId ?? `issue-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { validItems, reviewItems, issues };
}

export function issueLabel(issue: ExtractionIssue) {
  return issue.name ?? issue.raw_name ?? issue.rawName ?? issue.raw_value ?? issue.rawValue ?? 'Fragmento sin nombre';
}

export function issueReasons(issue: ExtractionIssue) {
  return [...new Set([...(issue.validation_reasons ?? issue.validationReasons ?? []), ...(issue.review_reasons ?? issue.reviewReasons ?? [])])];
}
