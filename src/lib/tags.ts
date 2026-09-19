import { PREDEFINED_TAGS } from './constants'

export const DELETED_TAGS_STORAGE_KEY = 'ecengine:deleted_tags'
export const CUSTOM_TAGS_STORAGE_KEY = 'ecengine:custom_tags'

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {}
  return null
}

export function getDeletedTags(): string[] {
  try {
    const raw = getStorage()?.getItem(DELETED_TAGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(t => String(t).trim().toLowerCase()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function getCustomTags(): string[] {
  try {
    const raw = getStorage()?.getItem(CUSTOM_TAGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(t => String(t).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveCustomTag(tag: string): void {
  const trimmed = tag.trim()
  if (!trimmed) return
  const lower = trimmed.toLowerCase()

  // 1. Remove from deleted tags if previously deleted
  const deleted = getDeletedTags().filter(d => d !== lower)
  try {
    getStorage()?.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deleted))
  } catch {}

  // 2. Add to custom tags if not already present
  const custom = getCustomTags()
  if (!custom.some(c => c.toLowerCase() === lower)) {
    custom.push(trimmed)
    try {
      getStorage()?.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(custom))
    } catch {}
  }
}

export function markTagDeleted(tag: string): void {
  const trimmed = tag.trim()
  if (!trimmed) return
  const lower = trimmed.toLowerCase()

  // 1. Add to deleted tags
  const deleted = getDeletedTags()
  if (!deleted.includes(lower)) {
    deleted.push(lower)
    try {
      getStorage()?.setItem(DELETED_TAGS_STORAGE_KEY, JSON.stringify(deleted))
    } catch {}
  }

  // 2. Remove from custom tags
  const custom = getCustomTags().filter(c => c.toLowerCase() !== lower)
  try {
    getStorage()?.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(custom))
  } catch {}
}

export function getAllAvailableTags(existingTopics?: Array<{ tags?: string | null }>): string[] {
  const deletedSet = new Set(getDeletedTags())
  const tagMap = new Map<string, string>() // lower -> original casing

  // 1. Predefined tags (if not deleted)
  for (const tag of PREDEFINED_TAGS) {
    const lower = tag.trim().toLowerCase()
    if (!deletedSet.has(lower) && !tagMap.has(lower)) {
      tagMap.set(lower, tag.trim())
    }
  }

  // 2. Custom tags stored locally
  for (const tag of getCustomTags()) {
    const lower = tag.trim().toLowerCase()
    if (!deletedSet.has(lower) && !tagMap.has(lower)) {
      tagMap.set(lower, tag.trim())
    }
  }

  // 3. Any tags on existing topics in DB (if not deleted)
  if (existingTopics && Array.isArray(existingTopics)) {
    for (const topic of existingTopics) {
      if (!topic.tags) continue
      try {
        const parsed = JSON.parse(topic.tags)
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (typeof t !== 'string') continue
            const trimmed = t.trim()
            if (!trimmed) continue
            const lower = trimmed.toLowerCase()
            if (!deletedSet.has(lower) && !tagMap.has(lower)) {
              tagMap.set(lower, trimmed)
            }
          }
        }
      } catch {
        // Fallback for comma-separated legacy tags if any
        const parts = String(topic.tags).split(',').map(s => s.trim()).filter(Boolean)
        for (const part of parts) {
          const lower = part.toLowerCase()
          if (!deletedSet.has(lower) && !tagMap.has(lower)) {
            tagMap.set(lower, part)
          }
        }
      }
    }
  }

  return Array.from(tagMap.values())
}
