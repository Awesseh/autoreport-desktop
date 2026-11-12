import { chatJson } from './client'
import type { ChangeLogEntry, CleaningResult, ColumnMapping, Dataset } from '../../../shared/types'
export async function aiColumnMapping(dataset: Dataset, apiKey: string): Promise<CleaningResult> {
  const sample = dataset.columns.map((column) => ({ name: column.name, type: column.type, samples: dataset.rows.slice(0, 3).map((row) => row[column.name]) }))
  const result = await chatJson<{ mappings?: ColumnMapping[] }>(apiKey, 'You identify columns that refer to the same measure. Return JSON only with mappings: [{from,to,confidence,reason}]. Use only existing column names. Leave unrelated fields unchanged.', JSON.stringify({ columns: sample }))
  const mappings = (result.mappings ?? []).filter((mapping) => mapping.confidence >= 0.75 && dataset.columns.some((c) => c.name === mapping.from) && dataset.columns.some((c) => c.name === mapping.to) && mapping.from !== mapping.to)
  let current = dataset
  const changes: ChangeLogEntry[] = []
  for (const mapping of mappings) {
    if (!current.columns.some((c) => c.name === mapping.from) || !current.columns.some((c) => c.name === mapping.to)) continue
    const from = current.columns.find((c) => c.name === mapping.from)!
    let filled = 0
    const rows = current.rows.map((row) => {
      const canonical = row[mapping.to], source = row[mapping.from], useSource = canonical === null || canonical === undefined || canonical === ''
      if (useSource && source !== null && source !== undefined && source !== '') filled++
      const { [mapping.from]: _removed, ...remaining } = row
      return { ...remaining, [mapping.to]: useSource ? source : canonical }
    })
    current = { ...current, rows, columns: current.columns.filter((c) => c.name !== mapping.from).map((c) => c.name === mapping.to ? { ...c, type: c.type === 'unknown' ? from.type : c.type } : c) }
    changes.push({ id: `ai-merge-${Date.now()}-${changes.length}`, stage: 'ai-column-mapping', description: `Merged “${mapping.from}” into canonical field “${mapping.to}” at ${Math.round(mapping.confidence * 100)}% confidence, filling ${filled} blank value(s), then removed the source column. ${mapping.reason}`, affectedRows: filled, affectedColumns: [mapping.from, mapping.to], status: 'pending' })
  }
  return { dataset: current, changes }
}
