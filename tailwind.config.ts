import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'engine-black':  '#0D0D0D',
        'engine-green':  '#00FF41',
        'engine-card':   '#161616',
        'engine-border': 'rgba(0,255,65,0.3)',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body:    ['IBM Plex Mono', 'monospace'],
        ui:      ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'glow':  '0 0 8px rgba(0,255,65,0.6), 0 0 20px rgba(0,255,65,0.2)',
        'card':  '0 0 0 1px rgba(0,255,65,0.15), 0 4px 24px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
} satisfies Config
