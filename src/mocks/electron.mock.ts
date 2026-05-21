const noop = () => Promise.resolve({ success: false, error: 'Not available in web mode' })

export default {
  db: { query: noop, run: noop },
  decks: {
    getTopics: noop,
    getCardsByTopic: noop,
    getDueCounts: noop,
    getDueCardsForSession: noop,
    addDeckWithCards: noop,
    deleteTopic: noop,
    exportToText: noop,
  },
  file: { import: noop, export: noop },
  saveImage: noop,
  explainQuestion: noop,
  config: { setApiKey: noop, getApiKeyStatus: noop },
  windowControls: { minimize: noop, maximize: noop, close: noop },
  print: { open: noop, toPDF: noop },
}
