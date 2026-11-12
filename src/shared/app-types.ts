import type { AppSettings, Branding, CleaningResult, Dataset, IngestResult, ReportDefinition, ReportFilters, ReportSuggestion, SavedTemplate } from './types'
export interface CleaningOptions { fuzzyDedup?: boolean; missingValuePolicy?: 'flag' | 'impute' | 'drop'; flagOutliers?: boolean }
export interface DatasetProfile { rowCount: number; numericColumns: string[]; dateColumns: string[]; categoricalColumns: string[]; completeness: Record<string, number>; hasDateColumn: boolean }
export interface EasyReportApi {
  openFile(): Promise<string | null>; ingest(path: string): Promise<IngestResult>; ingestDroppedFile(file: File): Promise<IngestResult>; clean(dataset: Dataset, options?: CleaningOptions): Promise<CleaningResult>
  suggest(dataset: Dataset): Promise<ReportSuggestion[]>; build(dataset: Dataset, suggestionId: string, branding: Branding, filters?: ReportFilters, template?: ReportDefinition): Promise<ReportDefinition>
  exportExcel(dataset: Dataset, definition: ReportDefinition, branding: Branding): Promise<string | null>; exportPdf(definition: ReportDefinition, branding: Branding): Promise<string | null>; exportSlides(definition: ReportDefinition, branding: Branding): Promise<string | null>
  getSettings(): Promise<AppSettings>; saveSettings(settings: AppSettings): Promise<void>; listTemplates(): Promise<SavedTemplate[]>; saveTemplate(name: string, definition: ReportDefinition): Promise<SavedTemplate[]>; deleteTemplate(id: string): Promise<SavedTemplate[]>; aiColumnMapping(dataset: Dataset): Promise<CleaningResult>
}
