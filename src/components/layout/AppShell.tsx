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
  Layers
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
    <div className="flex flex-col h-screen bg-[#111111] text-[var(--text-primary)] font-['IBM_Plex_Mono'] overflow-hidden w-screen">
      <TitleBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-16' : 'w-48'
        } bg-[#1A1A1A] border-r border-[#333] flex flex-col transition-all duration-300 relative z-20 shrink-0`}
      >
        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 pt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center p-2.5 transition-all duration-200 min-w-max group
                ${isActive 
                  ? 'border-l-4 border-[#00FF41] bg-gradient-to-r from-[#00FF41]/10 to-transparent text-white' 
                  : 'text-gray-400 hover:bg-[#222] hover:text-gray-300 border-l-4 border-transparent'
                }
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="w-6 flex justify-center shrink-0">
                <item.icon size={20} />
              </div>
              {!isCollapsed && <span className="font-['Rajdhani'] text-lg font-medium tracking-wide ml-3">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--bg-card)] flex justify-end">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-2 rounded focus:outline-none flex justify-center w-full bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)]"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-[#111111]">
        <Outlet />
      </main>
      </div>
    </div>
  )
}
