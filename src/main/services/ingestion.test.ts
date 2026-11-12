import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { ingestFile, parseTableLines } from './ingestion'

describe('PDF and OCR table line heuristic', () => {
  it('uses the first aligned line as headers and fills short rows safely', () => {
    expect(parseTableLines('Region     Sales\nNorth      25\nSouth')).toEqual({ headers: ['Region', 'Sales'], rows: [{ Region: 'North', Sales: '25' }] })
  })
  it('does not treat prose as a table', () => {
    expect(parseTableLines('This is a normal sentence.\nIt has no column spacing.')).toBeNull()
  })
})

describe('Excel workbook ingestion', () => {
  it('imports an XLSX workbook with headers and typed cell values', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'easy-report-xlsx-'))
    const filePath = path.join(directory, 'sales.xlsx')

    try {
      const workbook = XLSX.utils.book_new()
      const sheet = XLSX.utils.aoa_to_sheet([
        ['Region', 'Sales'],
        ['North', 125],
        ['South', 240],
      ])
      XLSX.utils.book_append_sheet(workbook, sheet, 'Sales')
      await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))

      const result = await ingestFile(filePath)

      expect(result.dataset.columns).toEqual([
        { name: 'Region', type: 'string' },
        { name: 'Sales', type: 'number' },
      ])
      expect(result.dataset.rows).toEqual([
        { Region: 'North', Sales: 125 },
        { Region: 'South', Sales: 240 },
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
