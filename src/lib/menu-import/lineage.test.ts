import { describe, expect, it } from 'vitest';
import { createMenuImportIdFactory, isServerLineageId, sanitizeLineageEvent } from './lineage';
import { MENU_IMPORT_ANALYZER_V3, MENU_IMPORT_ANALYZER_V4, resolveAnalyzerVersion } from './analyzer-version';

describe('menu import lineage boundaries', () => {
  it('uses server-generated collision-safe IDs for every canonical lineage entity', () => {
    const ids = createMenuImportIdFactory();
    const values = [ids.item(), ids.section(), ids.candidate(), ids.attempt(), ids.event(), ids.reconciledSection()];
    expect(new Set(values)).toHaveLength(values.length);
    expect(values.every(isServerLineageId)).toBe(true);
  });

  it('bounds raw diagnostics and removes credentials from metadata', () => {
    const event = sanitizeLineageEvent({
      id: createMenuImportIdFactory().event(), sourceKind: 'gemini-visual', stage: 'provider_raw', rawPayload: '{"items":[]}',
      metadata: { apiKey: 'never-store-this', prompt: 'safe', authorization: 'Bearer no' },
    });
    expect(event.rawPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.rawPayloadExpiresAt).toBeTruthy();
    expect(event.metadata).toEqual({ prompt: 'safe' });
  });

  it('keeps v3 as default while accepting v4 metadata selection for comparison and rollback', () => {
    expect(resolveAnalyzerVersion()).toBe(MENU_IMPORT_ANALYZER_V3);
    expect(resolveAnalyzerVersion(MENU_IMPORT_ANALYZER_V4)).toBe(MENU_IMPORT_ANALYZER_V4);
    expect(resolveAnalyzerVersion('unknown')).toBe(MENU_IMPORT_ANALYZER_V3);
  });
});
