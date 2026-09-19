// src/types/window.d.ts
// Global Window augmentation for Electron IPC bridge.
// This is the single source of truth for window.electron typing.

export { }  // ensure this is treated as a module

export interface FolderRow {
  id: string
  name: string
  parent_id: string | null
  order_index: number
}

declare global {
  interface Window {
    electron: {
      platform: string
      decks: {
        getTopics: () => Promise<{ success: boolean; data?: any; error?: string }>
        getCardsByTopic: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        addDeckWithCards: (payload: {
          topicId: string
          name: string
          subject: string
          description: string
          tags: string
          folderName: string
          folderId: string | null
          scope: string
          cards: Array<{ id: string; type: string; data: string; is_custom: number }>
        }) => Promise<{ success: boolean; error?: string }>
        deleteTopic: (topicId: string) => Promise<{ success: boolean; error?: string }>
        exportToText: (topicId: number | string, topicName: string) => Promise<{ success: boolean; error?: string }>
        getTopicsWithCardCounts: () => Promise<{ success: boolean; data?: any; error?: string }>
        getFormulaTopics: () => Promise<{ success: boolean; data?: any; error?: string }>
        getFormulaMastery: () => Promise<{ success: boolean; data?: any; error?: string }>
        getBookmarkCountsByTopic: (cardIds: string[]) => Promise<{ success: boolean; data?: Record<string, number>; error?: string }>
        updateDeckWithCards: (payload: {
          deckId: string, title: string, subject: string, description: string,
          tags: string, folderName: string, folderId: string | null, scope: string,
          cards: Array<{ id: string, type: string, data: string, isNew: boolean }>,
          deletedCardIds: string[]
        }) => Promise<{ success: boolean; error?: string }>

        /** @deprecated Legacy deck order by folder name. Use folders.reorder for folder ordering. */
        updateFolderOrder: (folderOrders: Array<{ folderName: string, orderIndex: number }>) => Promise<{ success: boolean; error?: string }>
        toggleFavorite: (topicId: string) => Promise<{ success: boolean; isFavorite?: boolean; error?: string }>
        setFavorite: (topicId: string, isFavorite: boolean) => Promise<{ success: boolean; isFavorite?: boolean; error?: string }>
      }
      folders: {
        getAll(payload?: { scope?: string }): Promise<{ success: boolean; data?: FolderRow[]; error?: string }>
        create(payload: { name: string, parentId?: string | null, scope?: string }): Promise<{ success: boolean; data?: FolderRow; error?: string }>
        delete(payload: { folderId: string, scope?: string } | string): Promise<{ success: boolean; error?: string }>
        setParent(payload: { folderId: string, parentId: string | null, scope?: string }): Promise<{ success: boolean; error?: string }>
        reorder(orders: Array<{ id: string; order_index: number }>): Promise<{ success: boolean; error?: string }>
        rename(folderId: string, newName: string): Promise<{ success: boolean; error?: string }>
      }
      data: {
        getCards: (topicId?: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getProgress: (cardId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        saveProgress: (payload: { cardId: string, easeFactor: number, interval: number, repetitions: number, nextReview: string, lastReviewed: string, correctIncrement: number, lastResult: string }) => Promise<{ success: boolean; error?: string }>
        recordActivity: (payload: { today: string, correctInc: number, totalInc: number }) => Promise<{ success: boolean; error?: string }>
        getActivityHistory: () => Promise<{ success: boolean; data?: any; error?: string }>
        getAccuracyTrendAll: (startStr: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getAccuracyTrendSubject: (fullSubject: string, startStr: string) => Promise<{ success: boolean; data?: any; error?: string }>
        updateTimeSpent: (today: string, minutes: number) => Promise<{ success: boolean; error?: string }>
        getDashboardStats: () => Promise<{ success: boolean; data?: any; error?: string }>
        getSubjectBreakdown: () => Promise<{ success: boolean; data?: any; error?: string }>
        getSubjectProgress: () => Promise<{ success: boolean; data?: any; error?: string }>
        getGlobalStats: () => Promise<{ success: boolean; data?: any; error?: string }>
        clearAllData: () => Promise<{ success: boolean; error?: string }>
        resetProgress: () => Promise<{ success: boolean; error?: string }>
        exportDecks: () => Promise<{ success: boolean; data?: string; error?: string }>
        exportSelectedDecks: (topicIds: string[]) => Promise<{ success: boolean; data?: string; error?: string }>
        importDecks: (parsed: unknown) => Promise<{ success: boolean; data?: string; error?: string }>
        getAllCardsByTopic: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getCardsPrioritized: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getDueCards: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getDueCardCount: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getFlashcardSchedule: () => Promise<{ success: boolean; data?: any; error?: string }>
        getCardsWithProgress: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        /** Write MCQ correctness without touching SM-2 fields. Safe to call for native MCQ cards only. */
        recordCardResult: (payload: { cardId: string, isCorrect: boolean, lastReviewed: string }) => Promise<{ success: boolean; error?: string }>
        saveExamSession: (payload: {
          id?: string
          topicId?: string | null
          mode: string
          startedAt?: string | number
          finishedAt?: string | number
          score: number
          total: number
          answers?: string
        }) => Promise<{ success: boolean; data?: { id: string }; error?: string }>
        getExamSessions: (limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>
        deleteExamSession: (id: string) => Promise<{ success: boolean; error?: string }>
        clearExamSessions: () => Promise<{ success: boolean; error?: string }>
        exportDatabaseAndImages: () => Promise<{ success: boolean; canceled?: boolean; folderPath?: string; error?: string }>
      }
      file: {
        import: (filePath?: string) => Promise<{ success: boolean; data?: string; canceled?: boolean; error?: string }>
        export: (data: unknown, savePath?: string) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
      }
      saveImage: (srcPath: string) => Promise<{ success: boolean; filename?: string; error?: string }>
      explainQuestion: (payload: {
        question: string
        choices: string[]
        correctAnswerIndex: number
      }) => Promise<{ text?: string; error?: string; status?: number; detail?: string }>
      explainFlashcard: (payload: {
        term: string
        definition: string
      }) => Promise<{ text?: string; error?: string; status?: number; detail?: string }>
      summarizeDeck: (payload: {
        title?: string
        subject?: string
        cardItems: string[]
        totalCards: number
      }) => Promise<{ text?: string; error?: string; status?: number; detail?: string }>
      getUsageLimits: () => Promise<{
        success: boolean
        isConfigured: boolean
        usage: {
          limitRequests: number
          remainingRequests: number
          resetRequests: string
          limitTokens: number
          remainingTokens: number
          resetTokens: string
          lastUpdated: number
        } | null
        error?: string
      }>
      refreshUsageLimits: () => Promise<{
        success: boolean
        isConfigured: boolean
        usage: {
          limitRequests: number
          remainingRequests: number
          resetRequests: string
          limitTokens: number
          remainingTokens: number
          resetTokens: string
          lastUpdated: number
        } | null
        error?: string
      }>
      config: {
        setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
        getApiKeyStatus: () => Promise<{ configured: boolean }>
        getSettings: () => Promise<{ examDate?: string; preboardDate?: string | null; katexScale?: number; katexBold?: boolean; sidebarCollapsed?: boolean }>
        updateSettings: (settings: { examDate?: string; preboardDate?: string | null; katexScale?: number; katexBold?: boolean; sidebarCollapsed?: boolean }) => Promise<{ success: boolean; error?: string }>
        getImagesPath: () => Promise<{ imagesPath: string }>
        selectImagesPath: () => Promise<{ success: boolean; canceled?: boolean; imagesPath?: string; error?: string }>
        setImagesPath: (imagesPath: string) => Promise<{ success: boolean; imagesPath?: string; error?: string }>
        getDBPath: () => Promise<{ dbPath: string }>
        selectDBPath: () => Promise<{ success: boolean; canceled?: boolean; dbPath?: string; error?: string }>
        setDBPath: (dbPath: string) => Promise<{ success: boolean; dbPath?: string; error?: string }>
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
      tts: {
        synthesize: (text: string, modelPath?: string) => Promise<{ success: boolean; audioData?: Uint8Array; error?: string }>
        speak: (text: string, modelPath?: string, volume?: number) => Promise<void>
        setVolume?: (volume: number) => Promise<void>
        stop: () => Promise<void>
        isAvailable: (modelPath?: string) => Promise<{ piperInstalled: boolean; modelConfigured: boolean; defaultModelPath?: string; availableModels?: string[] }>
        selectVoiceModel: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
        onEnded: (callback: () => void) => () => void
      }
      windowControls: {
        minimize: () => void
        maximize: () => void
        close: () => void
        onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => () => void
      }
      print: {
        open: (topicId: string, title: string) => Promise<{ success: boolean; error?: string }>
        toPDF: (
          suggestedName: string,
          themeVars: Record<string, string>,
          topicId: string,
          title: string,
          theme: string,
          layout: string,
          options?: {
            showAnswers?: boolean
            showSolutions?: boolean
            boldSide?: string
          }
        ) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
      }
      zoom: {
        get: () => number
        getZoomFactor?: () => Promise<number>
        onChanged: (callback: (percent: number) => void) => () => void
        step: (direction: 1 | -1) => void
      }
    }
  }
}
