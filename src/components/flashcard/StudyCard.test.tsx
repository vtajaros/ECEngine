// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StudyCard } from './StudyCard'
import type { Card } from '../../types'

const mockFormulaCard: Card = {
  id: 'card-formula-1',
  topicId: 'dc-circuits',
  type: 'formula',
  data: {
    name: 'Resistance',
    latex: 'R=\\rho\\frac{L}{A}',
    description: '',
    variables: '',
    explanation: '**R** = resistance (ohms)\n**ρ** = resistivity (ohm-meter)\n**L** = length of wire (m)\n**A** = cross-sectional area (m^2)\n\nCommon Resistivity Values at 20°C:\n- Silver: 1.59 × 10⁻⁸ Ω·m\n- Copper: 1.68 × 10⁻⁸ Ω·m',
  },
  difficulty: 'medium',
  tags: [],
  isCustom: false,
  createdAt: new Date().toISOString(),
}

describe('StudyCard', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
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

  it('renders front face with relative positioning when not flipped', () => {
    act(() => {
      root.render(
        <StudyCard
          card={mockFormulaCard}
          currentIndex={0}
          isFlipped={false}
          swapTermDef={false}
          writtenMode={false}
          writtenAnswer=""
          writtenSubmitted={false}
          writtenCorrect={null}
          isAutoplay={false}
          isBookmarked={false}
          onFlip={vi.fn()}
          onBookmarkToggle={vi.fn()}
          onWrittenChange={vi.fn()}
          onWrittenSubmit={vi.fn()}
          onViewCard={vi.fn()}
          onZoomImage={vi.fn()}
        />
      )
    })

    expect(container.textContent).toContain('Resistance')
    expect(container.textContent).toContain('Term')

    // Check front face is relative in layout
    const faces = container.querySelectorAll('.bg-surface-2')
    expect(faces.length).toBe(2)
    const frontFace = faces[0] as HTMLElement
    const backFace = faces[1] as HTMLElement
    expect(frontFace.style.position).toBe('relative')
    expect(backFace.style.position).toBe('absolute')
  })

  it('renders back face with relative positioning when flipped, and toggles explanation without cutoff', async () => {
    const onExplanationOpen = vi.fn()

    act(() => {
      root.render(
        <StudyCard
          card={mockFormulaCard}
          currentIndex={0}
          isFlipped={true}
          swapTermDef={false}
          writtenMode={false}
          writtenAnswer=""
          writtenSubmitted={false}
          writtenCorrect={null}
          isAutoplay={false}
          isBookmarked={false}
          onFlip={vi.fn()}
          onBookmarkToggle={vi.fn()}
          onWrittenChange={vi.fn()}
          onWrittenSubmit={vi.fn()}
          onViewCard={vi.fn()}
          onZoomImage={vi.fn()}
          onExplanationOpen={onExplanationOpen}
        />
      )
    })

    const faces = container.querySelectorAll('.bg-surface-2')
    const frontFace = faces[0] as HTMLElement
    const backFace = faces[1] as HTMLElement
    expect(frontFace.style.position).toBe('absolute')
    expect(backFace.style.position).toBe('relative')

    // Find Explanation button
    const buttons = Array.from(container.querySelectorAll('button'))
    const expButton = buttons.find(b => b.textContent?.includes('Explanation'))
    expect(expButton).toBeDefined()

    // Click Explanation button to open
    act(() => {
      expButton?.click()
    })

    expect(onExplanationOpen).toHaveBeenCalledWith(true, expect.any(Number), false)
    expect(container.textContent).toContain('resistance (ohms)')
    expect(container.textContent).toContain('resistivity (ohm-meter)')
    expect(container.textContent).toContain('length of wire (m)')
    expect(container.textContent).toContain('Silver: 1.59')
  })

  it('opens explanation when forceExplanationOpen is set to true', () => {
    act(() => {
      root.render(
        <StudyCard
          card={mockFormulaCard}
          currentIndex={0}
          isFlipped={true}
          swapTermDef={false}
          writtenMode={false}
          writtenAnswer=""
          writtenSubmitted={false}
          writtenCorrect={null}
          isAutoplay={false}
          isBookmarked={false}
          onFlip={vi.fn()}
          onBookmarkToggle={vi.fn()}
          onWrittenChange={vi.fn()}
          onWrittenSubmit={vi.fn()}
          onViewCard={vi.fn()}
          onZoomImage={vi.fn()}
          forceExplanationOpen={true}
        />
      )
    })

    expect(container.textContent).toContain('resistance (ohms)')
    expect(container.textContent).toContain('cross-sectional area')
  })
})
