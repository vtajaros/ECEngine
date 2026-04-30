import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#FF3333',
          fontFamily: 'IBM Plex Mono',
          background: '#0D0D0D',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h2 style={{ color: '#00FF41', fontFamily: 'Orbitron' }}>
            Something went wrong
          </h2>
          <pre style={{ fontSize: '0.8rem', color: '#888' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: '#00FF41',
              color: '#000',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              fontFamily: 'Orbitron',
              width: 'fit-content'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
