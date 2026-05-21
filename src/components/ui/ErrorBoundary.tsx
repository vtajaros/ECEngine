import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  showDetails: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      showDetails: false,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unknown system error occurred'
      const isDbError = errorMsg.includes('Database Operation Failed')

      // Theme colors & accents based on whether it is a Database Storage Failure
      const accentColor = isDbError ? '#FFB800' : '#FF3333' // Amber/Orange for DB Save issues, Red for React/UI crashes
      const glowColor = isDbError ? 'rgba(255, 184, 0, 0.2)' : 'rgba(255, 51, 51, 0.2)'
      const accentText = isDbError ? 'DATABASE SAVE FAILURE' : 'SYSTEM CRASH DETECTED'

      return (
        <div style={{
          minHeight: '100vh',
          background: '#080808',
          color: '#E8E8E8',
          fontFamily: "'Rajdhani', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          {/* Main Error Card */}
          <div style={{
            background: 'linear-gradient(135deg, #121212 0%, #161616 100%)',
            border: `1px solid ${accentColor}33`,
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '640px',
            width: '100%',
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px ${glowColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top Glowing Ambient Accents */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`
            }} />

            {/* Error Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: `${accentColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${accentColor}44`
              }}>
                {isDbError ? (
                  // Elegant Database Icon
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                    <path d="M3 12A9 3 0 0 0 21 12"></path>
                  </svg>
                ) : (
                  // Elegant Warning/Triangle Icon
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                )}
              </div>
              <div>
                <span style={{
                  color: accentColor,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '0.85rem',
                  letterSpacing: '2px',
                  fontWeight: 'bold'
                }}>
                  {accentText}
                </span>
                <h1 style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  margin: '4px 0 0 0',
                  color: '#FFFFFF'
                }}>
                  {isDbError ? 'Data Storage Error' : 'System Interrupted'}
                </h1>
              </div>
            </div>

            {/* Error Message Details */}
            <p style={{
              fontSize: '1.05rem',
              lineHeight: '1.6',
              color: '#B8B8B8',
              margin: 0
            }}>
              {isDbError 
                ? "An error occurred while saving or reading deck progress from your SQLite local storage database. This can happen if the database file is locked, corrupt, or has schema inconsistencies."
                : "A runtime error occurred in the user interface component, causing it to fail to render correctly."
              }
            </p>

            <div style={{
              background: '#0D0D0D',
              border: '1px solid #222',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.9rem',
              color: '#FF6666',
              wordBreak: 'break-word',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              <strong style={{ color: accentColor, marginRight: '8px' }}>[Error]:</strong>
              {errorMsg}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => this.setState({ hasError: false })}
                style={{
                  background: isDbError ? 'rgba(255, 184, 0, 0.1)' : 'rgba(0, 255, 65, 0.1)',
                  color: isDbError ? '#FFB800' : '#00FF41',
                  border: `1px solid ${isDbError ? '#FFB800' : '#00FF41'}aa`,
                  borderRadius: '6px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif",
                  transition: 'all 0.2s ease',
                  flex: '1',
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDbError ? 'rgba(255, 184, 0, 0.25)' : 'rgba(0, 255, 65, 0.25)'
                  e.currentTarget.style.boxShadow = `0 0 12px ${isDbError ? 'rgba(255, 184, 0, 0.2)' : 'rgba(0, 255, 65, 0.2)'}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDbError ? 'rgba(255, 184, 0, 0.1)' : 'rgba(0, 255, 65, 0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  background: '#222222',
                  color: '#FFFFFF',
                  border: '1px solid #444444',
                  borderRadius: '6px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif",
                  transition: 'all 0.2s ease',
                  flex: '1',
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#333333'
                  e.currentTarget.style.borderColor = '#666666'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#222222'
                  e.currentTarget.style.borderColor = '#444444'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                </svg>
                Force Restart App
              </button>
            </div>

            {/* Collapsible Tech Stack Trace Details */}
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0'
                }}
              >
                {this.state.showDetails ? 'Hide technical inspection panel' : 'Show technical inspection panel'}
              </button>

              {this.state.showDetails && (
                <div style={{
                  marginTop: '12px',
                  background: '#080808',
                  border: '1px solid #222',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.75rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#888',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'left'
                }}>
                  {this.state.error?.stack || 'No trace available'}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
