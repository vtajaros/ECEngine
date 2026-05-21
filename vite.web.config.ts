import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Stub out Electron and Node-only modules for web build
      'electron': resolve(__dirname, 'src/mocks/electron.mock.ts'),
    },
  },
  define: {
    // Prevents process.env references from crashing in browser
    'process.env': '{}',
  },
})
