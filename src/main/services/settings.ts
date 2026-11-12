import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AppSettings } from '../../shared/types'
const defaults: AppSettings = { apiKey: '', branding: { orgName: '', accentColor: '#2563eb' } }
const filePath = () => path.join(app.getPath('userData'), 'settings.json')
export async function getSettings(): Promise<AppSettings> {
  try { const stored = JSON.parse(await readFile(filePath(), 'utf8')) as Partial<AppSettings>; return { ...defaults, ...stored, branding: { ...defaults.branding, ...stored.branding } } }
  catch { return defaults }
}
export async function saveSettings(settings: AppSettings): Promise<void> { await writeFile(filePath(), JSON.stringify(settings, null, 2), 'utf8') }
