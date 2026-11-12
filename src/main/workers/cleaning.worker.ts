import { parentPort } from 'node:worker_threads'
import { runRules } from '../services/cleaning/rules'
import type { Dataset } from '../../shared/types'
if (!parentPort) throw new Error('Cleaning worker must run in a worker thread.')
parentPort.on('message', ({ dataset, options }: { dataset: Dataset; options?: Parameters<typeof runRules>[1] }) => {
  try { parentPort?.postMessage({ ok: true, result: runRules(dataset, options) }) }
  catch (error) { parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Cleaning failed.' }) }
})
