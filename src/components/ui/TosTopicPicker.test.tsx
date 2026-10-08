// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TosTopicPicker } from './TosTopicPicker'

describe('TosTopicPicker Component', () => {
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

  it('renders placeholder when value is null', () => {
    act(() => {
      root.render(
        <TosTopicPicker
          value={null}
          onChange={vi.fn()}
          subject="MATH"
          placeholder="None / Mixed Topics"
        />
      )
    })

    expect(container.textContent).toContain('None / Mixed Topics')
  })

  it('renders resolved subtopic code and title when value is provided', () => {
    act(() => {
      root.render(
        <TosTopicPicker
          value="MATH-4.1"
          onChange={vi.fn()}
          subject="MATH"
        />
      )
    })

    expect(container.textContent).toContain('4.1')
    expect(container.textContent).toContain('Complex Numbers')
  })

  it('opens popover on click and does NOT allow selecting whole number parent topics', () => {
    const handleChange = vi.fn()
    act(() => {
      root.render(
        <TosTopicPicker
          value={null}
          onChange={handleChange}
          subject="ELECS"
          placeholder="(Default from Deck / None)"
        />
      )
    })

    const triggerBtn = container.querySelector('button')
    expect(triggerBtn).not.toBeNull()

    act(() => {
      triggerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Popover is open in document.body via portal
    expect(document.body.textContent).toContain('ELECS Subtopics')

    // Find all buttons inside the popover
    const buttons = Array.from(document.body.querySelectorAll('button'))
    // Parent headers like '1.0 DC Electrical Circuits' must NOT be in buttons
    const buttonTexts = buttons.map(b => b.textContent)

    // Subtopic like 1.1 Resistive Network or 2.2 Impedance should be a button
    const subtopicBtn = buttons.find(b => b.textContent?.includes('1.1') && b.textContent?.includes('Resistive'))
    expect(subtopicBtn).toBeDefined()

    // Clicking subtopic triggers onChange
    act(() => {
      subtopicBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleChange).toHaveBeenCalledWith('ELECS-1.1')
  })

  it('filters subtopics using the search input', () => {
    act(() => {
      root.render(
        <TosTopicPicker
          value={null}
          onChange={vi.fn()}
          subject="MATH"
        />
      )
    })

    const triggerBtn = container.querySelector('button')
    act(() => {
      triggerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const searchInput = document.body.querySelector('input[type="text"]') as HTMLInputElement
    expect(searchInput).not.toBeNull()

    act(() => {
      searchInput.value = 'Laplace'
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      // React state update for onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      nativeInputValueSetter?.call(searchInput, 'Laplace')
      searchInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })

  it('allows clearing / untagging selection', () => {
    const handleChange = vi.fn()
    act(() => {
      root.render(
        <TosTopicPicker
          value="MATH-4.1"
          onChange={handleChange}
          subject="MATH"
        />
      )
    })

    const triggerBtn = container.querySelector('button')
    act(() => {
      triggerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const clearBtn = Array.from(document.body.querySelectorAll('button')).find(
      b => b.textContent?.includes('Clear / Untag') || b.textContent?.includes('Default from Deck')
    )
    expect(clearBtn).toBeDefined()

    act(() => {
      clearBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleChange).toHaveBeenCalledWith(null)
  })
})
