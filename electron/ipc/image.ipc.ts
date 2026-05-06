import { ipcMain, app, protocol, net } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { pathToFileURL } from 'url'
import sharp from 'sharp'

// ── Allowed source extensions ──────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MAX_EDGE_PX = 1280

function getImagesDir(): string {
  const dir = join(app.getPath('userData'), 'ece-images')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function registerImageHandlers() {
  // ── IPC: save-image ────────────────────────────────────────────────
  ipcMain.handle('save-image', async (_event, srcPath: string) => {
    try {
      // 1. Validate source path exists
      if (!srcPath || !existsSync(srcPath)) {
        return { success: false, error: 'Source file not found.' }
      }

      // 2. Validate file extension
      const srcExt = extname(srcPath).toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(srcExt)) {
        return {
          success: false,
          error: `Invalid file type "${srcExt}". Allowed: .png, .jpg, .jpeg, .webp`,
        }
      }

      // 3. Build a safe output filename — always save as .webp for consistency
      const base = basename(srcPath, srcExt)
        .replace(/[^a-z0-9_-]/gi, '_')
        .slice(0, 48)
      const filename = `${Date.now()}_${base}.webp`
      const destPath = join(getImagesDir(), filename)

      // 4. Process with sharp: resize longest edge to MAX_EDGE_PX, save as webp
      await sharp(srcPath)
        .resize({
          width: MAX_EDGE_PX,
          height: MAX_EDGE_PX,
          fit: 'inside',          // maintains aspect ratio, never upscales
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(destPath)

      console.log(`[save-image] Saved processed image: ${filename}`)
      return { success: true, filename }
    } catch (err) {
      console.error('[save-image] Error:', err)
      return { success: false, error: (err as Error).message }
    }
  })
}

// ── Custom protocol scheme registration (before app ready) ─────────
export function registerImageProtocolScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'ece-app',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    },
  ])
}

import { createReadStream } from 'fs'
import { Readable } from 'node:stream'

// ── Protocol handler (after app ready) ────────────────────────────
export function handleImageProtocol() {
  protocol.handle('ece-app', (request) => {
    try {
      const url = new URL(request.url)
      const filename = decodeURIComponent(url.host + url.pathname).replace(/^\//, '')
      const imagesDir = join(app.getPath('userData'), 'ece-images')
      const filePath = join(imagesDir, filename)

      if (!existsSync(filePath)) {
        console.warn(`[ece-app://] File not found: ${filePath}`)
        return new Response('Not Found', { status: 404 })
      }

      // Convert Node ReadStream to Web ReadableStream
      const nodeStream = createReadStream(filePath)
      const webStream = Readable.toWeb(nodeStream)

      return new Response(webStream as any, {
        status: 200,
        headers: {
          'Content-Type': `image/${extname(filePath).slice(1) || 'webp'}`,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    } catch (err) {
      console.error('[ece-app://] Protocol error:', err)
      return new Response('Internal Error', { status: 500 })
    }
  })
}
