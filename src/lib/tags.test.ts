import { describe, it, expect, beforeEach } from 'vitest'

function createStorageMock(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

const mockLocal = createStorageMock()
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocal,
  writable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocal,
    writable: true,
  })
}

import {
  getAllAvailableTags,
  markTagDeleted,
  saveCustomTag,
  getDeletedTags,
  getCustomTags,
} from './tags'
import { PREDEFINED_TAGS } from './constants'

describe('tags management utility', () => {
  beforeEach(() => {
    mockLocal.clear()
  })

  it('returns no tags on a fresh install', () => {
    expect(PREDEFINED_TAGS).toEqual([])
    expect(getAllAvailableTags()).toEqual([])
  })

  it('excludes deleted tags when markTagDeleted is called', () => {
    saveCustomTag('Edge')
    saveCustomTag('Excel')
    markTagDeleted('Edge')
    const tags = getAllAvailableTags()
    expect(tags).not.toContain('Edge')
    expect(tags).toContain('Excel')
    expect(getDeletedTags()).toContain('edge')
  })

  it('handles multiple deleted tags case-insensitively', () => {
    saveCustomTag('Cuervo')
    saveCustomTag('Edge')
    markTagDeleted('CUERVO')
    markTagDeleted('edge')
    const tags = getAllAvailableTags()
    expect(tags).not.toContain('Cuervo')
    expect(tags).not.toContain('Edge')
  })

  it('adds and retains custom tags', () => {
    saveCustomTag('MyCustomTag')
    expect(getCustomTags()).toContain('MyCustomTag')
    const tags = getAllAvailableTags()
    expect(tags).toContain('MyCustomTag')
  })

  it('restores a deleted tag if it is re-added via saveCustomTag', () => {
    markTagDeleted('Edge')
    expect(getAllAvailableTags()).not.toContain('Edge')

    saveCustomTag('Edge')
    expect(getDeletedTags()).not.toContain('edge')
    expect(getAllAvailableTags()).toContain('Edge')
  })

  it('includes tags from existing topics unless deleted', () => {
    const topics = [
      { tags: JSON.stringify(['TopicTag1', 'Edge']) }
    ]
    markTagDeleted('Edge')
    const tags = getAllAvailableTags(topics)
    expect(tags).toContain('TopicTag1')
    expect(tags).not.toContain('Edge')
  })
})
