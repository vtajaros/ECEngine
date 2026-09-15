import React from 'react';
import { Target, CheckCircle, Flame, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface StudySessionStatsProps {
  correctCount: number;
  totalReviewed: number;
  countdownSeconds?: number;
  streakDays?: number;
}

export const StudySessionStats: React.FC<StudySessionStatsProps> = ({ 
  correctCount,
  totalReviewed,
  countdownSeconds,
  streakDays = 0
}) => {
  const accuracy = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0;
  
  const formatTime = (totalSecs?: number) => {
    if (totalSecs === undefined || totalSecs < 0) return '--:--';
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-wrap gap-4 items-center mb-6 z-40 relative">
      {/* Accuracy Tag */}
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] px-3 py-1.5 rounded-lg">
        <Target size={14} className="text-[#00BFFF]" />
        <span className="text-xs font-['JetBrains_Mono'] text-[#aaa] uppercase tracking-wider">
          Accuracy
        </span>
        <span className="text-sm font-['Rajdhani'] font-bold text-white tracking-widest">
          {accuracy}%
        </span>
      </div>

      {/* Correct / Total Tag */}
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] px-3 py-1.5 rounded-lg">
        <CheckCircle size={14} className="text-accent" />
        <span className="text-xs font-['JetBrains_Mono'] text-[#aaa] uppercase tracking-wider">
          Correct
        </span>
        <span className="text-sm font-['Rajdhani'] font-bold text-white tracking-widest">
          {correctCount} / {totalReviewed}
        </span>
      </div>

      {/* Streak Tag */}
      {streakDays > 0 && (
        <div className="flex items-center gap-2 bg-[rgba(255,107,0,0.1)] border border-[rgba(255,107,0,0.3)] px-3 py-1.5 rounded-lg">
          <Flame size={14} className="text-[#FF6B00]" />
          <span className="text-xs font-['JetBrains_Mono'] text-[#FF6B00] uppercase tracking-wider">
            Streak
          </span>
          <span className="text-sm font-['Rajdhani'] font-bold text-[#FF6B00] tracking-widest">
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
          </span>
        </div>
      )}

      {/* Countdown Timer */}
      {countdownSeconds !== undefined && (
        <div className="flex items-center gap-2 bg-[#111] border border-[#333] px-3 py-1.5 rounded-lg ml-auto">
          <Clock size={14} className="text-[#A855F7]" />
          <span className="text-sm font-['JetBrains_Mono'] font-bold text-white tracking-widest">
            {formatTime(countdownSeconds)}
          </span>
        </div>
      )}
    </div>
  );
};
