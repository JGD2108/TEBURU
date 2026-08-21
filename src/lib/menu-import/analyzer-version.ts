export const MENU_IMPORT_ANALYZER_V3 = 'menu-import-v3-visual';
export const MENU_IMPORT_ANALYZER_V4 = 'menu-import-v4-visual';
export type MenuImportAnalyzerVersion = typeof MENU_IMPORT_ANALYZER_V3 | typeof MENU_IMPORT_ANALYZER_V4;

/** v4 is selectable for comparison/rollback metadata; v3 remains the default until Stage 2. */
export function resolveAnalyzerVersion(value = process.env.MENU_IMPORT_ANALYZER_VERSION): MenuImportAnalyzerVersion {
  return value === MENU_IMPORT_ANALYZER_V4 ? MENU_IMPORT_ANALYZER_V4 : MENU_IMPORT_ANALYZER_V3;
}
