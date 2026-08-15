import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'left', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);

  const GAP = 10;

  const recalc = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    if (position === 'bottom') {
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2;
    } else if (position === 'top') {
      top = rect.top - GAP;
      left = rect.left + rect.width / 2;
    } else if (position === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + GAP;
    } else {
      // left
      top = rect.top + rect.height / 2;
      left = rect.left - GAP;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    recalc();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Translate based on position so tooltip box is centred/aligned correctly
  const getTransformStyle = () => {
    if (position === 'bottom') return 'translate(-50%, 0)';
    if (position === 'top')    return 'translate(-50%, -100%)';
    if (position === 'right')  return 'translate(0, -50%)';
    return 'translate(-100%, -50%)'; // left
  };

  // Framer-motion initial/exit offset (small nudge in the approach direction)
  const getOffset = () => {
    if (position === 'bottom') return { y: -6 };
    if (position === 'top')    return { y: 6 };
    if (position === 'right')  return { x: -6 };
    return { x: 6 }; // left
  };

  const offset = getOffset();

  const tooltipNode = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, ...offset }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, ...offset }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: getTransformStyle(),
            zIndex: 99999,
            pointerEvents: 'none',
          }}
          className="px-3 py-2 bg-[#0D0D0D] border border-[#00FF41] rounded shadow-[0_0_15px_rgba(0,255,65,0.35)] w-max max-w-[220px] text-center"
        >
          <p className="text-[#00FF41] text-[10px] font-['Rajdhani'] font-bold tracking-widest leading-tight uppercase whitespace-nowrap">
            {content}
          </p>
          {/* Arrow */}
          {position === 'left' && (
            <>
              <div className="absolute left-[100%] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-[#00FF41]" />
              <div className="absolute left-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px] border-l-[#0D0D0D]" />
            </>
          )}
          {position === 'right' && (
            <>
              <div className="absolute right-[100%] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-[#00FF41]" />
              <div className="absolute right-[calc(100%-1px)] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#0D0D0D]" />
            </>
          )}
          {position === 'top' && (
            <>
              <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#00FF41]" />
              <div className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#0D0D0D]" />
            </>
          )}
          {position === 'bottom' && (
            <>
              <div className="absolute bottom-[100%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#00FF41]" />
              <div className="absolute bottom-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-[#0D0D0D]" />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={anchorRef}
      className={`relative flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {createPortal(tooltipNode, document.body)}
    </div>
  );
};
