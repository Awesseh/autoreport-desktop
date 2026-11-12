import { useEffect, useState } from 'react'
import type { DatasetAnalysis } from '../../../shared/app-types'
import { useStore } from '../state/store'

const formatNumber = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumSignificantDigits: 5 })

export default function DataPreview() {
  const { rawDataset: dataset, warnings, setBusy, setCleaning, setError, setStep, busy, error } = useStore()
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    if (!dataset) return
    let active = true
    setAnalysis(null)
    setAnalysisError(null)
    void window.easyReport.analyze(dataset).then((result) => {
      if (active) setAnalysis(result)
    }).catch((reason: unknown) => {
      if (active) setAnalysisError(reason instanceof Error ? reason.message : 'Could not analyze this dataset.')
    })
    return () => { active = false }
  }, [dataset])

  if (!dataset) return null
  const clean = async () => {
    setBusy(true)
    setError(null)
    try { setCleaning(await window.easyReport.clean(dataset)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cleaning failed.') }
    finally { setBusy(false) }
  }

  return <section className="workspace">
    <header className="page-heading">
      <div><span className="eyebrow">STEP 02 · SOURCE DATA</span><h1>Take a first look</h1><p>Confirm the file is right. We’ll show every cleanup step before using it in a report.</p></div>
      <button className="quiet" onClick={() => setStep('upload')}>← Change file</button>
    </header>
    <div className="data-meta"><strong>{dataset.name}</strong><span>{dataset.rows.length.toLocaleString()} rows</span><span>{dataset.columns.length} columns</span><span>{dataset.sourceFile}</span></div>
    {warnings.map((warning) => <div className="warning" key={warning}>ⓘ {warning}</div>)}
    <div className="table-shell preview-table">
      <table><thead><tr>{dataset.columns.map((column) => <th key={column.name}>{column.name}<small>{column.type}</small></th>)}</tr></thead>
        <tbody>{dataset.rows.slice(0, 50).map((row, i) => <tr key={i}>{dataset.columns.map((column) => <td key={column.name}>{row[column.name] === null || row[column.name] === undefined ? <span className="muted">—</span> : String(row[column.name])}</td>)}</tr>)}</tbody>
      </table>
      {dataset.rows.length > 50 && <div className="table-note">Showing the first 50 of {dataset.rows.length.toLocaleString()} rows.</div>}
    </div>

    <section className="analysis-panel" aria-live="polite">
      <header><div><span className="eyebrow">OFFLINE DATA PROFILE</span><h2>Explore your data</h2></div><span className="analysis-note">Original data is unchanged</span></header>
      {!analysis && !analysisError && <p className="analysis-loading">Calculating descriptive statistics…</p>}
      {analysisError && <div className="warning error">Analysis could not be completed: {analysisError}</div>}
      {analysis && <>
        <div className="analysis-metrics"><div><strong>{analysis.rowCount.toLocaleString()}</strong><span>Rows analyzed</span></div><div><strong>{analysis.numeric.length}</strong><span>Numeric fields</span></div><div><strong>{analysis.categorical.length}</strong><span>Text fields</span></div></div>
        {analysis.numeric.length > 0 && <>
          <h3>Numeric summaries</h3>
          <div className="table-shell analysis-table"><table><thead><tr><th>Field</th><th>Count</th><th>Missing</th><th>Unique</th><th>Min</th><th>Q1</th><th>Median</th><th>Q3</th><th>Max</th><th>Mean</th><th>Std. dev.</th><th>Outliers</th></tr></thead>
            <tbody>{analysis.numeric.map((item) => <tr key={item.column}><th>{item.column}</th><td>{item.count.toLocaleString()}</td><td>{item.missing.toLocaleString()}</td><td>{item.distinct.toLocaleString()}</td><td>{formatNumber(item.min)}</td><td>{formatNumber(item.q1)}</td><td>{formatNumber(item.median)}</td><td>{formatNumber(item.q3)}</td><td>{formatNumber(item.max)}</td><td>{formatNumber(item.mean)}</td><td>{formatNumber(item.sampleStdDev)}</td><td>{item.outlierCount.toLocaleString()}</td></tr>)}</tbody>
          </table></div>
        </>}
        {analysis.categorical.length > 0 && <>
          <h3>Most frequent text values</h3>
          <div className="category-summary-grid">{analysis.categorical.map((item) => <article className="category-summary" key={item.column}><header><strong>{item.column}</strong><span>{item.distinct.toLocaleString()} unique</span></header>
            {item.topValues.length ? item.topValues.slice(0, 5).map((value) => <div className="frequency-row" key={value.value}><span title={value.value}>{value.value}</span><strong>{value.count.toLocaleString()}</strong><small>{value.percentage.toFixed(1)}%</small></div>) : <p className="analysis-loading">No non-empty values.</p>}
          </article>)}</div>
        </>}
      </>}
    </section>

    {error && <div className="warning error">{error}</div>}
    <footer className="action-footer"><span>Original data stays available while you review the cleaned copy.</span><button className="primary" disabled={busy} onClick={clean}>{busy ? 'Checking data…' : 'Clean and validate automatically'} <span>→</span></button></footer>
  </section>
}
