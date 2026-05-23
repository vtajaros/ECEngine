import Dexie, { Table } from 'dexie'

export interface WebTopic {
  id: string
  name: string
  subject: string
  description: string
  folder_name: string
  tags: string
  created_at: string
  order_index?: number
}

export interface WebCard {
  id: string
  topic_id: string
  type: string
  data: string        // JSON string, same as desktop
  difficulty: string
  tags: string        // JSON string
  is_custom: number
  created_at: string
}

export interface WebProgress {
  card_id: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  last_reviewed: string
  correct_count: number
  total_count: number
}

export interface WebStudyActivity {
  id?: number
  day: string         // YYYY-MM-DD
  count: number
  correct_count: number
  total_count: number
  time_spent: number
}

export interface WebMeta {
  key: string
  value: string
}

export class ECEngineWebDB extends Dexie {
  topics!: Table<WebTopic>
  cards!: Table<WebCard>
  progress!: Table<WebProgress>
  study_activity!: Table<WebStudyActivity>
  meta!: Table<WebMeta>

  constructor() {
    super('ECEngineWeb')
    this.version(1).stores({
      topics:         'id, name, subject',
      cards:          'id, topic_id',
      progress:       'card_id',
      study_activity: '++id, day',
      meta:           'key',
    })
  }
}

export const webDB = new ECEngineWebDB()
