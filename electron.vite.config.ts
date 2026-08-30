import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['better-sqlite3', 'sharp', 'archiver'], input: { index: resolve(__dirname, 'electron/main.ts') } } }
  },
  preload: {
    build: { rollupOptions: { external: [], input: { index: resolve(__dirname, 'electron/preload.ts') } } }
  },
  renderer: {
    root: 'src',
    publicDir: '../public',
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/index.html') } } },
    plugins: [react()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    }
  }
})
