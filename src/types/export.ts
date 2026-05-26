export interface ExportPayload {
  schema_version: number
  exported_at: string
  decks: any[]
  cards: any[]
  progress?: any[]
  study_activity?: any[]
}

declare global {
  type ExportPayload = import('./export').ExportPayload
}
