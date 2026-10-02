// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GauntletRankUpModal } from './GauntletRankUpModal'
import { detectRankUp, type RankUpEvent } from '../../lib/gauntlet'

const mockPlay = vi.fn()
vi.mock('../../hooks/useSound', () => ({
  useSound: () => ({
    play: mockPlay,
  }),
}))

describe('GauntletRankUpModal Component', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockPlay.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders rank up celebration with old tier, new tier, and promotion title', () => {
    const event: RankUpEvent = detectRankUp(840, 860, 'MATH')
    expect(event.isRankUp).toBe(true)
    expect(event.oldTier.name).toBe('INSULATOR')
    expect(event.newTier.name).toBe('SEMICONDUCTOR')

    act(() => {
      root.render(
        <GauntletRankUpModal
          isOpen={true}
          onClose={vi.fn()}
          event={event}
        />
      )
    })

    expect(container.textContent).toContain('RANK UP!')
    expect(container.textContent).toContain('Promotion Achieved · MATH')
    expect(container.textContent).toContain('INSULATOR')
    expect(container.textContent).toContain('SEMICONDUCTOR')
    expect(container.textContent).toContain('+20 Elo Gained')
    expect(mockPlay).toHaveBeenCalledWith('roundComplete')
  })

  it('renders overall promotion tag when subject is not specified', () => {
    const event: RankUpEvent = detectRankUp(1190, 1215)
    expect(event.isRankUp).toBe(true)
    expect(event.newTier.name).toBe('CONDUCTOR')

    act(() => {
      root.render(
        <GauntletRankUpModal
          isOpen={true}
          onClose={vi.fn()}
          event={event}
        />
      )
    })

    expect(container.textContent).toContain('Promotion Achieved · Overall')
    expect(container.textContent).toContain('CONDUCTOR')
  })

  it('calls onClose when clicking Continue to Debrief button', () => {
    const handleClose = vi.fn()
    const event: RankUpEvent = detectRankUp(1490, 1520, 'ELECS')

    act(() => {
      root.render(
        <GauntletRankUpModal
          isOpen={true}
          onClose={handleClose}
          event={event}
        />
      )
    })

    const continueBtn = container.querySelector('button')
    expect(continueBtn).not.toBeNull()
    expect(continueBtn?.textContent).toContain('Continue to Debrief')

    act(() => {
      continueBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when pressing Escape or Enter key', () => {
    const handleClose = vi.fn()
    const event: RankUpEvent = detectRankUp(1790, 1810, 'EST')

    act(() => {
      root.render(
        <GauntletRankUpModal
          isOpen={true}
          onClose={handleClose}
          event={event}
        />
      )
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(handleClose).toHaveBeenCalledTimes(1)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(handleClose).toHaveBeenCalledTimes(2)
  })

  it('returns null when isOpen is false', () => {
    const event: RankUpEvent = detectRankUp(840, 860, 'MATH')

    act(() => {
      root.render(
        <GauntletRankUpModal
          isOpen={false}
          onClose={vi.fn()}
          event={event}
        />
      )
    })

    expect(container.textContent).toBe('')
  })
})
