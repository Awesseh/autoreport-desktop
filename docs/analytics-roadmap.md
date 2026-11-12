# Easy Report analytics roadmap

Easy Report is expanding from a report builder into an offline analytics workbench. Keep the renderer free of Node APIs, preserve raw data, make transformations reviewable, and run expensive dataset operations in worker threads.

## Phase 1: Data explorer and descriptive statistics

**In progress.** Add a dataset profile to the preview, with row and field counts, completeness, numeric summaries (quartiles, mean, variance, standard deviation, skewness, and IQR outlier counts), and top categorical values. The analysis runs in a worker thread and never changes the input dataset.

## Phase 2: Reproducible data preparation

- Add a transformation recipe model for filtering, selecting, renaming, splitting, merging, calculated columns, grouping, joins, append, pivot, and unpivot.
- Keep each step deterministic and visible, with preview, undo, and a change log.
- Preserve the source dataset and materialize transformations into a separate working dataset.

## Phase 3: Statistical analysis

- Add pairwise correlation and covariance, distributions and frequency tables, confidence intervals, common hypothesis tests, and effect sizes.
- Add linear and logistic regression with fit diagnostics and clearly labeled assumptions.
- Add time-series summaries, decomposition, and forecast comparisons.
- Keep formulas deterministic and test edge cases, missing data behavior, and small-sample handling.

## Phase 4: Data modeling

- Add explicit table relationships, reusable calculated measures, date tables, and a semantic model that can feed reports.
- Validate relationship cardinality and report ambiguous or many-to-many joins before applying them.

## Phase 5: Visualization workbench

- Add scatter, histogram, box, area, heatmap, and distribution plots alongside existing charts.
- Add interactive selections, drill-down, cross-filtering, and dashboard layout controls.
- Keep the shared report definition as the source for the dashboard and all exporters.

## Phase 6: Guided advanced analysis

- Add notebook-like analysis recipes that compose built-in transformations and statistical operations.
- Allow users to save, rerun, and inspect recipe inputs and outputs offline.
- Consider optional user-authored Python execution only as a separate, explicitly enabled extension; it is not required for Python-style built-in analytics.

## Delivery order

Ship one working slice at a time: pure analysis functions and unit tests, worker-backed IPC, a reviewable UI, then report/export integration. Keep the existing upload, cleaning review, dashboard, and export flow runnable at each phase.
