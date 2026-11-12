import { describe, expect, it } from 'vitest'
import { chartToSvg } from './svgCharts'
import type { ChartSpec } from '../../../shared/types'
describe('SVG report charts', () => {
  it('escapes user-supplied chart labels and renders a valid SVG document', () => {
    const chart: ChartSpec = { id: 'test', title: '<Sales & Growth>', type: 'bar', labels: ['<North>'], series: [{ name: 'Revenue', values: [4] }] }
    const svg = chartToSvg(chart)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('&lt;North&gt;')
    expect(svg).not.toContain('<North>')
  })
  it('creates a donut chart with percentage labels', () => {
    const chart: ChartSpec = { id: 'pie', title: 'Mix', type: 'pie', labels: ['A', 'B'], series: [{ name: 'Count', values: [1, 3] }] }
    expect(chartToSvg(chart)).toContain('25%')
    expect(chartToSvg(chart)).toContain('75%')
  })
})
