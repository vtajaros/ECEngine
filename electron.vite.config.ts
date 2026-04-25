import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve(__dirname, 'electron/main.ts') } } }
  },
  preload: {
    build: { rollupOptions: { input: { index: resolve(__dirname, 'electron/preload.ts') } } }
  },
  renderer: {
    root: 'src',
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/index.html') } } },
    plugins: [react()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    }
  }
})
