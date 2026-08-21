export const MENU_IMPORT_ANALYZER_V3 = 'menu-import-v3-visual';
export const MENU_IMPORT_ANALYZER_V4 = 'menu-import-v4-visual';
export const MENU_IMPORT_ANALYZER_V5 = 'menu-import-v5-text';
export type MenuImportAnalyzerVersion = typeof MENU_IMPORT_ANALYZER_V3 | typeof MENU_IMPORT_ANALYZER_V4 | typeof MENU_IMPORT_ANALYZER_V5;
export type MenuImportAnalyzerOption = Readonly<{ version: MenuImportAnalyzerVersion; label: string }>;

const VISUAL_ANALYZER_OPTIONS: readonly MenuImportAnalyzerOption[] = [
  { version: MENU_IMPORT_ANALYZER_V3, label: 'Visual V3' },
  { version: MENU_IMPORT_ANALYZER_V4, label: 'Visual V4' },
];
const TEXT_ONLY_ANALYZER_OPTION: MenuImportAnalyzerOption = { version: MENU_IMPORT_ANALYZER_V5, label: 'Texto V5' };

export function isTextOnlyAnalyzerEnabled() {
  return process.env.MENU_IMPORT_TEXT_ONLY_ENABLED === 'true';
}

/** Safe admin metadata only: never expose provider models, credentials, or configuration. */
export function menuImportAnalyzerOptions(): readonly MenuImportAnalyzerOption[] {
  return isTextOnlyAnalyzerEnabled() ? [...VISUAL_ANALYZER_OPTIONS, TEXT_ONLY_ANALYZER_OPTION] : VISUAL_ANALYZER_OPTIONS;
}

/** Returns no value when a requested version is unavailable to this server. */
export function resolveRequestedAnalyzerVersion(value: unknown): MenuImportAnalyzerVersion | undefined {
  if (value === MENU_IMPORT_ANALYZER_V3 || value === MENU_IMPORT_ANALYZER_V4) return value;
  if (value === MENU_IMPORT_ANALYZER_V5 && isTextOnlyAnalyzerEnabled()) return value;
  return undefined;
}

/** New admin jobs never inherit V5 from a process default; V5 requires request selection. */
export function resolveDefaultAdminAnalyzerVersion(): Exclude<MenuImportAnalyzerVersion, typeof MENU_IMPORT_ANALYZER_V5> {
  const resolved = resolveAnalyzerVersion();
  return resolved === MENU_IMPORT_ANALYZER_V5 ? MENU_IMPORT_ANALYZER_V3 : resolved;
}

/** V3 remains the default; V4 stays selectable and V5 requires explicit server opt-in. */
export function resolveAnalyzerVersion(value = process.env.MENU_IMPORT_ANALYZER_VERSION): MenuImportAnalyzerVersion {
  if (value === MENU_IMPORT_ANALYZER_V4) return MENU_IMPORT_ANALYZER_V4;
  // V5 is deliberately opt-in. A stray analyzer-version value cannot enable a
  // new text-only production path without an explicit server-side rollout flag.
  if (value === MENU_IMPORT_ANALYZER_V5 && isTextOnlyAnalyzerEnabled()) return MENU_IMPORT_ANALYZER_V5;
  return MENU_IMPORT_ANALYZER_V3;
}
