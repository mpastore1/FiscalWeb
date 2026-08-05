'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

//const API_URL = 'http://localhost:8000' 
const API_URL = 'https://mj-prod-fiscal.hf.space'

// Bubble color palette
const BUBBLE_COLORS = [
  { bg: '#FEF3E2', border: '#F0C24A' },
  { bg: '#E8F5F3', border: '#0d9488' },
  { bg: '#FCE7E7', border: '#E07A5F' },
  { bg: '#E8EEF5', border: '#5F7A9A' },
  { bg: '#EEF5E8', border: '#5F9A7A' },
  { bg: '#F5E8F0', border: '#9A5F7A' },
  { bg: '#F5F0E8', border: '#8A6F4A' },
  { bg: '#E8E8F5', border: '#5F5F9A' },
]

const INCOME_COLOR = { bg: '#0f3c3a', border: '#0d9488', text: '#FDFBF5' }

function getColorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return BUBBLE_COLORS[Math.abs(hash) % BUBBLE_COLORS.length]
}

interface Merchant {
  name: string
  display_name: string
  total: number
  count: number
  transactions: Array<{ date: string; amount: number; name: string }>
}

interface Category {
  name: string
  raw_name: string
  total: number
  count: number
  merchants: Merchant[]
}

interface CashFlowData {
  income_total: number
  categories: Category[]
}

// Compute a bubble position on a fanned arc below the payroll bubble.
// Payroll sits at top center; categories fan out beneath in a downward arc.
function getFannedArcPosition(
  index: number, 
  total: number, 
  centerX: number, 
  originY: number,     // Y coordinate the arc emanates from (payroll bubble bottom)
  radius: number,      // arc radius
  arcSpan: number = Math.PI * 0.75,  // total angle of the arc (135° default)
) {
  // Distribute across the arc, centered on straight-down
  const startAngle = Math.PI / 2 - arcSpan / 2  // starts to the left
  const angleStep = total > 1 ? arcSpan / (total - 1) : 0
  const angle = startAngle + angleStep * index
  return {
    x: centerX + Math.cos(angle) * radius,
    y: originY + Math.sin(angle) * radius,
  }
}

function getBubbleSize(amount: number, maxAmount: number, minSize = 60, maxSize = 130) {
  const ratio = Math.sqrt(amount / maxAmount)
  return minSize + (maxSize - minSize) * ratio
}

// Focus knob — abstract dial that rotates as we zoom
function FocusKnob({ rotation }: { rotation: number }) {
  return (
    <div style={{
      position: 'absolute',
      top: 24,
      right: 24,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{ 
        fontSize: 8, 
        color: '#0d9488', 
        letterSpacing: 1.5, 
        fontWeight: 700, 
        fontFamily: 'monospace',
      }}>
        FOCUS
      </div>
      <div style={{
        position: 'relative',
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '2px solid #0d9488',
        backgroundColor: '#FDFBF5',
        boxShadow: '0 2px 4px rgba(13, 148, 136, 0.15)',
      }}>
        {/* Tick marks around the dial */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <div key={deg} style={{
            position: 'absolute',
            top: 2,
            left: '50%',
            marginLeft: -1,
            width: 2,
            height: 5,
            backgroundColor: '#0d9488',
            opacity: 0.35,
            transformOrigin: '50% 22px',  // Rotate around center of dial (22px from top of tick)
            transform: `rotate(${deg}deg)`,
          }} />
        ))}
        
        {/* The needle — rotates from the center */}
        <motion.div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 3,
            marginLeft: -1.5,
            height: 18,
            marginTop: -18,        // Position needle so its base is at center
            backgroundColor: '#E07A5F',
            borderRadius: 1,
            transformOrigin: '50% 100%',  // Rotate around bottom of needle (which is at center of dial)
          }}
          animate={{ rotate: rotation }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        />
        
        {/* Center dot — covers the needle base for a clean look */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          backgroundColor: '#0d9488',
          borderRadius: '50%',
        }} />
      </div>
    </div>
  )
}

// Floating opinion card — where Cheque Up's diagnosis streams in
function OpinionCard({ 
  title,
  content, 
  isStreaming,
}: { 
  title: string
  content: string
  isStreaming: boolean
}) {
  return (
    <motion.div
      key={title}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'absolute',
        top: 90,
        right: 24,
        width: 320,
        maxHeight: '65%',
        backgroundColor: '#FDFBF5',
        border: '2px solid #0d9488',
        borderRadius: 16,
        padding: 16,
        zIndex: 15,
        boxShadow: '0 6px 20px rgba(15, 60, 58, 0.15)',
        overflow: 'auto',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(13, 148, 136, 0.15)',
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#0d9488',
          animation: isStreaming ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        <div style={{ 
          fontSize: 10, 
          color: '#0d9488', 
          fontWeight: 700, 
          letterSpacing: 1.2, 
          textTransform: 'uppercase',
          fontFamily: 'monospace',
        }}>
          Cheque Up says
        </div>
      </div>
      <div style={{
        fontSize: 9,
        color: '#64748B',
        marginBottom: 8,
        fontFamily: 'monospace',
        letterSpacing: 0.5,
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: 13, 
        lineHeight: 1.6, 
        color: '#334155',
      }}>
        {content ? (
          <ReactMarkdown components={{
            p: ({children}) => <p style={{ marginBottom: 8 }}>{children}</p>,
            strong: ({children}) => <strong style={{ color: '#E07A5F', fontWeight: 600 }}>{children}</strong>,
          }}>
            {content}
          </ReactMarkdown>
        ) : (
          <div style={{ display: 'flex', gap: 4, color: '#0d9488' }}>
            <span className="animate-bounce">●</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </motion.div>
  )
}

export default function CashFlowDashboard() {
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [visibleCategories, setVisibleCategories] = useState(0)
  const [zoomedCategory, setZoomedCategory] = useState<Category | null>(null)
  const [zoomedMerchant, setZoomedMerchant] = useState<Merchant | null>(null)
  const [visibleMerchants, setVisibleMerchants] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 })
  
  // Opinion caching + streaming
  const [opinionContent, setOpinionContent] = useState('')
  const [opinionTitle, setOpinionTitle] = useState('')
  const [isOpinionStreaming, setIsOpinionStreaming] = useState(false)
  const opinionCacheRef = useRef<Record<string, string>>({})

  // Fetch data
  useEffect(() => {
    fetch(`${API_URL}/trial/cashflow/data`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        console.error('Cashflow fetch error:', e)
        setLoading(false)
      })
  }, [])

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Spawn category animation
  useEffect(() => {
    if (!hasStarted || !data) return
    setVisibleCategories(0)
    const total = Math.min(data.categories.length, 8)
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisibleCategories(i)
      if (i >= total) clearInterval(interval)
    }, 700)
    return () => clearInterval(interval)
  }, [hasStarted, data])

  // Spawn merchant animation (when zoomed into category)
  useEffect(() => {
    if (!zoomedCategory || zoomedMerchant) {
      setVisibleMerchants(0)
      return
    }
    setVisibleMerchants(0)
    const total = Math.min(zoomedCategory.merchants.length, 8)
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisibleMerchants(i)
      if (i >= total) clearInterval(interval)
    }, 400)
    return () => clearInterval(interval)
  }, [zoomedCategory, zoomedMerchant])

  // Stream an opinion from backend
  const streamOpinion = useCallback(async (cacheKey: string, title: string, payload: any) => {
    setOpinionTitle(title)

    // Check cache first
    if (opinionCacheRef.current[cacheKey]) {
      setOpinionContent(opinionCacheRef.current[cacheKey])
      setIsOpinionStreaming(false)
      return
    }
    
    setOpinionContent('')
    setIsOpinionStreaming(true)
    
    try {
      const res = await fetch(`${API_URL}/trial/cashflow/opinion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            const dataLine = line.replace('data: ', '').trim()
            if (dataLine === '[DONE]') continue
            try {
              const json = JSON.parse(dataLine)
              if (json.chunk) {
                full += json.chunk
                // Strip any chart syntax that leaks
                const cleaned = full
                  .replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/g, '')
                  .replace(/\[CHART_DATA\][\s\S]*$/g, '')
                setOpinionContent(cleaned)
              }
            } catch {}
          }
        }
      }
      
      // Cache it
      opinionCacheRef.current[cacheKey] = full.replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/g, '')
    } catch (e) {
      console.error('Opinion stream error:', e)
    } finally {
      setIsOpinionStreaming(false)
    }
  }, [])

  // Trigger overview opinion when all categories have spawned
  useEffect(() => {
    if (!data || !hasStarted || zoomedCategory) return
    const total = Math.min(data.categories.length, 8)
    if (visibleCategories >= total) {
      const topCats = data.categories.slice(0, 6).map(c => ({
        name: c.name,
        total: c.total,
        count: c.count,
      }))
      streamOpinion('overview', 'Monthly Overview', {
        level: 'overview',
        income_total: data.income_total,
        top_categories: topCats,
      })
    }
  }, [visibleCategories, data, hasStarted, zoomedCategory, streamOpinion])

  // Trigger category opinion when zooming into a category
  useEffect(() => {
    if (!zoomedCategory || zoomedMerchant || !data) return
    const cacheKey = `category-${zoomedCategory.raw_name}`
    streamOpinion(cacheKey, zoomedCategory.name, {
      level: 'category',
      category_name: zoomedCategory.name,
      category_total: zoomedCategory.total,
      category_count: zoomedCategory.count,
      income_total: data.income_total,
      top_merchants: zoomedCategory.merchants.slice(0, 5).map(m => ({
        name: m.display_name,
        total: m.total,
        count: m.count,
      })),
    })
  }, [zoomedCategory, zoomedMerchant, data, streamOpinion])

  // Trigger merchant opinion when zooming into a merchant
  useEffect(() => {
    if (!zoomedMerchant || !zoomedCategory) return
    const cacheKey = `merchant-${zoomedMerchant.name}`
    streamOpinion(cacheKey, zoomedMerchant.display_name, {
      level: 'merchant',
      merchant_name: zoomedMerchant.display_name,
      merchant_total: zoomedMerchant.total,
      merchant_count: zoomedMerchant.count,
      category_name: zoomedCategory.name,
      transactions: zoomedMerchant.transactions.slice(0, 5),
    })
  }, [zoomedMerchant, zoomedCategory, streamOpinion])

  // Layout math
  const centerX = containerSize.width / 2
  const payrollY = 130   // Payroll bubble Y position (top center)
  const payrollBaseSize = 180
  
  const visibleCategoriesData = data?.categories.slice(0, visibleCategories) || []
  const totalDeducted = visibleCategoriesData.reduce((sum, c) => sum + c.total, 0)
  const remaining = data ? data.income_total - totalDeducted : 0
  const remainingPercent = data && data.income_total > 0 ? remaining / data.income_total : 1
  
  // Payroll shrinks as expenses come out
  const payrollSize = 100 + (payrollBaseSize - 100) * Math.max(0.35, remainingPercent)
  
  // Arc parameters
  const arcOriginY = payrollY + payrollSize / 2 + 20    // just below payroll
  const arcRadius = Math.min(containerSize.width * 0.35, containerSize.height * 0.45)
  
  const maxCategoryAmount = Math.max(...(data?.categories.slice(0, 8).map(c => c.total) || [1]))
  const numCategories = Math.min(data?.categories.length || 0, 8)

  // Focus knob rotation state
  let knobRotation = 0
  if (zoomedMerchant) knobRotation = 240
  else if (zoomedCategory) knobRotation = 120

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        height: '100%', color: '#0d9488', fontSize: 14,
      }}>
        Loading your cash flow...
      </div>
    )
  }

  if (!data || data.income_total === 0) {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', height: '100%', gap: 12,
      }}>
        <p style={{ color: '#94A3B8', fontSize: 14 }}>No income data available</p>
      </div>
    )
  }

  const isZoomed = !!zoomedCategory
  const isDeepZoomed = !!zoomedMerchant

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', height: '100%', position: 'relative',
        backgroundColor: '#FDFBF5', borderRadius: 24, overflow: 'hidden',
      }}
    >
      {/* Microscope vignette — appears when zoomed */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at center, transparent 40%, rgba(15, 60, 58, 0.35) 100%)',
              zIndex: 8,
            }}
          />
        )}
      </AnimatePresence>

      {/* Breadcrumb */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 20,
        fontSize: 11, color: '#64748B', fontFamily: 'monospace',
        letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>CASH FLOW · 30 DAYS</span>
        {zoomedCategory && (
          <>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: '#0d9488' }}>{zoomedCategory.name.toUpperCase()}</span>
          </>
        )}
        {zoomedMerchant && (
          <>
            <span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: '#0d9488' }}>{zoomedMerchant.display_name.toUpperCase()}</span>
          </>
        )}
      </div>

      {/* Focus knob (only shows after animation started) */}
      {hasStarted && <FocusKnob rotation={knobRotation} />}

      {/* Back / Replay buttons */}
      <div style={{
        position: 'absolute', top: 80, left: 20, zIndex: 20,
        display: 'flex', gap: 8,
      }}>
        {(zoomedCategory || zoomedMerchant) && (
          <button
            onClick={() => {
              if (zoomedMerchant) setZoomedMerchant(null)
              else setZoomedCategory(null)
            }}
            style={{
              padding: '6px 14px', fontSize: 12, backgroundColor: 'white',
              color: '#0d9488', border: '1px solid #0d9488', borderRadius: 20,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            ← Back
          </button>
        )}
        {hasStarted && !zoomedCategory && !zoomedMerchant && (
          <button
            onClick={() => {
              setHasStarted(false)
              opinionCacheRef.current = {}
              setOpinionContent('')
              setOpinionTitle('')
              setTimeout(() => setHasStarted(true), 80)
            }}
            style={{
              padding: '6px 14px', fontSize: 12, backgroundColor: 'white',
              color: '#0d9488', border: '1px solid #0d9488', borderRadius: 20,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            ↻ Replay
          </button>
        )}
      </div>

      {/* Start screen */}
      {!hasStarted && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{ 
            fontSize: 15, color: '#0f3c3a', fontWeight: 600, textAlign: 'center', 
            maxWidth: 320, lineHeight: 1.5,
          }}>
            Take a look at your money flow.
          </div>
          <div style={{ 
            fontSize: 12, color: '#64748B', textAlign: 'center', 
            maxWidth: 320, lineHeight: 1.5,
          }}>
            Watch your income and expenses come to life.<br/>
            Click any bubble to zoom in for a closer look.
          </div>
          <button
            onClick={() => setHasStarted(true)}
            style={{
              marginTop: 8, padding: '14px 40px', fontSize: 15, fontWeight: 700, 
              color: 'white', backgroundColor: '#0d9488', border: 'none', borderRadius: 30,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
            }}
          >
            ▶ Start
          </button>
        </div>
      )}

      {/* TOP-LEVEL VIEW: Payroll + Category bubbles */}
      {hasStarted && !zoomedCategory && (
        <>
          {/* Connecting lines from payroll to categories */}
          <svg style={{ 
            position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
          }}>
            {visibleCategoriesData.map((cat, i) => {
              const color = getColorForId(cat.raw_name)
              const pos = getFannedArcPosition(i, numCategories, centerX, arcOriginY, arcRadius)
              return (
                <motion.line
                  key={cat.raw_name}
                  x1={centerX}
                  y1={payrollY + payrollSize / 2}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={color.border}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  opacity={0.5}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              )
            })}
          </svg>

          {/* Payroll bubble at top center */}
          <motion.div
            style={{
              position: 'absolute',
              left: centerX - payrollSize / 2,
              top: payrollY - payrollSize / 2 + payrollSize / 2,
              width: payrollSize,
              height: payrollSize,
              borderRadius: '50%',
              backgroundColor: INCOME_COLOR.bg,
              border: `3px solid ${INCOME_COLOR.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: INCOME_COLOR.text,
              boxShadow: '0 4px 20px rgba(15, 60, 58, 0.3)',
              zIndex: 5,
            }}
            animate={{
              width: payrollSize,
              height: payrollSize,
              left: centerX - payrollSize / 2,
              top: payrollY - payrollSize / 2 + payrollSize / 2,
            }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div style={{ fontSize: 10, opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>
              {remaining >= 0 ? 'Remaining' : 'Over'}
            </div>
            <div style={{ fontSize: payrollSize > 140 ? 26 : 20, fontWeight: 700 }}>
              ${Math.abs(remaining).toFixed(0)}
            </div>
            <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>
              of ${data.income_total.toFixed(0)} income
            </div>
          </motion.div>

          {/* Category bubbles fanned below */}
          <AnimatePresence>
            {visibleCategoriesData.map((cat, i) => {
              const color = getColorForId(cat.raw_name)
              const size = getBubbleSize(cat.total, maxCategoryAmount)
              const pos = getFannedArcPosition(i, numCategories, centerX, arcOriginY, arcRadius)
              
              return (
                <motion.div
                  key={cat.raw_name}
                  onClick={() => setZoomedCategory(cat)}
                  style={{
                    position: 'absolute',
                    borderRadius: '50%',
                    backgroundColor: color.bg,
                    border: `3px solid ${color.border}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 8, textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 6,
                  }}
                  initial={{ 
                    scale: 0, opacity: 0,
                    width: size, height: size,
                    left: centerX - size / 2, 
                    top: payrollY - size / 2,
                  }}
                  animate={{ 
                    scale: 1, opacity: 1,
                    width: size, height: size,
                    left: pos.x - size / 2, 
                    top: pos.y - size / 2,
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ 
                    duration: 0.7, 
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  whileHover={{ scale: 1.08 }}
                >
                  <div style={{ 
                    fontSize: size > 100 ? 11 : 9, fontWeight: 700, 
                    color: '#0f3c3a', lineHeight: 1.1,
                  }}>
                    {cat.name}
                  </div>
                  <div style={{ 
                    fontSize: size > 100 ? 15 : 12, fontWeight: 700, 
                    color: color.border, marginTop: 2,
                  }}>
                    ${cat.total.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>
                    {cat.count} txn{cat.count !== 1 ? 's' : ''}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </>
      )}

      {/* ZOOMED-IN VIEW: Category + merchants */}
      {zoomedCategory && !zoomedMerchant && (
        <ZoomedCategoryView
          category={zoomedCategory}
          visibleMerchants={visibleMerchants}
          containerSize={containerSize}
          onMerchantClick={(m) => setZoomedMerchant(m)}
        />
      )}

      {/* DEEPEST ZOOM: single merchant */}
      {zoomedMerchant && zoomedCategory && (
        <ZoomedMerchantView
          merchant={zoomedMerchant}
          category={zoomedCategory}
          containerSize={containerSize}
        />
      )}

      {/* Opinion card — appears alongside all views once we have content */}
      <AnimatePresence mode="wait">
        {hasStarted && opinionTitle && (
          <OpinionCard
            title={opinionTitle}
            content={opinionContent}
            isStreaming={isOpinionStreaming}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Zoomed-in category view (merchants)
function ZoomedCategoryView({ 
  category, visibleMerchants, containerSize, onMerchantClick,
}: { 
  category: Category
  visibleMerchants: number
  containerSize: { width: number; height: number }
  onMerchantClick: (m: Merchant) => void
}) {
  const color = getColorForId(category.raw_name)
  const centerX = containerSize.width / 2
  const categoryY = 130
  const categorySize = 180
  const arcOriginY = categoryY + categorySize / 2 + 20
  const arcRadius = Math.min(containerSize.width * 0.35, containerSize.height * 0.45)
  const maxMerchantAmount = Math.max(...category.merchants.slice(0, 8).map(m => m.total), 1)
  const visibleMerchantsData = category.merchants.slice(0, visibleMerchants)
  const numMerchants = Math.min(category.merchants.length, 8)

  return (
    <>
      {/* Lines from category to merchants */}
      <svg style={{ 
        position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
      }}>
        {visibleMerchantsData.map((merchant, i) => {
          const pos = getFannedArcPosition(i, numMerchants, centerX, arcOriginY, arcRadius)
          return (
            <motion.line
              key={merchant.name}
              x1={centerX} y1={categoryY + categorySize / 2}
              x2={pos.x} y2={pos.y}
              stroke={color.border} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 0.4 }}
            />
          )
        })}
      </svg>

      {/* Category bubble at top */}
      <motion.div
        style={{
          position: 'absolute',
          left: centerX - categorySize / 2,
          top: categoryY,
          width: categorySize, height: categorySize,
          borderRadius: '50%',
          backgroundColor: color.bg,
          border: `4px solid ${color.border}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#0f3c3a',
          boxShadow: `0 6px 24px ${color.border}40`,
          zIndex: 10, padding: 16, textAlign: 'center',
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div style={{ 
          fontSize: 10, opacity: 0.7, letterSpacing: 1.2, 
          textTransform: 'uppercase', color: color.border, fontWeight: 700,
        }}>
          {category.name}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#0f3c3a', marginTop: 4 }}>
          ${category.total.toFixed(0)}
        </div>
        <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
          {category.count} transaction{category.count !== 1 ? 's' : ''}
        </div>
      </motion.div>

      {/* Merchant sub-bubbles */}
      <AnimatePresence>
        {visibleMerchantsData.map((merchant, i) => {
          const size = getBubbleSize(merchant.total, maxMerchantAmount, 55, 110)
          const pos = getFannedArcPosition(i, numMerchants, centerX, arcOriginY, arcRadius)
          const merchantColor = getColorForId(merchant.name)
          
          return (
            <motion.div
              key={merchant.name}
              onClick={() => onMerchantClick(merchant)}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                backgroundColor: merchantColor.bg,
                border: `2px solid ${merchantColor.border}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 6, textAlign: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 10,
              }}
              initial={{ 
                scale: 0, opacity: 0,
                width: size, height: size,
                left: centerX - size / 2, 
                top: categoryY - size / 2,
              }}
              animate={{ 
                scale: 1, opacity: 1,
                width: size, height: size,
                left: pos.x - size / 2, 
                top: pos.y - size / 2,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              whileHover={{ scale: 1.08 }}
            >
              <div style={{ 
                fontSize: 9, fontWeight: 600, color: '#0f3c3a', lineHeight: 1.1,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const, maxWidth: '100%',
              }}>
                {merchant.display_name}
              </div>
              <div style={{ 
                fontSize: size > 80 ? 12 : 10, fontWeight: 700, 
                color: merchantColor.border, marginTop: 2,
              }}>
                ${merchant.total.toFixed(0)}
              </div>
              <div style={{ fontSize: 7, color: '#64748B', marginTop: 1 }}>
                {merchant.count}×
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </>
  )
}

// Deepest zoom — single merchant
function ZoomedMerchantView({ 
  merchant, category, containerSize,
}: { 
  merchant: Merchant
  category: Category
  containerSize: { width: number; height: number }
}) {
  const merchantColor = getColorForId(merchant.name)
  const centerX = containerSize.width / 2
  const centerY = containerSize.height / 2 - 20
  const mainSize = 240

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: centerX - mainSize / 2,
        top: centerY - mainSize / 2,
        width: mainSize,
        height: mainSize,
        borderRadius: '50%',
        backgroundColor: merchantColor.bg,
        border: `5px solid ${merchantColor.border}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#0f3c3a',
        boxShadow: `0 10px 40px ${merchantColor.border}60`,
        zIndex: 10, padding: 20, textAlign: 'center',
      }}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.34, 1.4, 0.5, 1] }}
    >
      <div style={{ 
        fontSize: 10, opacity: 0.7, letterSpacing: 1.5, 
        textTransform: 'uppercase', color: merchantColor.border, fontWeight: 700,
      }}>
        {category.name}
      </div>
      <div style={{ 
        fontSize: 18, fontWeight: 700, color: '#0f3c3a', marginTop: 8, 
        lineHeight: 1.2, maxWidth: '80%',
      }}>
        {merchant.display_name}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: merchantColor.border, marginTop: 8 }}>
        ${merchant.total.toFixed(2)}
      </div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
        {merchant.count} transaction{merchant.count !== 1 ? 's' : ''} · avg ${(merchant.total / merchant.count).toFixed(2)}
      </div>
    </motion.div>
  )
}