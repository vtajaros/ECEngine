import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { 
  Home, 
  Brain, 
  BookOpen, 
  Sigma, 
  Upload,
  PlusCircle,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Layers,
  Menu
} from 'lucide-react'
import { TitleBar } from './TitleBar'

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/study', label: 'LooksFam', icon: Brain },
    { to: '/flashcards', label: 'Flashcards', icon: Layers },
    { to: '/topics', label: 'Topics', icon: BookOpen },
    { to: '/add-decks', label: 'Add Decks', icon: PlusCircle },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0D0D0D] text-[var(--text-primary)] font-['IBM_Plex_Mono'] overflow-hidden w-screen">
      <TitleBar 
        isCollapsed={isCollapsed} 
        onToggleSidebar={() => setIsCollapsed(!isCollapsed)} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`${
            isCollapsed ? 'w-16' : 'w-[170px]'
          } bg-[#1A1A1A] border-r border-[#222] flex flex-col transition-all duration-300 relative z-20 shrink-0`}
        >
          <nav className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-0 pt-4">
            {navItems.map((item) => (
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
                title={isCollapsed ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00FF41] shadow-[0_0_10px_#00FF41]" />
                    )}
                    <div className={`${isCollapsed ? 'w-16' : 'w-12'} flex justify-center shrink-0`}>
                      <item.icon size={18} />
                    </div>
                    {!isCollapsed && <span className="font-['Rajdhani'] text-sm font-medium tracking-wide">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {!isCollapsed && (
            <div className="text-[10px] text-gray-400 text-center pb-4 w-full font-rajdhani tracking-widest opacity-60">
              V1.0.0
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-[#111111]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
