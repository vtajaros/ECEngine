import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { 
  Home, 
  Library, 
  BookOpen, 
  Sigma, 
  List, 
  Download, 
  BarChart, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/flashcards', label: 'Study', icon: BookOpen },
    { to: '/exam', label: 'Exam Mode', icon: Library },
    { to: '/formulas', label: 'Formulas', icon: Sigma },
    { to: '/topics', label: 'Topics', icon: List },
    { to: '/import', label: 'Import', icon: Download },
    { to: '/stats', label: 'Stats', icon: BarChart },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-[#0D0D0D] text-[#E8E8E8] font-['IBM_Plex_Mono'] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-16' : 'w-60'
        } bg-[#111111] border-r border-[#161616] flex flex-col transition-all duration-300 relative z-20`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#161616]">
          {!isCollapsed && (
            <span className="font-['Orbitron'] text-[#00FF41] font-bold text-xl tracking-wider">
              ECEngine
            </span>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-[#888888] hover:text-[#00FF41] transition-colors p-1 rounded focus:outline-none"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center px-4 py-3 mx-2 rounded-r-md transition-all duration-200
                ${isActive 
                  ? 'bg-[#161616] text-[#00FF41] border-l-2 border-[#00FF41] shadow-[inset_4px_0_10px_rgba(0,255,65,0.1)]' 
                  : 'text-[#888888] hover:bg-[#161616] hover:text-[#E8E8E8] border-l-2 border-transparent'
                }
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon size={20} className={isCollapsed ? 'mx-auto' : 'mr-3'} />
              {!isCollapsed && <span className="font-['Rajdhani'] text-lg font-medium tracking-wide">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
