import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'

// node_modules/better-sqlite3 is compiled for Electron's ABI (postinstall: electron-rebuild),
// so plain-Node vitest can't load it. If a Node-ABI copy exists in .native-node/, tests use it.
const nodeSqlite = path.resolve(__dirname, '.native-node/node_modules/better-sqlite3')
const useNodeSqlite = fs.existsSync(path.join(nodeSqlite, 'package.json'))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/lib/**',
        'src/services/**',
        'electron/db/database.ts',
      ],
      exclude: [
        'src/pages/**',
        'src/components/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...(useNodeSqlite ? { 'better-sqlite3': nodeSqlite } : {}),
    },
  },
})
