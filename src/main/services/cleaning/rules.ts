import type { ChangeLogEntry, CleaningResult, Dataset } from '../../../shared/types'

export interface RuleOptions { fuzzyDedup?: boolean; missingValuePolicy?: 'flag' | 'impute' | 'drop'; flagOutliers?: boolean }
const isMissing = (v: unknown) => v === null || v === undefined || v === ''
const change = (stage: string, description: string, affectedRows: number, affectedColumns: string[]): ChangeLogEntry => {
  const source = `${stage}|${description}|${affectedRows}|${affectedColumns.join('|')}`
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return { id: `${stage}-${(hash >>> 0).toString(36)}`, stage, description, affectedRows, affectedColumns, status: 'pending' }
}
const renameColumns = (dataset: Dataset, names: string[]) => ({ ...dataset, columns: dataset.columns.map((c, i) => ({ ...c, name: names[i] ?? c.name })), rows: dataset.rows.map((row) => Object.fromEntries(names.map((name, i) => [name, row[dataset.columns[i]?.name ?? name]]))) })

export function repairHeaders(dataset: Dataset): CleaningResult {
  const seen = new Map<string, number>(), names = dataset.columns.map((column, index) => {
    const initial = column.name.trim(), repaired = !initial || /^unnamed(?:\s*:?\s*\d+)?$/i.test(initial) || /^column\s+\d+$/i.test(initial) ? `Column ${index + 1}` : initial
    const count = (seen.get(repaired) ?? 0) + 1; seen.set(repaired, count)
    return count === 1 ? repaired : `${repaired}_${count}`
  })
  if (names.every((name, i) => name === dataset.columns[i]?.name)) return { dataset, changes: [] }
  return { dataset: renameColumns(dataset, names), changes: [change('header-repair', 'Repaired empty or repeated column names and updated row keys.', dataset.rows.length, names)] }
}
export function trimWhitespace(dataset: Dataset): CleaningResult {
  const touched = new Set<string>(), names = dataset.columns.map((c) => c.name.replace(/\s+/g, ' ').trim())
  const seen = new Map<string, number>(), uniqueNames = names.map((name) => { const n = (seen.get(name) ?? 0) + 1; seen.set(name, n); return n > 1 ? `${name}_${n}` : name })
  const rows = dataset.rows.map((row) => {
    const next: Record<string, unknown> = {}
    dataset.columns.forEach((column, i) => {
      let value = row[column.name]
      if (typeof value === 'string') { const normalized = value.replace(/\s+/g, ' ').trim(); if (normalized !== value) touched.add(uniqueNames[i] ?? column.name); value = normalized }
      next[uniqueNames[i] ?? column.name] = value
    })
    return next
  })
  const headerTouched = uniqueNames.some((name, i) => name !== dataset.columns[i]?.name)
  if (!touched.size && !headerTouched) return { dataset, changes: [] }
  return { dataset: { ...dataset, columns: dataset.columns.map((c, i) => ({ ...c, name: uniqueNames[i] ?? c.name })), rows }, changes: [change('trim-whitespace', `Trimmed or normalized whitespace${headerTouched ? ' in column names' : ''}.`, dataset.rows.length, [...touched, ...(headerTouched ? uniqueNames : [])])] }
}
export function dropEmptyRows(dataset: Dataset): CleaningResult {
  const rows = dataset.rows.filter((row) => !dataset.columns.every((c) => isMissing(row[c.name])))
  const removed = dataset.rows.length - rows.length
  return { dataset: removed ? { ...dataset, rows } : dataset, changes: removed ? [change('drop-empty-rows', `Removed ${removed} fully empty row(s).`, removed, [])] : [] }
}
const numericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !/^-?[\d,\s]*\.?\d+%?$/.test(value.trim())) return null
  const n = Number(value.replace(/[,%\s]/g, '')); return Number.isFinite(n) ? n : null
}
export function coerceTypes(dataset: Dataset): CleaningResult {
  const columns = dataset.columns.map((column) => {
    const values = dataset.rows.map((r) => r[column.name]).filter((v) => !isMissing(v))
    if (!values.length) return column
    const numeric = values.map(numericValue)
    if ((column.type === 'string' || column.type === 'unknown') && numeric.every((v) => v !== null)) return { ...column, type: 'number' as const }
    if (column.type === 'date' && values.every((v) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime()))) return { ...column, type: 'date' as const }
    return column
  })
  let dateChangeCount = new Map<string, number>()
  const rows = dataset.rows.map((row) => Object.fromEntries(columns.map((column) => {
    const original = dataset.columns.find((c) => c.name === column.name)?.type
    const value = row[column.name]
    if (column.type === 'number' && (original === 'string' || original === 'unknown')) return [column.name, isMissing(value) ? value : numericValue(value)]
    if (column.type === 'date' && typeof value === 'string') { const date = new Date(value); if (!Number.isNaN(date.getTime())) { const normalized = date.toISOString().slice(0, 10); if (normalized !== value) dateChangeCount.set(column.name, (dateChangeCount.get(column.name) ?? 0) + 1); return [column.name, normalized] } }
    return [column.name, value]
  })))
  const changes = columns.flatMap((c, i) => {
    const typeChanged = c.type !== dataset.columns[i]?.type, count = typeChanged ? rows.filter((r) => !isMissing(r[c.name])).length : dateChangeCount.get(c.name) ?? 0
    return count ? [change('type-coercion', `Converted ${count} value(s) in “${c.name}” to ${c.type === 'date' ? 'ISO dates' : c.type}.`, count, [c.name])] : []
  })
  return { dataset: changes.length ? { ...dataset, columns, rows } : dataset, changes }
}
export function deduplicate(dataset: Dataset): CleaningResult {
  const seen = new Set<string>(), rows = dataset.rows.filter((row) => {
    const key = JSON.stringify(dataset.columns.map((c) => row[c.name] ?? null)); if (seen.has(key)) return false; seen.add(key); return true
  })
  const removed = dataset.rows.length - rows.length
  return { dataset: removed ? { ...dataset, rows } : dataset, changes: removed ? [change('deduplicate', `Removed ${removed} exact duplicate row(s); the first copy was kept.`, removed, dataset.columns.map((c) => c.name))] : [] }
}
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  const maxLength = Math.max(a.length, b.length), window = Math.max(0, Math.floor(maxLength / 2) - 1)
  const aMatches = Array<boolean>(a.length).fill(false), bMatches = Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j++) {
    if (!bMatches[j] && a[i] === b[j]) { aMatches[i] = true; bMatches[j] = true; matches++; break }
  }
  if (!matches) return 0
  let k = 0, transpositions = 0
  for (let i = 0; i < a.length; i++) if (aMatches[i]) { while (!bMatches[k]) k++; if (a[i] !== b[k]) transpositions++; k++ }
  const m = matches, jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3
  if (jaro < 0.7) return jaro
  let prefix = 0; while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}
export function fuzzyDeduplicate(dataset: Dataset): CleaningResult {
  if (dataset.rows.length > 5000) return { dataset, changes: [change('fuzzy-deduplicate', 'Fuzzy duplicate scan skipped because the dataset exceeds the 5,000 row safety limit.', 0, [])] }
  const signatures = dataset.rows.map((row) => dataset.columns.map((c) => String(row[c.name] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')).join('|'))
  const kept: number[] = [], removed = new Set<number>()
  for (let i = 0; i < signatures.length; i++) {
    if (removed.has(i)) continue
    const a = signatures[i] ?? ''
    for (let j = i + 1; j < signatures.length; j++) {
      if (removed.has(j)) continue
      const b = signatures[j] ?? '', ratio = Math.max(a.length, b.length) ? Math.abs(a.length - b.length) / Math.max(a.length, b.length) : 0
      if (a[0] === b[0] && ratio <= 0.2 && jaroWinkler(a, b) >= 0.93) removed.add(j)
    }
    kept.push(i)
  }
  const rows = kept.map((i) => dataset.rows[i]!).filter(Boolean)
  return { dataset: removed.size ? { ...dataset, rows } : dataset, changes: removed.size ? [change('fuzzy-deduplicate', `Found ${removed.size} likely near-duplicate row(s); kept the first match in each group. Review before relying on totals.`, removed.size, dataset.columns.map((c) => c.name))] : [] }
}
export function handleMissing(dataset: Dataset, policy: 'flag' | 'impute' | 'drop' = 'flag'): CleaningResult {
  const missingRows = dataset.rows.filter((r) => dataset.columns.some((c) => isMissing(r[c.name])))
  if (!missingRows.length) return { dataset, changes: [] }
  if (policy === 'drop') {
    const rows = dataset.rows.filter((r) => dataset.columns.every((c) => !isMissing(r[c.name])))
    return { dataset: { ...dataset, rows }, changes: [change('missing-values', `Removed ${dataset.rows.length - rows.length} row(s) containing missing values.`, dataset.rows.length - rows.length, dataset.columns.filter((c) => dataset.rows.some((r) => isMissing(r[c.name]))).map((c) => c.name))] }
  }
  if (policy === 'impute') {
    const rows = dataset.rows.map((r) => ({ ...r }))
    const affected: string[] = []
    for (const column of dataset.columns) {
      const missing = rows.filter((r) => isMissing(r[column.name])); if (!missing.length) continue
      affected.push(column.name)
      const values = rows.map((r) => r[column.name]).filter((v) => !isMissing(v))
      let fill: unknown = null
      if (column.type === 'number') { const sorted = values.map((v) => Number(v)).filter(Number.isFinite).sort((a, b) => a - b), mid = Math.floor(sorted.length / 2); fill = sorted.length ? sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : null }
      else { const counts = new Map<string, { count: number; value: unknown }>(); for (const v of values) { const key = String(v); const item = counts.get(key) ?? { count: 0, value: v }; item.count++; counts.set(key, item) }; fill = [...counts.values()].sort((a, b) => b.count - a.count)[0]?.value ?? null }
      rows.forEach((r) => { if (isMissing(r[column.name])) r[column.name] = fill })
    }
    return { dataset: { ...dataset, rows }, changes: [change('missing-values', `Imputed missing values using column median or mode in ${missingRows.length} row(s).`, missingRows.length, affected)] }
  }
  const name = uniqueColumnName(dataset, '__missing_count')
  const columns = hasColumn ? dataset.columns : [...dataset.columns, { name, type: 'number' as const }]
  const rows = dataset.rows.map((r) => ({ ...r, [name]: dataset.columns.filter((c) => isMissing(r[c.name])).length }))
  return { dataset: { ...dataset, columns, rows }, changes: [change('missing-values', `Flagged missing cells in ${missingRows.length} row(s) with “${name}”.`, missingRows.length, dataset.columns.filter((c) => dataset.rows.some((r) => isMissing(r[c.name]))).map((c) => c.name).concat(name))] }
}
const quantile = (values: number[], p: number) => { const position = (values.length - 1) * p, lower = Math.floor(position), fraction = position - lower; return (values[lower] ?? 0) * (1 - fraction) + (values[lower + 1] ?? values[lower] ?? 0) * fraction }
export function flagOutliers(dataset: Dataset): CleaningResult {
  let rows = dataset.rows, columns = dataset.columns, changes: ChangeLogEntry[] = []
  for (const column of dataset.columns.filter((c) => c.type === 'number')) {
    const values = dataset.rows.map((r) => r[column.name]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
    if (values.length < 4) continue
    const q1 = quantile(values, 0.25), q3 = quantile(values, 0.75), iqr = q3 - q1, low = q1 - 1.5 * iqr, high = q3 + 1.5 * iqr
    const flag = uniqueColumnName({ ...dataset, columns }, `__outlier_${column.name}`)
    rows = rows.map((r) => ({ ...r, [flag]: typeof r[column.name] === 'number' && ((r[column.name] as number) < low || (r[column.name] as number) > high) }))
    columns = [...columns, { name: flag, type: 'boolean' }]
    const count = rows.filter((r) => r[flag] === true).length
    changes.push(change('outliers', count ? `Flagged ${count} outlier value(s) in “${column.name}” using the 1.5×IQR rule. Rows were kept.` : `Added “${flag}” using the 1.5×IQR rule; no outlier values were found. Rows were kept.`, count, [column.name, flag]))
  }
  return { dataset: columns === dataset.columns ? dataset : { ...dataset, columns, rows }, changes }
}
function uniqueColumnName(dataset: Dataset, base: string): string { let name = base, suffix = 2; while (dataset.columns.some((column) => column.name === name)) name = `${base}_${suffix++}`; return name }
export function runRules(dataset: Dataset, options: RuleOptions = {}): CleaningResult {
  let current = dataset, changes: ChangeLogEntry[] = []
  const apply = (fn: (d: Dataset) => CleaningResult) => { const result = fn(current); current = result.dataset; changes.push(...result.changes) }
  apply(repairHeaders); apply(trimWhitespace); apply(dropEmptyRows); apply(coerceTypes); apply(deduplicate)
  if (options.fuzzyDedup !== false) apply(fuzzyDeduplicate)
  apply((d) => handleMissing(d, options.missingValuePolicy ?? 'flag'))
  if (options.flagOutliers !== false) apply(flagOutliers)
  return { dataset: current, changes }
}
