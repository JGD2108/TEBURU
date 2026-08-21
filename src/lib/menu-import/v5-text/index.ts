/**
 * V5 is intentionally isolated from the visual provider and worker paths.
 * It consumes native PDF.js text, makes one structured Gemini request, and
 * projects invalid candidates outside normal draft items.
 */
export * from './adapter';
