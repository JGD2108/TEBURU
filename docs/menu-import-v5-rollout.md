# V5 text-only rollout

Initial recommendation: **KEEP V5 OPT-IN**. Set the server-only flag `MENU_IMPORT_TEXT_ONLY_ENABLED=true` to expose the **Texto V5** choice to authorized administrators; V5 then runs only for jobs where that choice is selected. Its default model is the server-only `MENU_IMPORT_TEXT_ONLY_GEMINI_MODEL=gemini-3.5-flash-lite`.

Rollback is reversible for new jobs: select `menu-import-v4-visual` or `menu-import-v3-visual` through `MENU_IMPORT_ANALYZER_VERSION` and leave V5 disabled. Existing job and analysis-run records retain their analyzer version; no historical import is reinterpreted or migrated.

Promotion beyond opt-in requires an explicitly budgeted V5-versus-V4 evidence run across generic fixtures. Compare independent items, invalid fragments, review reasons, category continuity, provider calls, latency, tokens, and provenance. Do not enable V5 as the global default from a single fixture or an HTTP success alone.
