import { app, BrowserWindow, shell, session, ipcMain } from 'electron'
import { join } from 'path'
import { registerDBHandlers } from './ipc/db.ipc'
import { registerImageHandlers, registerImageProtocolScheme, handleImageProtocol } from './ipc/image.ipc'
import { registerAIHandlers } from './ipc/ai.ipc'
import { registerFileHandlers } from './ipc/file.ipc'
import { registerConfigHandlers } from './ipc/config.ipc'
import { registerPrintHandlers } from './ipc/print.ipc'
import { flushDB } from './db/database'

// Register custom protocol BEFORE app is ready (Electron requirement)
registerImageProtocolScheme()

// Force Chromium to use classic (non-overlay) scrollbars so that
// CSS ::-webkit-scrollbar pseudo-elements are respected on Windows.
// Without this, Electron 31+ on Windows ignores scrollbar width/styling.
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0D0D0D', // Instant black background
    show: false, // Don't show until ready
    title: 'ECEngine',
    autoHideMenuBar: true,
    frame: false,
    icon: join(__dirname, '../../resources/ecengine_icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' ece-app: data:; connect-src 'self' https://api.groq.com https://openrouter.ai;"
        ]
      }
    })
  })

  // Show window smoothly once React/Vite has loaded the UI initially
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  // Disable built-in pinch/ctrl+wheel zoom so PrintView can handle it
  win.webContents.setVisualZoomLevelLimits(1, 1)

  // Disable unnecessary permissions for privacy/security
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const blocked = ['geolocation', 'notifications', 'midiSysex', 'media'];
    if (blocked.includes(permission)) {
      return callback(false); // Deny silently
    }
    callback(true); // Allow others like 'fullscreen'
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Inject scrollbar styles after every page load.
  // webContents.insertCSS() has the highest priority and cannot be
  // overridden by any renderer-side CSS, solving the Electron/Chromium
  // overlay-scrollbar issue where ::-webkit-scrollbar CSS is ignored.
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      ::-webkit-scrollbar { width: 4px !important; height: 4px !important; }
      ::-webkit-scrollbar-track { background: #0D0D0D !important; border-radius: 4px !important; }
      ::-webkit-scrollbar-thumb { background: #00FF41 !important; border-radius: 4px !important; }
      ::-webkit-scrollbar-thumb:hover { background: #00CC33 !important; }
      ::-webkit-scrollbar-corner { background: #0D0D0D !important; }
    `)
  })
}

app.whenReady().then(() => {
  registerDBHandlers()
  registerImageHandlers()
  registerAIHandlers()
  registerFileHandlers()
  registerConfigHandlers()
  registerPrintHandlers()
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
app.on('will-quit', flushDB)
