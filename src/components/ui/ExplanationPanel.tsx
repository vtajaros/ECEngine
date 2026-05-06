import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getExplanation } from '../../services/explain.service';

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

  useEffect(() => {
    let isMounted = true;

    async function fetchExplanation() {
      setLoading(true);
      setErrorType(null);
      
      try {
        const text = await getExplanation({ question, choices, correctAnswerIndex: answerIndex });
        if (isMounted) {
          setExplanation(text);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorType(err.message || 'API_ERROR');
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
        className="absolute top-4 right-4 text-[#888888] hover:text-[#00FF41] transition-colors"
        aria-label="Close Explanation"
      >
        <X size={18} />
      </button>

      <h4 className="font-['Orbitron'] text-[0.75rem] font-bold text-[#00FF41] tracking-widest uppercase mb-3 flex items-center">
        ⚡ EXPLANATION
      </h4>

      <div className="font-['IBM_Plex_Mono'] text-[0.85rem] text-[#E8E8E8] leading-relaxed">
        {loading && (
          <div className="flex items-center text-[#888888]">
            Generating explanation
            <span className="flex ml-1">
              <span className="animate-razer-pulse" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-razer-pulse" style={{ animationDelay: '300ms' }}>.</span>
              <span className="animate-razer-pulse" style={{ animationDelay: '600ms' }}>.</span>
            </span>
          </div>
        )}

        {!loading && explanation && (
          <div className="whitespace-pre-wrap">{explanation}</div>
        )}

        {!loading && errorType && (
          <div className="text-[#FF3333]">
            {errorType === 'NO_KEY' && (
              <p>
                Add your Groq API key in Settings to enable AI explanations.{' '}
                <Link to="/settings" className="text-[#00FF41] underline hover:text-white transition-colors ml-1">
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
              <p>Could not generate explanation. Check your connection or Settings.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
