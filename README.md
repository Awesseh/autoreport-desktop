# Easy Report

Easy Report is an offline-first Electron desktop application that turns local CSV, TSV, JSON, Excel, PDF, and image files into reviewed dashboards and exports. One `ReportDefinition` feeds the on-screen dashboard, Excel workbook, print PDF, and editable PowerPoint deck.

## Run locally

```sh
pnpm install
pnpm dev
```

Use `pnpm test` for the pure cleaning and report logic tests, `pnpm typecheck` for TypeScript checks, and `pnpm build` to produce the desktop bundles.

## Workflow

1. Choose or drop a supported local file.
2. Inspect the inferred columns and first 50 rows.
3. Run the deterministic cleaning pipeline and review its change log.
4. Choose a suggested report type.
5. Filter, reorder, or remove sections; add custom pivots; save a template.
6. Export Excel, PDF, or slides from the same report model.

The cleaning log calls out any row removals, conversions, imputations, duplicate detection, and added flags. Fuzzy deduplication and missing-value policies are configurable in the cleaning service. No rows are removed for outlier detection.

## Optional AI

AI column mapping is opt-in and only sends column names, inferred types, and up to three sample values per column to Mistral. Set an API key in Settings. The ordinary upload, cleaning, report, and export path does not call a network service.

## Distribution

`pnpm dist:win`, `pnpm dist:mac`, and `pnpm dist:linux` build NSIS, DMG, and AppImage packages. Set `EASY_REPORT_UPDATE_URL` to a hosted generic update feed to add the electron-builder publish target. Code signing and notarization require platform certificates and credentials, which are not included in the source tree.

The provided shell targets desktop Windows, macOS, and Linux. The renderer uses responsive layouts, and the data/report logic is kept outside Electron-specific APIs so a native mobile shell can reuse it. Android and iOS installers require that additional shell and are not produced by Electron Builder.
