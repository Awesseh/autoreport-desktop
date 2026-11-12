import { useEffect, useState } from 'react'
import type { AppStep } from '../../shared/types'
import UploadWizard from './components/UploadWizard'
import DataPreview from './components/DataPreview'
import CleaningReview from './components/CleaningReview'
import ReportSuggestions from './components/ReportSuggestions'
import ReportView from './components/ReportView'
import SettingsPanel from './components/SettingsPanel'
import { useStore } from './state/store'
const steps: { id: AppStep; label: string; no: string }[] = [{ id: 'upload', label: 'Upload', no: '01' }, { id: 'preview', label: 'Preview', no: '02' }, { id: 'cleaning', label: 'Prepare', no: '03' }, { id: 'suggestions', label: 'Report type', no: '04' }, { id: 'report', label: 'Dashboard', no: '05' }]
export default function App() {
  const step = useStore((s) => s.step), setStep = useStore((s) => s.setStep), [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => { void window.easyReport.getSettings().then((settings) => useStore.getState().setSettings(settings)).catch((error) => useStore.getState().setError(error instanceof Error ? error.message : 'Could not load settings.')) }, [])
  const currentIndex = steps.findIndex((item) => item.id === step)
  return <div className="app-shell"><header className="topbar"><button className="brand-lockup" onClick={() => useStore.getState().reset()}><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 23V9h4l5 7 5-7h4v14h-4v-8l-5 6-5-6v8z" fill="currentColor"/></svg></span><span className="brand-name">easy<span>report</span></span></button><div className="topbar-right"><span className="offline-indicator"><i/> Offline ready</span><button className="settings-button" onClick={() => setSettingsOpen(true)}><span>⚙</span> Settings</button></div></header><main><nav className="stepper" aria-label="Report workflow">{steps.map((item, index) => <button key={item.id} className={`step-item ${step === item.id ? 'current' : ''} ${index < currentIndex ? 'complete' : ''}`} disabled={index > currentIndex} onClick={() => setStep(item.id)}><span className="step-number">{index < currentIndex ? '✓' : item.no}</span><span>{item.label}</span>{index < steps.length - 1 && <i/>}</button>)}</nav>{step === 'upload' && <UploadWizard/>}{step === 'preview' && <DataPreview/>}{step === 'cleaning' && <CleaningReview/>}{step === 'suggestions' && <ReportSuggestions/>}{step === 'report' && <ReportView/>}</main>{settingsOpen && <SettingsPanel close={() => setSettingsOpen(false)}/>}<footer className="app-footer"><span>Easy Report <i>·</i> Your data stays on your device</span><span>v0.1.0 <i>·</i> Built for better decisions</span></footer></div>
}
