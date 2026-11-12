import type { Branding, Dataset, KpiSpec, PivotSpec, ReportDefinition, ReportFilters, SavedTemplate, SectionSpec } from '../../../shared/types'
import { profileDataset } from './suggestion'
import { buildPivot } from '../../../shared/pivot'

const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number.isFinite(Number(value)) ? Number(value) : 0
const monthKey = (value: unknown) => { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7) }
const monthLabel = (key: string) => { const [year, month] = key.split('-').map(Number); return new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) }
export function filterDataset(dataset: Dataset, filters?: ReportFilters): Dataset {
  let rows = dataset.rows
  if (filters?.dateColumn) rows = rows.filter((row) => { const date = new Date(String(row[filters.dateColumn!] ?? '')); if (Number.isNaN(date.getTime())) return false; const day = date.toISOString().slice(0, 10); return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to) })
  if (filters?.categoryColumn && filters.categoryValue) rows = rows.filter((row) => String(row[filters.categoryColumn!] ?? '') === filters.categoryValue)
  return { ...dataset, rows }
}
const chart = (title: string, type: ChartSpec['type'], labels: string[], name: string, values: number[]): SectionSpec => ({ kind: 'chart', chart: { id: `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title, type, labels, series: [{ name, values }] } })
const pivotSection = (pivot: PivotSpec): SectionSpec => ({ kind: 'pivot', pivot })
const primaryValue = (dataset: Dataset) => dataset.columns.find((c) => c.type === 'number')?.name
const primaryCategory = (dataset: Dataset) => dataset.columns.find((c) => c.type === 'string')?.name
export function buildReportDefinition(dataset: Dataset, suggestionId: string, branding: Branding, filters?: ReportFilters): ReportDefinition {
  void branding
  const data = filterDataset(dataset, filters), profile = profileDataset(data), valueField = primaryValue(data), categoryField = filters?.categoryColumn ?? primaryCategory(data), dateField = filters?.dateColumn ?? data.columns.find((c) => c.type === 'date')?.name
  const sum = valueField ? data.rows.reduce((n, row) => n + numeric(row[valueField]), 0) : 0, average = valueField && data.rows.length ? sum / data.rows.filter((r) => r[valueField] !== null && r[valueField] !== undefined && r[valueField] !== '').length : 0
  const kpis: KpiSpec[] = [{ label: 'Rows', value: data.rows.length.toLocaleString() }, { label: 'Columns', value: data.columns.length.toLocaleString() }]
  if (valueField) { kpis.push({ label: `Total ${valueField}`, value: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }) }, { label: `Average ${valueField}`, value: average.toLocaleString(undefined, { maximumFractionDigits: 2 }) }) }
  if (dateField && valueField) {
    const totals = new Map<string, number>()
    for (const row of data.rows) { const key = monthKey(row[dateField]); if (key) totals.set(key, (totals.get(key) ?? 0) + numeric(row[valueField])) }
    const months = [...totals.keys()].sort(), previous = months.length > 1 ? totals.get(months[months.length - 2]!) ?? 0 : 0, latest = months.length ? totals.get(months[months.length - 1]!) ?? 0 : 0
    if (months.length > 1) kpis.push({ label: 'Latest month', value: latest.toLocaleString(undefined, { maximumFractionDigits: 2 }), delta: previous ? (latest - previous) / Math.abs(previous) * 100 : 0 })
  }
  const sections: SectionSpec[] = [{ kind: 'kpi', kpis }]
  if (suggestionId === 'data-quality') {
    const labels = Object.keys(profile.completeness), vals = labels.map((label) => profile.completeness[label] ?? 0)
    if (labels.length) sections.push(chart('Column completeness', 'bar', labels, 'Completeness (%)', vals))
    if (labels.length) { const total = vals.reduce((a, b) => a + b, 0); sections.push(pivotSection({ id: 'pivot-completeness', title: 'Completeness by column', rowLabels: labels, columnLabels: ['Completeness (%)'], values: vals.map((value) => [value]), rowTotals: vals, columnTotals: [total], grandTotal: total, valueLabel: 'Completeness (%)' })) }
    const incomplete = labels.filter((label) => (profile.completeness[label] ?? 100) < 100)
    sections.push({ kind: 'narrative', narrative: { paragraphs: [`The dataset contains ${profile.rowCount} row(s) and ${data.columns.length} column(s).`, incomplete.length ? `${incomplete.length} column(s) contain missing values: ${incomplete.slice(0, 8).join(', ')}.` : 'Every column is complete in the current data.', `Detected ${profile.numericColumns.length} numeric and ${profile.dateColumns.length} date column(s).`] } })
  } else {
    if (suggestionId === 'trend-analysis' && dateField && valueField) {
      const totals = new Map<string, number>()
      for (const row of data.rows) { const key = monthKey(row[dateField]); if (key) totals.set(key, (totals.get(key) ?? 0) + numeric(row[valueField])) }
      const months = [...totals.keys()].sort(), labels = months.map(monthLabel)
      if (months.length) sections.push(chart(`${valueField} by month`, 'line', labels, valueField, months.map((m) => totals.get(m) ?? 0)))
    }
    if (categoryField && valueField) {
      const sums = new Map<string, number>()
      for (const row of data.rows) { const label = String(row[categoryField] ?? '(blank)'); sums.set(label, (sums.get(label) ?? 0) + numeric(row[valueField])) }
      const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      if (top.length && ['category-breakdown', 'kpi-dashboard', 'trend-analysis'].includes(suggestionId)) {
        sections.push(chart(`Top ${categoryField}`, 'bar', top.map(([label]) => label), valueField, top.map(([, value]) => value)))
        sections.push(chart(`${categoryField} share`, 'pie', top.map(([label]) => label), valueField, top.map(([, value]) => value)))
      }
      if (['category-breakdown', 'kpi-dashboard', 'trend-analysis'].includes(suggestionId)) {
        const pivot = buildPivot(data, { rowField: categoryField, columnField: null, valueField, aggregation: 'sum' })
        // Keep the table valid even when the source has no derived year column.
        if (dateField) {
          const years = [...new Set(data.rows.map((r) => new Date(String(r[dateField])).getFullYear()).filter(Number.isFinite))].sort()
          const matrix = new Map<string, Map<string, number>>()
          for (const row of data.rows) { const year = String(new Date(String(row[dateField])).getFullYear()), label = String(row[categoryField] ?? '(blank)'), rowMap = matrix.get(label) ?? new Map<string, number>(); rowMap.set(year, (rowMap.get(year) ?? 0) + numeric(row[valueField])); matrix.set(label, rowMap) }
          const ranked = [...matrix.entries()].map(([label, m]) => ({ label, m, total: [...m.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total).slice(0, 15)
          const values = ranked.map(({ m }) => years.map((year) => m.get(String(year)) ?? 0)), rowTotals = values.map((r) => r.reduce((a, b) => a + b, 0)), columnTotals = years.map((_, ci) => values.reduce((s, r) => s + (r[ci] ?? 0), 0))
          sections.push(pivotSection({ id: 'pivot-category-year', title: `${valueField} by ${categoryField} and year`, rowLabels: ranked.map((r) => r.label), columnLabels: years.map(String), values, rowTotals, columnTotals, grandTotal: rowTotals.reduce((a, b) => a + b, 0), valueLabel: valueField }))
        } else {
          const keep = pivot.rowLabels.map((label, index) => ({ label, index, total: pivot.rowTotals[index] ?? 0 })).sort((a, b) => b.total - a.total).slice(0, 15)
          const values = keep.map(({ index }) => pivot.values[index] ?? []), rowTotals = keep.map(({ total }) => total), columnTotals = pivot.columnLabels.map((_, ci) => values.reduce((sum, row) => sum + (row[ci] ?? 0), 0))
          sections.push(pivotSection({ ...pivot, rowLabels: keep.map((row) => row.label), values, rowTotals, columnTotals, grandTotal: rowTotals.reduce((a, b) => a + b, 0) }))
        }
      }
    }
    if (suggestionId === 'kpi-dashboard' && valueField && !categoryField) sections.push(chart(`Total ${valueField}`, 'bar', ['Total'], valueField, [sum]))
    const weakest = Object.entries(profile.completeness).sort((a, b) => a[1] - b[1])[0]
    const paragraphs = [`The current view contains ${data.rows.length} row(s) across ${data.columns.length} column(s).`]
    if (weakest && weakest[1] < 95) paragraphs.push(`“${weakest[0]}” has the lowest completeness at ${weakest[1]}%.`)
    if (profile.hasDateColumn) paragraphs.push('Date values are available, so time-based comparisons can be explored.')
    sections.push({ kind: 'narrative', narrative: { paragraphs } })
  }
  const titles: Record<string, string> = { 'trend-analysis': 'Trend analysis', 'category-breakdown': 'Category breakdown', 'kpi-dashboard': 'KPI dashboard', 'data-quality': 'Data quality report' }
  return { id: `report-${Date.now()}`, title: titles[suggestionId] ?? 'Easy Report', suggestionId, datasetName: dataset.name, sections, ...(filters ? { filters } : {}) }
}
export function rebuildTemplate(dataset: Dataset, template: SavedTemplate, branding: Branding): ReportDefinition {
  const generated = buildReportDefinition(dataset, template.definition.suggestionId, branding, template.definition.filters), available = [...generated.sections], sections = template.definition.sections.flatMap((saved) => {
    if (saved.kind === 'kpi') { const current = available.find((item) => item.kind === 'kpi'); return current ? [current] : [] }
    if (saved.kind === 'narrative') { const current = available.find((item) => item.kind === 'narrative'); return current ? [current] : [] }
    if (saved.kind === 'chart') { const current = available.find((item) => item.kind === 'chart' && item.chart.id === saved.chart.id); return current ? [current] : [] }
    const current = available.find((item) => item.kind === 'pivot' && item.pivot.id === saved.pivot.id)
    return current ? [current] : [saved]
  })
  return { ...generated, title: template.definition.title, sections: sections.length ? sections : generated.sections }
}
