import type { Dataset, ReportSuggestion } from '../../../shared/types'
import type { DatasetProfile } from '../../../shared/app-types'
export function profileDataset(dataset: Dataset): DatasetProfile {
  const completeness: Record<string, number> = {}
  for (const column of dataset.columns) completeness[column.name] = dataset.rows.length ? Math.round(dataset.rows.filter((row) => row[column.name] !== null && row[column.name] !== undefined && row[column.name] !== '').length / dataset.rows.length * 100) : 0
  const numericColumns = dataset.columns.filter((c) => c.type === 'number').map((c) => c.name), dateColumns = dataset.columns.filter((c) => c.type === 'date').map((c) => c.name)
  const categoricalColumns = dataset.columns.filter((c) => c.type === 'string').filter((c) => { const cardinality = new Set(dataset.rows.map((r) => String(r[c.name] ?? '')).filter(Boolean)).size; return cardinality >= 2 && cardinality <= Math.max(20, dataset.rows.length / 2) }).map((c) => c.name)
  return { rowCount: dataset.rows.length, numericColumns, dateColumns, categoricalColumns, completeness, hasDateColumn: dateColumns.length > 0 }
}
export function suggestReports(dataset: Dataset): ReportSuggestion[] {
  const p = profileDataset(dataset), suggestions: ReportSuggestion[] = []
  if (p.hasDateColumn && p.numericColumns.length) suggestions.push({ id: 'trend-analysis', title: 'Trend analysis', description: 'Track how numeric measures change over time.', highlights: ['Monthly trend chart', 'Month-over-month change', 'Time-based summary'] })
  if (p.numericColumns.length && p.categoricalColumns.length) suggestions.push({ id: 'category-breakdown', title: 'Category breakdown', description: 'Compare performance across the categories in your data.', highlights: ['Top category comparisons', 'Share of total', 'Category pivot table'] })
  if (p.numericColumns.length) suggestions.push({ id: 'kpi-dashboard', title: 'KPI dashboard', description: 'Summarize the dataset with key measures and supporting visuals.', highlights: ['Key totals and averages', 'Supporting chart', 'Quick summary'] })
  suggestions.push({ id: 'data-quality', title: 'Data quality', description: 'Review completeness and the overall shape of this dataset.', highlights: ['Column completeness', 'Quality profile', 'Areas to review'] })
  return suggestions
}
