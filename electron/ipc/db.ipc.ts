import { ipcMain } from 'electron'
import { initDB, queryAll, execute } from '../db/database'

let dbReady: Promise<void> | null = null

export function registerDBHandlers() {
  // Initialize the database eagerly
  dbReady = initDB().catch(err => {
    console.error('[DB Init Error]', err)
  })

  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    try {
      await dbReady
      const rows = queryAll(sql, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('[DB Query Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('db:run', async (_, sql: string, params: unknown[] = []) => {
    try {
      await dbReady
      execute(sql, params)
      return { success: true, data: { changes: 1, lastInsertRowid: 0 } }
    } catch (error) {
      console.error('[DB Run Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
