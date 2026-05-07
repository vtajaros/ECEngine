import { Zap, Minus, Square, X, Menu, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const TitleBar: React.FC = () => {
  const controls = (window as any).electron?.windowControls
  const navigate = useNavigate()

  return (
    <div className="w-full h-10 bg-[#1A1A1A] text-gray-400 flex items-center select-none border-b border-[#222] [-webkit-app-region:drag] relative shrink-0">
      {/* Left Side: Navigation & Menu */}
      <div className="flex items-center gap-1 ml-2 [-webkit-app-region:no-drag]">
        {/* Hamburger Menu */}
        <button className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors">
          <Menu size={16} />
        </button>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-[#333] mx-1"></div>

        {/* Navigation Arrows */}
        <button 
          onClick={() => navigate(-1)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
          title="Go Back"
        >
          <ChevronLeft size={18} />
        </button>
        <button className="p-1.5 text-[#333] cursor-not-allowed rounded">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Centered Brand */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <img src="/ECEngine_orig.png" alt="Logo" className="w-5 h-5 object-contain" />
        <span className="font-rajdhani font-bold tracking-wider text-white">ECEngine</span>
      </div>

      {/* Right Side: Window Controls */}
      <div className="flex h-full ml-auto [-webkit-app-region:no-drag]">
        <button
          onClick={() => controls?.minimize()}
          className="px-4 h-full hover:bg-[#333] transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => controls?.maximize()}
          className="px-4 h-full hover:bg-[#333] transition-colors flex items-center justify-center"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => controls?.close()}
          className="px-4 h-full hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
