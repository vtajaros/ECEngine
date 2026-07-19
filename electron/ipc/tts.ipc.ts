import { ipcMain, BrowserWindow, dialog } from 'electron'
import { spawn, execFileSync, ChildProcess } from 'child_process'
import * as fs from 'fs'

let currentPiperChild: ChildProcess | null = null
let currentAplayChild: ChildProcess | null = null
let piperAvailable: boolean | null = null // null = not yet checked

/**
 * One-shot check: is `piper` on PATH?
 * Uses execFileSync('which', ['piper']) — no shell, safe.
 * Result is cached for the process lifetime.
 */
function checkPiperAvailable(): boolean {
  if (piperAvailable !== null) return piperAvailable
  try {
    execFileSync('which', ['piper'], { stdio: 'ignore' })
    piperAvailable = true
  } catch {
    piperAvailable = false
  }
  return piperAvailable
}

/**
 * Check that both the .onnx model and its .onnx.json sidecar exist on disk.
 * Piper requires both files at startup.
 */
function checkVoiceModelConfigured(modelPath: string): boolean {
  if (!modelPath) return false
  return fs.existsSync(modelPath) && fs.existsSync(modelPath + '.json')
}

/**
 * Kill both tracked child processes.
 * Piper is killed first (SIGTERM); closing piper's stdout signals EOF to aplay,
 * which should let aplay drain and exit naturally. aplay is also killed explicitly
 * in case it is still blocked on a write.
 */
function killAllChildren(): void {
  if (currentPiperChild) {
    try { currentPiperChild.kill('SIGTERM') } catch { /* already dead */ }
    currentPiperChild = null
  }
  if (currentAplayChild) {
    try { currentAplayChild.kill('SIGTERM') } catch { /* already dead */ }
    currentAplayChild = null
  }
}

/**
 * Exported so electron/main.ts can call this on 'before-quit'
 * without reaching into module-private state.
 */
export function killAllTTSChildren(): void {
  killAllChildren()
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
   * 'tts:isAvailable' — returns a status object distinguishing two failure modes:
   *   { piperInstalled: boolean, modelConfigured: boolean }
   * Breaking change from the old boolean return — Settings.tsx is updated to match.
   * modelConfigured is only meaningful when piperInstalled is true.
   */
  ipcMain.handle('tts:isAvailable', async (_event, modelPath?: string) => {
    const piperInstalled = checkPiperAvailable()
    const modelConfigured = piperInstalled && typeof modelPath === 'string'
      ? checkVoiceModelConfigured(modelPath)
      : false
    return { piperInstalled, modelConfigured }
  })

  /**
   * 'tts:speak' — spawn a piper→aplay pipeline.
   * @param text      The text to synthesize.
   * @param modelPath Absolute path to the .onnx voice model. Renderer reads this
   *                  from localStorage and passes it here — main process does not
   *                  read localStorage itself.
   *
   * Pipeline:
   *   piper (stdin=text, stdout=raw audio) → aplay (stdin=raw audio)
   *
   * sendEnded() fires on aplayChild 'exit', NOT on piper's exit.
   * This is the critical correctness point: piper finishes encoding before aplay
   * finishes playing, so we must wait for the player to complete.
   */
  ipcMain.handle('tts:speak', async (_event, text: string, modelPath: string) => {
    killAllChildren()

    if (typeof text !== 'string' || !text.trim()) {
      sendEnded()
      return
    }

    if (!modelPath || !checkVoiceModelConfigured(modelPath)) {
      // No valid model — short-circuit immediately rather than spawning a doomed process
      sendEnded()
      return
    }

    try {
      const piperChild = spawn(
        'piper',
        ['--model', modelPath, '--output_file', '-'],
        { stdio: ['pipe', 'pipe', 'ignore'] }
      )
      currentPiperChild = piperChild

      const aplayChild = spawn(
        'aplay',
        ['-'],
        { stdio: ['pipe', 'ignore', 'ignore'] }
      )
      currentAplayChild = aplayChild

      // Pipe piper's WAV output into aplay's stdin
      piperChild.stdout!.pipe(aplayChild.stdin!)

      // Write text to piper and close its stdin to signal end of input
      piperChild.stdin!.on('error', () => { /* ignore — process likely already dying, cleanup
        handled by the child's own exit/error handlers */ })
      piperChild.stdin!.write(text)
      piperChild.stdin!.end()

      // sendEnded fires when APLAY finishes (audio fully played), not when piper exits
      aplayChild.on('exit', () => {
        const wasCurrent = currentAplayChild === aplayChild
        if (wasCurrent) currentAplayChild = null
        if (currentPiperChild === piperChild) currentPiperChild = null
        if (wasCurrent) sendEnded()
      })

      aplayChild.on('error', () => {
        const wasCurrent = currentAplayChild === aplayChild
        if (wasCurrent) currentAplayChild = null
        if (currentPiperChild === piperChild) currentPiperChild = null
        if (wasCurrent) sendEnded()
      })

      piperChild.on('error', () => {
        const wasCurrent = currentPiperChild === piperChild
        // ENOENT if piper disappears mid-flight
        if (wasCurrent) currentPiperChild = null
        // Also clean up aplay if piper failed to start
        if (currentAplayChild === aplayChild) {
          try { aplayChild.kill('SIGTERM') } catch { /* ignore */ }
          currentAplayChild = null
        }
        if (wasCurrent) sendEnded()
      })
    } catch {
      // spawn itself threw synchronously (shouldn't happen, but guard)
      currentPiperChild = null
      currentAplayChild = null
      sendEnded()
    }
  })

  /**
   * 'tts:stop' — kill any running piper/aplay child processes.
   */
  ipcMain.handle('tts:stop', async () => {
    killAllChildren()
  })

  /**
   * 'tts:selectVoiceModel' — opens file selection dialog to select a Piper Voice Model (.onnx)
   */
  ipcMain.handle('tts:selectVoiceModel', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Piper Voice Model',
      properties: ['openFile'],
      filters: [{ name: 'Piper Voice Model', extensions: ['onnx'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    return { success: true, filePath: filePaths[0] }
  })
}
