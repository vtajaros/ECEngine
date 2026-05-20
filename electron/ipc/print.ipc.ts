import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { join } from 'path'
import fs from 'fs'

let printWindow: BrowserWindow | null = null

export function registerPrintHandlers(): void {
  ipcMain.handle('print:open', async (_event, topicId: string, title: string) => {
    try {
      // Focus existing window instead of opening a duplicate
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.focus()
        return { success: true }
      }

      const encodedTitle = encodeURIComponent(title)

      printWindow = new BrowserWindow({
        width: 900,
        height: 800,
        frame: true,
        backgroundColor: '#FFFFFF',
        title: `Test Paper — ${title}`,
        autoHideMenuBar: true,
        icon: join(__dirname, '../../resources/ecengine_icon.ico'),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      })

      printWindow.on('closed', () => {
        printWindow = null
      })

      if (process.env['ELECTRON_RENDERER_URL']) {
        await printWindow.loadURL(
          `${process.env['ELECTRON_RENDERER_URL']}#/print?topicId=${topicId}&title=${encodedTitle}`
        )
      } else {
        await printWindow.loadFile(join(__dirname, '../renderer/index.html'), {
          hash: `/print?topicId=${topicId}&title=${encodedTitle}`,
        })
      }

      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('print:toPDF', async (_event, suggestedName: string) => {
    try {
      if (!printWindow || printWindow.isDestroyed()) {
        return { success: false, error: 'Print window is not open' }
      }

      await printWindow.webContents.insertCSS(`
        body { background: white !important; margin: 0 !important; }
        * { box-shadow: none !important; }
        ::-webkit-scrollbar { display: none !important; }
      `)

      const buffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'default' },
        landscape: false,
      })

      const { canceled, filePath } = await dialog.showSaveDialog(printWindow, {
        title: 'Save Test Paper as PDF',
        defaultPath: join(app.getPath('documents'), `${suggestedName}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      fs.writeFileSync(filePath, buffer)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })
}
