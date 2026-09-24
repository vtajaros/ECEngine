import Database from 'better-sqlite3'

/**
 * Deletes cards together with their progress rows.
 * progress.card_id REFERENCES cards(id) has no ON DELETE action and foreign_keys=ON,
 * so progress must be removed first. The caller owns the transaction.
 */
export function deleteCardsWithProgress(db: Database.Database, cardIds: string[]): void {
  if (cardIds.length === 0) return
  const deleteProgress = db.prepare('DELETE FROM progress WHERE card_id = ?')
  const deleteCard = db.prepare('DELETE FROM cards WHERE id = ?')
  for (const id of cardIds) {
    deleteProgress.run(id)
    try {
      db.prepare('DELETE FROM gauntlet_flagged_cards WHERE card_id = ?').run(id)
    } catch {}
    deleteCard.run(id)
  }
}
