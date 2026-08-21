import { describe, expect, it } from 'vitest';
import { defaultAnalyzerVersion, finalizeImportBody, safeAnalyzerOptions } from './MenuImportPanel';

describe('MenuImportPanel analyzer selection', () => {
  it('preserves the server visual default when the admin API has no selected analyzer', () => {
    expect(safeAnalyzerOptions(undefined)).toEqual([]);
    expect(defaultAnalyzerVersion(undefined)).toBe('');
  });

  it('only exposes V5 when the server includes it in its safe allow-list', () => {
    expect(safeAnalyzerOptions([
      { version: 'menu-import-v4-visual', enabled: true },
      { version: 'menu-import-v5-text', enabled: false },
    ])).toEqual(['menu-import-v4-visual']);

    const options = [
      { version: 'menu-import-v4-visual', enabled: true },
      { version: 'menu-import-v5-text' },
    ];
    expect(safeAnalyzerOptions(options)).toEqual(['menu-import-v4-visual', 'menu-import-v5-text']);
    expect(defaultAnalyzerVersion(options)).toBe('');
  });

  it('honors only a server default from the safe allow-list', () => {
    expect(defaultAnalyzerVersion([
      { version: 'menu-import-v5-text', enabled: false, default: true },
      { version: 'menu-import-v3-visual', enabled: true, default: true },
    ])).toBe('menu-import-v3-visual');
  });

  it('adds a selected analyzer only to the finalize payload', () => {
    const authorization = { id: 'authorization-id', token: 'upload-token' };
    expect(finalizeImportBody(authorization, '')).toEqual({ authorizationId: authorization.id, token: authorization.token });
    expect(finalizeImportBody(authorization, 'menu-import-v5-text')).toEqual({ authorizationId: authorization.id, token: authorization.token, analyzerVersion: 'menu-import-v5-text' });
  });
});
