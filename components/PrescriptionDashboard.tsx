'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const HF_URL = 'https://mj-prod-fiscal.hf.space'
//const HF_URL ='http://localhost:8000'

// Paper colors — muted, receipt-like tones
const PAPER_COLORS = [
  { bg: '#FEF3E2', border: '#F0C24A' },  // warm yellow
  { bg: '#E8F5F3', border: '#0d9488' },  // teal
  { bg: '#FCE7E7', border: '#E07A5F' },  // dusty coral
  { bg: '#E8EEF5', border: '#5F7A9A' },  // slate blue
  { bg: '#EEF5E8', border: '#5F9A7A' },  // mint green
  { bg: '#F5E8F0', border: '#9A5F7A' },  // dusty rose
  { bg: '#F5F0E8', border: '#8A6F4A' },  // paper tan
  { bg: '#E8E8F5', border: '#5F5F9A' },  // dusty lavender
]

// Deterministic color assignment based on prescription id
function getColorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return PAPER_COLORS[Math.abs(hash) % PAPER_COLORS.length]
}

interface Prescription {
  id: string
  type: 'account' | 'income' | 'expense' | 'loan'
  name: string
  amount: number
  details: string
  displayLabel: string  // short label shown on the paper e.g. "chequing $50"
}

// Torn-zigzag receipt paper — matches your logo shape
function PaperShape({ 
  width = 140, 
  height = 180, 
  color,
  children,
  rotation = 0,
}: { 
  width?: number
  height?: number
  color: { bg: string; border: string }
  children: React.ReactNode
  rotation?: number
}) {
  // Zigzag path calculation for torn bottom
  const zigzagPoints = 8
  const zigzagHeight = 16
  const zigzagStep = width / zigzagPoints
  const zigzagPath = Array.from({ length: zigzagPoints + 1 }, (_, i) => {
    const x = i * zigzagStep
    const y = i % 2 === 0 ? height : height - zigzagHeight
    return `${x},${y}`
  }).join(' L ')

  const clipPath = `polygon(
    0 0, 
    100% 0, 
    100% ${((height - zigzagHeight) / height) * 100}%, 
    ${Array.from({ length: zigzagPoints }, (_, i) => {
      const xPct = ((i + 0.5) * zigzagStep / width) * 100
      const yPct = i % 2 === 0 ? 100 : ((height - zigzagHeight) / height) * 100
      return `${xPct}% ${yPct}%`
    }).join(', ')}, 
    0 ${((height - zigzagHeight) / height) * 100}%
  )`

  return (
    <div 
      style={{ 
        width, 
        height, 
        transform: `rotate(${rotation}deg)`,
        position: 'relative',
      }}
    >
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <path
          d={`M 4 4 L ${width - 4} 4 L ${width - 4} ${height - zigzagHeight} ${
            Array.from({ length: zigzagPoints }, (_, i) => {
              const x = width - 4 - ((i + 1) / zigzagPoints) * (width - 8)
              const y = i % 2 === 0 ? height - 4 : height - zigzagHeight
              return `L ${x} ${y}`
            }).join(' ')
          } L 4 ${height - zigzagHeight} Z`}
          fill={color.bg}
          stroke={color.border}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0,
          padding: '16px 12px',
          paddingBottom: zigzagHeight + 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Individual prescription card
function PrescriptionCard({ 
  prescription, 
  rotation, 
  onDragStart,
  isDragging,
}: { 
  prescription: Prescription
  rotation: number
  onDragStart: (p: Prescription) => void
  isDragging: boolean
}) {
  const color = getColorForId(prescription.id)
  const [isHovered, setIsHovered] = useState(false)

  const typeSymbol = {
    account: '$',
    income: '+',
    expense: '−',
    loan: '⚠',
  }[prescription.type]

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', prescription.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(prescription)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transform: isHovered && !isDragging ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        filter: isHovered ? 'drop-shadow(0 8px 12px rgba(0,0,0,0.15))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
      }}
    >
      <PaperShape color={color} rotation={rotation}>
        <div style={{ fontSize: 24, fontWeight: 700, color: color.border, lineHeight: 1 }}>
          {typeSymbol}
        </div>
        <div style={{ 
          fontSize: 11, 
          fontWeight: 600, 
          color: '#334155', 
          marginTop: 8,
          lineHeight: 1.2,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {prescription.displayLabel.split(' ').slice(0, -1).join(' ')}
        </div>
        <div style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: '#0f3c3a', 
          marginTop: 4,
        }}>
          ${prescription.amount.toFixed(2)}
        </div>
      </PaperShape>
    </div>
  )
}

// Heartbeat pulse chart — the visual signature of the checkup
function HeartbeatChart({ prescription, isDiagnosing }: { 
  prescription: Prescription
  isDiagnosing: boolean  // NEW: pass in whether the LLM is still streaming
}) {
  const [points, setPoints] = useState<Array<{ date: string; value: number; count: number; is_income: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [pulseCycle, setPulseCycle] = useState(0)  // increments to trigger re-animations
  const [drawProgress, setDrawProgress] = useState(0)
  const color = getColorForId(prescription.id)

  // Fetch activity data
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDrawProgress(0)
    setPulseCycle(0)
    
    fetch(`${HF_URL}/trial/prescription/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: prescription.type,
        name: prescription.name,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setPoints(data.points || [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    
    return () => { cancelled = true }
  }, [prescription.id])

  // Animate the pulse line — repeats while diagnosing, settles when done
  useEffect(() => {
    if (loading || points.length === 0) return
    
    let raf: number
    let start = performance.now()
    const duration = 2500  // one full sweep
    
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDrawProgress(eased)
      
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else if (isDiagnosing) {
        // If still diagnosing, restart the pulse after a brief pause
        setTimeout(() => {
          if (isDiagnosing) {
            start = performance.now()
            setPulseCycle(c => c + 1)
            raf = requestAnimationFrame(tick)
          }
        }, 300)
      }
    }
    
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loading, points.length, isDiagnosing, pulseCycle])

  // Chart dimensions
  const width = 500
  const height = 80
  const paddingX = 20
  const paddingY = 20
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2

  const maxValue = Math.max(...points.map(p => p.value), 1)
  const centerY = height / 2
  
  const pathPoints = points.map((p, i) => {
    const x = paddingX + (i / Math.max(points.length - 1, 1)) * innerWidth
    let y = centerY
    if (p.value > 0) {
      const magnitude = (p.value / maxValue) * (innerHeight / 2)
      y = p.is_income ? centerY + magnitude : centerY - magnitude
    }
    return { x, y, value: p.value, date: p.date }
  })

  const visiblePointCount = Math.floor(pathPoints.length * drawProgress)
  const visiblePath = pathPoints.slice(0, visiblePointCount + 1).reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    return `${acc} L ${pt.x} ${pt.y}`
  }, '')

  const currentPoint = pathPoints[visiblePointCount] || pathPoints[pathPoints.length - 1]
  const totalEvents = points.filter(p => p.value > 0).length

  if (loading) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: 11,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <span className="animate-bounce">●</span>
          <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
          <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
        </div>
      </div>
    )
  }

  if (points.length === 0 || totalEvents === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: 11,
        fontStyle: 'italic',
        backgroundColor: '#FDFBF5',
        border: '2px solid #0d9488',
        borderRadius: 12,
        marginBottom: 16,
      }}>
        No recent activity to display
      </div>
    )
  }

  return (
    <div style={{ 
      backgroundColor: '#FDFBF5',      // warm cream, like receipt paper
      border: `3px solid #0d9488`,      // teal outline like the logo
      borderRadius: 12, 
      padding: '12px 8px',
      position: 'relative',
      marginBottom: 16,
    }}>
      {/* Header label */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 12px',
        marginBottom: 6,
      }}>
        <span style={{ 
          fontSize: 9, 
          color: '#0d9488', 
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          fontFamily: 'monospace',
          fontWeight: 700,
        }}>
          Activity Monitor
        </span>
        <span style={{ 
          fontSize: 9, 
          color: '#0d9488',
          fontFamily: 'monospace',
          opacity: 0.7,
        }}>
          {totalEvents} events · 90 days
        </span>
      </div>

      {/* The pulse */}
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Center reference line — very subtle */}
        <line 
          x1={paddingX} 
          y1={centerY} 
          x2={width - paddingX} 
          y2={centerY} 
          stroke="#0d9488" 
          strokeWidth="0.5" 
          strokeDasharray="2,4" 
          opacity="0.15"
        />
        
        {/* Ghost path (full path faded, so you can see where it's going) */}
        <path
          d={pathPoints.reduce((acc, pt, i) => {
            if (i === 0) return `M ${pt.x} ${pt.y}`
            return `${acc} L ${pt.x} ${pt.y}`
          }, '')}
          fill="none"
          stroke="#F0C24A"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />
        
        {/* The active pulse — logo yellow, bold */}
        <path
          d={visiblePath}
          fill="none"
          stroke="#F0C24A"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Pulsing dot at the current end of the line */}
        {currentPoint && drawProgress < 1 && (
          <>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r="6"
              fill="#F0C24A"
              opacity="0.4"
            >
              <animate attributeName="r" values="4;10;4" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="0.8s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r="3"
              fill="#F0C24A"
            />
          </>
        )}

        {/* End-of-line indicator when animation completes and no longer diagnosing */}
        {drawProgress >= 1 && !isDiagnosing && (
          <>
            <circle
              cx={pathPoints[pathPoints.length - 1].x}
              cy={pathPoints[pathPoints.length - 1].y}
              r="5"
              fill="#F0C24A"
              opacity="0.5"
            >
              <animate attributeName="r" values="3;7;3" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={pathPoints[pathPoints.length - 1].x}
              cy={pathPoints[pathPoints.length - 1].y}
              r="2.5"
              fill="#F0C24A"
            />
          </>
        )}
      </svg>

      {/* Time labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 20px 0',
        fontSize: 8,
        color: '#0d9488',
        fontFamily: 'monospace',
        opacity: 0.6,
      }}>
        <span>90d ago</span>
        <span>today</span>
      </div>
    </div>
  )
}

// The diagnostic panel — where prescriptions get analyzed
function DiagnosticPanel({ 
  activePrescription, 
  onClear,
  isDraggingOver,
  onDrop,
}: {
  activePrescription: Prescription | null
  onClear: () => void
  isDraggingOver: boolean
  onDrop: (id: string) => void
}) {
  const [diagnosis, setDiagnosis] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [followUpInput, setFollowUpInput] = useState('')
  const [followUpMessages, setFollowUpMessages] = useState<Array<{q: string, a: string}>>([])
  const [currentFollowUp, setCurrentFollowUp] = useState('')
  const [isFollowingUp, setIsFollowingUp] = useState(false)

  // Trigger diagnosis when a new prescription arrives
  useEffect(() => {
    if (!activePrescription) return
    
    // Reset state for new diagnosis
    setDiagnosis('')
    setFollowUpMessages([])
    setCurrentFollowUp('')
    setShowStamp(true)
    
    // Stamp effect duration
    setTimeout(() => setShowStamp(false), 900)
    
    // Start streaming diagnosis after a brief delay for the stamp
    setTimeout(() => {
      streamDiagnosis(activePrescription)
    }, 400)
  }, [activePrescription?.id])

  const streamDiagnosis = async (prescription: Prescription, question?: string) => {
    const setter = question ? setCurrentFollowUp : setDiagnosis
    if (question) setIsFollowingUp(true)
    else setIsStreaming(true)

    try {
      const res = await fetch(`${HF_URL}/trial/prescription/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: prescription.type,
          name: prescription.name,
          amount: prescription.amount,
          details: prescription.details,
          question: question || '',
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw = decoder.decode(value)
        for (const line of raw.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.replace('data: ', '').trim()
            if (data === '[DONE]') continue
            try {
              const json = JSON.parse(data)
              if (json.chunk) {
                full += json.chunk
                // Strip any chart syntax the LLM emits despite instructions
                const cleaned = full
                  .replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/g, '')
                  .replace(/\[CHART_DATA\][\s\S]*$/g, '')  // handle unclosed mid-stream
                setter(cleaned)
              }
            } catch {}
          }
        }
      }

      if (question) {
        setFollowUpMessages(prev => [...prev, { q: question, a: full }])
        setCurrentFollowUp('')
      }
    } catch (e) {
      console.error('Diagnosis error:', e)
    } finally {
      setIsStreaming(false)
      setIsFollowingUp(false)
    }
  }

  const handleFollowUp = () => {
    const q = followUpInput.trim()
    if (!q || !activePrescription || isFollowingUp) return
    setFollowUpInput('')
    streamDiagnosis(activePrescription, q)
  }

  const activeColor = activePrescription ? getColorForId(activePrescription.id) : null

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(id)
      }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDraggingOver ? '#F0FAF8' : '#F8FAFB',
        border: isDraggingOver ? '2px dashed #0d9488' : '2px dashed #CBD5E1',
        borderRadius: 24,
        padding: 24,
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Empty state */}
      {!activePrescription && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 48, opacity: 0.4 }}>🩺</div>
          <p style={{ fontSize: 14, color: '#64748B', fontWeight: 600, maxWidth: 280 }}>
            Diagnostic Panel
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8', maxWidth: 280, lineHeight: 1.5 }}>
            Drag a prescription from the right to get a check-up on that account, income, or expense.
          </p>
        </div>
      )}

      {/* Active state */}
      {activePrescription && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header with the prescription */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: 16,
            gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'left center' }}>
                <PaperShape color={activeColor!} width={100} height={130}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: activeColor!.border }}>
                    {{ account: '$', income: '+', expense: '−', loan: '⚠' }[activePrescription.type]}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#334155', marginTop: 4, textAlign: 'center' }}>
                    {activePrescription.displayLabel.split(' ').slice(0, -1).join(' ')}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f3c3a', marginTop: 2 }}>
                    ${activePrescription.amount.toFixed(2)}
                  </div>
                </PaperShape>
              </div>
              <div style={{ maxWidth: 200 }}>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {activePrescription.type}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f3c3a', marginTop: 2 }}>
                  {activePrescription.name}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {activePrescription.details}
                </div>
              </div>
            </div>
            <button
              onClick={onClear}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 20,
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 4,
              }}
              title="Clear"
            >
              ×
            </button>
          </div>
              {/* Heartbeat activity chart */}
            <HeartbeatChart 
              prescription={activePrescription} 
              isDiagnosing={isStreaming || isFollowingUp}
            />
          {/* Diagnosis content — scrollable */}
              <div style={{ 
                flex: 1, 
                overflow: 'auto', 
                minHeight: 0,
                fontSize: 13, 
                lineHeight: 1.7,
                color: '#334155',
                paddingRight: 4,
              }}>
            {diagnosis && (
              <ReactMarkdown components={{
                p: ({children}) => <p style={{ marginBottom: 10 }}>{children}</p>,
                strong: ({children}) => <strong style={{ color: '#E07A5F', fontWeight: 600 }}>{children}</strong>,
                ol: ({children}) => <ol style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ol>,
                ul: ({children}) => <ul style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ul>,
                li: ({children}) => <li style={{ marginBottom: 4 }}>{children}</li>,
              }}>
                {diagnosis}
              </ReactMarkdown>
            )}
            {isStreaming && !diagnosis && (
              <div style={{ display: 'flex', gap: 4, color: '#0d9488', fontSize: 20 }}>
                <span className="animate-bounce">●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
              </div>
            )}

            {/* Follow-up conversation */}
            {followUpMessages.map((msg, i) => (
              <div key={i} style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <div style={{ 
                  fontSize: 12, 
                  color: '#0d9488', 
                  fontWeight: 600, 
                  marginBottom: 8,
                }}>
                  Follow up: {msg.q}
                </div>
                <ReactMarkdown components={{
                  p: ({children}) => <p style={{ marginBottom: 10 }}>{children}</p>,
                  strong: ({children}) => <strong style={{ color: '#E07A5F' }}>{children}</strong>,
                }}>
                  {msg.a}
                </ReactMarkdown>
              </div>
            ))}
            {currentFollowUp && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <ReactMarkdown components={{
                  p: ({children}) => <p style={{ marginBottom: 10 }}>{children}</p>,
                  strong: ({children}) => <strong style={{ color: '#E07A5F' }}>{children}</strong>,
                }}>
                  {currentFollowUp}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Follow-up input */}
          {!isStreaming && diagnosis && (
            <div style={{ 
              marginTop: 12, 
              display: 'flex', 
              gap: 8,
              paddingTop: 12,
              borderTop: '1px solid #E2E8F0',
            }}>
              <input
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                placeholder="Ask a follow-up..."
                disabled={isFollowingUp}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: 13,
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  backgroundColor: 'black',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleFollowUp}
                disabled={!followUpInput.trim() || isFollowingUp}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                  backgroundColor: '#0d9488',
                  border: 'none',
                  borderRadius: 12,
                  cursor: followUpInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: followUpInput.trim() ? 1 : 0.4,
                }}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ink stamp effect */}
      {showStamp && activePrescription && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            border: '6px solid #E07A5F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(-12deg)',
            color: '#E07A5F',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 2,
            fontFamily: 'Georgia, serif',
            opacity: 0.85,
            animation: 'stampIn 0.9s cubic-bezier(0.3, 1.4, 0.5, 1) forwards',
          }}>
            CHECK-UP
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes stampIn {
          0% {
            transform: rotate(-12deg) scale(3);
            opacity: 0;
          }
          40% {
            transform: rotate(-12deg) scale(0.9);
            opacity: 1;
          }
          60% {
            transform: rotate(-12deg) scale(1.05);
          }
          100% {
            transform: rotate(-12deg) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

// Main component: prescription pad + diagnostic panel
export default function PrescriptionDashboard({ 
  chartData, 
  calendarData,
}: { 
  chartData: any
  calendarData: any
}) {
  const [activePrescription, setActivePrescription] = useState<Prescription | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Build the prescription list from account balances + recurring data
  const prescriptions: Prescription[] = []

  if (chartData?.accounts) {
    chartData.accounts.forEach((acc: any, i: number) => {
      prescriptions.push({
        id: `account-${i}-${acc.name}`,
        type: acc.type === 'credit card' || acc.type === 'line of credit' || acc.type === 'mortgage' ? 'loan' : 'account',
        name: acc.name,
        amount: acc.balance,
        details: acc.type,
        displayLabel: `${acc.type} $${acc.balance.toFixed(0)}`,
      })
    })
  }

  if (calendarData?.recurring_income) {
    calendarData.recurring_income.forEach((item: any, i: number) => {
      prescriptions.push({
        id: `income-${i}-${item.merchant}`,
        type: 'income',
        name: item.merchant,
        amount: item.amount,
        details: `${item.frequency} income · ${item.consecutive_months} months`,
        displayLabel: `${item.merchant} +$${item.amount.toFixed(0)}`,
      })
    })
  }

  if (calendarData?.recurring_expenses) {
    calendarData.recurring_expenses.forEach((item: any, i: number) => {
      prescriptions.push({
        id: `expense-${i}-${item.merchant}`,
        type: 'expense',
        name: item.merchant,
        amount: item.amount,
        details: `${item.frequency} · ${item.category.replace(/_/g, ' ').toLowerCase()}`,
        displayLabel: `${item.merchant} -$${item.amount.toFixed(0)}`,
      })
    })
  }

  const handleDrop = (id: string) => {
    const p = prescriptions.find(p => p.id === id)
    if (p) {
      setActivePrescription(p)
    }
    setDraggingId(null)
    setIsDraggingOver(false)
  }

  // Deterministic rotation per prescription (looks organic but stable)
  const getRotation = (id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0
    }
    return ((Math.abs(hash) % 11) - 5) // -5 to +5 degrees
  }

  return (
    <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          height: 'calc(100vh - 160px)',
          minHeight: 0,
          padding: '0 4px',
        }}>
      {/* LEFT: Diagnostic Panel */}
      <div
          onDragEnter={() => setIsDraggingOver(true)}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setIsDraggingOver(false)
          }}
          style={{ minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
        >
        <DiagnosticPanel
          activePrescription={activePrescription}
          onClear={() => setActivePrescription(null)}
          isDraggingOver={isDraggingOver}
          onDrop={handleDrop}
        />
      </div>

      {/* RIGHT: Prescription pad */}
      <div style={{
        backgroundColor: '#FAFAF7',
        borderRadius: 24,
        padding: 20,
        overflow: 'auto',
        border: '1px solid #E8E4D9',
      }}>
        <div style={{ 
          fontSize: 11, 
          fontWeight: 600, 
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 16,
        }}>
          Your prescriptions ({prescriptions.length})
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
        }}>
          {prescriptions.map(p => (
            <PrescriptionCard
              key={p.id}
              prescription={p}
              rotation={getRotation(p.id)}
              onDragStart={(prescription) => setDraggingId(prescription.id)}
              isDragging={draggingId === p.id}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
