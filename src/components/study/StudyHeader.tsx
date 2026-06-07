import React from 'react';
import { Share2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudyHeaderProps {
  topicName: string;
  currentCardIndex: number;
  totalCards: number;
  onBackClick: () => void;
}

export const StudyHeader: React.FC<StudyHeaderProps> = ({ 
  topicName, 
  currentCardIndex, 
  totalCards, 
  onBackClick 
}) => {
  const progress = totalCards > 0 ? (currentCardIndex / totalCards) * 100 : 0;

  return (
    <>
      <div className="flex items-center justify-between w-full mb-6 z-40 relative">
        <div className="flex flex-col gap-1">
          <button
            onClick={onBackClick}
            className="flex items-center gap-2 text-[var(--accent-primary)] font-['Rajdhani'] uppercase tracking-widest font-bold text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Exit Session
          </button>
          <h2 className="text-xl font-['Rajdhani'] font-bold text-white uppercase tracking-widest mt-2">{topicName}</h2>
          <span className="text-[#888] font-['IBM_Plex_Mono'] text-sm tracking-wider uppercase">
            Card {Math.min(currentCardIndex + 1, totalCards)} / {totalCards}
          </span>
        </div>
      </div>
      
      {/* Global Progress Bar */}
      {currentCardIndex < totalCards && (
        <div className="fixed top-0 left-0 w-full bg-[var(--bg-secondary)] h-1.5 z-50 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
          <motion.div
            className="bg-[var(--accent-primary)] h-full shadow-[0_0_12px_rgba(0,255,65,0.8)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </>
  );
};
