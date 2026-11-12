import type { AppSettings, Branding, CleaningResult, Dataset, IngestResult, ReportDefinition, ReportFilters, ReportSuggestion, SavedTemplate } from './types'
export interface CleaningOptions { fuzzyDedup?: boolean; missingValuePolicy?: 'flag' | 'impute' | 'drop'; flagOutliers?: boolean }
export interface DatasetProfile { rowCount: number; numericColumns: string[]; dateColumns: string[]; categoricalColumns: string[]; completeness: Record<string, number>; hasDateColumn: boolean }
export interface NumericColumnSummary { column: string; count: number; missing: number; distinct: number; sum: number; mean: number | null; median: number | null; min: number | null; max: number | null; range: number | null; q1: number | null; q3: number | null; iqr: number | null; populationVariance: number | null; populationStdDev: number | null; sampleVariance: number | null; sampleStdDev: number | null; skewness: number | null; outlierCount: number }
export interface CategoryFrequency { value: string; count: number; percentage: number }
export interface CategoricalColumnSummary { column: string; count: number; missing: number; distinct: number; topValues: CategoryFrequency[] }
export interface DatasetAnalysis { rowCount: number; columnCount: number; completeness: Record<string, number>; numeric: NumericColumnSummary[]; categorical: CategoricalColumnSummary[] }
export interface EasyReportApi {
  openFile(): Promise<string | null>; ingest(path: string): Promise<IngestResult>; ingestDroppedFile(file: File): Promise<IngestResult>; analyze(dataset: Dataset): Promise<DatasetAnalysis>; clean(dataset: Dataset, options?: CleaningOptions): Promise<CleaningResult>
  suggest(dataset: Dataset): Promise<ReportSuggestion[]>; build(dataset: Dataset, suggestionId: string, branding: Branding, filters?: ReportFilters, template?: ReportDefinition): Promise<ReportDefinition>
  exportExcel(dataset: Dataset, definition: ReportDefinition, branding: Branding): Promise<string | null>; exportPdf(definition: ReportDefinition, branding: Branding): Promise<string | null>; exportSlides(definition: ReportDefinition, branding: Branding): Promise<string | null>
  getSettings(): Promise<AppSettings>; saveSettings(settings: AppSettings): Promise<void>; listTemplates(): Promise<SavedTemplate[]>; saveTemplate(name: string, definition: ReportDefinition): Promise<SavedTemplate[]>; deleteTemplate(id: string): Promise<SavedTemplate[]>; aiColumnMapping(dataset: Dataset): Promise<CleaningResult>
}
