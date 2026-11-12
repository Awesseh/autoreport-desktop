import type { Dataset } from './types'
import type { CategoricalColumnSummary, DatasetAnalysis, NumericColumnSummary } from './app-types'

const missing = (value: unknown): boolean => value === null || value === undefined || value === ''

function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.replace(/,/g, '').trim()
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function quantile(sorted: number[], probability: number): number | null {
  if (!sorted.length) return null
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const lowerValue = sorted[lower]
  const upperValue = sorted[upper]
  if (lowerValue === undefined || upperValue === undefined) return null
  return lowerValue + (upperValue - lowerValue) * (position - lower)
}

export function summarizeNumericColumn(dataset: Dataset, column: string): NumericColumnSummary {
  const raw = dataset.rows.map((row) => row[column])
  const values = raw.map(numericValue).filter((value): value is number => value !== null).sort((a, b) => a - b)
  const count = values.length
  const sum = values.reduce((total, value) => total + value, 0)
  const mean = count ? sum / count : null
  const q1 = quantile(values, 0.25)
  const median = quantile(values, 0.5)
  const q3 = quantile(values, 0.75)
  const min = values[0] ?? null
  const max = values[count - 1] ?? null
  const populationVariance = mean === null ? null : values.reduce((total, value) => total + (value - mean) ** 2, 0) / count
  const sampleVariance = count > 1 && populationVariance !== null ? populationVariance * count / (count - 1) : null
  const populationStdDev = populationVariance === null ? null : Math.sqrt(populationVariance)
  const sampleStdDev = sampleVariance === null ? null : Math.sqrt(sampleVariance)
  const secondMoment = populationVariance
  const thirdMoment = mean === null ? null : values.reduce((total, value) => total + (value - mean) ** 3, 0) / count
  const skewness = count >= 3 && secondMoment && thirdMoment !== null
    ? Math.sqrt(count * (count - 1)) / (count - 2) * thirdMoment / secondMoment ** 1.5
    : null
  const iqr = q1 !== null && q3 !== null ? q3 - q1 : null
  const lowerFence = q1 !== null && iqr !== null ? q1 - 1.5 * iqr : null
  const upperFence = q3 !== null && iqr !== null ? q3 + 1.5 * iqr : null
  const outlierCount = lowerFence === null || upperFence === null ? 0 : values.filter((value) => value < lowerFence || value > upperFence).length

  return {
    column,
    count,
    missing: raw.filter((value) => missing(value) || numericValue(value) === null).length,
    distinct: new Set(values).size,
    sum,
    mean,
    median,
    min,
    max,
    range: min === null || max === null ? null : max - min,
    q1,
    q3,
    iqr,
    populationVariance,
    populationStdDev,
    sampleVariance,
    sampleStdDev,
    skewness,
    outlierCount,
  }
}

export function summarizeCategoricalColumn(dataset: Dataset, column: string, limit = 8): CategoricalColumnSummary {
  const raw = dataset.rows.map((row) => row[column])
  const frequencies = new Map<string, number>()
  let missingCount = 0
  for (const value of raw) {
    if (missing(value)) {
      missingCount++
      continue
    }
    const label = String(value)
    frequencies.set(label, (frequencies.get(label) ?? 0) + 1)
  }
  const count = raw.length - missingCount
  const topValues = [...frequencies.entries()]
    .sort(([leftLabel, leftCount], [rightLabel, rightCount]) => rightCount - leftCount || leftLabel.localeCompare(rightLabel))
    .slice(0, Math.max(0, limit))
    .map(([value, valueCount]) => ({ value, count: valueCount, percentage: count ? valueCount / count * 100 : 0 }))
  return { column, count, missing: missingCount, distinct: frequencies.size, topValues }
}

export function correlateColumns(dataset: Dataset, leftColumn: string, rightColumn: string): number | null {
  const pairs = dataset.rows.flatMap((row) => {
    const left = numericValue(row[leftColumn])
    const right = numericValue(row[rightColumn])
    return left === null || right === null ? [] : [{ left, right }]
  })
  if (pairs.length < 2) return null
  const leftMean = pairs.reduce((total, pair) => total + pair.left, 0) / pairs.length
  const rightMean = pairs.reduce((total, pair) => total + pair.right, 0) / pairs.length
  const covariance = pairs.reduce((total, pair) => total + (pair.left - leftMean) * (pair.right - rightMean), 0)
  const leftSquares = pairs.reduce((total, pair) => total + (pair.left - leftMean) ** 2, 0)
  const rightSquares = pairs.reduce((total, pair) => total + (pair.right - rightMean) ** 2, 0)
  const denominator = Math.sqrt(leftSquares * rightSquares)
  return denominator === 0 ? null : covariance / denominator
}

export function analyzeDataset(dataset: Dataset): DatasetAnalysis {
  const rowCount = dataset.rows.length
  const completeness = Object.fromEntries(dataset.columns.map((column) => [
    column.name,
    rowCount ? Math.round(dataset.rows.filter((row) => !missing(row[column.name])).length / rowCount * 100) : 0,
  ]))
  const numeric = dataset.columns.filter((column) => column.type === 'number').map((column) => summarizeNumericColumn(dataset, column.name))
  const categorical = dataset.columns.filter((column) => column.type === 'string').map((column) => summarizeCategoricalColumn(dataset, column.name))
  return { rowCount, columnCount: dataset.columns.length, completeness, numeric, categorical }
}
