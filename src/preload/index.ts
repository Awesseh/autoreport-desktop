import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppSettings, Dataset, ReportDefinition, ReportFilters } from '../shared/types'
import type { CleaningOptions, EasyReportApi } from '../shared/app-types'
const api: EasyReportApi = {
  openFile: () => ipcRenderer.invoke('dialog:openFile'), ingest: (path) => ipcRenderer.invoke('ingest:file', path), ingestDroppedFile: (file) => ipcRenderer.invoke('ingest:file', webUtils.getPathForFile(file)), analyze: (dataset: Dataset) => ipcRenderer.invoke('analytics:describe', dataset), clean: (dataset: Dataset, options?: CleaningOptions) => ipcRenderer.invoke('clean:run', dataset, options),
  suggest: (dataset) => ipcRenderer.invoke('reports:suggest', dataset), build: (dataset, id, branding, filters?: ReportFilters, template?: ReportDefinition) => ipcRenderer.invoke('reports:build', dataset, id, branding, filters, template),
  exportExcel: (dataset, definition, branding) => ipcRenderer.invoke('export:excel', dataset, definition, branding), exportPdf: (definition, branding) => ipcRenderer.invoke('export:pdf', definition, branding), exportSlides: (definition, branding) => ipcRenderer.invoke('export:slides', definition, branding),
  getSettings: () => ipcRenderer.invoke('settings:get'), saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings), listTemplates: () => ipcRenderer.invoke('templates:list'), saveTemplate: (name, definition) => ipcRenderer.invoke('templates:save', name, definition), deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id), aiColumnMapping: (dataset) => ipcRenderer.invoke('ai:columnMapping', dataset)
}
contextBridge.exposeInMainWorld('easyReport', api)
