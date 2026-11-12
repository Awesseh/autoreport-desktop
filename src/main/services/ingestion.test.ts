import { describe, expect, it } from 'vitest'
import { parseTableLines } from './ingestion'
describe('PDF and OCR table line heuristic', () => {
  it('uses the first aligned line as headers and fills short rows safely', () => {
    expect(parseTableLines('Region     Sales\nNorth      25\nSouth')).toEqual({ headers: ['Region', 'Sales'], rows: [{ Region: 'North', Sales: '25' }] })
  })
  it('does not treat prose as a table', () => {
    expect(parseTableLines('This is a normal sentence.\nIt has no column spacing.')).toBeNull()
  })
})
