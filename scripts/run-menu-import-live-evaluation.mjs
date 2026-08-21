if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.log('Live Gemini evaluation skipped: set GEMINI_API_KEY or GOOGLE_API_KEY explicitly.');
  console.log('When enabled, run the same fixture with MENU_IMPORT_ANALYZER_VERSION=menu-import-v3-visual and menu-import-v4-visual, then compare structural metrics and lineage artifacts.');
  process.exit(0);
}

console.log('Live Gemini evaluation is opt-in and separate from deterministic CI tests.');
console.log('Provider credentials are available, but no live fixture command is configured in this environment; no live result is claimed.');
process.exit(0);
