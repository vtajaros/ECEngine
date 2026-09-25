import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, ChevronDown, FileText, Image as ImageIcon } from 'lucide-react'
import {
  PromptContextData,
  buildTextExplanationPrompt,
  buildVisualBreakdownPrompt,
} from '../../lib/contextPrompts'

export interface GetContextDropdownProps {
  /** The card/question data context used to generate prompts */
  contextData: PromptContextData
  /** Called after copying to clipboard; receives the prompt type ('text' | 'visual') and recommended toast message */
  onCopied?: (type: 'text' | 'visual', message: string) => void
  /** Size variant: 'sm' (compact for review rows) or 'md' (standard for study modes) */
  size?: 'sm' | 'md'
  /** Custom label for the primary button (defaults to 'Get Context') */
  label?: string
  /** Dropdown menu opening direction ('down' | 'up') */
  direction?: 'down' | 'up'
  /** Alignment relative to the button ('left' | 'right' | 'center') */
  align?: 'left' | 'right' | 'center'
  /** Additional CSS class on root container */
  className?: string
  /** Test ID prefix for automation testing */
  testId?: string
}

export const GetContextDropdown: React.FC<GetContextDropdownProps> = ({
  contextData,
  onCopied,
  size = 'md',
  label = 'Get Context',
  direction = 'down',
  align = 'center',
  className = '',
  testId = 'get-context',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Copy handler
  const handleCopy = useCallback(
    (type: 'text' | 'visual') => {
      const text =
        type === 'visual'
          ? buildVisualBreakdownPrompt(contextData)
          : buildTextExplanationPrompt(contextData)

      const toastMsg =
        type === 'visual'
          ? 'Visual prompt copied to clipboard — paste into Gemini, ChatGPT, or Claude'
          : 'Context copied to clipboard — paste into Gemini, ChatGPT, or Claude'

      navigator.clipboard
        .writeText(text)
        .then(() => {
          onCopied?.(type, toastMsg)
          setIsOpen(false)
        })
        .catch(err => {
          console.error('Failed to copy to clipboard:', err)
        })
    },
    [contextData, onCopied]
  )

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const isSmall = size === 'sm'
  const isUp = direction === 'up'
  const menuPlacement = isUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-stretch rounded transition-colors ${
        isSmall
          ? 'bg-surface border border-[rgba(255,255,255,0.2)] hover:border-text-muted'
          : 'bg-[#0D0D0D] border border-[rgba(255,255,255,0.3)] hover:border-text-muted'
      } ${className}`}
      data-testid={testId}
    >
      {/* Primary Action Button (1-Click copies standard text explanation) */}
      <button
        type="button"
        data-testid={`${testId}-main-btn`}
        onClick={e => {
          e.stopPropagation()
          handleCopy('text')
        }}
        className={`flex items-center gap-1.5 text-[#CCCCCC] hover:text-white transition-colors font-['Rajdhani'] font-bold ${
          isSmall
            ? 'px-2.5 py-1 text-xs'
            : 'px-3.5 py-2 text-xs uppercase tracking-widest'
        }`}
        title="1-Click: Copy step-by-step text explanation prompt"
      >
        <Copy size={isSmall ? 12 : 13} />
        <span>{label}</span>
      </button>

      {/* Split Separator */}
      <div
        className={`w-[1px] my-1 ${
          isSmall ? 'bg-[rgba(255,255,255,0.15)]' : 'bg-[rgba(255,255,255,0.2)]'
        }`}
      />

      {/* Dropdown Chevron Toggle */}
      <button
        type="button"
        data-testid={`${testId}-chevron-btn`}
        aria-label="More context options"
        aria-expanded={isOpen}
        onClick={e => {
          e.stopPropagation()
          setIsOpen(prev => !prev)
        }}
        className={`flex items-center justify-center text-[#CCCCCC] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-r transition-colors ${
          isSmall ? 'px-1.5 py-1' : 'px-2 py-2'
        }`}
        title="Choose prompt type (Text explanation vs Visual diagram)"
      >
        <ChevronDown
          size={isSmall ? 12 : 14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : ''}`}
        />
      </button>

      {/* Cyber Dropdown Menu */}
      {isOpen && (
        <div
          data-testid={`${testId}-menu`}
          className={`absolute ${menuPlacement} ${alignClass} z-50 w-72 bg-[#0E0E0E] border border-[rgba(0,255,65,0.35)] rounded-lg shadow-[0_12px_36px_rgba(0,0,0,0.9),0_0_20px_rgba(0,255,65,0.12)] p-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Option 1: Text Explanation */}
          <button
            type="button"
            data-testid={`${testId}-option-text`}
            onClick={e => {
              e.stopPropagation()
              handleCopy('text')
            }}
            className="w-full text-left p-2.5 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors flex items-start gap-2.5 group"
          >
            <div className="p-1.5 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-[#CCCCCC] group-hover:text-white group-hover:border-[rgba(255,255,255,0.3)] transition-colors mt-0.5 shrink-0">
              <FileText size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-['Rajdhani'] font-bold text-xs text-white">
                  Text Explanation
                </span>
                <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[#888]">
                  1-Click
                </span>
              </div>
              <p className="text-[11px] font-['Rajdhani'] text-[#888888] leading-tight mt-0.5">
                Step-by-step reasoning, formula derivation & choice breakdown
              </p>
            </div>
          </button>

          {/* Option 2: Visual & Diagram Breakdown */}
          <button
            type="button"
            data-testid={`${testId}-option-visual`}
            onClick={e => {
              e.stopPropagation()
              handleCopy('visual')
            }}
            className="w-full text-left p-2.5 rounded hover:bg-[rgba(0,255,65,0.08)] transition-colors flex items-start gap-2.5 group border-t border-[rgba(255,255,255,0.06)]"
          >
            <div className="p-1.5 rounded bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.3)] text-accent group-hover:border-accent transition-colors mt-0.5 shrink-0">
              <ImageIcon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-['Rajdhani'] font-bold text-xs text-accent">
                  Visual Breakdown
                </span>
                <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-[rgba(0,255,65,0.15)] text-accent">
                  VISUAL
                </span>
              </div>
              <p className="text-[11px] font-['Rajdhani'] text-[#888888] leading-tight mt-0.5">
                Mental model, renderable diagram code (Mermaid/SVG) & image gen prompt
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
