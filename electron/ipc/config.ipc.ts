import { ipcMain, app, shell } from 'electron'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

let cachedGroqApiKey: string | undefined | null = null // null = not yet loaded

export interface AppConfig {
  groqApiKey?: string
  examDate?: string
  preboardDate?: string | null
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return {}
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return {}
  }
}

function writeConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

/**
 * Returns the resolved Groq API key for main-process use only.
 * Priority: userData/config.json → process.env.GROQ_API_KEY
 */
export function resolveGroqApiKey(): string | undefined {
  if (cachedGroqApiKey !== null) return cachedGroqApiKey
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
      await fsp.writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
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
      preboardDate: config.preboardDate
    }
  })

  /**
   * 'config:updateSettings' - updates general settings.
   */
  ipcMain.handle('config:updateSettings', async (_event, settings: Partial<AppConfig>) => {
    try {
      const config = readConfig()
      // Merge updates
      if (settings.examDate !== undefined) config.examDate = settings.examDate
      if (settings.preboardDate !== undefined) config.preboardDate = settings.preboardDate
      
      await fsp.writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
      return { success: true }
    } catch (err) {
      console.error('[config:updateSettings] Error:', err)
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
