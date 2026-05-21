import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/theme.css'
import './styles/animations.css'

const root = document.getElementById('root')!

async function init() {
  // Desktop: skip all web DB logic entirely
  if (typeof window !== 'undefined' && (window as any).electron) {
    renderApp()
    return
  }

  // Web: initialize IndexedDB before rendering
  try {
    const { webDBService } = await import('./services/web/db.web.service')

    const seeded = await webDBService.isSeeded()
    if (!seeded) {
      const res = await fetch('/default-decks.json')
      if (!res.ok) throw new Error('Failed to load default deck bundle')
      const data = await res.json()
      await webDBService.seedFromDefault(data)
    }

    renderApp()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    root.innerHTML = `
      <div style="
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; height: 100vh; font-family: sans-serif;
        color: #333; gap: 12px;
      ">
        <h2 style="margin:0">Failed to initialize storage</h2>
        <p style="margin:0; color:#666; font-size:14px">${message}</p>
        <button onclick="location.reload()"
          style="margin-top:8px; padding: 8px 20px; cursor:pointer">
          Retry
        </button>
      </div>
    `
  }
}

function renderApp() {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

init()
