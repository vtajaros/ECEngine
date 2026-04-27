import React from 'react'
import { Settings as SettingsIcon, Monitor, Bell, Database, Shield } from 'lucide-react'

export default function Settings() {
  const sections = [
    {
      title: 'Appearance',
      icon: <Monitor size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Dark Theme (Neon)', type: 'select', current: 'Default' },
        { label: 'UI Scaling', type: 'select', current: '100%' },
        { label: 'Reduced Motion', type: 'toggle', current: false },
      ]
    },
    {
      title: 'Notifications & Alerts',
      icon: <Bell size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Daily Study Reminders', type: 'toggle', current: true },
        { label: 'Exam Countdown Timer Warning', type: 'toggle', current: true },
      ]
    },
    {
      title: 'Data & Sync',
      icon: <Database size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Auto-Backup Progress Locally', type: 'toggle', current: true },
        { label: 'Export Progress to File', type: 'action', buttonText: 'Export JSON' },
        { label: 'Clear All Data (Danger Zone)', type: 'action', buttonText: 'Reset DB', danger: true },
      ]
    }
  ]

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto w-full relative">
      <header className="mb-12 flex flex-col gap-2">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <SettingsIcon className="text-[#00FF41] mr-4" size={36} />
          PREFERENCES
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
          Configure application behavior and engine data
        </p>
      </header>

      <div className="max-w-4xl space-y-12">
        {sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#161616] pb-4">
              {section.icon}
              <span className="ml-3">{section.title}</span>
            </h2>

            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-[#161616] shadow-lg space-y-8">
              {section.options.map((opt, idy) => (
                <div key={idy} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="font-['IBM_Plex_Mono'] text-[#E8E8E8] text-sm md:text-base">
                    {opt.label}
                  </div>

                  {opt.type === 'toggle' && (
                    <button className={`w-14 h-7 rounded-full p-1 transition-colors ${opt.current ? 'bg-[rgba(0,255,65,0.2)] border border-[#00FF41]' : 'bg-[#161616] border border-[#222]'} focus:outline-none relative shadow-inner`}>
                      <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${opt.current ? 'bg-[#00FF41] translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                    </button>
                  )}

                  {opt.type === 'select' && (
                    <select className="bg-[#161616] border border-[#222] rounded px-4 py-2 text-sm text-[#E8E8E8] focus:border-[#00FF41] outline-none font-['Rajdhani'] uppercase tracking-wider">
                      <option>{opt.current}</option>
                    </select>
                  )}

                  {opt.type === 'action' && (
                    <button className={`px-4 py-2 border rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all ${
                      opt.danger 
                        ? 'border-[#FF3333] text-[#FF3333] hover:bg-[rgba(255,51,51,0.1)] hover:shadow-[0_0_10px_rgba(255,51,51,0.5)]' 
                        : 'border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)]'
                    }`}>
                      {opt.buttonText}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
