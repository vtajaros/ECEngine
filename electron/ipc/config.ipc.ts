import { ipcMain, app, shell, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { setDBPathResolver, getActiveDatabasePath } from '../db/database'

let cachedGroqApiKey: string | undefined | null = null // null = not yet loaded

export interface AppConfig {
  groqApiKey?: string
  examDate?: string
  preboardDate?: string | null
  imagesPath?: string
  dbPath?: string
  zoomIndex?: number   // index into ZOOM_STEPS, persisted
  katexScale?: number
  katexBold?: boolean
  sidebarCollapsed?: boolean
  showFormulaBank?: boolean
}

export const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3] as const
export const DEFAULT_ZOOM_INDEX = 2 // 1.0 / 100%

export function resolveZoomIndex(): number {
  const config = readConfig()
  const idx = config.zoomIndex
  if (typeof idx === 'number' && idx >= 0 && idx < ZOOM_STEPS.length) return idx
  return DEFAULT_ZOOM_INDEX
}

let zoomWriteTimer: NodeJS.Timeout | null = null
export function persistZoomIndex(index: number): void {
  const config = readConfig()
  config.zoomIndex = index
  cachedConfig = { ...config }
  if (zoomWriteTimer) clearTimeout(zoomWriteTimer)
  zoomWriteTimer = setTimeout(async () => {
    try {
      await writeConfig(config)
    } catch (err) {
      console.error('[persistZoomIndex] Error:', err)
    }
  }, 400)
}

export function flushPendingConfigWrites(): void {
  if (zoomWriteTimer) {
    clearTimeout(zoomWriteTimer)
    zoomWriteTimer = null
    const config = readConfig()
    try {
      const configPath = getConfigPath()
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    } catch (err) {
      console.error('[flushPendingConfigWrites] Error:', err)
    }
  }
}

export function resolveImagesPath(): string {
  const config = readConfig()
  if (config.imagesPath && config.imagesPath.trim()) {
    return config.imagesPath.trim()
  }
  return process.env.ECE_IMAGES_PATH || path.join(app.getPath('userData'), 'ece-images')
}

export function resolveDBPath(): string {
  const config = readConfig()
  if (config.dbPath && config.dbPath.trim()) {
    return config.dbPath.trim()
  }
  return path.join(app.getPath('userData'), 'ecengine.sqlite')
}

/**
 * Called once at startup from main.ts to wire the lazy resolver so
 * database.ts can look up the user-configured DB path without a circular dep.
 */
export function initDBPathResolver(): void {
  setDBPathResolver(resolveDBPath)
}

let cachedConfig: AppConfig | null = null

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  if (cachedConfig !== null) return cachedConfig
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    cachedConfig = {}
    return cachedConfig
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    cachedConfig = (JSON.parse(raw) as AppConfig) || {}
  } catch {
    cachedConfig = {}
  }
  return cachedConfig
}

let writeQueue: Promise<void> = Promise.resolve()

function writeConfig(config: AppConfig): Promise<void> {
  cachedConfig = { ...config }
  if (config.groqApiKey !== undefined) {
    cachedGroqApiKey = config.groqApiKey ? config.groqApiKey.trim() : undefined
  }
  const configPath = getConfigPath()
  const tmpPath = `${configPath}.${Date.now()}.tmp`
  const currentWrite = writeQueue.then(async () => {
    await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8')
    await fsp.rename(tmpPath, configPath)
  })
  writeQueue = currentWrite.catch((err) => {
    console.error('[writeConfig] Error:', err)
  })
  return currentWrite
}

/**
 * Returns the resolved Groq API key for main-process use only.
 * Priority: userData/config.json → process.env.GROQ_API_KEY
 */
export function resolveGroqApiKey(): string | undefined {
  if (cachedGroqApiKey !== null && cachedGroqApiKey !== undefined) return cachedGroqApiKey
  const config = readConfig()
  if (config.groqApiKey && config.groqApiKey.trim()) {
    cachedGroqApiKey = config.groqApiKey.trim()
    return cachedGroqApiKey
  }
  cachedGroqApiKey = process.env['GROQ_API_KEY'] || undefined
  return cachedGroqApiKey
}

export function registerConfigHandlers(): void {
  /**
   * 'config:setApiKey' — writes the key to userData/config.json.
   * The key is NEVER returned to the renderer; only a boolean success is sent back.
   */
  ipcMain.handle('config:setApiKey', async (_event, key: string) => {
    try {
      if (typeof key !== 'string') {
        return { success: false, error: 'Invalid key type' }
      }
      const trimmed = key.trim()
      const config = readConfig()
      config.groqApiKey = trimmed || undefined
      await writeConfig(config)
      cachedGroqApiKey = trimmed || undefined
      return { success: true }
    } catch (err) {
      console.error('[config:setApiKey] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'config:getApiKey' — returns ONLY whether a key is configured (boolean).
   * The actual key value is never sent to the renderer.
   */
  ipcMain.handle('config:getApiKey', async () => {
    const key = resolveGroqApiKey()
    return { configured: Boolean(key && key.length > 0) }
  })

  /**
   * 'config:getSettings' - returns general settings like exam dates.
   */
  ipcMain.handle('config:getSettings', async () => {
    const config = readConfig()
    return {
      examDate: config.examDate,
      preboardDate: config.preboardDate,
      katexScale: config.katexScale,
      katexBold: config.katexBold,
      sidebarCollapsed: config.sidebarCollapsed,
      showFormulaBank: config.showFormulaBank
    }
  })

  /**
   * 'config:updateSettings' - updates general settings.
   */
  ipcMain.handle('config:updateSettings', async (_event, settings: Partial<AppConfig>) => {
    try {
      const config = readConfig()
      // Safely merge settings
      Object.assign(config, settings)
      
      await writeConfig(config)
      return { success: true }
    } catch (err) {
      console.error('[config:updateSettings] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'config:getImagesPath' - returns the resolved images path.
   */
  ipcMain.handle('config:getImagesPath', async () => {
    return { imagesPath: resolveImagesPath() }
  })

  /**
   * 'config:selectImagesPath' - opens directory selection dialog and saves the selection.
   */
  ipcMain.handle('config:selectImagesPath', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Images Storage Directory',
      properties: ['openDirectory', 'createDirectory']
    })

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const selectedPath = filePaths[0]
      const config = readConfig()
      config.imagesPath = selectedPath
      await writeConfig(config)
      return { success: true, imagesPath: selectedPath }
    } catch (err) {
      console.error('[config:selectImagesPath] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'config:setImagesPath' - saves a manually provided images path.
   */
  ipcMain.handle('config:setImagesPath', async (_event, imagesPath: string) => {
    try {
      const config = readConfig()
      config.imagesPath = imagesPath.trim() || undefined
      await writeConfig(config)
      return { success: true, imagesPath: config.imagesPath }
    } catch (err) {
      console.error('[config:setImagesPath] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'config:getDBPath' - returns the resolved database file path.
   */
  ipcMain.handle('config:getDBPath', async () => {
    return { dbPath: getActiveDatabasePath() }
  })

  /**
   * 'config:selectDBPath' - opens a file-save dialog to pick a new DB location.
   * The new path is persisted to config.json but requires an app restart to take effect.
   */
  ipcMain.handle('config:selectDBPath', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Choose Database File Location',
      defaultPath: getActiveDatabasePath(),
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    try {
      const config = readConfig()
      config.dbPath = filePath
      await writeConfig(config)
      return { success: true, dbPath: filePath }
    } catch (err) {
      console.error('[config:selectDBPath] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'config:setDBPath' - saves a manually entered database path.
   * Requires an app restart to take effect.
   */
  ipcMain.handle('config:setDBPath', async (_event, dbPath: string) => {
    try {
      const config = readConfig()
      config.dbPath = dbPath.trim() || undefined
      await writeConfig(config)
      return { success: true, dbPath: config.dbPath }
    } catch (err) {
      console.error('[config:setDBPath] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  /**
   * 'shell:openExternal' — securely opens allowed URLs in the default browser.
   */
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      const allowedHosts = ['console.groq.com', 'groq.com']
      const parsed = new URL(url)
      if (!allowedHosts.includes(parsed.hostname)) return
      await shell.openExternal(url)
    } catch (err) {
      console.error('[shell:openExternal] Error:', err)
    }
  })
}
