export type MenuImportStatus = 'pending' | 'processing' | 'needs_review' | 'failed' | 'published';
export type Confidence = 'high' | 'medium' | 'low';
export type ReviewReasonCode =
  | 'missing_category' | 'missing_name' | 'missing_price' | 'ambiguous_price'
  | 'merged_items' | 'price_only_name' | 'multiple_prices_in_name'
  | 'invalid_page_reference' | 'suspicious_category' | 'decorative_content'
  | 'sparse_page_inconsistency' | 'reconciliation_conflict' | 'provider_fallback';

/** Normalized [0,1] geometry relative to a rendered source page. */
export type SourceBoundingBox = { x: number; y: number; width: number; height: number };
export type SourceGeometry = { page: number; bbox?: SourceBoundingBox; region?: string; excerpt?: string };
export type ObservedPrice = {
  raw: string;
  amount?: number | null;
  currency?: string | null;
  label?: string | null;
  shared?: boolean;
  source?: SourceGeometry;
  confidence?: Confidence;
};
export type ValidationSignal = { code: ReviewReasonCode | string; severity: 'info' | 'warning' | 'error'; detail?: string; source?: SourceGeometry };
export type ReviewReason = { code: ReviewReasonCode | string; message?: string; source?: SourceGeometry };
export type ExtractedOption = { name: string; price?: ObservedPrice; attributes?: Record<string, string>; source?: SourceGeometry };
export type ExtractedModifier = { name: string; options?: ExtractedOption[]; source?: SourceGeometry };
export type ExtractedSection = {
  key: string;
  name?: string | null;
  parentKey?: string | null;
  sortOrder?: number;
  source?: SourceGeometry;
  attributes?: Record<string, string>;
  confidence?: Confidence;
  reviewReasons?: ReviewReason[];
};
export type DocumentMetadata = { title?: string; language?: string; currency?: string | null; priceNotes?: string[]; pageCount?: number; attributes?: Record<string, string> };
export type AnalysisMetrics = {
  analyzerVersion?: string; promptVersion?: string; model?: string; pageCount?: number;
  providerCalls?: number; retryCount?: number; durationMs?: number; inputTokens?: number;
  outputTokens?: number; suspiciousPages?: number[]; fallbackReasons?: string[];
};

export type PageText = { page: number; text: string; source: 'native' | 'ocr' };
export type ExtractedImage = { page: number; data: Uint8Array; mimeType: string; width?: number; height?: number };
export type PdfDocument = { pages: PageText[]; images: ExtractedImage[]; usedOcr: boolean };

export type ExtractedMenuItem = {
  /** Compatibility category name. Rich results should use sectionKey. */
  category?: string | null;
  sectionKey?: string | null;
  name?: string | null;
  rawName?: string | null;
  description?: string;
  ingredients?: string[];
  price?: number;
  rawPrice?: string | null;
  currency?: string | null;
  priceVariants?: ObservedPrice[];
  modifiers?: ExtractedModifier[];
  options?: ExtractedOption[];
  attributes?: Record<string, string>;
  source?: SourceGeometry;
  page: number;
  confidence: { category: Confidence; name: Confidence; description: Confidence; price: Confidence };
  validationSignals?: ValidationSignal[];
  reviewReasons?: ReviewReason[];
};

export type ImageSuggestion = { assetIndex: number; itemIndex?: number; confidence: Confidence; reason: string };
export type StructureMetadata = { provider: 'gemini' | 'local-fallback'; model?: string; fallbackReason?: string };
export type AnalysisResult = {
  items: ExtractedMenuItem[];
  images: ExtractedImage[];
  suggestions: ImageSuggestion[];
  sections?: ExtractedSection[];
  documentMetadata?: DocumentMetadata;
  metrics?: AnalysisMetrics;
  structureMetadata?: StructureMetadata;
};
export type StructuredMenuOutput = Pick<AnalysisResult, 'items' | 'sections' | 'documentMetadata' | 'metrics'>;

export interface PdfAnalysisProvider {
  extractNative(pdf: Uint8Array): Promise<{ pages: PageText[]; images: ExtractedImage[] }>;
  ocr(pdf: Uint8Array): Promise<PageText[]>;
  /** Text-only provider boundary; images and source PDFs never reach structuring. */
  structure(pages: PageText[]): Promise<ExtractedMenuItem[]>;
  structureDocument?(pages: PageText[]): Promise<StructuredMenuOutput>;
  getStructureMetadata?(): StructureMetadata;
  associateImages(items: ExtractedMenuItem[], images: ExtractedImage[]): Promise<ImageSuggestion[]>;
}
