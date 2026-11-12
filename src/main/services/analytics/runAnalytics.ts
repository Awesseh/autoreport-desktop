import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { Dataset } from '../../../shared/types'
import type { DatasetAnalysis } from '../../../shared/app-types'
import { analyzeDataset } from '../../../shared/analytics'

export function runAnalysis(dataset: Dataset): Promise<DatasetAnalysis> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(path.join(__dirname, 'analyticsWorker.js'))
    } catch {
      try { resolve(analyzeDataset(dataset)) } catch (error) { reject(error) }
      return
    }

    let settled = false
    const fallback = () => {
      if (settled) return
      settled = true
      void worker.terminate()
      try { resolve(analyzeDataset(dataset)) } catch (error) { reject(error) }
    }
    worker.once('error', fallback)
    worker.once('exit', (code) => { if (!settled && code !== 0) fallback() })
    worker.once('message', (message: { ok: boolean; result?: DatasetAnalysis; error?: string }) => {
      if (settled) return
      settled = true
      void worker.terminate()
      if (message.ok && message.result) resolve(message.result)
      else reject(new Error(message.error ?? 'Dataset analysis failed.'))
    })
    try { worker.postMessage(dataset) } catch { fallback() }
  })
}
