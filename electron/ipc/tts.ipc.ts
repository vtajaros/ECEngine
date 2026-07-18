import { ipcMain, BrowserWindow } from 'electron'
import { spawn, execFileSync, ChildProcess } from 'child_process'

let currentChild: ChildProcess | null = null
let spdSayAvailable: boolean | null = null // null = not yet checked

/**
 * One-shot check: is `spd-say` on PATH?
 * Uses execFileSync('which', ['spd-say']) — no shell, safe.
 */
function checkSpdSayAvailable(): boolean {
  if (spdSayAvailable !== null) return spdSayAvailable
  try {
    execFileSync('which', ['spd-say'], { stdio: 'ignore' })
    spdSayAvailable = true
  } catch {
    spdSayAvailable = false
  }
  return spdSayAvailable
}

/**
 * Kill the currently-running spd-say child, if any.
 */
function killCurrentChild(): void {
  if (currentChild) {
    try { currentChild.kill() } catch { /* already dead */ }
    currentChild = null
  }
}

/**
 * Send 'tts:ended' to the renderer's focused window.
 * Falls back to the first available BrowserWindow if none is focused.
 */
function sendEnded(): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('tts:ended')
  }
}

export function registerTTSHandlers(): void {
  /**
   * 'tts:speak' — spawn `spd-say` with the given text.
   * Kills any in-flight child first. Sends 'tts:ended' when done.
   */
  ipcMain.handle('tts:speak', async (_event, text: string) => {
    killCurrentChild()

    if (typeof text !== 'string' || !text.trim()) {
      sendEnded()
      return
    }

    try {
      const child = spawn('spd-say', ['-t', 'male2', '-r', '-20', text], { stdio: 'ignore' })
      currentChild = child

      child.on('exit', () => {
        if (currentChild === child) currentChild = null
        sendEnded()
      })

      child.on('error', () => {
        // ENOENT (spd-say missing) or other spawn failure
        if (currentChild === child) currentChild = null
        sendEnded()
      })
    } catch {
      // spawn itself threw synchronously (shouldn't happen, but guard)
      currentChild = null
      sendEnded()
    }
  })

  /**
   * 'tts:stop' — kill any running spd-say child process.
   */
  ipcMain.handle('tts:stop', async () => {
    killCurrentChild()
  })

  /**
   * 'tts:isAvailable' — returns true if spd-say is on PATH.
   */
  ipcMain.handle('tts:isAvailable', async () => {
    return checkSpdSayAvailable()
  })
}
