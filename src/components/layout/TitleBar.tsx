import { Zap, Minus, Square, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

interface TitleBarProps {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isCollapsed, onToggleSidebar }) => {
  const controls = (window as any).electron?.windowControls
  const navigate = useNavigate()
  const location = useLocation()

  const routeLabels: Record<string, string> = {
    '/':           'Dashboard',
    '/study':      'LooksFam',
    '/flashcards': 'Flashcards',
    '/formulas':   'Formulas',
    '/topics':     'EELE ToS',
    '/checklist':  'Checklist',
    '/add-decks':  'Add Decks',
    '/settings':   'Settings',
  }

  const pageTitle = routeLabels[location.pathname] ?? 'ECEngine'

  return (
    <div className="w-full h-8 bg-surface text-gray-400 flex items-center justify-between select-none [-webkit-app-region:drag] relative shrink-0 px-0">
      {/* Left Side: Navigation (Anchored to Sidebar Width) */}
      <div className="flex items-center gap-1 ml-2 [-webkit-app-region:no-drag]">
        <button
          onClick={() => navigate(-1)}
          className="p-1 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
          title="Go Back"
        >
          <ChevronLeft size={16} />
        </button>
        <button className="p-1 text-[#333] cursor-not-allowed rounded">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Centered Brand */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <img src="/ecengine_icon.png" alt="Logo" className="w-4 h-4 object-contain" />
        <span className="font-rajdhani font-bold tracking-wider text-white text-xs">
          <span className="text-accent">ECE</span>ngine
          <span className="text-gray-400 font-normal"> · </span>
          <span className="text-white">{pageTitle}</span>
        </span>
      </div>

      {/* Right Side: Window Controls */}
      <div className="flex h-full ml-auto [-webkit-app-region:no-drag]">
        <button
          onClick={() => controls?.minimize()}
          className="px-3 h-full hover:bg-[#333] transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => controls?.maximize()}
          className="px-3 h-full hover:bg-[#333] transition-colors flex items-center justify-center"
          title="Maximize"
        >
          <Square size={10} />
        </button>
        <button
          onClick={() => controls?.close()}
          className="px-3 h-full hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
