import { describe, expect, it } from 'vitest'
import { buildReportDefinition, filterDataset } from '../builder'
import { profileDataset, suggestReports } from '../suggestion'
import { buildPivot } from '../../../../shared/pivot'
import type { Dataset } from '../../../../shared/types'
const dataset: Dataset = { id: 'd', name: 'Sales', sourceFile: 'sales.csv', columns: [{ name: 'Date', type: 'date' }, { name: 'Region', type: 'string' }, { name: 'Revenue', type: 'number' }], rows: [
  { Date: '2025-01-03', Region: 'North', Revenue: 10 }, { Date: '2025-01-14', Region: 'South', Revenue: 20 }, { Date: '2025-02-04', Region: 'North', Revenue: 30 }, { Date: '2025-02-19', Region: 'South', Revenue: 40 }
] }
const branding = { orgName: 'Example', accentColor: '#2563eb' }
describe('report logic', () => {
  it('profiles columns, completeness and cardinality', () => {
    expect(profileDataset(dataset)).toMatchObject({ rowCount: 4, numericColumns: ['Revenue'], dateColumns: ['Date'], categoricalColumns: ['Region'], hasDateColumn: true })
  })
  it('suggests only report types supported by the dataset', () => {
    expect(suggestReports(dataset).map((s) => s.id)).toEqual(['trend-analysis', 'category-breakdown', 'kpi-dashboard', 'data-quality'])
    const noNumbers = { ...dataset, columns: dataset.columns.filter((c) => c.type !== 'number') }
    expect(suggestReports(noNumbers).map((s) => s.id)).toEqual(['data-quality'])
  })
  it('applies date and category filters before calculating report values', () => {
    const filtered = filterDataset(dataset, { dateColumn: 'Date', from: '2025-02-01', categoryColumn: 'Region', categoryValue: 'North' })
    expect(filtered.rows).toHaveLength(1)
    const report = buildReportDefinition(dataset, 'category-breakdown', branding, { dateColumn: 'Date', from: '2025-02-01', categoryColumn: 'Region', categoryValue: 'North' })
    expect(report.sections[0]?.kind === 'kpi' && report.sections[0].kpis.find((k) => k.label === 'Rows')?.value).toBe('1')
  })
  it('groups ISO dates by yyyy-MM and displays readable month labels', () => {
    const report = buildReportDefinition(dataset, 'trend-analysis', branding), line = report.sections.find((s) => s.kind === 'chart' && s.chart.type === 'line')
    expect(line?.kind === 'chart' && line.chart.labels).toEqual(['Jan 2025', 'Feb 2025'])
    expect(line?.kind === 'chart' && line.chart.series[0]?.values).toEqual([30, 70])
  })
  it('builds pivot average values and totals equal to a manual calculation', () => {
    const pivot = buildPivot(dataset, { rowField: 'Region', columnField: 'Date', valueField: 'Revenue', aggregation: 'average' })
    expect(pivot.rowLabels).toEqual(['North', 'South'])
    expect(pivot.values.flat().filter((v) => v > 0)).toEqual([10, 30, 20, 40])
    expect(pivot.grandTotal).toBe(100)
  })
  it('returns a completeness chart and quality narrative', () => {
    const report = buildReportDefinition({ ...dataset, rows: [...dataset.rows, { Date: '', Region: '', Revenue: null }] }, 'data-quality', branding)
    expect(report.sections.some((s) => s.kind === 'chart' && s.chart.title === 'Column completeness')).toBe(true)
    expect(report.sections.some((s) => s.kind === 'narrative')).toBe(true)
  })
})
