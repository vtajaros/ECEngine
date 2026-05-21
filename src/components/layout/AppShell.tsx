import React, { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Brain,
  BookOpen,
  Sigma,
  PlusCircle,
  Settings,
  Layers,
  ClipboardList,
  Menu,
} from 'lucide-react'
import { TitleBar } from './TitleBar'

const isWeb = typeof window !== 'undefined' && !(window as any).electron

type NavItem = {
  to: string
  label: string
  icon: React.ElementType
  webHidden?: boolean
  webOnly?: boolean
}

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Track time spent in the app (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      import('../../services/db.service').then(({ activeDBService }) => {
        activeDBService.updateTimeSpent(1)
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { to: '/',          label: 'Dashboard',       icon: Home },
    { to: '/study',     label: 'LooksFam',        icon: Brain },
    { to: '/flashcards',label: 'Flashcards',      icon: Layers },
    { to: '/formulas',  label: 'Formulas',        icon: Sigma },
    { to: '/topics',    label: 'EELE ToS',        icon: BookOpen },
    { to: '/checklist', label: 'Review Checklist',icon: ClipboardList },
    { to: '/add-decks', label: 'Add Decks',       icon: PlusCircle },
    { to: '/settings',  label: 'Settings',        icon: Settings },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0D0D0D] text-[var(--text-primary)] font-['IBM_Plex_Mono'] overflow-hidden w-screen">
      {!isWeb && (
        <TitleBar
          isCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
      )}

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            isCollapsed ? 'w-full h-12 sm:w-16 sm:h-full' : 'w-full h-12 sm:w-[170px] sm:h-full'
          } bg-[#1A1A1A] border-b sm:border-b-0 sm:border-r border-[#222] flex flex-row sm:flex-col transition-all duration-300 relative z-20 shrink-0`}
        >
          {/* Hamburger button — web only, lives at top of sidebar */}
          {isWeb && (
            <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-start sm:px-3'} sm:pt-3 sm:pb-1 px-3 shrink-0 items-center justify-center`}>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 hover:bg-[#222] border border-[#333]/40 rounded-md text-gray-400 hover:text-[#00FF41] transition-all flex items-center justify-center"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu size={18} />
              </button>
            </div>
          )}

          <nav 
            className="flex-1 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto overflow-y-hidden sm:overflow-x-hidden no-scrollbar items-center sm:items-stretch px-2 sm:px-0 pt-0 sm:pt-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {(navItems as NavItem[])
              .filter(item => {
                if (isWeb && item.webHidden) return false
                if (!isWeb && item.webOnly) return false
                return true
              })
              .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex items-center h-10 transition-all duration-200 min-w-max group relative
                  ${isActive
                    ? 'bg-gradient-to-r from-[#00FF41]/10 to-transparent text-white'
                    : 'text-gray-400 hover:bg-[#222] hover:text-gray-300'
                  }
                `}
                title={item.label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 right-0 bottom-0 h-[3px] sm:h-auto sm:w-[3px] sm:top-0 sm:bottom-0 bg-[#00FF41] shadow-[0_0_10px_#00FF41]" />
                    )}
                    <div className={`${isCollapsed ? 'sm:w-16' : 'sm:w-12'} w-10 flex justify-center shrink-0`}>
                      <item.icon size={18} />
                    </div>
                    {!isCollapsed && (
                      <span className="hidden sm:inline font-['Rajdhani'] text-sm font-medium tracking-wide">
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {!isCollapsed && (
            <div className="hidden sm:block text-[10px] text-gray-400 text-center pb-4 w-full font-rajdhani tracking-widest opacity-60">
              V1.0.0
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 relative overflow-y-auto overflow-x-hidden bg-[#111111]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
