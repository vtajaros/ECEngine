// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WindowControls } from './WindowControls'

describe('WindowControls', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  let mockMinimize: any
  let mockMaximize: any
  let mockClose: any
  let mockIsMaximized: any
  let maximizedListener: ((isMax: boolean) => void) | null = null

  beforeEach(() => {
    mockMinimize = vi.fn()
    mockMaximize = vi.fn()
    mockClose = vi.fn()
    mockIsMaximized = vi.fn().mockResolvedValue(false)
    maximizedListener = null

    ;(window as any).electron = {
      windowControls: {
        minimize: mockMinimize,
        maximize: mockMaximize,
        close: mockClose,
        isMaximized: mockIsMaximized,
        onMaximizedChanged: vi.fn((callback) => {
          maximizedListener = callback
          return () => {
            maximizedListener = null
          }
        }),
      },
    }

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount()
      })
      container.remove()
    }
    vi.restoreAllMocks()
  })

  it('renders native window controls with 46px width and correct accessible titles', async () => {
    await act(async () => {
      root!.render(<WindowControls />)
    })

    const buttons = container?.querySelectorAll('button')
    expect(buttons?.length).toBe(3)

    const minBtn = container?.querySelector('button[title="Minimize"]')
    const maxBtn = container?.querySelector('button[title="Maximize"]')
    const closeBtn = container?.querySelector('button[title="Close"]')

    expect(minBtn).toBeDefined()
    expect(maxBtn).toBeDefined()
    expect(closeBtn).toBeDefined()

    expect(minBtn?.className).toContain('w-[46px]')
    expect(maxBtn?.className).toContain('w-[46px]')
    expect(closeBtn?.className).toContain('w-[46px]')
    expect(closeBtn?.className).toContain('hover:bg-[#e81123]')
  })

  it('handles minimize, maximize, and close clicks', async () => {
    await act(async () => {
      root!.render(<WindowControls />)
    })

    const minBtn = container?.querySelector('button[title="Minimize"]') as HTMLButtonElement
    const maxBtn = container?.querySelector('button[title="Maximize"]') as HTMLButtonElement
    const closeBtn = container?.querySelector('button[title="Close"]') as HTMLButtonElement

    act(() => {
      minBtn.click()
    })
    expect(mockMinimize).toHaveBeenCalledTimes(1)

    act(() => {
      maxBtn.click()
    })
    expect(mockMaximize).toHaveBeenCalledTimes(1)
    // Toggled to Restore
    expect(maxBtn.getAttribute('title')).toBe('Restore')

    act(() => {
      closeBtn.click()
    })
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('updates maximize/restore icon when window is maximized via onMaximizedChanged', async () => {
    await act(async () => {
      root!.render(<WindowControls />)
    })

    expect(container?.querySelector('button[title="Maximize"]')).toBeDefined()

    // Trigger maximize event from main process
    await act(async () => {
      if (maximizedListener) {
        maximizedListener(true)
      }
    })

    expect(container?.querySelector('button[title="Restore"]')).toBeDefined()

    // Trigger unmaximize event from main process
    await act(async () => {
      if (maximizedListener) {
        maximizedListener(false)
      }
    })

    expect(container?.querySelector('button[title="Maximize"]')).toBeDefined()
  })
})
