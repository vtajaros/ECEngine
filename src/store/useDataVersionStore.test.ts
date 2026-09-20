import { describe, it, expect, beforeEach } from 'vitest'
import { useDataVersionStore } from './useDataVersionStore'

describe('useDataVersionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDataVersionStore.setState({ version: 0 })
  })

  it('initial version is 0', () => {
    expect(useDataVersionStore.getState().version).toBe(0)
  })

  it('bump increments version by 1', () => {
    useDataVersionStore.getState().bump()
    expect(useDataVersionStore.getState().version).toBe(1)
  })

  it('multiple bumps accumulate', () => {
    useDataVersionStore.getState().bump()
    useDataVersionStore.getState().bump()
    useDataVersionStore.getState().bump()
    expect(useDataVersionStore.getState().version).toBe(3)
  })
})
