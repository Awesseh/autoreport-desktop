import { describe, expect, it } from 'vitest'
import { analyzeDataset, correlateColumns, summarizeCategoricalColumn, summarizeNumericColumn } from './analytics'
import type { Dataset } from './types'

const dataset = (columns: Dataset['columns'], rows: Dataset['rows']): Dataset => ({ id: 'test', name: 'Test', sourceFile: 'test.csv', columns, rows })

describe('offline descriptive analytics', () => {
  it('summarizes numeric values with interpolated quartiles and sample statistics', () => {
    const source = dataset([{ name: 'Value', type: 'number' }], [{ Value: 1 }, { Value: 2 }, { Value: 3 }, { Value: 100 }, { Value: null }, { Value: '' }])
    const summary = summarizeNumericColumn(source, 'Value')
    expect(summary).toMatchObject({ count: 4, missing: 2, distinct: 4, sum: 106, mean: 26.5, median: 2.5, min: 1, max: 100, q1: 1.75, q3: 27.25, outlierCount: 1 })
    expect(summary.sampleVariance).toBeCloseTo(2401.6666667)
    expect(summary.sampleStdDev).toBeCloseTo(Math.sqrt(2401.6666667))
  })

  it('returns safe empty and singleton summaries', () => {
    const empty = summarizeNumericColumn(dataset([{ name: 'Value', type: 'number' }], []), 'Value')
    expect(empty).toMatchObject({ count: 0, missing: 0, distinct: 0, sum: 0, mean: null, median: null, min: null, max: null, sampleVariance: null })
    const one = summarizeNumericColumn(dataset([{ name: 'Value', type: 'number' }], [{ Value: 8 }]), 'Value')
    expect(one).toMatchObject({ count: 1, mean: 8, median: 8, sampleVariance: null, sampleStdDev: null, skewness: null })
  })

  it('ranks categorical values deterministically and reports their shares', () => {
    const source = dataset([{ name: 'Group', type: 'string' }], [{ Group: 'B' }, { Group: 'A' }, { Group: 'B' }, { Group: null }])
    expect(summarizeCategoricalColumn(source, 'Group', 2).topValues).toEqual([
      { value: 'B', count: 2, percentage: 2 / 3 * 100 },
      { value: 'A', count: 1, percentage: 1 / 3 * 100 },
    ])
  })

  it('calculates Pearson correlation with pairwise complete values', () => {
    const source = dataset([{ name: 'X', type: 'number' }, { name: 'Y', type: 'number' }], [
      { X: 1, Y: 3 }, { X: 2, Y: 5 }, { X: 3, Y: null }, { X: 4, Y: 9 },
    ])
    expect(correlateColumns(source, 'X', 'Y')).toBeCloseTo(1)
    expect(correlateColumns(dataset([{ name: 'X', type: 'number' }], [{ X: 2 }, { X: 2 }]), 'X', 'X')).toBeNull()
  })

  it('profiles numeric and categorical columns without mutating source rows', () => {
    const rows = [{ Amount: 10, Region: 'West' }, { Amount: 20, Region: 'West' }, { Amount: null, Region: 'East' }]
    const source = dataset([{ name: 'Amount', type: 'number' }, { name: 'Region', type: 'string' }], rows)
    const result = analyzeDataset(source)
    expect(result).toMatchObject({ rowCount: 3, columnCount: 2, completeness: { Amount: 67, Region: 100 } })
    expect(result.numeric[0]?.mean).toBe(15)
    expect(result.categorical[0]?.topValues[0]).toMatchObject({ value: 'West', count: 2 })
    expect(result.categorical[0]?.topValues[0]?.percentage).toBeCloseTo(200 / 3)
    expect(source.rows).toEqual(rows)
  })
})
