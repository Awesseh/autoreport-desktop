import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { runRules, type RuleOptions } from './rules'
import type { CleaningResult, Dataset } from '../../../shared/types'

export function runCleaning(dataset: Dataset, options?: RuleOptions): Promise<CleaningResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try { worker = new Worker(path.join(__dirname, 'cleaningWorker.js')) }
    catch { resolve(runRules(dataset, options)); return }
    let settled = false
    const fallback = () => { if (settled) return; settled = true; void worker.terminate(); try { resolve(runRules(dataset, options)) } catch (error) { reject(error) } }
    worker.once('error', fallback)
    worker.once('exit', (code) => { if (!settled && code !== 0) fallback() })
    worker.once('message', (message: { ok: boolean; result?: CleaningResult; error?: string }) => {
      if (settled) return; settled = true; void worker.terminate()
      if (message.ok && message.result) resolve(message.result); else reject(new Error(message.error ?? 'Cleaning worker failed.'))
    })
    try { worker.postMessage({ dataset, options }) } catch { fallback() }
  })
}
