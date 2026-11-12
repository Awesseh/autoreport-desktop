import { describe, expect, it } from 'vitest'
import { deduplicate, dropEmptyRows, fuzzyDeduplicate, handleMissing, jaroWinkler, repairHeaders, runRules, trimWhitespace, coerceTypes, flagOutliers } from '../rules'
import type { Dataset } from '../../../../shared/types'
const data = (columns: Dataset['columns'], rows: Dataset['rows']): Dataset => ({ id: 'test', name: 'Test', sourceFile: 'test.csv', columns, rows })

describe('cleaning rules', () => {
  it('keeps an already-clean dataset unchanged apart from requested missing and outlier flags', () => {
    const source = data([{ name: 'Sales', type: 'number' }, { name: 'Region', type: 'string' }], [{ Sales: 4, Region: 'North' }, { Sales: 8, Region: 'South' }])
    const result = runRules(source, { fuzzyDedup: false, flagOutliers: false })
    expect(result.dataset.rows).toEqual(source.rows)
    expect(result.changes).toEqual([])
  })

  it('handles empty datasets without inventing rows', () => {
    const source = data([{ name: 'A', type: 'string' }], [])
    expect(runRules(source, { fuzzyDedup: false, flagOutliers: false })).toEqual({ dataset: source, changes: [] })
  })

  it('repairs blank and repeated headers while re-keying rows', () => {
    const source = data([{ name: '', type: 'string' }, { name: 'Name', type: 'string' }, { name: 'Name', type: 'string' }], [{ '': 'x', Name: 'y' }])
    const result = repairHeaders(source)
    expect(result.dataset.columns.map((c) => c.name)).toEqual(['Column 1', 'Name', 'Name_2'])
    expect(result.dataset.rows[0]).toEqual({ 'Column 1': 'x', Name: 'y', Name_2: 'y' })
    expect(result.changes[0]?.affectedColumns).toContain('Name_2')
  })

  it('trims and collapses whitespace and logs touched columns', () => {
    const result = trimWhitespace(data([{ name: ' City  Name ', type: 'string' }], [{ ' City  Name ': '  New   York  ' }]))
    expect(result.dataset.columns[0]?.name).toBe('City Name')
    expect(result.dataset.rows[0]?.['City Name']).toBe('New York')
    expect(result.changes[0]?.affectedColumns).toContain('City Name')
  })

  it('removes only fully empty rows and records the count', () => {
    const source = data([{ name: 'A', type: 'string' }, { name: 'B', type: 'number' }], [{ A: '', B: null }, { A: 'ok', B: null }])
    const result = dropEmptyRows(source)
    expect(result.dataset.rows).toHaveLength(1)
    expect(result.changes[0]?.affectedRows).toBe(1)
  })

  it('coerces consistently numeric strings and reports the changed column', () => {
    const result = coerceTypes(data([{ name: 'Revenue', type: 'string' }], [{ Revenue: '1,200' }, { Revenue: ' 30.5 ' }, { Revenue: '10%' }]))
    expect(result.dataset.columns[0]?.type).toBe('number')
    expect(result.dataset.rows.map((row) => row.Revenue)).toEqual([1200, 30.5, 10])
    expect(result.changes.map((c) => c.affectedColumns)).toEqual([['Revenue']])
  })

  it('removes exact duplicates and preserves the first copy', () => {
    const first = { A: 1 }, result = deduplicate(data([{ name: 'A', type: 'number' }], [first, { A: 1 }, { A: 2 }]))
    expect(result.dataset.rows).toEqual([first, { A: 2 }])
    expect(result.changes[0]?.affectedRows).toBe(1)
  })

  it('computes Jaro-Winkler scores with exact match and transposition behavior', () => {
    expect(jaroWinkler('same', 'same')).toBe(1)
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961111, 5)
    expect(jaroWinkler('abc', 'xyz')).toBe(0)
  })

  it('fuzzy-deduplicates close signatures and skips datasets above 5,000 rows', () => {
    const similar = data([{ name: 'Name', type: 'string' }], [{ Name: 'Martha' }, { Name: 'Marhta' }])
    expect(fuzzyDeduplicate(similar).dataset.rows).toHaveLength(1)
    const large = data([{ name: 'Name', type: 'string' }], Array.from({ length: 5001 }, (_, i) => ({ Name: `name${i}` })))
    expect(fuzzyDeduplicate(large).changes[0]?.description).toContain('skipped')
    expect(fuzzyDeduplicate(large).dataset.rows).toHaveLength(5001)
  })

  it('flags, imputes, or drops missing values explicitly', () => {
    const source = data([{ name: 'Amount', type: 'number' }, { name: 'Group', type: 'string' }], [{ Amount: 2, Group: 'A' }, { Amount: null, Group: 'A' }, { Amount: 10, Group: null }])
    const flagged = handleMissing(source, 'flag')
    expect(flagged.dataset.rows[1]?.__missing_count).toBe(1)
    expect(flagged.changes[0]?.stage).toBe('missing-values')
    const imputed = handleMissing(source, 'impute')
    expect(imputed.dataset.rows.map((r) => r.Amount)).toEqual([2, 6, 10])
    const dropped = handleMissing(source, 'drop')
    expect(dropped.dataset.rows).toHaveLength(1)
    expect(dropped.changes[0]?.affectedRows).toBe(2)
    const oddMedian = handleMissing(data([{ name: 'Amount', type: 'number' }], [{ Amount: 1 }, { Amount: null }, { Amount: 9 }, { Amount: 5 }]), 'impute')
    expect(oddMedian.dataset.rows[1]?.Amount).toBe(5)
  })

  it('flags IQR outliers without deleting rows, including even and odd quantiles', () => {
    const source = data([{ name: 'Value', type: 'number' }], [{ Value: 1 }, { Value: 2 }, { Value: 3 }, { Value: 4 }, { Value: 100 }])
    const result = flagOutliers(source)
    expect(result.dataset.rows).toHaveLength(5)
    expect(result.dataset.rows[4]?.__outlier_Value).toBe(true)
    expect(result.changes[0]?.affectedRows).toBe(1)
    const even = flagOutliers(data([{ name: 'Value', type: 'number' }], [{ Value: 1 }, { Value: 2 }, { Value: 3 }, { Value: 4 }]))
    expect(even.dataset.columns[1]?.name).toBe('__outlier_Value')
    expect(even.changes).toHaveLength(1)
    expect(even.changes[0]?.affectedRows).toBe(0)
  })
})
