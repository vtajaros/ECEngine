import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300]"
    >
      <div className="bg-[#1C1C1C] border border-[rgba(0,255,65,0.3)] text-text-primary px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_#00FF41]" />
        <span className="text-xs font-['JetBrains_Mono'] tracking-wide">{message}</span>
      </div>
    </motion.div>
  );
};

export default Toast;
