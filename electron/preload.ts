import { contextBridge, ipcRenderer, webFrame } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

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

    updateFolderOrder: (folderOrders: Array<{ folderName: string, orderIndex: number }>) =>
      ipcRenderer.invoke('decks:updateFolderOrder', { folderOrders }),
    toggleFavorite: (topicId: string) => ipcRenderer.invoke('decks:toggleFavorite', topicId),
    setFavorite: (topicId: string, isFavorite: boolean) => ipcRenderer.invoke('decks:setFavorite', { topicId, isFavorite }),
  },
  folders: {
    getAll: (payload?: { scope?: string }): Promise<any> => ipcRenderer.invoke('folders:getAll', payload),
    create: (payload: { name: string, parentId?: string | null, scope?: string }): Promise<any> => ipcRenderer.invoke('folders:create', payload),
    delete: (payload: { folderId: string, scope?: string } | string): Promise<any> => ipcRenderer.invoke('folders:delete', payload),
    setParent: (payload: { folderId: string, parentId: string | null, scope?: string }): Promise<any> => ipcRenderer.invoke('folders:setParent', payload),
    reorder: (orders: Array<{ id: string; order_index: number }>): Promise<any> => ipcRenderer.invoke('folders:reorder', { orders }),
    rename: (folderId: string, newName: string): Promise<any> => ipcRenderer.invoke('folders:rename', { folderId, newName }),
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
    recordCardResult: (payload: { cardId: string; isCorrect: boolean }) =>
      ipcRenderer.invoke('data:recordCardResult', payload),
    saveExamSession: (payload: any) => ipcRenderer.invoke('data:saveExamSession', payload),
    getExamSessions: (limit?: number) => ipcRenderer.invoke('data:getExamSessions', limit),
    deleteExamSession: (id: string) => ipcRenderer.invoke('data:deleteExamSession', id),
    clearExamSessions: () => ipcRenderer.invoke('data:clearExamSessions'),
    exportDatabaseAndImages: (): Promise<{ success: boolean; canceled?: boolean; folderPath?: string; error?: string }> =>
      ipcRenderer.invoke('data:exportDatabaseAndImages'),
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
  summarizeDeck: (payload: {
    title?: string
    subject?: string
    cardItems: string[]
    totalCards: number
  }): Promise<{ text?: string; error?: string; status?: number; detail?: string }> =>
    ipcRenderer.invoke('ai:summarizeDeck', payload),
  getUsageLimits: (): Promise<{ success: boolean; isConfigured: boolean; usage: any; error?: string }> =>
    ipcRenderer.invoke('ai:getUsageLimits'),
  refreshUsageLimits: (): Promise<{ success: boolean; isConfigured: boolean; usage: any; error?: string }> =>
    ipcRenderer.invoke('ai:refreshUsageLimits'),
  config: {
    /** Save the API key to userData/config.json in the main process */
    setApiKey: (key: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('config:setApiKey', key),
    /** Returns whether an API key is configured — never returns the key value */
    getApiKeyStatus: (): Promise<{ configured: boolean }> =>
      ipcRenderer.invoke('config:getApiKey'),
    getSettings: (): Promise<{ examDate?: string; preboardDate?: string | null; katexScale?: number; katexBold?: boolean; sidebarCollapsed?: boolean; showFormulaBank?: boolean }> =>
      ipcRenderer.invoke('config:getSettings'),
    updateSettings: (settings: { examDate?: string; preboardDate?: string | null; katexScale?: number; katexBold?: boolean; sidebarCollapsed?: boolean; showFormulaBank?: boolean }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('config:updateSettings', settings),
    getImagesPath: (): Promise<{ imagesPath: string }> =>
      ipcRenderer.invoke('config:getImagesPath'),
    selectImagesPath: (): Promise<{ success: boolean; canceled?: boolean; imagesPath?: string; error?: string }> =>
      ipcRenderer.invoke('config:selectImagesPath'),
    setImagesPath: (imagesPath: string): Promise<{ success: boolean; imagesPath?: string; error?: string }> =>
      ipcRenderer.invoke('config:setImagesPath', imagesPath),
    /** Returns the active database file path (may differ from default after user change + restart) */
    getDBPath: (): Promise<{ dbPath: string }> =>
      ipcRenderer.invoke('config:getDBPath'),
    /** Opens a save-file dialog to choose a new database location. Requires restart. */
    selectDBPath: (): Promise<{ success: boolean; canceled?: boolean; dbPath?: string; error?: string }> =>
      ipcRenderer.invoke('config:selectDBPath'),
    /** Saves a manually typed database path. Requires restart. */
    setDBPath: (dbPath: string): Promise<{ success: boolean; dbPath?: string; error?: string }> =>
      ipcRenderer.invoke('config:setDBPath', dbPath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  tts: {
    synthesize: (text: string, modelPath?: string): Promise<{ success: boolean; audioData?: Uint8Array; error?: string }> =>
      ipcRenderer.invoke('tts:synthesize', text, modelPath),
    speak: (text: string, modelPath?: string, volume?: number): Promise<void> => ipcRenderer.invoke('tts:speak', text, modelPath, volume),
    setVolume: (volume: number): Promise<void> => ipcRenderer.invoke('tts:setVolume', volume),
    stop: (): Promise<void> => ipcRenderer.invoke('tts:stop'),
    isAvailable: (modelPath?: string): Promise<{ piperInstalled: boolean; modelConfigured: boolean; defaultModelPath?: string; availableModels?: string[] }> => ipcRenderer.invoke('tts:isAvailable', modelPath),
    selectVoiceModel: (): Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('tts:selectVoiceModel'),
    onEnded: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('tts:ended', listener)
      return () => { ipcRenderer.removeListener('tts:ended', listener) }
    },
  },
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_event: any, isFullscreen: boolean) => callback(isFullscreen)
      ipcRenderer.on('window:fullscreen', listener)
      return () => { ipcRenderer.removeListener('window:fullscreen', listener) }
    },
  },
  print: {
    open: (topicId: string, title: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('print:open', topicId, title),
    toPDF: (suggestedName: string, themeVars: Record<string, string>, topicId: string, title: string, theme: string, layout: string): Promise<{ success: boolean; canceled?: boolean; error?: string }> =>
      ipcRenderer.invoke('print:toPDF', suggestedName, themeVars, topicId, title, theme, layout),
  },
  zoom: {
    get: () => Math.round(webFrame.getZoomFactor() * 100),
    getZoomFactor: (): Promise<number> => ipcRenderer.invoke('zoom:getFactor'),
    onChanged: (callback: (percent: number) => void) => {
      const listener = (_event: unknown, percent: number) => callback(percent)
      ipcRenderer.on('zoom:changed', listener)
      return () => { ipcRenderer.removeListener('zoom:changed', listener) }
    },
    step: (direction: 1 | -1) => ipcRenderer.send('zoom:step', direction),
  },
})
