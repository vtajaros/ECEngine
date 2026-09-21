import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home,
  Brain,
  BookOpen,
  Sigma,
  FlaskConical,
  PlusCircle,
  Settings,
  Layers,
  ClipboardList,
  Timer,
} from 'lucide-react'
import { TitleBar } from './TitleBar'
import { ZoomIndicator } from '../ui/ZoomIndicator'
import { Tooltip } from '../ui/Tooltip'
import { dbService } from '../../services/db.service'
import { useLayoutStore } from '../../store/useLayoutStore'
import { GauntletBackdrop } from '../gauntlet/GauntletBackdrop'
import { useGauntletStore } from '../../store/useGauntletStore'

type NavItem = {
  to: string
  label: string
  icon: React.ElementType
}

type BackdropIntensity = 'full' | 'dimmed' | 'subtle' | 'off'

const ROUTE_BACKDROP_INTENSITY: Record<string, BackdropIntensity> = {
  '/': 'full',
  '/gauntlet': 'full', // Dynamically tuned: playing/summary -> 'subtle'
  '/lab': 'subtle',
  '/formulas': 'subtle',
  '/study': 'dimmed',
  '/flashcards': 'subtle',
  '/topics': 'dimmed',
  '/checklist': 'dimmed',
  '/settings': 'subtle',
  '/add-decks': 'dimmed',
  '/edit-deck': 'dimmed',
}

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('ecengine:sidebar-collapsed') === 'true'
  )
  const forceCollapsed = useLayoutStore(s => s.forceCollapsed)
  const isCollapsedEffective = isCollapsed || forceCollapsed

  const [isFullscreen, setIsFullscreen] = useState(false)
  const location = useLocation()
  const gauntletPhase = useGauntletStore(s => s.phase)

  const [reduceBgEffects, setReduceBgEffects] = useState(() =>
    localStorage.getItem('ecengine:reduce-bg-effects') === 'true'
  )
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const handleSettingsChange = () => {
      setReduceBgEffects(localStorage.getItem('ecengine:reduce-bg-effects') === 'true')
    }
    window.addEventListener('ecengine:settings-changed', handleSettingsChange)
    window.addEventListener('storage', handleSettingsChange)
    return () => {
      window.removeEventListener('ecengine:settings-changed', handleSettingsChange)
      window.removeEventListener('storage', handleSettingsChange)
    }
  }, [])

  const resolvedIntensity: BackdropIntensity = React.useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/gauntlet')) {
      return gauntletPhase === 'playing' || gauntletPhase === 'summary' ? 'subtle' : 'full'
    }
    const matchedKey = Object.keys(ROUTE_BACKDROP_INTENSITY).find(prefix =>
      prefix === '/' ? path === '/' : path.startsWith(prefix)
    )
    return matchedKey ? ROUTE_BACKDROP_INTENSITY[matchedKey] : 'dimmed'
  }, [location.pathname, gauntletPhase])

  const isBackdropDisabled = reduceBgEffects || prefersReducedMotion

  useEffect(() => {
    if (window.electron?.windowControls?.onFullscreenChanged) {
      return window.electron.windowControls.onFullscreenChanged(setIsFullscreen)
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
    { to: '/gauntlet', label: 'Gauntlet', icon: Timer },
    { to: '/lab', label: 'Data Lab', icon: FlaskConical },
    { to: '/topics', label: 'EELE ToS', icon: BookOpen },
    { to: '/checklist', label: 'Checklist', icon: ClipboardList },
    { to: '/add-decks', label: 'Add Decks', icon: PlusCircle },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-engine-black text-[var(--text-primary)] font-['JetBrains_Mono'] ${isFullscreen ? '' : 'rounded-xl border border-[#333]'}`}>
      {!isFullscreen && (
        <TitleBar
          isCollapsed={isCollapsedEffective}
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
          className={`${isCollapsedEffective ? 'w-16' : 'w-[150px]'
            } h-full bg-surface border-r border-border-base flex flex-col transition-all duration-300 shrink-0 relative z-10`}
        >
          {/* Logo + collapse toggle */}
          <div className={`h-10 w-full shrink-0 flex items-center ${isCollapsedEffective ? 'justify-center px-0' : 'justify-between px-2'}`}>
            {!isCollapsedEffective && (
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
              content={isCollapsedEffective ? 'Expand sidebar' : 'Collapse sidebar'}
              position="right"
              className={isCollapsedEffective ? 'w-full flex justify-center' : ''}
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
                      <div className={`${isCollapsedEffective ? 'w-16' : 'w-12'} flex justify-center shrink-0`}>
                        <item.icon size={18} />
                      </div>
                      {!isCollapsedEffective && (
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

          {!isCollapsedEffective && (
            <div className="text-[10px] text-gray-400 text-center pb-4 w-full font-rajdhani tracking-widest opacity-60">
              V1.0.0
            </div>
          )}
        </aside>

        {/* Global animated backdrop mounted once behind main content */}
        {!isBackdropDisabled && resolvedIntensity !== 'off' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <GauntletBackdrop
              intensity={resolvedIntensity === 'full' ? 'full' : resolvedIntensity === 'subtle' ? 'subtle' : 'dimmed'}
            />
          </div>
        )}

        {/* Main Content */}
        <main className="relative z-10 flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-transparent">
          <Outlet />
        </main>
      </div>

      {/* Global overlay — renders above all page content */}
      <ZoomIndicator />
    </div>
  )
}
