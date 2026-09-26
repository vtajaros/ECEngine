import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2 } from 'lucide-react'

interface OperationProgressModalProps {
  isOpen: boolean
  title: string
  description: string
  icon?: React.ReactNode
  accentColor?: string
}

export const OperationProgressModal: React.FC<OperationProgressModalProps> = ({
  isOpen,
  title,
  description,
  icon,
  accentColor = '#00FF41',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden"
          >
            {/* Top Glowing Accent Line */}
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                boxShadow: `0 0 12px ${accentColor}`,
              }}
            />

            <div className="p-8 flex flex-col items-center text-center">
              {/* Animated Graphic Centerpiece */}
              <div className="relative mb-6 flex items-center justify-center">
                {/* Rotating Outer Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                  className="w-20 h-20 rounded-full border-2 border-dashed"
                  style={{
                    borderColor: `${accentColor}55`,
                  }}
                />

                {/* Inner Glowing Ring */}
                <div
                  className="absolute w-14 h-14 rounded-full flex items-center justify-center border shadow-lg"
                  style={{
                    background: `${accentColor}12`,
                    borderColor: `${accentColor}40`,
                    boxShadow: `0 0 24px ${accentColor}25`,
                  }}
                >
                  {icon ? (
                    icon
                  ) : (
                    <motion.div
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    >
                      <Sparkles size={24} style={{ color: accentColor }} />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-['Orbitron'] font-bold text-white mb-2 tracking-wider uppercase">
                {title}
              </h3>

              {/* Description */}
              <p className="text-xs font-['JetBrains_Mono'] text-text-muted mb-6 leading-relaxed max-w-sm">
                {description}
              </p>

              {/* Animated Progress Bar */}
              <div className="w-full bg-[#181818] border border-[#2a2a2a] rounded-full h-2 overflow-hidden relative mb-4">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                    boxShadow: `0 0 10px ${accentColor}`,
                  }}
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.6,
                    ease: 'easeInOut',
                  }}
                />
              </div>

              {/* Status Pill */}
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-['JetBrains_Mono'] font-bold uppercase tracking-wider"
                style={{
                  background: `${accentColor}10`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                <Loader2 size={12} className="animate-spin" />
                <span>Processing • Please wait</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
