import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'left' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const isLeft = position === 'left';

  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: isLeft ? -10 : 10, y: '-50%', scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: isLeft ? -10 : 10, y: '-50%', scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute ${isLeft ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'} top-1/2 mb-0 px-3 py-2 bg-engine-black border border-accent rounded shadow-[0_0_15px_rgba(0,255,65,0.3)] z-[999] pointer-events-none w-max max-w-[200px] text-center`}
          >
            <p className="text-accent text-[10px] font-['Rajdhani'] font-bold tracking-widest leading-tight uppercase">
              {content}
            </p>
            {/* Arrow */}
            {isLeft ? (
              <>
                <div className="absolute left-[100%] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-[#00FF41]" />
                <div className="absolute left-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px] border-l-[#0D0D0D]" />
              </>
            ) : (
              <>
                <div className="absolute right-[100%] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-[#00FF41]" />
                <div className="absolute right-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#0D0D0D]" />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
