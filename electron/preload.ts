import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
  },
  file: {
    import: (filePath: string) => ipcRenderer.invoke('file:import', filePath),
    export: (data: unknown, savePath: string) => ipcRenderer.invoke('file:export', data, savePath),
  },
})
