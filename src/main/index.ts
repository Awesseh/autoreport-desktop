import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppSettings, Branding, Dataset, ReportDefinition, ReportFilters } from '../shared/types'
import { ingestFile } from './services/ingestion'
import { runCleaning } from './services/cleaning/runCleaning'
import { runAnalysis } from './services/analytics/runAnalytics'
import { suggestReports } from './services/report/suggestion'
import { buildReportDefinition, rebuildTemplate } from './services/report/builder'
import { writeExcel } from './services/export/excel'
import { generateReportHtml } from './services/export/pdf'
import { writeSlides } from './services/export/slides'
import { getSettings, saveSettings } from './services/settings'
import { deleteTemplate, listTemplates, saveTemplate } from './services/templates'
import { aiColumnMapping } from './services/ai/cleaningAssist'

const here = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
const pickExportPath = async (title: string, defaultPath: string, ext: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, { title, defaultPath: `${defaultPath}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
  return result.canceled ? null : result.filePath
}
function registerHandlers() {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Supported data', extensions: ['csv', 'tsv', 'json', 'xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp'] }] })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle('ingest:file', (_event, filePath: string) => ingestFile(filePath))
  ipcMain.handle('analytics:describe', (_event, dataset: Dataset) => runAnalysis(dataset))
  ipcMain.handle('clean:run', (_event, dataset: Dataset, options) => runCleaning(dataset, options))
  ipcMain.handle('reports:suggest', (_event, dataset: Dataset) => suggestReports(dataset))
  ipcMain.handle('reports:build', (_event, dataset: Dataset, suggestionId: string, branding: Branding, filters?: ReportFilters, template?: ReportDefinition) => template ? rebuildTemplate(dataset, { id: template.id, name: template.title, createdAt: '', definition: template }, branding) : buildReportDefinition(dataset, suggestionId, branding, filters))
  ipcMain.handle('export:excel', async (_event, dataset: Dataset, definition: ReportDefinition, branding: Branding) => { const filePath = await pickExportPath('Export Excel workbook', definition.title.replace(/[<>:"/\\|?*]/g, '-'), 'xlsx'); if (!filePath) return null; await writeExcel(filePath, dataset, definition, branding); return filePath })
  ipcMain.handle('export:pdf', async (_event, definition: ReportDefinition, branding: Branding) => {
    const filePath = await pickExportPath('Export print-ready PDF', definition.title.replace(/[<>:"/\\|?*]/g, '-'), 'pdf'); if (!filePath) return null
    const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try { await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(generateReportHtml(definition, branding))}`); const pdf = await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }); await writeFile(filePath, pdf); return filePath }
    finally { window.destroy() }
  })
  ipcMain.handle('export:slides', async (_event, definition: ReportDefinition, branding: Branding) => { const filePath = await pickExportPath('Export presentation', definition.title.replace(/[<>:"/\\|?*]/g, '-'), 'pptx'); if (!filePath) return null; await writeSlides(filePath, definition, branding); return filePath })
  ipcMain.handle('settings:get', () => getSettings()); ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(settings))
  ipcMain.handle('templates:list', () => listTemplates()); ipcMain.handle('templates:save', (_event, name: string, definition: ReportDefinition) => saveTemplate(name, definition)); ipcMain.handle('templates:delete', (_event, id: string) => deleteTemplate(id))
  ipcMain.handle('ai:columnMapping', async (_event, dataset: Dataset) => { const settings = await getSettings(); if (!settings.apiKey.trim()) throw new Error('Save a Mistral API key in Settings before using optional AI column mapping.'); return aiColumnMapping(dataset, settings.apiKey) })
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 920, minWidth: 900, minHeight: 650, title: 'Easy Report', webPreferences: { preload: path.join(here, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(path.join(here, '../renderer/index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
}
app.whenReady().then(() => { registerHandlers(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
