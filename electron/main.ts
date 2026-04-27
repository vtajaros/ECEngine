import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { registerDBHandlers } from './ipc/db.ipc'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0D0D0D', // Instant black background
    show: false, // Don't show until ready
    title: 'ECEngine',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show window smoothly once React/Vite has loaded the UI initially
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
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

    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerDBHandlers()
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
