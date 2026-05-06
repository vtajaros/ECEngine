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
    <div className="flex h-screen bg-[#111111] text-[var(--text-primary)] font-['IBM_Plex_Mono'] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-[64px]' : 'w-[240px]'
        } bg-[#0D0D0D] border-r border-[var(--bg-card)] flex flex-col transition-all duration-300 relative z-20 shrink-0`}
      >
        <div className="h-[64px] flex items-center justify-center border-b border-[var(--bg-card)] px-4 mb-4">
          <Zap className="text-[var(--accent-primary)] shrink-0" size={24} />
          {!isCollapsed && (
            <span className="font-['Orbitron'] font-bold text-xl ml-3 tracking-wider whitespace-nowrap overflow-hidden transition-all">
              <span className="text-[var(--accent-primary)]">ECE</span><span className="text-white">ngine</span>
            </span>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center p-3 rounded-md transition-all duration-200 min-w-max border-l-2
                ${isActive 
                  ? 'bg-[var(--accent-glow)] text-[var(--accent-primary)] border-[var(--accent-primary)]' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] border-transparent'
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
  )
}
