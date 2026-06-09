import { ipcMain, dialog, BrowserWindow } from 'electron'
import fsp from 'fs/promises'

export function registerFileHandlers() {
  ipcMain.handle('file:export', async (event, dataStr: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Decks',
      defaultPath: `ecengine-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    try {
      await fsp.writeFile(filePath, dataStr, 'utf8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('file:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Decks',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const dataStr = await fsp.readFile(filePaths[0], 'utf8')
      return { success: true, data: dataStr }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
