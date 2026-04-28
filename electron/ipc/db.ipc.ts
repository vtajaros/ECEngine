import { ipcMain } from 'electron'
import { queryAll, execute } from '../db/database'

export function registerDBHandlers() {
  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    try {
      const rows = queryAll(sql, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('[DB Query Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('db:run', async (_, sql: string, params: unknown[] = []) => {
    try {
      execute(sql, params)
      return { success: true, data: { changes: 1, lastInsertRowid: 0 } }
    } catch (error) {
      console.error('[DB Run Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
