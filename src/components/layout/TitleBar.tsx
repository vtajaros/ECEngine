import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { WindowControls } from './WindowControls'

interface TitleBarProps {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isCollapsed, onToggleSidebar }) => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  
  useEffect(() => {
    if (window.electron?.zoom) {
      setZoomLevel(window.electron.zoom.get())
      if (window.electron.zoom.getZoomFactor) {
        window.electron.zoom.getZoomFactor().then(pct => {
          if (typeof pct === 'number' && pct > 0) setZoomLevel(pct)
        }).catch(() => {})
      }
      const cleanup = window.electron.zoom.onChanged((pct) => {
        setZoomLevel(pct)
      })
      return cleanup
    }
  }, [])

  const routeLabels: Record<string, string> = {
    '/':           'Dashboard',
    '/study':      'LooksFam',
    '/gauntlet':   'Gauntlet',
    '/lab':        'Data Analytics',
    '/flashcards': 'Flashcards',
    '/formulas':   'Formulas',
    '/topics':     'EELE ToS',
    '/checklist':  'Checklist',
    '/add-decks':  'Add Decks',
    '/settings':   'Settings',
  }

  const pageTitle = routeLabels[location.pathname] ?? 'ECEngine'

  return (
    <div 
      className="w-full h-8 bg-surface text-gray-400 flex items-center justify-between select-none [-webkit-app-region:drag] relative z-20 shrink-0 px-0"
      style={{ zoom: 100 / zoomLevel }}
    >
      {/* Left Side: Navigation (Anchored to Sidebar Width) */}
      <div className="flex items-center gap-1 ml-2 [-webkit-app-region:no-drag]">
        <Tooltip content="Go Back" position="bottom">
          <button
            onClick={() => navigate(-1)}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        </Tooltip>
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
      <WindowControls />
    </div>
  )
}
