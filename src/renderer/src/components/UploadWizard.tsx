import { useState } from 'react'
import { useStore } from '../state/store'
export default function UploadWizard() {
  const { busy, setBusy, setIngest, setError, error } = useStore(), [dragging, setDragging] = useState(false)
  const open = async () => {
    setError(null); setBusy(true)
    try { const path = await window.easyReport.openFile(); if (!path) return; setIngest(await window.easyReport.ingest(path)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read this file.') } finally { setBusy(false) }
  }
  const drop = async (event: React.DragEvent) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (!file) { setError('Drop a local file from your computer.'); return }; setBusy(true); try { setIngest(await window.easyReport.ingestDroppedFile(file)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this file.') } finally { setBusy(false) } }
  return <section className="welcome"><div className="welcome-copy"><span className="eyebrow">FROM RAW DATA TO CLEAR DECISIONS</span><h1>Your data,<br/><em>ready to report.</em></h1><p>Upload a file. Easy Report checks the structure, prepares your data, and builds a report you can export and share.</p><div className="trust-row"><span>◉ Works offline</span><span>◉ Review every change</span><span>◉ One model, three exports</span></div></div><div className={`drop-card ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}><div className="upload-symbol">↥</div><h2>Start with a data file</h2><p>Drop a file here, or browse your computer</p><button className="primary" disabled={busy} onClick={open}>{busy ? 'Reading file…' : 'Choose a file'} <span>→</span></button><small>CSV · TSV · Excel · JSON · PDF · Images</small></div>{error && <div className="error-toast">{error}</div>}</section>
}
