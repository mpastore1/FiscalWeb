'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// Assuming these icons exist in your project or can be replaced with SVG/text
// import { X } from 'lucide-react' 

//const HF_URL = 'http://localhost:8000'
const HF_URL = 'https://mj-prod-fiscal.hf.space'

const MONTH_COLORS = [
  '#6C7D93', '#7CA982', '#A38199', '#7C9A82',
  '#B57A92', '#D97762', '#4B8B82', '#E2A84B',
  '#8C9A80', '#958BA6', '#A67B80', '#6C7D93',
]

// Assuming the same interfaces used in previous prompts for data structure context
interface Transaction { name: string; amount: number; is_income: boolean; category: string }
interface DailyData { day: number; amount: number; intensity: number; transactions: Transaction[] }
interface RecurringItem { name: string; amount: number; date: string }
interface Month {
  year: number; month: number; month_name: string; month_name_full: string
  total_spent: number; total_income: number
  is_past: boolean; is_current: boolean; is_future: boolean
  daily_data: DailyData[]; first_weekday: number; days_in_month: number
  recurring_income: RecurringItem[]; recurring_expenses: RecurringItem[]
}
interface YearSphereData { months: Month[]; current_month_index: number }

// --- External Helper Functions (unchanged from original logic) ---

function getMonthPositionOnSurface(
  index: number, total: number, rotation: number,
  centerX: number, centerY: number, sphereRadius: number,
  spendingRatio: number, isFuture: boolean
) {
  const angle = (index / total) * Math.PI * 2 + rotation
  const spendingLift = isFuture ? 0 : -spendingRatio * (sphereRadius * 0.18)
  const tiltOffsetY = Math.cos(angle) * (sphereRadius * 0.08)
  const yOffset = Math.max(-sphereRadius * 0.65, Math.min(sphereRadius * 0.65, spendingLift + tiltOffsetY))
  const sliceRadius = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - yOffset * yOffset))
  const x3d = Math.sin(angle) * sliceRadius
  const z3d = Math.cos(angle) * sliceRadius
  const x = centerX + x3d
  const y = centerY + yOffset
  const depthNormalized = (z3d + sphereRadius) / (sphereRadius * 2)
  const isFront = z3d >= -5
  const opacity = isFront ? 0.95 + depthNormalized * 0.05 : 0.25 + depthNormalized * 0.35
  const scale = isFront ? 0.82 + depthNormalized * 0.28 : 0.62 + depthNormalized * 0.2
  return { x, y, z: z3d, opacity, scale, isFront }
}

function getSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]; const p1 = points[i]; const p2 = points[i + 1]; const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6; const cp1y = p1.y + (p2.y - p0.y) / 6; const cp2x = p2.x - (p3.x - p1.x) / 6; const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function MitosisOrganelles({ centerX, centerY, sphereRadius }: { centerX: number; centerY: number; sphereRadius: number }) {
  if (!sphereRadius || sphereRadius <= 0 || !isFinite(centerX) || !isFinite(centerY)) return null
  
  return (
    <g opacity={0.55}>
      <circle
        cx={centerX - sphereRadius * 0.15}
        cy={centerY - sphereRadius * 0.08}
        r={sphereRadius * 0.3}
        fill="#00f804"
        style={{ filter: 'blur(22px)' }}
      >
        <animate attributeName="cx" values={`${centerX - sphereRadius * 0.25};${centerX + sphereRadius * 0.15};${centerX - sphereRadius * 0.25}`} dur="12s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${centerY - sphereRadius * 0.15};${centerY + sphereRadius * 0.2};${centerY - sphereRadius * 0.15}`} dur="12s" repeatCount="indefinite" />
        <animate attributeName="r" values={`${sphereRadius * 0.26};${sphereRadius * 0.34};${sphereRadius * 0.26}`} dur="12s" repeatCount="indefinite" />
      </circle>
      <circle
        cx={centerX + sphereRadius * 0.0}
        cy={centerY + sphereRadius * 0.0}
        r={sphereRadius * 0.32}
        fill="#000000"
        style={{ filter: 'blur(26px)' }}
      >
        <animate attributeName="cx" values={`${centerX + sphereRadius * 0.2};${centerX - sphereRadius * 0.2};${centerX + sphereRadius * 0.2}`} dur="15s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${centerY + sphereRadius * 0.15};${centerY - sphereRadius * 0.15};${centerY + sphereRadius * 0.15}`} dur="15s" repeatCount="indefinite" />
        <animate attributeName="r" values={`${sphereRadius * 0.34};${sphereRadius * 0.24};${sphereRadius * 0.34}`} dur="15s" repeatCount="indefinite" />
      </circle>
      <circle
        cx={centerX + sphereRadius * 0.05}
        cy={centerY + sphereRadius * 0.08}
        r={sphereRadius * 0.18}
        fill="#f6fe03"
        style={{ filter: 'blur(18px)' }}
      >
        <animate attributeName="cx" values={`${centerX - sphereRadius * 0.1};${centerX + sphereRadius * 0.25};${centerX - sphereRadius * 0.1}`} dur="9s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${centerY + sphereRadius * 0.25};${centerY - sphereRadius * 0.1};${centerY + sphereRadius * 0.25}`} dur="9s" repeatCount="indefinite" />
      </circle>
    </g>
  )
}

// --- Recoded Component: MonthDetailsPanel ---
// Replaces ZoomedMonthOrb. Now a rectangular sidebar.

function MonthDetailsPanel({ month, onClose }: { month: Month; onClose: () => void }) {
  // --- Retained Logic from original function ---
  const totalRecurringIncome = month.recurring_income.reduce((s, i) => s + i.amount, 0)
  const totalRecurringExpenses = month.recurring_expenses.reduce((s, e) => s + e.amount, 0)
  const netForMonth = month.total_income - month.total_spent

  const weeks: (DailyData | null)[][] = []
  let currentWeek: (DailyData | null)[] = Array(month.first_weekday).fill(null)
  for (const day of month.daily_data) {
    currentWeek.push(day)
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = [] }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const incomeColors = ['#059669', '#10B981', '#34D399']
  const expenseColors = ['#F0C24A', '#5F7A9A', '#0D9488', '#9A5F7A', '#E07A5F', '#5F5F9A', '#8A6F4A', '#C4553A']

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-')
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  }
  // ---------------------------------------------

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{
        width: 480,
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E2E8F0',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative', // for close button placement if needed absolute
        zIndex: 100, // ensure above sphere
        color: '#1E293B', // Default text color for white background
      }}
    >
      {/* Panel Header */}
      <div style={{
        padding: '24px 24px 16px 24px',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {month.year} › Details
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F3C3A' }}>
            {month.month_name_full}
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #E2E8F0', borderRadius: '50%', width: 36, height: 36,
            cursor: 'pointer', color: '#64748B', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#1E293B' }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748B' }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex', flexDirection: 'column', gap: 24,
        scrollbarWidth: 'thin',
        scrollbarColor: '#CBD5E1 transparent',
      }}>
        
        {/* Total Spent Header (adapted styling) */}
        <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1E293B', marginBottom: 2 }}>
            ${month.total_spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
            {month.is_current ? 'Total spent so far' : month.is_past ? `${month.month_name_full} total spending` : 'Projected spending'}
          </div>
        </div>

        {/* Calendar Section (Retained specific rendering logic, adapted constraints) */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Activity Calendar</h3>
             <div style={{
                display: 'flex', gap: 10, fontSize: 10, color: '#64748B', fontWeight: 500
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'rgba(16, 185, 129, 0.95)' }} />
                <span>Income</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'rgba(220, 38, 38, 0.9)' }} />
                <span>Expense</span>
                </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {dayNames.map((d, i) => (
              <div key={`hdr-${i}`} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {weeks.flat().map((day, i) => {
              if (!day) { return <div key={`c-${i}`} style={{ minHeight: 60 }} /> }

              const dayIncome = day.transactions.filter(t => t.is_income)
              const dayExpenses = day.transactions.filter(t => !t.is_income)

              return (
                <div
                  key={`c-${i}`}
                  style={{
                    minHeight: 60,
                    borderRadius: 6,
                    // Use slightly darker base opacity for white background context
                    backgroundColor: `rgba(42, 128, 122, ${0.03 + (day.intensity * 0.12)})`, 
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '3px',
                    gap: 1.5,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: day.intensity > 0.5 ? '#0F3C3A' : '#64748B', lineHeight: 1, marginBottom: 1 }}>{day.day}</div>

                  {dayIncome.slice(0, 2).map((item, j) => ( // Limiting visible items due to smaller sidebar cells
                    <div key={`inc-${j}`} style={{
                      fontSize: 8, padding: '1px 3px', borderRadius: 3,
                      backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#065F46', fontWeight: 600,
                      lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={`+$${item.amount.toFixed(2)} ${item.name}`}>
                      +${item.amount.toFixed(0)}
                    </div>
                  ))}

                  {dayExpenses.slice(0, 3).map((item, j) => (
                    <div key={`exp-${j}`} style={{
                      fontSize: 8, padding: '1px 3px', borderRadius: 3,
                      backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#991B1B', fontWeight: 600,
                      lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={`−$${item.amount.toFixed(2)} ${item.name}`}>
                      −${item.amount.toFixed(0)}
                    </div>
                  ))}
                  {(dayIncome.length > 2 || dayExpenses.length > 3) && (
                    <div style={{fontSize: 7, color: '#94A3B8', textAlign: 'center'}}>...</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ width: '100%', height: 1, backgroundColor: '#E2E8F0', flexShrink: 0 }} />

        {/* Recurring Income (retained rendering, adapted colors for white bg) */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Recurring Income</h3>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>+${totalRecurringIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          {month.recurring_income.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>None detected</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {month.recurring_income.map((item, i) => (
              <div key={`i-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px', borderRadius: 8,
                backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: incomeColors[i % incomeColors.length], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{formatDate(item.date)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                  +${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Expenses */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Recurring Expenses</h3>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>−${totalRecurringExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          {month.recurring_expenses.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>None detected</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {month.recurring_expenses.map((item, i) => (
              <div key={`e-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px', borderRadius: 8,
                backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: expenseColors[i % expenseColors.length], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{formatDate(item.date)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', flexShrink: 0 }}>
                  −${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Net Footer (adapted styling, pinned to bottom) */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Net for {month.month_name}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>All income − all expenses</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: netForMonth >= 0 ? '#059669' : '#DC2626' }}>
          {netForMonth >= 0 ? '+' : ''}${Math.abs(netForMonth).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    </motion.div>
  )
}

// --- MAIN DASHBOARD COMPONENT (Updated for sidebar layout) ---

export default function YearSphereDashboard() {
  const [data, setData] = useState<YearSphereData | null>(null)
  const [loading, setLoading] = useState(true)
  // Renamed state to represent panel state, not zoom state
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null) 
  const [rotation, setRotation] = useState(0)
const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)

const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
  setContainerEl(node)
}, [])
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const velocityRef = useRef(0)
  const dragState = useRef({ dragging: false, startX: 0, startRot: 0, lastX: 0, lastTime: 0 })

  useEffect(() => {
    fetch(`${HF_URL}/trial/yearsphere/data`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (d.months && d.current_month_index != null) {
          const targetAngle = (d.current_month_index / d.months.length) * Math.PI * 2
          setRotation(-targetAngle)
        }
        setLoading(false)
      })
      .catch(e => { console.error('YearSphere fetch:', e); setLoading(false) })
  }, [])

useEffect(() => {
  if (!containerEl) return

  const updateSize = () => {
    const w = containerEl.clientWidth
    const h = containerEl.clientHeight
    if (w > 0 && h > 0) {
      setContainerSize({ width: w, height: h })
    }
  }

  updateSize()
  const observer = new ResizeObserver(updateSize)
  observer.observe(containerEl)
  return () => observer.disconnect()
}, [containerEl])


  useEffect(() => {
    let rafId: number
    const decay = () => {
      if (!dragState.current.dragging && Math.abs(velocityRef.current) > 0.0001) {
        setRotation(r => r + velocityRef.current)
        velocityRef.current *= 0.94
      }
      rafId = requestAnimationFrame(decay)
    }
    rafId = requestAnimationFrame(decay)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Rotation is allowed even with panel open in this design
    dragState.current.dragging = true
    dragState.current.startX = e.clientX
    dragState.current.startRot = rotation
    dragState.current.lastX = e.clientX
    dragState.current.lastTime = performance.now()
    velocityRef.current = 0
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [rotation])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.startX
    const newRot = dragState.current.startRot + dx * 0.006
    const now = performance.now()
    const dt = now - dragState.current.lastTime
    if (dt > 0) { velocityRef.current = ((e.clientX - dragState.current.lastX) * 0.006) / dt * 16 }
    dragState.current.lastX = e.clientX
    dragState.current.lastTime = now
    setRotation(newRot)
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.dragging = false
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  const handleDoubleClick = useCallback(() => {
    if (!data) return
    const targetAngle = (data.current_month_index / data.months.length) * Math.PI * 2
    setRotation(-targetAngle)
  }, [data])

  // Center is now dynamic based on available containerSize
  const centerX = containerSize.width / 2
  const centerY = containerSize.height / 2
  // Adjust radius slightly if panel is open to fit better
  const sphereRadius = Math.min(containerSize.width, containerSize.height) * (selectedMonth ? 0.32 : 0.36)

  const maxSpending = useMemo(() => {
    if (!data || !data.months || data.months.length === 0) return 1
    const nonFuture = data.months.filter(m => !m.is_future).map(m => m.total_spent)
    return Math.max(...nonFuture, 1)
  }, [data])

  if (loading) { return ( <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2A807A', fontSize: 14, backgroundColor: '#FFFFFF' }}> Loading year sphere... </div> ) }
  if (!data || !data.months || data.months.length === 0) { return ( <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#FFFFFF' }}> <p style={{ color: '#94A3B8', fontSize: 14 }}>No data available</p> </div> ) }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        // CHANGED: Use flex layout to sit sphere view next to panel
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      {/* App Header (Adapted position) */}
      <div style={{ position: 'absolute', top: 28, left: 32, zIndex: 40, display: 'flex', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', letterSpacing: 1.5 }}>
          YEAR SPHERE
        </div>
      </div>

      {/* CHANGED: Main Sphere View Area - now takes remaining flex space */}
      <div 
        ref={containerRefCallback}
        style={{ flex: 1, position: 'relative', height: '100%'}}
      >
          {containerSize.width > 0 && (
            <SphereView
              data={data} maxSpending={maxSpending}
              centerX={centerX} centerY={centerY} sphereRadius={sphereRadius}
              rotation={rotation}
              // Set the month in state to open panel, don't trigger "zoom" mode
              onMonthClick={setSelectedMonth} 
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
            />
          )}
      </div>

      {/* CHANGED: Panel Area using AnimatePresence */}
      <AnimatePresence mode="wait">
        {selectedMonth && (
          <MonthDetailsPanel 
            key="panel"
            month={selectedMonth} 
            onClose={() => setSelectedMonth(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SphereView Component (Unchanged, included for file completeness) ---

function SphereView({
  data, maxSpending, centerX, centerY, sphereRadius, rotation,
  onMonthClick, onPointerDown, onPointerMove, onPointerUp, onDoubleClick,
}: {
  data: YearSphereData; maxSpending: number
  centerX: number; centerY: number; sphereRadius: number; rotation: number
  onMonthClick: (m: Month) => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onDoubleClick: () => void
}) {
  const positioned = data.months.map((m, i) => ({
    month: m, index: i,
    pos: getMonthPositionOnSurface(i, data.months.length, rotation, centerX, centerY, sphereRadius, m.total_spent / maxSpending, m.is_future),
  }))

  const backNodes = positioned.filter(p => !p.pos.isFront)
  const frontNodes = positioned.filter(p => p.pos.isFront)
const frontOrdered = [...frontNodes].sort((a, b) => a.pos.x - b.pos.x)
const frontPathD = getSmoothPath(frontOrdered.map(p => p.pos))
  const activeMonthPos = positioned.find(p => p.month.is_current)?.pos

  const renderNodeElement = ({ month, pos }: { month: Month; pos: ReturnType<typeof getMonthPositionOnSurface> }) => {
    const color = MONTH_COLORS[(month.month - 1) % 12]
    const isCurrent = month.is_current
    const nodeDiameter = (isCurrent ? 52 : 24) * pos.scale

    const formatAmount = (amount: number, isCurrent: boolean) => {
        if (amount === 0) return ''
        const kVal = (amount / 1000).toFixed(1)
        return isCurrent ? `$${kVal}k so far` : `$${kVal}k`
    }

    return (
      <div key={`${month.year}-${month.month}-node-element`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {month.total_spent > 0 && (
          <div style={{ position: 'absolute', left: pos.x - 60, top: pos.y - nodeDiameter / 2 - (isCurrent ? 28 : 20), width: 120, textAlign: 'center', fontSize: isCurrent ? 13 : 11, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? '#0F3C3A' : '#475569', opacity: pos.opacity, textShadow: '0 1px 3px rgba(255,255,255,0.95)' }}>
            {formatAmount(month.total_spent, isCurrent)}
          </div>
        )}
        <motion.div
          onClick={() => onMonthClick(month)}
          style={{ position: 'absolute', left: pos.x - nodeDiameter / 2, top: pos.y - nodeDiameter / 2, width: nodeDiameter, height: nodeDiameter, borderRadius: '50%', cursor: 'pointer', opacity: pos.opacity, pointerEvents: 'auto' }}
          initial={{ boxShadow: pos.isFront ? isCurrent ? '0 6px 20px rgba(226, 168, 75, 0.6), 0 2px 6px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.8)' : 'none' }}
          animate={isCurrent ? {
            scale: [1, 1.08, 1, 1.05, 1],
          } : undefined}
          transition={isCurrent ? {
            duration: 1.6,
            times: [0, 0.15, 0.35, 0.5, 1],
            repeat: Infinity,
            ease: 'easeInOut',
          } : undefined}
          whileHover={{
            scale: 1.22,
            boxShadow: isCurrent
              ? '0 0 32px rgba(226, 168, 75, 0.9), 0 6px 20px rgba(226, 168, 75, 0.6), 0 2px 6px rgba(0,0,0,0.15)'
              : `0 0 24px ${color}88, 0 4px 12px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.8)`,
          }}
        >
          {isCurrent ? (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #FFE08A 0%, #E2A84B 60%, #8A6F4A 100%)', border: '3px solid #0F3C3A', outline: '2px dashed #E2A84B', outlineOffset: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F3C3A', fontSize: 12, fontWeight: 800 }}> {month.month_name} </div>
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: color, border: month.is_future ? `1.5px dashed ${color}` : '2px solid #FFFFFF', opacity: month.is_future ? 0.5 : 1 }} />
          )}
        </motion.div>
        {!isCurrent && (
          <div style={{ position: 'absolute', left: pos.x - 30, top: pos.y + nodeDiameter / 2 + 8, width: 60, textAlign: 'center', fontSize: 11, fontWeight: 600, color: color, opacity: pos.opacity * 0.9, letterSpacing: 0.5 }}> {month.month_name} </div>
        )}
        {isCurrent && (
          <div style={{ position: 'absolute', left: pos.x - 50, top: pos.y + nodeDiameter / 2 + 10, width: 100, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: pos.opacity }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F3C3A', letterSpacing: 0.5 }}> {month.month_name} </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#1E293B' }}> You are here </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab', touchAction: 'none', userSelect: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick} >
      <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}> {backNodes.map(renderNodeElement)} </div>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <defs>
          <radialGradient id="sphereGlass" cx="42%" cy="32%" r="68%"> <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.88" /> <stop offset="38%" stopColor="#E0F2EE" stopOpacity="0.75" /> <stop offset="78%" stopColor="#89C4B8" stopOpacity="0.5" /> <stop offset="100%" stopColor="#327A6E" stopOpacity="0.75" /> </radialGradient>
          <radialGradient id="activeGlow" cx="50%" cy="50%" r="50%"> <stop offset="0%" stopColor="#FFE8A3" stopOpacity="0.85" /> <stop offset="60%" stopColor="#F5C96B" stopOpacity="0.3" /> <stop offset="100%" stopColor="#F5C96B" stopOpacity="0" /> </radialGradient>
          <filter id="softSphereShadow"> <feGaussianBlur in="SourceAlpha" stdDeviation="14" /> <feOffset dx="0" dy="10" result="offsetblur" /> <feComponentTransfer><feFuncA type="linear" slope="0.12" /></feComponentTransfer> <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge> </filter>
        </defs>
        <g filter="url(#softSphereShadow)">
          <circle cx={centerX} cy={centerY} r={sphereRadius} fill="url(#sphereGlass)" />
          <MitosisOrganelles centerX={centerX} centerY={centerY} sphereRadius={sphereRadius} />
          <CytoplasmParticles centerX={centerX} centerY={centerY} sphereRadius={sphereRadius} />
          {activeMonthPos && (
            <circle cx={activeMonthPos.x} cy={activeMonthPos.y} r={65} fill="url(#activeGlow)">
                <animate attributeName="r" values="60;78;60;72;60" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;1;0.85;0.95;0.85" dur="1.6s" repeatCount="indefinite" />
            </circle>
            )}
          <circle cx={centerX} cy={centerY} r={sphereRadius} fill="none" stroke="#2B7A6E" strokeWidth={2} opacity={0.45} />
        </g>
        {/* Inside Top Center Label */}
        <text x={centerX} y={centerY - sphereRadius + 32} textAnchor="middle" fill="#0F3C3A" fontSize={30} fontWeight={700} letterSpacing="0.08em" opacity={0.65} style={{ textTransform: 'uppercase' }} > 2026 </text>
        <ellipse cx={centerX} cy={centerY + 12} rx={sphereRadius * 0.78} ry={sphereRadius * 0.22} fill="none" stroke="#2A807A" strokeWidth={1.5} strokeDasharray="3 5" opacity={0.35} />
      </svg>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
        {frontPathD && ( <path d={frontPathD} fill="none" stroke="#2A807A" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} /> )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, zIndex: 25 }}> {frontNodes.map(renderNodeElement)} </div>
    </div>
  )
}


function CytoplasmParticles({ centerX, centerY, sphereRadius }: { centerX: number; centerY: number; sphereRadius: number }) {
  if (!sphereRadius || sphereRadius <= 0 || !isFinite(centerX) || !isFinite(centerY)) return null

  // Deterministic pseudo-random positions so React re-renders don't reshuffle particles
  const particles = [
    { angle: 0.1,  dist: 0.42, r: 1.8, dur: 18, delay: 0 },
    { angle: 0.7,  dist: 0.68, r: 2.4, dur: 22, delay: 2 },
    { angle: 1.3,  dist: 0.35, r: 1.4, dur: 16, delay: 5 },
    { angle: 1.9,  dist: 0.55, r: 2.0, dur: 24, delay: 1 },
    { angle: 2.5,  dist: 0.72, r: 1.6, dur: 20, delay: 3 },
    { angle: 3.1,  dist: 0.28, r: 2.2, dur: 26, delay: 4 },
    { angle: 3.7,  dist: 0.60, r: 1.8, dur: 19, delay: 6 },
    { angle: 4.3,  dist: 0.45, r: 1.5, dur: 23, delay: 0 },
    { angle: 4.9,  dist: 0.75, r: 2.6, dur: 21, delay: 3 },
    { angle: 5.5,  dist: 0.38, r: 1.7, dur: 17, delay: 5 },
    { angle: 5.9,  dist: 0.62, r: 2.1, dur: 25, delay: 2 },
    { angle: 0.4,  dist: 0.52, r: 1.9, dur: 28, delay: 1 },
    { angle: 1.6,  dist: 0.30, r: 1.3, dur: 15, delay: 4 },
    { angle: 2.8,  dist: 0.66, r: 2.3, dur: 27, delay: 6 },
    { angle: 4.0,  dist: 0.48, r: 1.6, dur: 22, delay: 2 },
    { angle: 5.2,  dist: 0.58, r: 2.0, dur: 24, delay: 5 },
  ]

  return (
    <g opacity={0.65}>
      {particles.map((p, i) => {
        // Base position on a ring inside the sphere
        const baseX = centerX + Math.cos(p.angle) * sphereRadius * p.dist
        const baseY = centerY + Math.sin(p.angle) * sphereRadius * p.dist

        // Drift range — particles wander in a small area around their base position
        const driftRange = sphereRadius * 0.08
        const x1 = baseX - driftRange
        const x2 = baseX + driftRange * 0.6
        const x3 = baseX + driftRange * 0.2
        const y1 = baseY - driftRange * 0.4
        const y2 = baseY + driftRange
        const y3 = baseY - driftRange * 0.7

        return (
          <circle
            key={`particle-${i}`}
            cx={baseX}
            cy={baseY}
            r={p.r * 2}
            fill="#0c605a"
            opacity={1}
          >
            <animate
              attributeName="cx"
              values={`${baseX};${x1};${x2};${x3};${baseX}`}
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values={`${baseY};${y1};${y2};${y3};${baseY}`}
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.15;0.5;0.35;0.55;0.15"
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        )
      })}
    </g>
  )
}