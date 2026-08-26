import { ipcMain, BrowserWindow, dialog } from 'electron'
import { spawn, execFileSync, ChildProcess } from 'child_process'
import { Transform } from 'stream'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

let currentPiperChild: ChildProcess | null = null
let currentAplayChild: ChildProcess | null = null
let piperAvailable: boolean | null = null // null = not yet checked
let currentTTSVolume = 1.0

function createVolumeTransform(getVol: () => number): Transform {
  let headerPassed = false
  let headerBytesRead = 0
  let leftover: Buffer | null = null

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const data = leftover ? Buffer.concat([leftover, chunk]) : chunk
      leftover = null

      let startOffset = 0
      if (!headerPassed) {
        if (headerBytesRead + data.length <= 44) {
          headerBytesRead += data.length
          callback(null, data)
          return
        } else {
          startOffset = 44 - headerBytesRead
          headerBytesRead += startOffset
          headerPassed = true
        }
      }

      const headerPart = data.subarray(0, startOffset)
      const audioPart = Buffer.from(data.subarray(startOffset))

      if (audioPart.length % 2 !== 0) {
        leftover = audioPart.subarray(audioPart.length - 1)
      }

      const processLength = leftover ? audioPart.length - 1 : audioPart.length
      const vol = getVol()
      for (let i = 0; i < processLength; i += 2) {
        const val = audioPart.readInt16LE(i)
        const scaled = Math.max(-32768, Math.min(32767, Math.round(val * vol)))
        audioPart.writeInt16LE(scaled, i)
      }

      if (leftover) {
        callback(null, Buffer.concat([headerPart, audioPart.subarray(0, processLength)]))
      } else {
        callback(null, Buffer.concat([headerPart, audioPart]))
      }
    },
    flush(callback) {
      if (leftover) {
        this.push(leftover)
        leftover = null
      }
      callback()
    }
  })
}

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
 * Scan standard Piper voice model directories on Linux.
 * Prioritizes ryan-medium as default if present.
 */
function findInstalledVoiceModels(): string[] {
  const searchDirs = [
    path.join(os.homedir(), '.local/share/piper-voices'),
    path.join(os.homedir(), '.local/share/piper'),
    '/usr/share/piper-voices',
    '/usr/local/share/piper-voices',
    path.join(os.homedir(), 'piper-voices'),
  ]

  const models: string[] = []
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          if (file.endsWith('.onnx')) {
            const fullPath = path.join(dir, file)
            if (checkVoiceModelConfigured(fullPath) && !models.includes(fullPath)) {
              models.push(fullPath)
            }
          }
        }
      } catch {}
    }
  }

  // Sort so preferred voices like Ryan medium come first if present
  models.sort((a, b) => {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()
    if (aLower.includes('ryan') && !bLower.includes('ryan')) return -1
    if (!aLower.includes('ryan') && bLower.includes('ryan')) return 1
    return a.localeCompare(b)
  })

  return models
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
   * 'tts:isAvailable' — returns a status object distinguishing failure modes and discovered voices:
   *   { piperInstalled: boolean, modelConfigured: boolean, defaultModelPath?: string, availableModels: string[] }
   */
  ipcMain.handle('tts:isAvailable', async (_event, modelPath?: string) => {
    const piperInstalled = checkPiperAvailable()
    const availableModels = piperInstalled ? findInstalledVoiceModels() : []
    const defaultModelPath = availableModels[0] || undefined
    const effectivePath = (modelPath && modelPath.trim()) || defaultModelPath
    const modelConfigured = piperInstalled && typeof effectivePath === 'string'
      ? checkVoiceModelConfigured(effectivePath)
      : false
    return { piperInstalled, modelConfigured, defaultModelPath, availableModels }
  })

  /**
   * 'tts:synthesize' — synthesize text to raw WAV buffer using Piper.
   * Enables Web Audio API playback in the renderer for instant, sample-accurate,
   * real-time gain/volume adjustments and seamless event lifecycle.
   */
  ipcMain.handle('tts:synthesize', async (_event, text: string, modelPath?: string) => {
    killAllChildren()

    if (typeof text !== 'string' || !text.trim()) {
      return { success: false, error: 'Empty text' }
    }

    let effectiveModelPath = modelPath && modelPath.trim()
    if (!effectiveModelPath || !checkVoiceModelConfigured(effectiveModelPath)) {
      const models = findInstalledVoiceModels()
      if (models.length > 0) {
        effectiveModelPath = models[0]
      }
    }

    if (!effectiveModelPath || !checkVoiceModelConfigured(effectiveModelPath)) {
      return { success: false, error: 'No valid voice model found' }
    }

    return new Promise((resolve) => {
      try {
        const piperChild = spawn(
          'piper',
          ['--model', effectiveModelPath, '--output_file', '-'],
          { stdio: ['pipe', 'pipe', 'ignore'] }
        )
        currentPiperChild = piperChild

        const chunks: Buffer[] = []
        piperChild.stdout!.on('data', (chunk) => {
          chunks.push(chunk)
        })

        piperChild.on('close', (code) => {
          if (currentPiperChild === piperChild) currentPiperChild = null
          if (code === 0 && chunks.length > 0) {
            const fullBuffer = Buffer.concat(chunks)
            resolve({ success: true, audioData: fullBuffer })
          } else {
            resolve({ success: false, error: `Piper exited with code ${code}` })
          }
        })

        piperChild.on('error', (err) => {
          if (currentPiperChild === piperChild) currentPiperChild = null
          resolve({ success: false, error: err.message })
        })

        piperChild.stdin!.on('error', () => { /* ignore */ })
        piperChild.stdin!.write(text)
        piperChild.stdin!.end()
      } catch (err: any) {
        currentPiperChild = null
        resolve({ success: false, error: err.message })
      }
    })
  })

  /**
   * 'tts:speak' — spawn a piper→aplay pipeline.
   * @param text      The text to synthesize.
   * @param modelPath Absolute path to the .onnx voice model. Falls back to default discovered model if omitted.
   * @param volume    Volume multiplier between 0.0 and 1.0 (default: 1.0)
   */
  ipcMain.handle('tts:speak', async (_event, text: string, modelPath?: string, volume?: number) => {
    killAllChildren()

    if (typeof volume === 'number') {
      currentTTSVolume = Math.max(0, Math.min(1, volume))
    }

    if (typeof text !== 'string' || !text.trim() || currentTTSVolume <= 0) {
      sendEnded()
      return
    }

    let effectiveModelPath = modelPath && modelPath.trim()
    if (!effectiveModelPath || !checkVoiceModelConfigured(effectiveModelPath)) {
      const models = findInstalledVoiceModels()
      if (models.length > 0) {
        effectiveModelPath = models[0]
      }
    }

    if (!effectiveModelPath || !checkVoiceModelConfigured(effectiveModelPath)) {
      // No valid model — short-circuit immediately rather than spawning a doomed process
      sendEnded()
      return
    }

    try {
      const piperChild = spawn(
        'piper',
        ['--model', effectiveModelPath, '--output_file', '-'],
        { stdio: ['pipe', 'pipe', 'ignore'] }
      )
      currentPiperChild = piperChild

      const aplayChild = spawn(
        'aplay',
        ['-'],
        { stdio: ['pipe', 'ignore', 'ignore'] }
      )
      currentAplayChild = aplayChild

      const volumeTransform = createVolumeTransform(() => currentTTSVolume)

      // Handle stream errors to prevent uncaught exceptions (e.g. EPIPE when killed)
      piperChild.stdout!.on('error', () => { /* ignore */ })
      volumeTransform.on('error', () => { /* ignore */ })
      aplayChild.stdin!.on('error', () => { /* ignore */ })

      // Pipe piper's WAV output -> volumeTransform -> aplay's stdin
      piperChild.stdout!.pipe(volumeTransform).pipe(aplayChild.stdin!)

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
   * 'tts:setVolume' — update current live playback volume.
   */
  ipcMain.handle('tts:setVolume', async (_event, volume: number) => {
    if (typeof volume === 'number') {
      currentTTSVolume = Math.max(0, Math.min(1, volume))
      if (currentTTSVolume <= 0 && (currentPiperChild || currentAplayChild)) {
        killAllChildren()
        sendEnded()
      }
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
