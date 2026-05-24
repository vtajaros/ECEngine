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
} from 'lucide-react'
import { TitleBar } from './TitleBar'
import { dbService } from '../../services/db.service'

type NavItem = {
  to: string
  label: string
  icon: React.ElementType
  webHidden?: boolean
  webOnly?: boolean
}

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      dbService.updateTimeSpent(1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const navItems: NavItem[] = [
    { to: '/',           label: 'Dashboard',  icon: Home },
    { to: '/study',      label: 'LooksFam',   icon: Brain },
    { to: '/flashcards', label: 'Flashcards', icon: Layers },
    { to: '/formulas',   label: 'Formulas',   icon: Sigma },
    { to: '/topics',     label: 'EELE ToS',   icon: BookOpen },
    { to: '/checklist',  label: 'Checklist',  icon: ClipboardList },
    { to: '/add-decks',  label: 'Add Decks',  icon: PlusCircle },
    { to: '/settings',   label: 'Settings',   icon: Settings },
  ]

  return (
    <div className="flex flex-col min-h-screen sm:h-screen bg-[#0D0D0D] text-[var(--text-primary)] font-['IBM_Plex_Mono'] overflow-y-auto sm:overflow-hidden overflow-x-hidden w-screen max-sm:[&::-webkit-scrollbar]:hidden max-sm:[scrollbar-width:none]">
      <TitleBar
        isCollapsed={isCollapsed}
        onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
      />

      <div className="flex flex-col sm:flex-row flex-1 overflow-visible sm:overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            isCollapsed ? 'w-full h-12 sm:w-16 sm:h-full' : 'w-full h-12 sm:w-[140px] sm:h-full'
          } bg-[#1A1A1A] border-b sm:border-b-0 sm:border-r border-[#222] flex flex-row sm:flex-col transition-all duration-300 absolute sm:relative top-0 left-0 sm:top-auto sm:left-auto z-20 shrink-0`}
        >
          {/* ── Hamburger row ── */}
          <div className="hidden sm:flex h-10 w-full shrink-0 items-center justify-between px-2">
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
                  <span className="text-[#00FF41]">ECE</span>ngine
                </span>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`${isCollapsed ? 'mx-auto' : 'ml-auto'} w-7 h-7 flex items-center justify-center hover:bg-[#222] rounded-md text-gray-500 hover:text-[#00FF41] transition-colors`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
          </div>

          <nav className="flex-1 flex max-sm:items-center max-sm:justify-center w-full gap-1 sm:gap-0 px-2 sm:flex-col sm:justify-start sm:items-stretch sm:px-0 sm:overflow-y-auto sm:overflow-x-hidden overflow-x-auto overflow-y-hidden no-scrollbar max-sm:[&::-webkit-scrollbar]:hidden max-sm:[scrollbar-width:none]">
            {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center h-10 transition-all duration-200 min-w-max group relative
                    ${isActive
                      ? 'bg-gradient-to-r from-[#00FF41]/10 to-transparent text-white'
                      : 'text-gray-400 hover:bg-[#222] hover:text-gray-300'
                    }`
                  }
                  title={item.label}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 right-0 bottom-0 h-[3px] sm:h-auto sm:w-[3px] sm:top-0 sm:bottom-0 bg-[#00FF41] shadow-[0_0_10px_#00FF41]" />
                      )}
                      {/* Icon column — always w-16 when collapsed, w-12 when expanded */}
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

        {/* Main Content */}
        <main className="flex-1 w-full min-w-0 relative overflow-visible sm:overflow-y-auto overflow-x-hidden bg-[#111111] pt-12 sm:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}