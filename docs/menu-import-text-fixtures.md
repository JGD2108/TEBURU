# Native-text menu fixtures

Production heuristics must stay fixture-agnostic. Add a new real PDF only through an evaluation fixture that records its SHA-256, page count, native-text coverage, and expected structural observations outside `src/lib/menu-import/v5-text/` production logic.

Each fixture should cover one of these contracts: simple one-column ordering, reordered/multi-column text with explicit ambiguity, arbitrary price variants, poor native text, or scanned/image-only PDFs. Scanned and insufficient-text fixtures must assert `TEXT_NOT_EVALUABLE`, zero Gemini requests, and zero normal drafts.

Fixture-specific dish names, categories, prices, and page assertions belong only in test or evaluation modules. They must never be used to repair, classify, or reconcile production imports.
