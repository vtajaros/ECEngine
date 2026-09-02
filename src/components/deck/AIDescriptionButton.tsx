import React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

interface AIDescriptionButtonProps {
  onClick: () => void
  isGenerating: boolean
  disabled?: boolean
  className?: string
}

export const AIDescriptionButton: React.FC<AIDescriptionButtonProps> = ({
  onClick,
  isGenerating,
  disabled = false,
  className = '',
}) => {
  return (
    <Tooltip content="Generate AI summary from deck content" position="top">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isGenerating}
        aria-label="Generate AI summary from deck content"
        className={`w-7 h-7 flex items-center justify-center rounded transition-all select-none ${
          isGenerating
            ? 'bg-accent/20 border border-accent text-accent cursor-wait animate-pulse'
            : disabled
              ? 'bg-surface-2 border border-border-base text-text-muted/40 cursor-not-allowed opacity-40'
              : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 hover:border-accent active:scale-95 cursor-pointer shadow-sm'
        } ${className}`}
      >
        {isGenerating ? (
          <Loader2 size={13} className="animate-spin text-accent" />
        ) : (
          <Sparkles size={13} className="text-accent shrink-0" />
        )}
      </button>
    </Tooltip>
  )
}

