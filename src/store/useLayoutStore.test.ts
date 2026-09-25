import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore } from './useLayoutStore'

describe('useLayoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({ forceCollapsed: false })
  })

  it('initializes forceCollapsed as false', () => {
    expect(useLayoutStore.getState().forceCollapsed).toBe(false)
  })

  it('updates forceCollapsed via setForceCollapsed', () => {
    useLayoutStore.getState().setForceCollapsed(true)
    expect(useLayoutStore.getState().forceCollapsed).toBe(true)

    useLayoutStore.getState().setForceCollapsed(false)
    expect(useLayoutStore.getState().forceCollapsed).toBe(false)
  })
})
