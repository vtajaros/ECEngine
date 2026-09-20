import { initDB } from '../db/database'
import { registerDeckHandlers }     from './deck.ipc'
import { registerProgressHandlers } from './progress.ipc'
import { registerStatsHandlers }    from './stats.ipc'
import { registerAnalyticsHandlers }from './analytics.ipc'
import { registerExportHandlers }   from './export.ipc'

export function registerDBHandlers(): void {
  // Initialize the database eagerly
  initDB()

  registerDeckHandlers()
  registerProgressHandlers()
  registerStatsHandlers()
  registerAnalyticsHandlers()
  registerExportHandlers()
}
