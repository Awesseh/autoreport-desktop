import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ReportDefinition, SavedTemplate } from '../../shared/types'
const filePath = () => path.join(app.getPath('userData'), 'templates.json')
export async function listTemplates(): Promise<SavedTemplate[]> { try { const value: unknown = JSON.parse(await readFile(filePath(), 'utf8')); return Array.isArray(value) ? value as SavedTemplate[] : [] } catch { return [] } }
export async function saveTemplate(name: string, definition: ReportDefinition): Promise<SavedTemplate[]> { const templates = await listTemplates(); templates.push({ id: `template-${Date.now()}`, name: name.trim(), createdAt: new Date().toISOString(), definition }); await writeFile(filePath(), JSON.stringify(templates, null, 2), 'utf8'); return templates }
export async function deleteTemplate(id: string): Promise<SavedTemplate[]> { const templates = (await listTemplates()).filter((item) => item.id !== id); await writeFile(filePath(), JSON.stringify(templates, null, 2), 'utf8'); return templates }
