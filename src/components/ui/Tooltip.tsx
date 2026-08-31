import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export type TooltipPosition = 'left' | 'right' | 'top' | 'bottom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  className?: string;
  tooltipClassName?: string;
}

export interface ComputedTooltipLayout {
  top: number;
  left: number;
  placement: TooltipPosition;
  arrowLeft?: number;
  arrowTop?: number;
}

export function computeTooltipPosition(
  anchorRect: { top: number; bottom: number; left: number; right: number; width: number; height: number },
  tooltipWidth: number,
  tooltipHeight: number,
  preferredPosition: TooltipPosition = 'left',
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1920,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 1080,
  gap: number = 10,
  padding: number = 8
): ComputedTooltipLayout {
  let placement: TooltipPosition = preferredPosition;
  const w = tooltipWidth;
  const h = tooltipHeight;

  // 1. Determine placement (auto-flip if requested position overflows viewport)
  if (preferredPosition === 'top') {
    const spaceAbove = anchorRect.top - gap;
    const spaceBelow = viewportHeight - anchorRect.bottom - gap;
    if (spaceAbove < h + padding && spaceBelow > spaceAbove) {
      placement = 'bottom';
    }
  } else if (preferredPosition === 'bottom') {
    const spaceBelow = viewportHeight - anchorRect.bottom - gap;
    const spaceAbove = anchorRect.top - gap;
    if (spaceBelow < h + padding && spaceAbove > spaceBelow) {
      placement = 'top';
    }
  } else if (preferredPosition === 'left') {
    const spaceLeft = anchorRect.left - gap;
    const spaceRight = viewportWidth - anchorRect.right - gap;
    if (spaceLeft < w + padding && spaceRight > spaceLeft) {
      placement = 'right';
    }
  } else if (preferredPosition === 'right') {
    const spaceRight = viewportWidth - anchorRect.right - gap;
    const spaceLeft = anchorRect.left - gap;
    if (spaceRight < w + padding && spaceLeft > spaceRight) {
      placement = 'left';
    }
  }

  // 2. Compute coordinates and arrow offsets based on resolved placement
  let top = 0;
  let left = 0;
  let arrowLeft: number | undefined;
  let arrowTop: number | undefined;

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;

  if (placement === 'top' || placement === 'bottom') {
    if (placement === 'top') {
      top = anchorRect.top - gap - h;
    } else {
      top = anchorRect.bottom + gap;
    }

    // Clamp top inside viewport
    top = Math.max(padding, Math.min(viewportHeight - padding - h, top));

    // Center horizontally on anchor
    left = anchorCenterX - w / 2;

    // Clamp left inside viewport
    left = Math.max(padding, Math.min(viewportWidth - padding - w, left));

    // Arrow horizontally points to anchor center
    const rawArrowLeft = anchorCenterX - left;
    arrowLeft = Math.max(12, Math.min(w - 12, rawArrowLeft));
  } else {
    // left or right
    if (placement === 'left') {
      left = anchorRect.left - gap - w;
    } else {
      left = anchorRect.right + gap;
    }

    // Clamp left inside viewport
    left = Math.max(padding, Math.min(viewportWidth - padding - w, left));

    // Center vertically on anchor
    top = anchorCenterY - h / 2;

    // Clamp top inside viewport
    top = Math.max(padding, Math.min(viewportHeight - padding - h, top));

    // Arrow vertically points to anchor center
    const rawArrowTop = anchorCenterY - top;
    arrowTop = Math.max(10, Math.min(h - 10, rawArrowTop));
  }

  return { top, left, placement, arrowLeft, arrowTop };
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'left',
  className = '',
  tooltipClassName = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState<ComputedTooltipLayout>(() => ({
    top: 0,
    left: 0,
    placement: position,
  }));
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const GAP = 10;
  const PADDING = 8;

  const updateLayout = () => {
    if (!anchorRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const w = tooltipRect?.width || 100;
    const h = tooltipRect?.height || 30;

    const newLayout = computeTooltipPosition(
      anchorRect,
      w,
      h,
      position,
      window.innerWidth,
      window.innerHeight,
      GAP,
      PADDING
    );
    setLayout(newLayout);
  };

  const handleMouseEnter = () => {
    updateLayout();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleFocus = (e: React.FocusEvent) => {
    try {
      if ((e.target as HTMLElement).matches(':focus-visible')) {
        updateLayout();
        setIsVisible(true);
      }
    } catch {
      // ignore
    }
  };

  const handleClick = () => {
    setIsVisible(false);
  };

  // Adjust exact layout after DOM render before paint
  useLayoutEffect(() => {
    if (isVisible) {
      updateLayout();
    }
  }, [isVisible, content, position]);

  // Framer-motion initial/exit offset
  const getOffset = (plc: TooltipPosition) => {
    if (plc === 'bottom') return { y: -4 };
    if (plc === 'top')    return { y: 4 };
    if (plc === 'right')  return { x: -4 };
    return { x: 4 }; // left
  };

  const offset = getOffset(layout.placement);

  // Dismiss tooltip when window loses focus
  useEffect(() => {
    const handleWindowBlur = () => {
      setIsVisible(false);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Update coords on scroll/resize and ensure mouse is still inside target while visible
  useEffect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      updateLayout();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!isInside) {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isVisible, position]);

  const tooltipNode = (
    <AnimatePresence>
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: layout.top,
            left: layout.left,
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, ...offset }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, ...offset }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`px-3 py-2 bg-[#0D0D0D] border border-[#00FF41] rounded shadow-[0_0_15px_rgba(0,255,65,0.35)] w-max max-w-[320px] text-center relative ${tooltipClassName}`}
          >
            {typeof content === 'string' ? (
              <p className="text-[#00FF41] text-[10px] font-['Rajdhani'] font-bold tracking-widest leading-tight uppercase whitespace-normal break-words">
                {content}
              </p>
            ) : (
              content
            )}
            {/* Arrow */}
            {layout.placement === 'left' && (
              <>
                <div
                  className="absolute left-[100%] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-[#00FF41]"
                  style={{ top: layout.arrowTop ?? '50%', transform: 'translateY(-50%)' }}
                />
                <div
                  className="absolute left-[calc(100%-1px)] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px] border-l-[#0D0D0D]"
                  style={{ top: layout.arrowTop ?? '50%', transform: 'translateY(-50%)' }}
                />
              </>
            )}
            {layout.placement === 'right' && (
              <>
                <div
                  className="absolute right-[100%] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-[#00FF41]"
                  style={{ top: layout.arrowTop ?? '50%', transform: 'translateY(-50%)' }}
                />
                <div
                  className="absolute right-[calc(100%-1px)] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#0D0D0D]"
                  style={{ top: layout.arrowTop ?? '50%', transform: 'translateY(-50%)' }}
                />
              </>
            )}
            {layout.placement === 'top' && (
              <>
                <div
                  className="absolute top-[100%] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#00FF41]"
                  style={{ left: layout.arrowLeft ?? '50%', transform: 'translateX(-50%)' }}
                />
                <div
                  className="absolute top-[calc(100%-1px)] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#0D0D0D]"
                  style={{ left: layout.arrowLeft ?? '50%', transform: 'translateX(-50%)' }}
                />
              </>
            )}
            {layout.placement === 'bottom' && (
              <>
                <div
                  className="absolute bottom-[100%] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#00FF41]"
                  style={{ left: layout.arrowLeft ?? '50%', transform: 'translateX(-50%)' }}
                />
                <div
                  className="absolute bottom-[calc(100%-1px)] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-[#0D0D0D]"
                  style={{ left: layout.arrowLeft ?? '50%', transform: 'translateX(-50%)' }}
                />
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={anchorRef}
      className={`relative flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleMouseLeave}
      onClick={handleClick}
      onPointerDown={handleClick}
    >
      {children}
      {createPortal(tooltipNode, document.body)}
    </div>
  );
};

