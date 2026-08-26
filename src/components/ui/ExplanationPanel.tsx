import React, { useState, useEffect } from 'react'
import { X, Cpu, Copy, Check, Terminal, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getExplanation } from '../../services/explain.service'
import { renderMath } from '../../lib/latex'

export interface ExplanationPanelProps {
  question: string
  choices: string[]
  answerIndex: number
  onClose?: () => void
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  question,
  choices,
  answerIndex,
  onClose: _onClose,
}) => {
  const [loading, setLoading] = useState(true)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<{ status?: number; detail?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchExplanation() {
      setLoading(true)
      setErrorType(null)
      setErrorDetails(null)

      try {
        const text = await getExplanation({ question, choices, correctAnswerIndex: answerIndex })
        if (isMounted) {
          setExplanation(text)
          setLoading(false)
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorType(err.message || 'API_ERROR')
          setErrorDetails({ status: err.status, detail: err.detail })
          setLoading(false)
        }
      }
    }

    fetchExplanation()

    return () => {
      isMounted = false
    }
  }, [question, choices, answerIndex])

  const handleCopy = () => {
    if (!explanation) return
    navigator.clipboard.writeText(explanation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative mt-4 w-full rounded-xl overflow-hidden border border-[#232730] bg-[#0c0d12] shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_15px_rgba(0,255,65,0.05)] animate-slide-down">
      {/* Code Block Terminal Header Bar */}
      <div className="bg-[#12141a] border-b border-[#1f232c] px-4 py-2.5 flex items-center justify-between select-none">
        {/* AI Model Badge / File Tab */}
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-accent" />
          <span className="font-['Orbitron'] font-bold text-accent text-[11px] tracking-wider uppercase">
            GPT-OSS-120B
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted px-2 py-0.5 rounded bg-[#181b22] border border-[#262b35] font-['JetBrains_Mono',monospace]">
            <Sparkles className="w-2.5 h-2.5 text-accent/70" /> ai_explanation.md
          </span>
        </div>

        {/* Actions (Copy) */}
        <div className="flex items-center gap-1.5">
          {!loading && explanation && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-text-muted hover:text-white hover:bg-[#1a1d24] border border-transparent hover:border-[#2a2f3d] transition-all font-['JetBrains_Mono',monospace] text-xs cursor-pointer"
              title="Copy explanation"
              aria-label="Copy explanation"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-bold text-accent">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px] text-text-muted hover:text-white">COPY</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code Block Content Body with JetBrains Mono */}
      <div className="p-4 sm:p-5 font-['JetBrains_Mono',monospace] text-[13px] sm:text-[13.5px] text-[#d4d4d4] leading-[1.75] selection:bg-accent/20 selection:text-white">
        {loading && (
          <div className="flex items-center gap-2.5 text-text-muted py-2">
            <Terminal className="w-4 h-4 text-accent animate-pulse" />
            <span className="text-[#a0a0a0]">Generating AI breakdown</span>
            <span className="flex gap-1 ml-0.5">
              <span className="animate-razer-pulse text-accent" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-razer-pulse text-accent" style={{ animationDelay: '300ms' }}>.</span>
              <span className="animate-razer-pulse text-accent" style={{ animationDelay: '600ms' }}>.</span>
            </span>
          </div>
        )}

        {!loading && explanation && (
          <div className="space-y-4">
            {(() => {
              const formattedExplanation = /^\s*(\*\*Explanation:\*\*|\*\*Explanation\*\*|Explanation:)/i.test(explanation.trim())
                ? explanation.trim()
                : `**Explanation:** ${explanation.trim()}`

              return formattedExplanation
                .split(/\n\s*\n/)
                .filter(p => p.trim())
                .map((paragraph, idx) => {
                  const isCallout = /^\s*(\*\*Key Formula:\*\*|Key Formula:|\*\*Memory Tip:\*\*|Memory Tip:)/i.test(paragraph)

                  return (
                    <div
                      key={idx}
                      className={`relative transition-colors ${
                        isCallout
                          ? 'border-l-2 border-accent pl-3.5 py-1.5 my-2 bg-[#0c1a14]/40 rounded-r'
                          : 'pl-1'
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderMath(paragraph.trim()) }}
                    />
                  )
                })
            })()}
          </div>
        )}

        {!loading && errorType && (
          <div className="border-l-2 border-danger pl-3.5 py-2 bg-danger/5 rounded-r text-danger text-xs space-y-2">
            {errorType === 'NO_KEY' && (
              <p>
                Add your Groq API key in Settings to enable AI explanations.{' '}
                <Link to="/settings" className="text-accent underline hover:text-white transition-colors ml-1 font-bold">
                  Go to Settings →
                </Link>
              </p>
            )}
            {errorType === 'INVALID_KEY' && (
              <p>Invalid API key. Please check your credentials in Settings.</p>
            )}
            {errorType === 'RATE_LIMITED' && (
              <p>Groq is currently busy. Try again in a moment.</p>
            )}
            {!['NO_KEY', 'INVALID_KEY', 'RATE_LIMITED'].includes(errorType) && (
              <div className="space-y-1">
                {errorDetails?.status === 503 && <p>Groq service unavailable. Try again later.</p>}
                {errorDetails?.status === 500 && <p>Groq server error. Try again in a moment.</p>}
                {!errorDetails?.status && <p>Network error. Check your connection.</p>}
                {errorDetails?.status && errorDetails.status !== 503 && errorDetails.status !== 500 && (
                  <p>Could not generate explanation (Status: {errorDetails.status}).</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
