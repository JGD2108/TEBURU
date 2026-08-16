export type MenuImportStatus = 'pending' | 'processing' | 'needs_review' | 'failed' | 'published';
export type Confidence = 'high' | 'medium' | 'low';

export type PageText = { page: number; text: string; source: 'native' | 'ocr' };
export type ExtractedImage = { page: number; data: Uint8Array; mimeType: string; width?: number; height?: number };
export type PdfDocument = { pages: PageText[]; images: ExtractedImage[]; usedOcr: boolean };

export type ExtractedMenuItem = {
  category: string;
  name: string;
  description?: string;
  price?: number;
  page: number;
  confidence: { category: Confidence; name: Confidence; description: Confidence; price: Confidence };
};

export type ImageSuggestion = { assetIndex: number; itemIndex?: number; confidence: Confidence; reason: string };
export type AnalysisResult = { items: ExtractedMenuItem[]; images: ExtractedImage[]; suggestions: ImageSuggestion[] };

export interface PdfAnalysisProvider {
  extractNative(pdf: Uint8Array): Promise<{ pages: PageText[]; images: ExtractedImage[] }>;
  ocr(pdf: Uint8Array): Promise<PageText[]>;
  structure(document: PdfDocument): Promise<ExtractedMenuItem[]>;
  associateImages(items: ExtractedMenuItem[], images: ExtractedImage[]): Promise<ImageSuggestion[]>;
}
