import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {

  decks: {
    getTopics: () => ipcRenderer.invoke('decks:getTopics'),
    getCardsByTopic: (topicId: string) => ipcRenderer.invoke('decks:getCardsByTopic', topicId),
    addDeckWithCards: (payload: any) => ipcRenderer.invoke('decks:addDeckWithCards', payload),
    deleteTopic: (topicId: string) => ipcRenderer.invoke('decks:deleteTopic', topicId),
    exportToText: (topicId: number | string, topicName: string) => ipcRenderer.invoke('decks:exportToText', topicId, topicName),
    getTopicsWithCardCounts: () => ipcRenderer.invoke('decks:getTopicsWithCardCounts'),
    getFormulaTopics: () => ipcRenderer.invoke('decks:getFormulaTopics'),
    getFormulaMastery: () => ipcRenderer.invoke('decks:getFormulaMastery'),
    updateDeckWithCards: (payload: any) => ipcRenderer.invoke('decks:updateDeckWithCards', payload),
    updateDecksFolder: (fromFolder: string, toFolder: string) =>
      ipcRenderer.invoke('decks:updateDecksFolder', { fromFolder, toFolder }),
    updateFolderOrder: (folderOrders: Array<{ folderName: string, orderIndex: number }>) =>
      ipcRenderer.invoke('decks:updateFolderOrder', { folderOrders }),
  },
  folders: {
    getAll:    ():                                          Promise<any> => ipcRenderer.invoke('folders:getAll'),
    create:    (name: string, parentId?: string | null):   Promise<any> => ipcRenderer.invoke('folders:create', { name, parentId }),
    delete:    (folderId: string):                         Promise<any> => ipcRenderer.invoke('folders:delete', folderId),
    setParent: (folderId: string, parentId: string | null):Promise<any> => ipcRenderer.invoke('folders:setParent', { folderId, parentId }),
    reorder:   (orders: Array<{ id: string; order_index: number }>): Promise<any> => ipcRenderer.invoke('folders:reorder', { orders }),
    rename:    (folderId: string, newName: string):                  Promise<any> => ipcRenderer.invoke('folders:rename', { folderId, newName }),
  },
  data: {
    getCards: (topicId?: string) => ipcRenderer.invoke('data:getCards', topicId),
    getCardsWithProgress: (topicId: string) => ipcRenderer.invoke('data:getCardsWithProgress', topicId),
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
    resetProgress: () => ipcRenderer.invoke('data:resetProgress'),
    exportDecks: () => ipcRenderer.invoke('data:exportDecks'),
    exportSelectedDecks: (topicIds: string[]) => ipcRenderer.invoke('data:exportSelectedDecks', topicIds),
    importDecks: (parsed: any) => ipcRenderer.invoke('data:importDecks', parsed),
    getAllCardsByTopic: (topicId: string) => ipcRenderer.invoke('data:getAllCardsByTopic', topicId),
    getCardsPrioritized: (topicId: string) => ipcRenderer.invoke('data:getCardsPrioritized', topicId),
    getDueCards: (topicId: string) => ipcRenderer.invoke('data:getDueCards', topicId),
    getDueCardCount: (topicId: string) => ipcRenderer.invoke('data:getDueCardCount', topicId),
    getDueBySubject: () => ipcRenderer.invoke('data:getDueBySubject'),
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
  explainFlashcard: (payload: { term: string; definition: string }) =>
    ipcRenderer.invoke('ai:explainFlashcard', payload),
  config: {
    /** Save the API key to userData/config.json in the main process */
    setApiKey: (key: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('config:setApiKey', key),
    /** Returns whether an API key is configured — never returns the key value */
    getApiKeyStatus: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('config:getApiKey'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },
  print: {
    open: (topicId: string, title: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('print:open', topicId, title),
    toPDF: (suggestedName: string, themeVars: Record<string, string>, topicId: string, title: string, theme: string, layout: string): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('print:toPDF', suggestedName, themeVars, topicId, title, theme, layout),
  },
})
