import { ipcMain } from 'electron'
import { query, run } from '../db/database'

export function registerDBHandlers() {
  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    try {
      const rows = query(sql, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('[DB Query Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('db:run', async (_, sql: string, params: unknown[] = []) => {
    try {
      const result = run(sql, params)
      return { success: true, data: result }
    } catch (error) {
      console.error('[DB Run Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
