import { app, BrowserWindow, shell, session, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { registerDBHandlers } from './ipc/db.ipc'
import { registerImageHandlers, registerImageProtocolScheme, handleImageProtocol } from './ipc/image.ipc'
import { registerAIHandlers } from './ipc/ai.ipc'
import { registerFileHandlers } from './ipc/file.ipc'
import { registerConfigHandlers, resolveZoomIndex, persistZoomIndex, ZOOM_STEPS } from './ipc/config.ipc'
import { registerPrintHandlers } from './ipc/print.ipc'
import { registerTTSHandlers, killAllTTSChildren } from './ipc/tts.ipc'
import { flushDB } from './db/database'

// Exported so sibling IPC modules can reference the main window (e.g. as a parent).
export let mainWindow: BrowserWindow | null = null

// Register custom protocol BEFORE app is ready (Electron requirement)
registerImageProtocolScheme()

// Force Chromium to use classic (non-overlay) scrollbars so that
// CSS ::-webkit-scrollbar pseudo-elements are respected on Windows.
// Without this, Electron 31+ on Windows ignores scrollbar width/styling.
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar')

function createWindow() {
  if (!app.isPackaged && process.platform === 'win32') {
    // Prevent cache lock ("Access is denied", 0x5) on Windows during dev hot-reloads.
    // Windows-only: this works around zombie Electron processes from electron-vite
    // hot-reload holding file locks on the Chromium disk/GPU cache. Not needed on
    // Linux/macOS dev machines — do not remove the platform check.
    app.commandLine.appendSwitch('disable-disk-cache')
    app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  }

  const iconExt = process.platform === 'win32' ? 'ico' : 'png'
  const iconPath = join(__dirname, `../../resources/ecengine_icon.${iconExt}`)
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0D0D0D', // Instant black background
    show: false, // Don't show until ready
    title: 'ECEngine',
    autoHideMenuBar: true,
    frame: false,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: ece-app:; connect-src 'self' https://api.groq.com;"
        ]
      }
    })
  })

  // Show window smoothly once React/Vite has loaded the UI initially
  mainWindow.once('ready-to-show', () => {
    mainWindow!.maximize()
    mainWindow!.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Disable built-in pinch/ctrl+wheel zoom so PrintView can handle it
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1)

  // Apply persisted zoom on startup
  let currentZoomIndex = resolveZoomIndex()
  mainWindow.webContents.setZoomFactor(ZOOM_STEPS[currentZoomIndex])

  // Shared by keyboard shortcuts and ctrl+wheel — single source of truth
  // for stepping through ZOOM_STEPS, persisting, and broadcasting.
  const applyZoomIndex = (nextIndex: number) => {
    currentZoomIndex = Math.min(Math.max(nextIndex, 0), ZOOM_STEPS.length - 1)
    const factor = ZOOM_STEPS[currentZoomIndex]
    mainWindow!.webContents.setZoomFactor(factor)
    persistZoomIndex(currentZoomIndex)
    mainWindow!.webContents.send('zoom:changed', Math.round(factor * 100))
  }

  // Ctrl+=, Ctrl+-, Ctrl+0 discrete zoom steps (mainWindow only)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrlOrCmd = input.control || input.meta
    if (!ctrlOrCmd) return

    if (input.key === '=' || input.key === '+') {
      applyZoomIndex(currentZoomIndex + 1)
    } else if (input.key === '-') {
      applyZoomIndex(currentZoomIndex - 1)
    } else if (input.key === '0') {
      applyZoomIndex(2) // DEFAULT_ZOOM_INDEX
    } else {
      return // not a zoom key — don't preventDefault
    }
    event.preventDefault()
  })

  // Ctrl+wheel zoom (mainWindow only) — renderer sends direction after
  // its own throttling; this handler just steps the shared index.
  ipcMain.on('zoom:step', (_event, direction: 1 | -1) => {
    applyZoomIndex(currentZoomIndex + direction)
  })

  // Disable unnecessary permissions for privacy/security
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const blocked = ['geolocation', 'notifications', 'midiSysex', 'media'];
    if (blocked.includes(permission)) {
      return callback(false); // Deny silently
    }
    callback(true); // Allow others like 'fullscreen'
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Inject scrollbar styles after every page load.
  // webContents.insertCSS() has the highest priority and cannot be
  // overridden by any renderer-side CSS, solving the Electron/Chromium
  // overlay-scrollbar issue where ::-webkit-scrollbar CSS is ignored.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow!.webContents.insertCSS(`
      ::-webkit-scrollbar { width: 4px !important; height: 4px !important; }
      ::-webkit-scrollbar-track { background: #0D0D0D !important; border-radius: 4px !important; }
      ::-webkit-scrollbar-thumb { background: #00FF41 !important; border-radius: 4px !important; }
      ::-webkit-scrollbar-thumb:hover { background: #00CC33 !important; }
      ::-webkit-scrollbar-corner { background: #0D0D0D !important; }
    `)
  })
}

app.setName('ECEngine')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.ecengine.app')
}

app.whenReady().then(() => {
  registerDBHandlers()
  registerImageHandlers()
  registerAIHandlers()
  registerFileHandlers()
  registerConfigHandlers()
  registerPrintHandlers(() => mainWindow)
  registerTTSHandlers()
  handleImageProtocol()

  // Window Control Handlers
  ipcMain.on('window-minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })
  ipcMain.on('window-close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { killAllTTSChildren() })
app.on('will-quit', flushDB)
