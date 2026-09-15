import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home,
  Brain,
  BookOpen,
  Sigma,
  PlusCircle,
  Settings,
  Layers,
  ClipboardList,
  FlaskConical,
} from 'lucide-react'
import { TitleBar } from './TitleBar'
import { ZoomIndicator } from '../ui/ZoomIndicator'
import { Tooltip } from '../ui/Tooltip'
import { dbService } from '../../services/db.service'

type NavItem = {
  to: string
  label: string
  icon: React.ElementType
}

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('ecengine:sidebar-collapsed') === 'true'
  )
  const [showFormulaBank, setShowFormulaBank] = useState(() =>
    localStorage.getItem('ecengine:show-formula-bank') === 'true'
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (window.electron?.windowControls?.onFullscreenChanged) {
      return window.electron.windowControls.onFullscreenChanged(setIsFullscreen)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setShowFormulaBank(localStorage.getItem('ecengine:show-formula-bank') === 'true')
    }
    window.addEventListener('storage', handler)
    window.addEventListener('ecengine:settings-changed', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('ecengine:settings-changed', handler)
    }
  }, [])

  useEffect(() => {
    let lastStepTime = 0
    const THROTTLE_MS = 150

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()

      const now = Date.now()
      if (now - lastStepTime < THROTTLE_MS) return
      lastStepTime = now

      window.electron.zoom.step(e.deltaY < 0 ? 1 : -1)
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/study', label: 'LooksFam', icon: Brain },
    { to: '/flashcards', label: 'Flashcards', icon: Layers },
    { to: '/formulas', label: 'Formulas', icon: Sigma },
    ...(showFormulaBank ? [{ to: '/formula-bank', label: 'Formula Bank', icon: FlaskConical }] : []),
    { to: '/topics', label: 'EELE ToS', icon: BookOpen },
    { to: '/checklist', label: 'Checklist', icon: ClipboardList },
    { to: '/add-decks', label: 'Add Decks', icon: PlusCircle },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-engine-black text-[var(--text-primary)] font-['JetBrains_Mono'] ${isFullscreen ? '' : 'rounded-xl border border-[#333]'}`}>
      {!isFullscreen && (
        <TitleBar
          isCollapsed={isCollapsed}
          onToggleSidebar={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            localStorage.setItem('ecengine:sidebar-collapsed', String(next));
          }}
        />
      )}

      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${isCollapsed ? 'w-16' : 'w-[150px]'
            } h-full bg-surface border-r border-border-base flex flex-col transition-all duration-300 shrink-0`}
        >
          {/* Logo + collapse toggle */}
          <div className={`h-10 w-full shrink-0 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-2'}`}>
            {!isCollapsed && (
              <div className="flex items-center gap-2 pl-1">
                <img
                  src="/ecengine_icon.png"
                  alt="ECEngine"
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.src.includes('resources')) {
                      img.src = 'resources/ecengine_icon.png'
                    }
                  }}
                />
                <span className="font-['Rajdhani'] font-bold tracking-wider text-white text-sm">
                  <span className="text-accent">ECE</span>ngine
                </span>
              </div>
            )}
            <Tooltip
              content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              position="right"
              className={isCollapsed ? 'w-full flex justify-center' : ''}
            >
              <button
                onClick={() => {
                  const next = !isCollapsed;
                  setIsCollapsed(next);
                  localStorage.setItem('ecengine:sidebar-collapsed', String(next));
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-border-base rounded-md text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </Tooltip>
          </div>

          {/* Nav items */}
          <nav className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => (
              <Tooltip key={item.to} content={item.label} position="right" className="w-full">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center h-10 transition-all duration-200 group relative w-full
                    ${isActive
                      ? 'bg-gradient-to-r from-[#00FF41]/10 to-transparent text-white'
                      : 'text-gray-400 hover:bg-border-base hover:text-gray-300'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
                      )}
                      <div className={`${isCollapsed ? 'w-16' : 'w-12'} flex justify-center shrink-0`}>
                        <item.icon size={18} />
                      </div>
                      {!isCollapsed && (
                        <span className="font-['Rajdhani'] text-sm font-medium tracking-wide whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </Tooltip>
            ))}
          </nav>

          {!isCollapsed && (
            <div className="text-[10px] text-gray-400 text-center pb-4 w-full font-rajdhani tracking-widest opacity-60">
              V1.0.0
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#111111]">
          <Outlet />
        </main>
      </div>

      {/* Global overlay — renders above all page content */}
      <ZoomIndicator />
    </div>
  )
}
