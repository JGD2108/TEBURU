export const PDF_MENU_MAX_BYTES = 20 * 1024 * 1024;
export const pdfMenuImportStatuses = ['pending', 'processing', 'needs_review', 'failed', 'published'] as const;
export type PdfMenuImportStatus = (typeof pdfMenuImportStatuses)[number];
export const draftReviewStatuses = ['pending', 'approved', 'excluded', 'published'] as const;
export type DraftReviewStatus = (typeof draftReviewStatuses)[number];

export function validatePdfUpload(file: File) {
  if (file.type !== 'application/pdf' || file.size < 1 || file.size > PDF_MENU_MAX_BYTES) {
    return 'Selecciona un PDF de entre 1 byte y 20 MB';
  }
  return null;
}

export function validatePublicationInput(value: unknown): { mode: 'append' } | null {
  return typeof value === 'object' && value !== null && (value as { mode?: unknown }).mode === 'append' ? { mode: 'append' } : null;
}
