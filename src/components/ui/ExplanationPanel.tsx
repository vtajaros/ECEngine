import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getExplanation } from '../../services/explain.service';
import { renderMath } from '../../lib/latex';

function renderMarkdownBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export interface ExplanationPanelProps {
  question: string;
  choices: string[];
  answerIndex: number;
  onClose: () => void;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  question,
  choices,
  answerIndex,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ status?: number; detail?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchExplanation() {
      setLoading(true);
      setErrorType(null);
      setErrorDetails(null);

      try {
        const text = await getExplanation({ question, choices, correctAnswerIndex: answerIndex });
        if (isMounted) {
          setExplanation(text);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorType(err.message || 'API_ERROR');
          setErrorDetails({ status: err.status, detail: err.detail });
          setLoading(false);
        }
      }
    }

    fetchExplanation();

    return () => {
      isMounted = false;
    };
  }, [question, choices, answerIndex]);

  return (
    <div className="bg-[#111111] border-t-2 border-t-[rgba(0,255,65,0.2)] px-[20px] py-[16px] relative mt-4 w-full animate-slide-down shadow-lg rounded-b-lg">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-text-muted hover:text-accent transition-colors"
        aria-label="Close Explanation"
      >
        <X size={18} />
      </button>

      <h4 className="font-['Orbitron'] text-[0.75rem] font-bold text-accent tracking-widest uppercase mb-3 flex items-center">
        ⚡ AI EXPLANATION
      </h4>

      <div className="font-sans text-[0.875rem] text-text-primary leading-[1.6]">
        {loading && (
          <div className="flex items-center text-text-muted font-mono">
            Generating explanation
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
                dangerouslySetInnerHTML={{ __html: renderMath(renderMarkdownBold(paragraph.trim())) }}
              />
            ))}
          </div>
        )}




        {!loading && errorType && (
          <div className="text-danger">
            {errorType === 'NO_KEY' && (
              <p>
                Add your Groq API key in Settings to enable AI explanations.{' '}
                <Link to="/settings" className="text-accent underline hover:text-white transition-colors ml-1">
                  Go to Settings
                </Link>
              </p>
            )}
            {errorType === 'INVALID_KEY' && (
              <p>Invalid API key. Please check your credentials in Settings.</p>
            )}
            {errorType === 'RATE_LIMITED' && (
              <p>Groq is currently busy. Try again in a moment.</p>
            )}
            {(!['NO_KEY', 'INVALID_KEY', 'RATE_LIMITED'].includes(errorType)) && (
              <div className="space-y-1">
                {errorDetails?.status === 503 && <p>Groq service unavailable. Try again later.</p>}
                {errorDetails?.status === 500 && <p>Groq server error. Try again in a moment.</p>}
                {!errorDetails?.status && <p>Network error. Check your connection.</p>}
                {errorDetails?.status && errorDetails.status !== 503 && errorDetails.status !== 500 && <p>Could not generate explanation (Status: {errorDetails.status}).</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
