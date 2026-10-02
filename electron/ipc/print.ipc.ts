import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { join } from 'path'
import fsp from 'fs/promises'

let printWindow: BrowserWindow | null = null

export function registerPrintHandlers(getMainWindow: () => Electron.BrowserWindow | null): void {
  ipcMain.handle('print:open', async (_event, topicId: string, title: string) => {
    try {
      // Focus existing window instead of opening a duplicate
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.focus()
        return { success: true }
      }

      const encodedTitle = encodeURIComponent(title)

      // Resolve icon — works both in dev (project root) and packaged (resources/)
      const iconPath = app.isPackaged
        ? join(process.resourcesPath, 'ecengine_icon.ico')
        : join(__dirname, '../../resources/ecengine_icon.ico')

      const parent = getMainWindow() ?? undefined

      printWindow = new BrowserWindow({
        width: 900,
        height: 800,
        frame: false,
        transparent: true,
        title: `Test Paper View — ${title}`,
        autoHideMenuBar: true,
        icon: iconPath,
        // Attach as a child of the main window so Linux window managers
        // (KDE/KWin + Polonium) treat it as a transient/companion window
        // rather than an independent top-level window.
        ...(parent ? { parent, modal: false } : {}),
        show: false,
        webPreferences: {
          partition: 'print',
          zoomFactor: 1.0,
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      })

      printWindow.webContents.setVisualZoomLevelLimits(1, 1)

      printWindow.on('maximize', () => {
        printWindow?.webContents.send('window:maximized', true)
      })

      printWindow.on('unmaximize', () => {
        printWindow?.webContents.send('window:maximized', false)
      })

      printWindow.on('closed', () => {
        printWindow = null
      })

      let hasShown = false
      const showWindowSmoothly = () => {
        if (hasShown || !printWindow || printWindow.isDestroyed()) return
        hasShown = true
        printWindow.webContents.setZoomFactor(1)
        printWindow.show()
      }

      printWindow.once('ready-to-show', showWindowSmoothly)

      // Override title AFTER did-finish-load — Chromium applies <title>ECEngine</title>
      // from the HTML after navigation, which overwrites the BrowserWindow constructor title.
      // Hooking did-finish-load guarantees our title wins every time.
      printWindow.webContents.on('did-finish-load', () => {
        printWindow?.setTitle(`Test Paper View — ${title}`)
        // Fallback in case ready-to-show was already triggered or delayed by window manager
        setTimeout(showWindowSmoothly, 100)
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

interface PDFExportOptions {
  showAnswers?: boolean
  showSolutions?: boolean
  boldSide?: string
}

ipcMain.handle('print:toPDF', async (_event, suggestedName: string, themeVars: Record<string, string>, topicId: string, title: string, theme: string, layout: string, options?: PDFExportOptions) => {
    let pdfWindow: BrowserWindow | null = null
    try {
      if (!printWindow || printWindow.isDestroyed()) {
        return { success: false, error: 'Print window not open' }
      }

      const { canceled, filePath } = await dialog.showSaveDialog(printWindow, {
        title: 'Save Test Paper as PDF',
        defaultPath: join(app.getPath('documents'), `${suggestedName}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) return { success: false, canceled: true }

      const encodedTitle = encodeURIComponent(title)
      const queryParams = [
        `topicId=${encodeURIComponent(topicId)}`,
        `title=${encodedTitle}`,
        `theme=${encodeURIComponent(theme)}`,
        `layout=${encodeURIComponent(layout)}`,
        `pdfmode=1`,
        `showAnswers=${options?.showAnswers !== false}`,
        `showSolutions=${options?.showSolutions !== false}`,
        `boldSide=${encodeURIComponent(options?.boldSide ?? 'term')}`,
      ].join('&')

      // A4 at 96dpi = 794×1122px. Window matches layout width; pageSize 'A4' is passed
      // as a string so Chromium uses its validated internal A4 definition (no micron rounding).
      pdfWindow = new BrowserWindow({
        width: 794,
        height: 1122,
        show: false,
        webPreferences: {
          partition: 'print',
          preload: join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: false,
          zoomFactor: 1.0,
        },
      })

      if (process.env['ELECTRON_RENDERER_URL']) {
        await pdfWindow.loadURL(
          `${process.env['ELECTRON_RENDERER_URL']}#/print?${queryParams}`
        )
      } else {
        await pdfWindow.loadFile(join(__dirname, '../renderer/index.html'), {
          hash: `/print?${queryParams}`,
        })
      }

      await pdfWindow.webContents.executeJavaScript(`
        window.__pdfConfig = {
          pdfmode: '1',
          theme: ${JSON.stringify(theme)},
          layout: ${JSON.stringify(layout)},
          showAnswers: ${JSON.stringify(options?.showAnswers !== false)},
          showSolutions: ${JSON.stringify(options?.showSolutions !== false)},
          boldSide: ${JSON.stringify(options?.boldSide ?? 'term')},
        };
        window.dispatchEvent(new Event('pdf-config-ready'));
      `)
      // Wait for PrintView to signal render completion via 'pdf-ready' event.
      // Falls back to 10s timeout on slow machines or render failure.
      await pdfWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (window.__pdfReady) return resolve(true)
          window.addEventListener('pdf-ready', () => resolve(true), { once: true })
          setTimeout(() => resolve(false), 10000)
        })
      `)

      const buffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'none' },
        landscape: false,
        preferCSSPageSize: true,
      })

      await fsp.writeFile(filePath, buffer)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    } finally {
      if (pdfWindow && !pdfWindow.isDestroyed()) pdfWindow.destroy()
    }
  })
}
