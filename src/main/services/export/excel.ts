import ExcelJS from 'exceljs'
import { createCanvas } from '@napi-rs/canvas'
import type { Branding, Dataset, ReportDefinition, SectionSpec } from '../../../shared/types'
const chartPng = (section: Extract<SectionSpec, { kind: 'chart' }>, accentColor: string): Buffer => {
  const width = 680, height = 300, canvas = createCanvas(width, height), ctx = canvas.getContext('2d'), spec = section.chart
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#263a2e'; ctx.font = 'bold 18px Arial'; ctx.fillText(spec.title, 18, 28)
  const values = spec.series[0]?.values ?? [], labels = spec.labels, color = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : '#2563eb'
  if (spec.type === 'pie') {
    const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1; let angle = -Math.PI / 2
    values.forEach((value, i) => { const next = angle + Math.max(0, value) / total * Math.PI * 2; ctx.beginPath(); ctx.moveTo(170, 165); ctx.arc(170, 165, 105, angle, next); ctx.closePath(); ctx.fillStyle = [color, '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563', '#65a30d', '#ea580c'][i % 10] ?? color; ctx.fill(); angle = next })
    ctx.beginPath(); ctx.arc(170, 165, 53, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
    labels.slice(0, 10).forEach((label, i) => { ctx.fillStyle = '#526358'; ctx.fillRect(330, 57 + i * 22, 10, 10); ctx.fillStyle = '#374151'; ctx.font = '12px Arial'; ctx.fillText(`${label.slice(0, 22)} (${Math.round((values[i] ?? 0) / total * 100)}%)`, 348, 67 + i * 22) })
  } else {
    const left = 55, top = 55, plotW = 600, plotH = 190, max = Math.max(1, ...values)
    for (let i = 0; i <= 4; i++) { const y = top + plotH * i / 4; ctx.strokeStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotW, y); ctx.stroke(); ctx.fillStyle = '#728076'; ctx.font = '10px Arial'; ctx.fillText(String(Math.round(max * (4 - i) / 4)), 12, y + 4) }
    const slot = plotW / Math.max(1, values.length)
    if (spec.type === 'line') { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); values.forEach((value, i) => { const x = left + (i + 0.5) * slot, y = top + plotH * (1 - value / max); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }); ctx.stroke(); values.forEach((value, i) => { ctx.beginPath(); ctx.arc(left + (i + 0.5) * slot, top + plotH * (1 - value / max), 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill() }) }
    else values.forEach((value, i) => { ctx.fillStyle = color; const barH = plotH * Math.max(0, value) / max; ctx.fillRect(left + i * slot + slot * .18, top + plotH - barH, slot * .64, barH) })
    const indexes = labels.length <= 12 ? labels.map((_, i) => i) : Array.from({ length: 12 }, (_, i) => Math.round(i * (labels.length - 1) / 11))
    ctx.fillStyle = '#526358'; ctx.font = '10px Arial'; indexes.forEach((index) => { const x = left + (index + .5) * slot; ctx.fillText((labels[index] ?? '').slice(0, 12), x - 18, 270) })
  }
  return canvas.toBuffer('image/png')
}
export async function writeExcel(filePath: string, dataset: Dataset, definition: ReportDefinition, branding: Branding): Promise<void> {
  const workbook = new ExcelJS.Workbook(), summary = workbook.addWorksheet('Summary'), overview = workbook.addWorksheet('Report'), data = workbook.addWorksheet('Data')
  summary.addRow([branding.orgName || 'Easy Report']); summary.addRow([definition.title]); summary.addRow(['Source', dataset.sourceFile]); summary.addRow(['Generated', new Date().toISOString()]); summary.addRow(['Rows', dataset.rows.length]); summary.addRow(['Columns', dataset.columns.length]); summary.addRow([]); summary.addRow(['Column', 'Type', 'Non-null', 'Unique', 'Min', 'Max', 'Mean'])
  for (const column of dataset.columns) {
    const values = dataset.rows.map((row) => row[column.name]).filter((v) => v !== null && v !== undefined && v !== ''), numeric = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    summary.addRow([column.name, column.type, values.length, new Set(values.map(String)).size, numeric.length ? Math.min(...numeric) : '', numeric.length ? Math.max(...numeric) : '', numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : ''])
  }
  summary.getRow(1).font = { bold: true, size: 16 }; summary.getRow(8).font = { bold: true, color: { argb: 'FFFFFFFF' } }; summary.getRow(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; summary.columns.forEach((col) => { col.width = 20 })
  overview.mergeCells('A1:L1'); overview.getCell('A1').value = branding.orgName || 'Easy Report'; overview.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF2563EB' } }; overview.mergeCells('A2:L2'); overview.getCell('A2').value = definition.title; overview.getCell('A2').font = { bold: true, size: 15 }
  let rowIndex = 4
  for (const section of definition.sections) {
    if (section.kind === 'kpi') { overview.getRow(rowIndex++).values = ['Key metrics']; for (let i = 0; i < section.kpis.length; i += 2) { const first = section.kpis[i], second = section.kpis[i + 1]; overview.getRow(rowIndex++).values = [first?.label ?? '', first?.value ?? '', second?.label ?? '', second?.value ?? ''] } rowIndex++; continue }
    if (section.kind === 'chart') { overview.getCell(`A${rowIndex}`).value = section.chart.title; overview.getCell(`A${rowIndex}`).font = { bold: true, size: 13 }; const png = chartPng(section, branding.accentColor), arrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer, image = workbook.addImage({ buffer: Buffer.from(arrayBuffer), extension: 'png' } as unknown as Parameters<ExcelJS.Workbook['addImage']>[0]); overview.addImage(image, { tl: { col: 0, row: rowIndex + 1 }, ext: { width: 680, height: 300 } }); rowIndex += 18; continue }
    if (section.kind === 'narrative') { overview.getCell(`A${rowIndex}`).value = 'Summary'; overview.getCell(`A${rowIndex}`).font = { bold: true, size: 13 }; rowIndex++; for (const paragraph of section.narrative.paragraphs) { overview.mergeCells(rowIndex, 1, rowIndex, 12); overview.getCell(rowIndex, 1).value = paragraph; rowIndex++ } rowIndex++; continue }
    const pivot = section.pivot; overview.getCell(`A${rowIndex}`).value = pivot.title; overview.getCell(`A${rowIndex}`).font = { bold: true, size: 13 }; rowIndex++; overview.getRow(rowIndex++).values = ['', ...pivot.columnLabels, 'Total']; pivot.rowLabels.forEach((label, ri) => { overview.getRow(rowIndex++).values = [label, ...(pivot.values[ri] ?? []), pivot.rowTotals[ri] ?? 0] }); overview.getRow(rowIndex++).values = ['Total', ...pivot.columnTotals, pivot.grandTotal]; rowIndex += 2
  }
  overview.columns = Array.from({ length: 12 }, () => ({ width: 15 })); overview.views = [{ state: 'frozen', ySplit: 3 }]
  data.addRow(dataset.columns.map((c) => c.name)); data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; data.views = [{ state: 'frozen', ySplit: 1 }]
  for (const row of dataset.rows) data.addRow(dataset.columns.map((c) => row[c.name] instanceof Date ? (row[c.name] as Date).toISOString() : row[c.name] as ExcelJS.CellValue))
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, dataset.columns.length) } }
  data.columns.forEach((col, i) => { const header = dataset.columns[i]?.name ?? ''; const max = Math.max(header.length, ...dataset.rows.slice(0, 1000).map((row) => String(row[header] ?? '').length)); col.width = Math.max(12, Math.min(34, max + 2)) })
  await workbook.xlsx.writeFile(filePath)
}
