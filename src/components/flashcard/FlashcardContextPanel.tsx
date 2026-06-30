import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getFlashcardExplanation } from '../../services/explain.service'
import { renderMath } from '../../lib/latex'


interface FlashcardContextPanelProps {
  term: string
  definition: string
  onClose: () => void
}

export const FlashcardContextPanel: React.FC<FlashcardContextPanelProps> = ({
  term,
  definition,
  onClose,
}) => {
  const [loading, setLoading] = useState(true)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setErrorType(null)
    setExplanation(null)

    getFlashcardExplanation({ term, definition })
      .then((text) => {
        if (isMounted) { setExplanation(text); setLoading(false) }
      })
      .catch((err: any) => {
        if (isMounted) { setErrorType(err.message || 'API_ERROR'); setLoading(false) }
      })

    return () => { isMounted = false }
  }, [term, definition])

  return (
    <div className="bg-[#111111] border-t-2 border-t-[rgba(0,255,65,0.2)] px-5 py-4 relative mt-4 w-full animate-slide-down shadow-lg rounded-b-lg">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-text-muted hover:text-accent transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <h4 className="font-['Orbitron'] text-[0.75rem] font-bold text-accent tracking-widest uppercase mb-3">
        ⚡ AI CONTEXT
      </h4>

      <div className="font-sans text-[0.875rem] text-text-primary leading-[1.6]">
        {loading && (
          <div className="flex items-center text-text-muted font-mono">
            Generating context
            <span className="flex ml-1">
              <span className="animate-razer-pulse" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-razer-pulse" style={{ animationDelay: '300ms' }}>.</span>
              <span className="animate-razer-pulse" style={{ animationDelay: '600ms' }}>.</span>
            </span>
          </div>
        )}

        {!loading && explanation && (
          <div className="space-y-3">
            {explanation.trim().split(/\n\s*\n/).filter(p => p.trim()).map((paragraph, idx) => (
              <div
                key={idx}
                dangerouslySetInnerHTML={{ __html: renderMath(paragraph.trim()) }}
              />
            ))}
          </div>
        )}

        {!loading && errorType && (
          <div className="text-danger">
            {errorType === 'NO_KEY' && (
              <p>
                Add your Groq API key in Settings to enable AI context.{' '}
                <Link to="/settings" className="text-accent underline hover:text-white transition-colors ml-1">
                  Go to Settings
                </Link>
              </p>
            )}
            {errorType === 'RATE_LIMITED' && <p>Groq is busy. Try again in a moment.</p>}
            {!['NO_KEY', 'RATE_LIMITED'].includes(errorType) && <p>Could not generate context. Check your connection.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
