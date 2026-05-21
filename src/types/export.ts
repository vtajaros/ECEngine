import { WebCard, WebTopic, WebProgress, WebStudyActivity } from '../services/web/schema'

export interface ExportPayload {
  schema_version: number
  exported_at: string
  decks: WebTopic[]
  cards: WebCard[]
  progress?: WebProgress[]
  study_activity?: WebStudyActivity[]
}

declare global {
  type WebCard = import('../services/web/schema').WebCard
  type WebTopic = import('../services/web/schema').WebTopic
  type WebProgress = import('../services/web/schema').WebProgress
  type WebStudyActivity = import('../services/web/schema').WebStudyActivity
  type ExportPayload = import('./export').ExportPayload
}
