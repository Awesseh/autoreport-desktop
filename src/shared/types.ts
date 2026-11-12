export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'unknown'
export interface Column { name: string; type: ColumnType }
export interface Dataset { id: string; name: string; sourceFile: string; columns: Column[]; rows: Record<string, unknown>[] }
export interface IngestResult { dataset: Dataset; warnings: string[] }
export type ChangeStatus = 'pending' | 'accepted' | 'rejected'
export interface ChangeLogEntry { id: string; stage: string; description: string; affectedRows: number; affectedColumns: string[]; status: ChangeStatus }
export interface CleaningResult { dataset: Dataset; changes: ChangeLogEntry[] }
export interface KpiSpec { label: string; value: string; delta?: number }
export interface ChartSpec { id: string; title: string; type: 'bar' | 'line' | 'pie'; labels: string[]; series: { name: string; values: number[] }[] }
export interface PivotSpec { id: string; title: string; rowLabels: string[]; columnLabels: string[]; values: number[][]; rowTotals: number[]; columnTotals: number[]; grandTotal: number; valueLabel: string }
export interface NarrativeSpec { paragraphs: string[] }
export type SectionSpec = { kind: 'kpi'; kpis: KpiSpec[] } | { kind: 'chart'; chart: ChartSpec } | { kind: 'pivot'; pivot: PivotSpec } | { kind: 'narrative'; narrative: NarrativeSpec }
export type Aggregation = 'sum' | 'average' | 'count' | 'min' | 'max'
export interface PivotConfig { rowField: string; columnField: string | null; valueField: string; aggregation: Aggregation }
export interface ReportFilters { dateColumn?: string; from?: string; to?: string; categoryColumn?: string; categoryValue?: string }
export interface ReportDefinition { id: string; title: string; suggestionId: string; datasetName: string; sections: SectionSpec[]; filters?: ReportFilters }
export interface ReportSuggestion { id: string; title: string; description: string; highlights: string[] }
export interface SavedTemplate { id: string; name: string; createdAt: string; definition: ReportDefinition }
export interface Branding { orgName: string; accentColor: string }
export interface AppSettings { apiKey: string; branding: Branding }
export interface ColumnMapping { from: string; to: string; confidence: number; reason: string }
export type AppStep = 'upload' | 'preview' | 'cleaning' | 'suggestions' | 'report'

