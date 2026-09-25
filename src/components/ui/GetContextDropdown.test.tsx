// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GetContextDropdown } from './GetContextDropdown'
import { PromptContextData } from '../../lib/contextPrompts'

describe('GetContextDropdown', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  const mockContext: PromptContextData = {
    question: 'Find the resonant frequency of an LC circuit.',
    choices: ['1 / (2*pi*sqrt(LC))', '2*pi*sqrt(LC)', 'sqrt(L/C)', '1 / (LC)'],
    answer: 0,
    subject: 'ELECS',
    tosTopicId: 'ELECS-1.0',
    deckName: 'AC Circuits',
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    vi.restoreAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount()
      })
      container.remove()
    }
  })

  it('renders split buttons with default label', () => {
    act(() => {
      root!.render(<GetContextDropdown contextData={mockContext} />)
    })

    const mainBtn = container?.querySelector('[data-testid="get-context-main-btn"]')
    const chevronBtn = container?.querySelector('[data-testid="get-context-chevron-btn"]')
    const menu = container?.querySelector('[data-testid="get-context-menu"]')

    expect(mainBtn).not.toBeNull()
    expect(mainBtn?.textContent).toContain('Get Context')
    expect(chevronBtn).not.toBeNull()
    expect(menu).toBeNull()
  })

  it('clicking main button copies text prompt directly without opening menu', async () => {
    const onCopied = vi.fn()
    act(() => {
      root!.render(<GetContextDropdown contextData={mockContext} onCopied={onCopied} />)
    })

    const mainBtn = container?.querySelector('[data-testid="get-context-main-btn"]') as HTMLButtonElement
    expect(mainBtn).not.toBeNull()

    await act(async () => {
      mainBtn.click()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const written = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(written).toContain('Please explain the correct answer to this multiple choice question:')
    expect(written).toContain('QUESTION:\nFind the resonant frequency')
    expect(onCopied).toHaveBeenCalledWith('text', expect.stringContaining('Context copied'))
    expect(container?.querySelector('[data-testid="get-context-menu"]')).toBeNull()
  })

  it('clicking chevron opens dropdown menu with text and visual options', () => {
    act(() => {
      root!.render(<GetContextDropdown contextData={mockContext} />)
    })

    const chevronBtn = container?.querySelector('[data-testid="get-context-chevron-btn"]') as HTMLButtonElement
    expect(chevronBtn).not.toBeNull()

    act(() => {
      chevronBtn.click()
    })

    const menu = container?.querySelector('[data-testid="get-context-menu"]')
    const optionText = container?.querySelector('[data-testid="get-context-option-text"]')
    const optionVisual = container?.querySelector('[data-testid="get-context-option-visual"]')

    expect(menu).not.toBeNull()
    expect(optionText).not.toBeNull()
    expect(optionVisual).not.toBeNull()
  })

  it('selecting visual option copies visual breakdown prompt and closes menu', async () => {
    const onCopied = vi.fn()
    act(() => {
      root!.render(<GetContextDropdown contextData={mockContext} onCopied={onCopied} />)
    })

    // Open menu
    const chevronBtn = container?.querySelector('[data-testid="get-context-chevron-btn"]') as HTMLButtonElement
    act(() => {
      chevronBtn.click()
    })

    const optionVisual = container?.querySelector('[data-testid="get-context-option-visual"]') as HTMLButtonElement
    expect(optionVisual).not.toBeNull()

    // Click visual option
    await act(async () => {
      optionVisual.click()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const written = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(written).toContain('Please provide a comprehensive visual breakdown and technical diagram')
    expect(written).toContain('1. 🧠 MENTAL MODEL & VISUAL INTUITION')
    expect(written).toContain('2. 📐 TECHNICAL DIAGRAM / SCHEMATIC CODE')
    expect(onCopied).toHaveBeenCalledWith('visual', expect.stringContaining('Visual prompt copied'))
    expect(container?.querySelector('[data-testid="get-context-menu"]')).toBeNull()
  })

  it('closes dropdown when Escape key is pressed', () => {
    act(() => {
      root!.render(<GetContextDropdown contextData={mockContext} />)
    })

    const chevronBtn = container?.querySelector('[data-testid="get-context-chevron-btn"]') as HTMLButtonElement
    act(() => {
      chevronBtn.click()
    })
    expect(container?.querySelector('[data-testid="get-context-menu"]')).not.toBeNull()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(container?.querySelector('[data-testid="get-context-menu"]')).toBeNull()
  })
})
