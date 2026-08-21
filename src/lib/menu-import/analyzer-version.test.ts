import { afterEach, describe, expect, it, vi } from 'vitest';

const originalVersion = process.env.MENU_IMPORT_ANALYZER_VERSION;
const originalTextOnlyEnabled = process.env.MENU_IMPORT_TEXT_ONLY_ENABLED;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.MENU_IMPORT_ANALYZER_VERSION;
  else process.env.MENU_IMPORT_ANALYZER_VERSION = originalVersion;
  if (originalTextOnlyEnabled === undefined) delete process.env.MENU_IMPORT_TEXT_ONLY_ENABLED;
  else process.env.MENU_IMPORT_TEXT_ONLY_ENABLED = originalTextOnlyEnabled;
  vi.resetModules();
});

describe('menu import analyzer selection', () => {
  it('keeps v3 as the default and preserves the separately selectable v4 version', async () => {
    delete process.env.MENU_IMPORT_ANALYZER_VERSION;
    delete process.env.MENU_IMPORT_TEXT_ONLY_ENABLED;
    const { MENU_IMPORT_ANALYZER_V3, MENU_IMPORT_ANALYZER_V4, resolveAnalyzerVersion } = await import('./analyzer-version');
    expect(resolveAnalyzerVersion()).toBe(MENU_IMPORT_ANALYZER_V3);
    expect(resolveAnalyzerVersion(MENU_IMPORT_ANALYZER_V4)).toBe(MENU_IMPORT_ANALYZER_V4);
  });

  it('requires the explicit server-only opt-in before selecting v5', async () => {
    const { MENU_IMPORT_ANALYZER_V3, MENU_IMPORT_ANALYZER_V5, resolveAnalyzerVersion } = await import('./analyzer-version');
    delete process.env.MENU_IMPORT_TEXT_ONLY_ENABLED;
    expect(resolveAnalyzerVersion(MENU_IMPORT_ANALYZER_V5)).toBe(MENU_IMPORT_ANALYZER_V3);
    process.env.MENU_IMPORT_TEXT_ONLY_ENABLED = 'true';
    expect(resolveAnalyzerVersion(MENU_IMPORT_ANALYZER_V5)).toBe(MENU_IMPORT_ANALYZER_V5);
  });
});
