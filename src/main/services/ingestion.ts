import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createWorker } from 'tesseract.js'
import type { Column, ColumnType, Dataset, IngestResult } from '../../shared/types'

const objectRow = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const empty = (value: unknown) => value === null || value === undefined || value === ''
const text = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value ?? '')
const createOfflineOcrWorker = async () => {
  const { app } = await import('electron')
  return createWorker('eng', 1, { langPath: path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), app.isPackaged ? 'tessdata' : 'resources/tessdata') + path.sep, gzip: false, cacheMethod: 'none' })
}
const inferType = (values: unknown[]): ColumnType => {
  const sample = values.filter((v) => !empty(v)).slice(0, 200)
  if (!sample.length) return 'unknown'
  const all = (re: RegExp) => sample.every((v) => typeof v === 'number' || re.test(text(v).trim()))
  if (sample.every((v) => typeof v === 'boolean' || /^(true|false|yes|no)$/i.test(text(v).trim()))) return 'boolean'
  if (all(/^-?[\d,\s]*\.?\d+%?$/)) return 'number'
  if (all(/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})$/)) return 'date'
  return 'string'
}
const makeDataset = (name: string, sourceFile: string, headers: string[], rows: Record<string, unknown>[]): Dataset => {
  const columns: Column[] = headers.map((header) => ({ name: header, type: inferType(rows.map((row) => row[header])) }))
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, sourceFile, columns, rows }
}
export const parseTableLines = (input: string): { headers: string[]; rows: Record<string, unknown>[] } | null => {
  const lines = input.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim())
  if (lines.length < 2) return null
  const tableLines = lines.filter((line) => /(?: {2,}|\t+)/.test(line))
  if (tableLines.length <= lines.length / 2) return null
  const split = (line: string) => line.trim().split(/\s{2,}|\t+/).map((cell) => cell.trim())
  const headers = split(tableLines[0] ?? '')
  if (headers.length < 2) return null
  const rows = tableLines.slice(1).map((line) => {
    const cells = split(line)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
  })
  return { headers, rows }
}

export async function ingestFile(filePath: string): Promise<IngestResult> {
  const ext = path.extname(filePath).toLowerCase()
  const base = path.basename(filePath)
  const warnings: string[] = []
  let headers: string[] = []
  let rows: Record<string, unknown>[] = []
  if (ext === '.csv' || ext === '.tsv') {
    const source = await readFile(filePath, 'utf8')
    const parsed = Papa.parse<Record<string, unknown>>(source, { header: true, skipEmptyLines: 'greedy', delimiter: ext === '.tsv' ? '\t' : '' })
    headers = (parsed.meta.fields ?? []).map((field) => field.trim())
    rows = parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), value])))
    if (parsed.errors.length) warnings.push(`${parsed.errors.length} parsing issue(s) were found. Review the preview before cleaning.`)
    const sourceLines = source.replace(/\r?\n$/, '').split(/\r?\n/), blankLines = sourceLines.filter((line) => !line.trim()).length
    if (blankLines) warnings.push(`${blankLines} fully blank line(s) were skipped during import.`)
  } else if (ext === '.json') {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    if (Array.isArray(parsed)) {
      rows = parsed.filter(objectRow)
      if (rows.length !== parsed.length) warnings.push(`${parsed.length - rows.length} non-object JSON item(s) were ignored.`)
    } else if (objectRow(parsed)) {
      const arrays = Object.values(parsed).filter(Array.isArray)
      if (arrays.length) {
        const chosen = arrays[0] as unknown[]
        rows = chosen.filter(objectRow)
        if (rows.length !== chosen.length) warnings.push(`${chosen.length - rows.length} non-object item(s) in the first array were ignored.`)
      } else { rows = [parsed]; warnings.push('The JSON object was imported as a single-row dataset.') }
    } else throw new Error('JSON must contain an array of objects or a single object.')
    headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  } else if (ext === '.xls' || ext === '.xlsx') {
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer', cellDates: true }), sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('The workbook has no worksheets.')
    if (workbook.SheetNames.length > 1) warnings.push(`Only the first worksheet (“${sheetName}”) was imported; ${workbook.SheetNames.length - 1} additional sheet(s) were not included.`)
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, { header: 1, defval: null, raw: true })
    headers = (matrix.shift() ?? []).map((value, index) => String(value ?? '').trim() || `Column ${index + 1}`)
    let emptyRows = 0
    rows = matrix.flatMap((values) => { if (values.every(empty)) { emptyRows++; return [] }; return [Object.fromEntries(headers.map((header, index) => [header, values[index]]))] })
    if (emptyRows) warnings.push(`${emptyRows} fully empty row(s) were skipped during workbook import.`)
  } else if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const buffer = await readFile(filePath)
    const extracted = await pdfParse(buffer)
    let table = parseTableLines(extracted.text ?? '')
    if (!table && (extracted.text ?? '').trim().length < 80) {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const canvasModule = await import('@napi-rs/canvas')
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
        const worker = await createOfflineOcrWorker()
        let ocrText = ''
        for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
          const page = await doc.getPage(i), viewport = page.getViewport({ scale: 2 }), canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
          await page.render({ canvasContext: canvas.getContext('2d') as never, viewport }).promise
          const result = await worker.recognize(await canvas.toBuffer('image/png'))
          ocrText += `${result.data.text}\n`
        }
        await worker.terminate()
        table = parseTableLines(ocrText)
        if (table) warnings.push('Scanned PDF pages were read with OCR. Review the recognized values carefully.')
      } catch (error) { warnings.push(`OCR could not read this PDF: ${error instanceof Error ? error.message : 'unknown error'}`) }
    }
    if (table) { headers = table.headers; rows = table.rows }
    else { headers = ['Text']; rows = [{ Text: extracted.text ?? '' }]; warnings.push('No table structure was detected. PDF text was imported into one column.') }
  } else if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) {
    const worker = await createOfflineOcrWorker()
    const result = await worker.recognize(filePath)
    await worker.terminate()
    if (result.data.confidence < 70) warnings.push(`OCR confidence is ${Math.round(result.data.confidence)}%. Review recognized values carefully.`)
    const table = parseTableLines(result.data.text)
    if (table) { headers = table.headers; rows = table.rows }
    else { headers = ['Text']; rows = [{ Text: result.data.text }]; warnings.push('No table structure was detected in the image; recognized text was imported into one column.') }
  } else throw new Error(`Unsupported file type “${ext || 'unknown'}”. Choose CSV, TSV, JSON, Excel, PDF, or an image.`)
  const dataset = makeDataset(base.replace(/\.[^.]+$/, ''), base, headers, rows)
  return { dataset, warnings }
}
