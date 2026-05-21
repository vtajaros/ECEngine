import React, { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle, AlertTriangle, FileJson } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function ImportBackup() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setErrorMsg('File must be a .json export from ECEngine desktop.')
      setStatus('error')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (!parsed.topics || !parsed.cards) {
          setErrorMsg('Invalid backup format. File must contain "topics" and "cards" fields.')
          setStatus('error')
          return
        }
        setPendingData(parsed)
        setShowConfirm(true)
      } catch {
        setErrorMsg('Failed to parse JSON. The file may be corrupted.')
        setStatus('error')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleConfirmImport = async () => {
    if (!pendingData) return
    setShowConfirm(false)
    setStatus('loading')
    try {
      console.log('[import] payload keys:', Object.keys(pendingData))
      console.log('[import] topics count:', pendingData.topics?.length)
      console.log('[import] cards count:', pendingData.cards?.length)
      const { webDBService } = await import('../services/web/db.web.service')
      await webDBService.importBackup(pendingData)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed.')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setErrorMsg('')
    setFileName('')
    setPendingData(null)
    setShowConfirm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{
      minHeight: '100%',
      background: '#0D0D0D',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Rajdhani', sans-serif",
    }}>

      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          color: '#00FF41', fontFamily: "'Orbitron', sans-serif",
          fontSize: '0.75rem', letterSpacing: '3px', marginBottom: '12px'
        }}>
          <FileJson size={14} />
          SNEAKERNET SYNC
        </div>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '2rem', fontWeight: 800,
          color: '#FFFFFF', margin: '0 0 12px 0'
        }}>
          IMPORT BACKUP
        </h1>
        <p style={{ color: '#888', fontSize: '1rem', maxWidth: '480px', lineHeight: 1.6 }}>
          Transfer your deck data from the ECEngine desktop app. Export a backup from desktop, then drop the JSON file here.
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#1A1A1A',
        border: '1px solid #222',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '560px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #00FF41, transparent)'
        }} />

        {/* IDLE STATE — Dropzone */}
        {status === 'idle' && !showConfirm && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? '#00FF41' : '#333'}`,
                borderRadius: '8px',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isDragging ? 'rgba(0, 255, 65, 0.05)' : 'transparent',
                boxShadow: isDragging ? '0 0 20px rgba(0, 255, 65, 0.1)' : 'none',
              }}
            >
              <Upload
                size={36}
                color={isDragging ? '#00FF41' : '#444'}
                style={{ marginBottom: '16px' }}
              />
              <p style={{
                color: isDragging ? '#00FF41' : '#E8E8E8',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '0.9rem', letterSpacing: '1px',
                marginBottom: '8px'
              }}>
                DROP JSON FILE HERE
              </p>
              <p style={{ color: '#555', fontSize: '0.9rem' }}>
                or click to browse
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Instructions */}
            <div style={{
              marginTop: '28px',
              padding: '16px',
              background: '#111',
              borderRadius: '8px',
              border: '1px solid #1E1E1E',
            }}>
              <p style={{
                color: '#555', fontSize: '0.8rem',
                fontFamily: "'IBM Plex Mono', monospace",
                marginBottom: '10px', letterSpacing: '1px'
              }}>
                HOW TO EXPORT FROM DESKTOP
              </p>
              {[
                '1. Open ECEngine on your Windows PC',
                '2. Go to Settings → Export Backup',
                '3. Save the .json file',
                '4. Transfer to this device and drop above',
              ].map((step, i) => (
                <p key={i} style={{
                  color: '#666', fontSize: '0.875rem',
                  lineHeight: 1.8, margin: 0
                }}>
                  {step}
                </p>
              ))}
            </div>
          </>
        )}

        {/* CONFIRM STATE — Overwrite Warning */}
        {showConfirm && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(255, 184, 0, 0.1)',
              border: '1px solid rgba(255, 184, 0, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={24} color="#FFB800" />
            </div>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1.1rem', color: '#FFB800',
              letterSpacing: '2px', marginBottom: '12px'
            }}>
              OVERWRITE WARNING
            </h2>
            <p style={{ color: '#B8B8B8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '8px' }}>
              This will permanently overwrite all current cards, decks, and progress on this device.
            </p>
            <p style={{
              color: '#555', fontSize: '0.85rem',
              fontFamily: "'IBM Plex Mono', monospace",
              marginBottom: '28px'
            }}>
              {fileName}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: '12px',
                  background: '#222', color: '#888',
                  border: '1px solid #333', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.9rem',
                  fontFamily: "'Orbitron', sans-serif",
                  letterSpacing: '1px'
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmImport}
                style={{
                  flex: 1, padding: '12px',
                  background: 'rgba(255, 184, 0, 0.1)',
                  color: '#FFB800',
                  border: '1px solid rgba(255, 184, 0, 0.4)',
                  borderRadius: '6px', cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: "'Orbitron', sans-serif",
                  letterSpacing: '1px'
                }}
              >
                CONFIRM OVERWRITE
              </button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '48px', height: '48px',
              border: '2px solid #1A1A1A',
              borderTop: '2px solid #00FF41',
              borderRadius: '50%',
              margin: '0 auto 20px auto',
              animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{
              color: '#00FF41', fontFamily: "'Orbitron', sans-serif",
              fontSize: '0.85rem', letterSpacing: '2px'
            }}>
              IMPORTING DATA...
            </p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '8px' }}>
              Do not close this tab
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(0, 255, 65, 0.1)',
              border: '1px solid rgba(0, 255, 65, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto',
              boxShadow: '0 0 20px rgba(0, 255, 65, 0.15)'
            }}>
              <CheckCircle size={28} color="#00FF41" />
            </div>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1.1rem', color: '#00FF41',
              letterSpacing: '2px', marginBottom: '12px'
            }}>
              IMPORT COMPLETE
            </h2>
            <p style={{ color: '#B8B8B8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '28px' }}>
              Your decks and cards are now available for review.
            </p>
            <button
              onClick={handleReset}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(0, 255, 65, 0.1)',
                color: '#00FF41',
                border: '1px solid rgba(0, 255, 65, 0.4)',
                borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.9rem',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '1px'
              }}
            >
              IMPORT ANOTHER BACKUP
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(255, 51, 51, 0.1)',
              border: '1px solid rgba(255, 51, 51, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={28} color="#FF3333" />
            </div>
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '1.1rem', color: '#FF3333',
              letterSpacing: '2px', marginBottom: '12px'
            }}>
              IMPORT FAILED
            </h2>
            <p style={{
              color: '#FF6666', fontSize: '0.875rem',
              fontFamily: "'IBM Plex Mono', monospace",
              background: '#0D0D0D', border: '1px solid #2A1A1A',
              borderRadius: '6px', padding: '12px',
              marginBottom: '28px', wordBreak: 'break-word'
            }}>
              {errorMsg}
            </p>
            <button
              onClick={handleReset}
              style={{
                width: '100%', padding: '12px',
                background: '#222', color: '#E8E8E8',
                border: '1px solid #333',
                borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.9rem',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '1px'
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
