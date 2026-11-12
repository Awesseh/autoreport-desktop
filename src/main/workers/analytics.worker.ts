import { parentPort } from 'node:worker_threads'
import type { Dataset } from '../../shared/types'
import { analyzeDataset } from '../../shared/analytics'

if (!parentPort) throw new Error('Analytics worker must run in a worker thread.')
parentPort.on('message', (dataset: Dataset) => {
  try { parentPort?.postMessage({ ok: true, result: analyzeDataset(dataset) }) }
  catch (error) { parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Dataset analysis failed.' }) }
})
