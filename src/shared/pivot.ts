import type { Aggregation, Dataset, PivotConfig, PivotSpec } from './types'
const aggregate = (values: number[], type: Aggregation) => !values.length ? 0 : type === 'count' ? values.length : type === 'sum' ? values.reduce((a, b) => a + b, 0) : type === 'average' ? values.reduce((a, b) => a + b, 0) / values.length : type === 'min' ? Math.min(...values) : Math.max(...values)
export function buildPivot(dataset: Dataset, config: PivotConfig): PivotSpec {
  const rowLabels = [...new Set(dataset.rows.map((r) => String(r[config.rowField] ?? '(blank)')))].sort()
  const columnLabels = config.columnField ? [...new Set(dataset.rows.map((r) => String(r[config.columnField!] ?? '(blank)')))].sort() : ['Total']
  const buckets = new Map<string, number[]>(), key = (r: string, c: string) => `${r}\u0000${c}`
  for (const row of dataset.rows) { const rowLabel = String(row[config.rowField] ?? '(blank)'), columnLabel = config.columnField ? String(row[config.columnField] ?? '(blank)') : 'Total', raw = row[config.valueField], value = config.aggregation === 'count' ? 1 : typeof raw === 'number' ? raw : Number(raw); if (config.aggregation !== 'count' && !Number.isFinite(value)) continue; const bucket = key(rowLabel, columnLabel); buckets.set(bucket, [...(buckets.get(bucket) ?? []), value]) }
  const values = rowLabels.map((r) => columnLabels.map((c) => aggregate(buckets.get(key(r, c)) ?? [], config.aggregation))), rowTotals = values.map((r) => r.reduce((a, b) => a + b, 0)), columnTotals = columnLabels.map((_, ci) => values.reduce((sum, row) => sum + (row[ci] ?? 0), 0))
  return { id: `pivot-${Date.now()}`, title: `${config.valueField} by ${config.rowField}`, rowLabels, columnLabels, values, rowTotals, columnTotals, grandTotal: rowTotals.reduce((a, b) => a + b, 0), valueLabel: config.aggregation === 'count' ? 'Count' : config.valueField }
}
