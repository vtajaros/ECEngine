import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {

  decks: {
    getTopics: () => ipcRenderer.invoke('decks:getTopics'),
    getCardsByTopic: (topicId: string) => ipcRenderer.invoke('decks:getCardsByTopic', topicId),
    getDueCounts: () => ipcRenderer.invoke('decks:getDueCounts'),
    getDueCardsForSession: (topicId: string) => ipcRenderer.invoke('decks:getDueCardsForSession', topicId),
    addDeckWithCards: (payload: any) => ipcRenderer.invoke('decks:addDeckWithCards', payload),
    deleteTopic: (topicId: string) => ipcRenderer.invoke('decks:deleteTopic', topicId),
    exportToText: (topicId: number | string, topicName: string) => ipcRenderer.invoke('decks:exportToText', topicId, topicName),
    getTopicsWithCardCounts: () => ipcRenderer.invoke('decks:getTopicsWithCardCounts'),
    getFormulaTopics: () => ipcRenderer.invoke('decks:getFormulaTopics'),
    updateDeckWithCards: (payload: any) => ipcRenderer.invoke('decks:updateDeckWithCards', payload),
    updateDecksFolder: (fromFolder: string, toFolder: string) =>
      ipcRenderer.invoke('decks:updateDecksFolder', { fromFolder, toFolder }),
    updateFolderOrder: (folderOrders: Array<{ folderName: string, orderIndex: number }>) =>
      ipcRenderer.invoke('decks:updateFolderOrder', { folderOrders }),
  },
  data: {
    getCards: (topicId?: string) => ipcRenderer.invoke('data:getCards', topicId),
    getProgress: (cardId: string) => ipcRenderer.invoke('data:getProgress', cardId),
    saveProgress: (payload: any) => ipcRenderer.invoke('data:saveProgress', payload),
    recordActivity: (payload: any) => ipcRenderer.invoke('data:recordActivity', payload),
    getActivityHistory: () => ipcRenderer.invoke('data:getActivityHistory'),
    getAccuracyTrendAll: (startStr: string) => ipcRenderer.invoke('data:getAccuracyTrendAll', startStr),
    getAccuracyTrendSubject: (fullSubject: string, startStr: string) => ipcRenderer.invoke('data:getAccuracyTrendSubject', fullSubject, startStr),
    updateTimeSpent: (today: string, minutes: number) => ipcRenderer.invoke('data:updateTimeSpent', today, minutes),
    getDashboardStats: () => ipcRenderer.invoke('data:getDashboardStats'),
    getSubjectBreakdown: () => ipcRenderer.invoke('data:getSubjectBreakdown'),
    getSubjectProgress: () => ipcRenderer.invoke('data:getSubjectProgress'),
    getGlobalStats: () => ipcRenderer.invoke('data:getGlobalStats'),
    clearAllData: () => ipcRenderer.invoke('data:clearAllData'),
    exportDecks: () => ipcRenderer.invoke('data:exportDecks'),
    importDecks: (parsed: any) => ipcRenderer.invoke('data:importDecks', parsed),
    getAllCardsByTopic: (topicId: string) => ipcRenderer.invoke('data:getAllCardsByTopic', topicId),
    getCardsPrioritized: (topicId: string) => ipcRenderer.invoke('data:getCardsPrioritized', topicId),
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
