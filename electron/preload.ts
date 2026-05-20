import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
  },
  decks: {
    getTopics: () => ipcRenderer.invoke('decks:getTopics'),
    getCardsByTopic: (topicId: string) => ipcRenderer.invoke('decks:getCardsByTopic', topicId),
    getDueCounts: () => ipcRenderer.invoke('decks:getDueCounts'),
    getDueCardsForSession: (topicId: string) => ipcRenderer.invoke('decks:getDueCardsForSession', topicId),
    addDeckWithCards: (payload: any) => ipcRenderer.invoke('decks:addDeckWithCards', payload),
    deleteTopic: (topicId: string) => ipcRenderer.invoke('decks:deleteTopic', topicId),
    exportToText: (topicId: number | string, topicName: string) => ipcRenderer.invoke('decks:exportToText', topicId, topicName),
  },
  file: {
    import: (filePath?: string) => ipcRenderer.invoke('file:import', filePath),
    export: (data: unknown, savePath?: string) => ipcRenderer.invoke('file:export', data, savePath),
  },
  saveImage: (srcPath: string): Promise<{ success: boolean; filename?: string; error?: string }> =>
    ipcRenderer.invoke('save-image', srcPath),
  explainQuestion: (payload: {
    question: string
    choices: string[]
    correctAnswerIndex: number
    // apiKey removed — key is managed exclusively in the main process
  }): Promise<{ text?: string; error?: string }> =>
    ipcRenderer.invoke('ai:explain', payload),
  config: {
    /** Save the API key to userData/config.json in the main process */
    setApiKey: (key: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('config:setApiKey', key),
    /** Returns whether an API key is configured — never returns the key value */
    getApiKeyStatus: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('config:getApiKey'),
  },
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },
  print: {
    open: (topicId: string, title: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('print:open', topicId, title),
    toPDF: (suggestedName: string): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('print:toPDF', suggestedName),
  },
})
