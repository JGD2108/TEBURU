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

export type NativeTextProvenance = {
  inputKind?: string;
  fallbackUsage?: string;
  serializerVersion?: string;
  pdfSha256?: string;
  textDocumentHash?: string;
  pdfPages?: number;
  textDocumentPages?: number;
  textCharacters?: number;
};

type ProvenanceRecord = Record<string, unknown>;

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

export function isTextOnlyV5Analyzer(analyzerVersion?: string | null) {
  return analyzerVersion === 'menu-import-v5-text';
}

/** V5 has page-local native-text evidence, never visual geometry. */
export function shouldShowSourceGeometry(analyzerVersion?: string | null) {
  return !isTextOnlyV5Analyzer(analyzerVersion);
}

/**
 * Keeps the admin display limited to V5's declared, non-secret text provenance.
 * Unknown metadata is deliberately ignored.
 */
export function nativeTextProvenance(value: unknown): NativeTextProvenance | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as ProvenanceRecord;
  const text = (key: string) => typeof source[key] === 'string' && source[key].trim() ? source[key].trim() : undefined;
  const number = (key: string) => typeof source[key] === 'number' && Number.isFinite(source[key]) && source[key] >= 0 ? source[key] : undefined;
  const result: NativeTextProvenance = {
    inputKind: text('inputKind') ?? text('input_kind'),
    fallbackUsage: text('fallbackUsage') ?? text('fallback_usage'),
    serializerVersion: text('serializerVersion') ?? text('serializer_version'),
    pdfSha256: text('pdfSha256') ?? text('pdf_sha256'),
    textDocumentHash: text('textDocumentHash') ?? text('text_document_hash'),
    pdfPages: number('pdfPages') ?? number('pdf_pages'),
    textDocumentPages: number('textDocumentPages') ?? number('text_document_pages'),
    textCharacters: number('textCharacters') ?? number('text_characters'),
  };
  return Object.values(result).some((entry) => entry !== undefined) ? result : undefined;
}

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
