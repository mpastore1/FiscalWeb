'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'
import { usePlaidLink } from 'react-plaid-link'
import ReactMarkdown from 'react-markdown'
import dynamic from 'next/dynamic';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, ReferenceLine
} from 'recharts'




const supabase = createClient(
  'https://iymwleromrtbsthtlptk.supabase.co',
  'sb_publishable_AZafK1NNF2CmXg4cTmTxhg_-sxIpa-d'
)

const HF_URL ='https://mj-prod-fiscal.hf.space' //'http://localhost:8000'
//const HF_URL ='http://localhost:8000'


interface Message {
  text: string
  isUser: boolean
  chartData?: any
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  created_at: string
}

function PlaidLinkButton({ authToken, plaidLinked, onSuccess, onDisconnect, triggerOpen, onTriggered }: { 
  authToken: string
  plaidLinked: boolean
  onSuccess: (accessToken: string) => void
  onDisconnect: () => void
  triggerOpen?: boolean
  onTriggered?: () => void
}) {
  const [linkToken, setLinkToken] = useState('')
  const linkTokenFetched = useRef(false)

  useEffect(() => {
    if (linkTokenFetched.current || plaidLinked || !authToken) return
    linkTokenFetched.current = true
    
    const fetchToken = async () => {
      try {
        const res = await fetch(`${HF_URL}/plaid/create_link_token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const data = await res.json()
        setLinkToken(data.link_token || '')
      } catch (e) {
        console.error('Link token error:', e)
      }
    }
    fetchToken()
  }, [authToken, plaidLinked])

  const { open, ready } = usePlaidLink({
    token: linkToken || null,
    onSuccess: async (public_token) => {
      try {
        const res = await fetch(`${HF_URL}/plaid/exchange_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ public_token })
        })
        const data = await res.json()
        if (data.access_token) {
          onSuccess(data.access_token)
        }
      } catch (e) {
        console.error('Exchange token error:', e)
      }
    }
  })

  useEffect(() => {
    if (triggerOpen && ready && !plaidLinked) {
      open()
      onTriggered?.()
    }
  }, [triggerOpen, ready, plaidLinked])

  // Reset on disconnect so a new token can be fetched
  useEffect(() => {
    if (!plaidLinked) {
      linkTokenFetched.current = false
    }
  }, [plaidLinked])

  if (plaidLinked) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 text-sm">✅ Bank Connected</span>
        </div>
        <button
          onClick={onDisconnect}
          className="text-slate-500 hover:text-red-400 text-xs transition text-left"
        >
          Disconnect bank
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="text-slate-400 hover:text-white text-sm transition text-left disabled:opacity-40"
    >
      🏦 Link Bank Account
    </button>
  )
}


function InlineChart({ chart }: { chart: any }) {
  const COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#818cf8', '#2dd4bf', '#fb923c', '#e879f9']

  // Detect data keys for multi-series charts
  const getSeriesKeys = (data: any[]) => {
    if (!data || data.length === 0) return []
    return Object.keys(data[0]).filter(k => 
      k !== 'name' && k !== 'label' && k !== 'detail' && k !== 'month' && k !== 'year' && k !== 'day' && k !== 'date' && k !== 'goal'
    )
  }

  const getXKey = (data: any[]) => {
    if (!data || data.length === 0) return 'name'
    const keys = Object.keys(data[0])
    const xKeys = ['name', 'label', 'month', 'year', 'day', 'date']
    return xKeys.find(k => keys.includes(k)) || keys[0]
  }

  return (
    <div className="mt-4 ml-10 animate-fadeIn">
      <div className="bg-[#111827] rounded-2xl p-4 border border-slate-800">
        <h3 className="text-white font-bold text-sm mb-1">{chart.title}</h3>
        {chart.subtitle && <p className="text-slate-500 text-[10px] mb-4">{chart.subtitle}</p>}

        {chart.type === 'pie' && (
  <div className="flex flex-col md:flex-row items-center gap-4">
    <div className="w-full md:w-1/2" style={{ minHeight: '220px' }}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chart.data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
            {chart.data.map((_: any, index: number) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0D1B2E', border: '1px solid #1e293b', borderRadius: '12px' }}
            formatter={(value: any) => [`${value}%`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="space-y-2 w-full md:w-1/2">
      {chart.data.map((item: any, i: number) => (
        <div key={item.name} className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
          <div>
            <span className="text-white text-xs font-semibold">{item.name}</span>
            {item.detail && <p className="text-slate-500 text-[10px]">{item.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

        {chart.type === 'bar' && (() => {
          const seriesKeys = getSeriesKeys(chart.data)
          const xKey = getXKey(chart.data)
          return (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.data} margin={{ top: 5, right: 5, left: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => typeof v === 'number' && v > 1000 ? `$${(v/1000).toFixed(0)}K` : `${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#0D1B2E', border: '1px solid #1e293b', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} name={key.charAt(0).toUpperCase() + key.slice(1)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )
        })()}

        {(chart.type === 'area' || chart.type === 'line') && (() => {
          const seriesKeys = getSeriesKeys(chart.data)
          const xKey = getXKey(chart.data)
          return (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chart.data} margin={{ top: 5, right: 5, left: 5, bottom: 20 }}>
                <defs>
                  {seriesKeys.map((key, i) => (
                    <linearGradient key={key} id={`grad_${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS[i]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS[i]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-45} textAnchor="end" interval={Math.max(0, Math.floor(chart.data.length / 6))} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => typeof v === 'number' && v > 1000 ? `$${(v/1000).toFixed(0)}K` : `${v}`} width={55} />
                <Tooltip contentStyle={{ backgroundColor: '#0D1B2E', border: '1px solid #1e293b', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesKeys.map((key, i) => (
                  <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i]} strokeWidth={2} fill={`url(#grad_${key})`} dot={false} name={key.charAt(0).toUpperCase() + key.slice(1)} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )
        })()}
      </div>
    </div>
  )
}

export default function Home() {
  const [authToken, setAuthToken] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [plaidLinked, setPlaidLinked] = useState(false)
  const [plaidAccessToken, setPlaidAccessToken] = useState('')
  const [chartData, setChartData] = useState<any>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const inChartRef = useRef(false)
  const [inlineChartLoading, setInlineChartLoading] = useState(false)
  const [canadianBanks, setCanadianBanks] = useState<any[]>([])
  const [triggerPlaidLink, setTriggerPlaidLink] = useState(false)
  const [bankInfo, setBankInfo] = useState<any>(null)
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'calendar'>('chat')
  const [calendarData, setCalendarData] = useState<any>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())

useEffect(() => {
  const init = async () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setAuthToken(session.access_token)
        setUserId(session.user.id)
        setIsLoggedIn(true)
        await loadConversations(session.user.id)
      }
    })

    // Check for existing session
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      setAuthToken(data.session.access_token)
      setUserId(data.session.user.id)
      setIsLoggedIn(true)
      await loadConversations(data.session.user.id)
    }
  }
  init()
}, [])

useEffect(() => {
  if (!plaidAccessToken || !authToken) return
  
  if (activeTab === 'calendar' && !calendarData) {
    fetchCalendarData(plaidAccessToken)
  }

  if (activeTab === 'dashboard' && !chartData) {
    loadChartData()
  }
}, [plaidAccessToken, activeTab, authToken])

const fetchCalendarData = async (accessToken: string, token?: string) => {
  const auth = token || authToken
  setCalendarLoading(true)
  
  // Retry only for PRODUCT_NOT_READY
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`${HF_URL}/plaid/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth}`
        },
        body: JSON.stringify({ message: '', access_token: accessToken })
      })
      const data = await res.json()
      
      if (data.not_ready) {
        console.log(`Plaid not ready, retry ${i + 1}/6...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
        continue
      }
      
      // Got data — show it, done
      setCalendarData(data)
      setCalendarLoading(false)
      return
      
    } catch (e) {
      console.error('Calendar fetch error:', e)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
  
  setCalendarLoading(false)
}

  const loadConversations = async (uid: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
    if (data) setConversations(data)
  }

  const saveConversation = async (msgs: Message[], convId: string | null) => {
    if (!userId || msgs.length === 0) return

    const title = msgs[0]?.text?.slice(0, 40) || 'New Conversation'

    if (convId) {
      await supabase
        .from('conversations')
        .update({ messages: msgs, title, updated_at: new Date().toISOString() })
        .eq('id', convId)
    } else {
      const { data } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title, messages: msgs })
        .select()
        .single()
      if (data) {
        setCurrentConvId(data.id)
        setConversations(prev => [data, ...prev])
        return data.id
      }
    }
    await loadConversations(userId)
    return convId
  }

  const loadConversation = async (conv: Conversation) => {
    setMessages(conv.messages)
    setCurrentConvId(conv.id)    
    setHasStarted(conv.messages.length > 0)
    setSidebarOpen(false)

     await fetch(`${HF_URL}/load_history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ messages: conv.messages })
  })
  }

  const newConversation = async () => {
    setMessages([])
    setCurrentConvId(null)
    setHasStarted(false)
    setSidebarOpen(false)
    await fetch(`${HF_URL}/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConvId === id) {
      setMessages([])
      setCurrentConvId(null)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAuthLoading(true)
    setAuthError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setAuthError(error.message)
      setIsAuthLoading(false)
      return
    }

    await fetch(`${HF_URL}/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${data.session!.access_token}` }
    })

    setAuthToken(data.session!.access_token)
    setUserId(data.session!.user.id)
    setIsLoggedIn(true)
    await loadConversations(data.session!.user.id)
    setIsAuthLoading(false)
  }

 const handleSignUp = async (e?: React.FormEvent) => {
  e?.preventDefault()
  setIsAuthLoading(true)
  setAuthError('')

  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    }
  })

  if (error) {
    setAuthError(error.message)
    setIsAuthLoading(false)
    return
  }

  if (data.session) {
    setAuthToken(data.session.access_token)
    setUserId(data.session.user.id)
    setIsLoggedIn(true)
  } else {
    setAuthError('Check your email to confirm your account.')
  }
  setIsAuthLoading(false)
}

  const handleGoogleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/(\d+)\.\s*\n+\s*/g, '$1. ')
}

const loadChartData = async () => {
  console.log('loadChartData called, plaidAccessToken:', plaidAccessToken)
  if (!plaidAccessToken) {
    console.log('No plaid access token, skipping')
    return
  }
  setChartLoading(true)
  try {
    const res = await fetch(`${HF_URL}/plaid/chart_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ message: '', access_token: plaidAccessToken })
    })
    const data = await res.json()
    console.log('Chart data received:', data)
    setChartData(data)
  } catch (e) {
    console.error('Chart data error:', e)
  }
  setChartLoading(false)
}

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isResponding) return
    setHasStarted(true)
    inChartRef.current = false
    setInput('')
    setIsResponding(true)

 const newMessages: Message[] = [...messages, { text, isUser: true }, { text: '', isUser: false }]
    setMessages(newMessages)
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)

    try {
      const response = await fetch(`${HF_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: text, access_token: plaidAccessToken })
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

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
              if (json.reauth) {
                setPlaidLinked(false)
                setPlaidAccessToken('')
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    text: 'Your bank connection has expired. Please reconnect your bank account in the sidebar to continue getting personalized advice.',
                    isUser: false
                  }
                  return updated
                })
                setIsResponding(false)
                return
              }
              const chunk = json.chunk || ''
              
              
              if (chunk) {
                fullResponse += chunk
                
                const chartIdx = fullResponse.indexOf('[CHART')
                let displayText: string
                
                if (chartIdx > -1) {
                  displayText = fullResponse.substring(0, chartIdx).trim()
                  inChartRef.current = true
                  if (!inlineChartLoading) setInlineChartLoading(true)
                } else {
                  displayText = fullResponse
                }
                
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { text: displayText, isUser: false }
                  return updated
                })
              }
            } catch {}
          }
        }
      }

    const { cleanText, chart } = extractChartData(fullResponse)

      // Show final text + chart
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          text: cleanText,
          isUser: false,
          chartData: chart
        }
        return updated
      })

      setInlineChartLoading(false)

      const finalMessages: Message[] = [
        ...messages,
        { text, isUser: true },
        { text: cleanText, isUser: false, chartData: chart }
      ]
      const newId = await saveConversation(finalMessages, currentConvId)
      if (newId && !currentConvId) setCurrentConvId(newId as string)

    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { text: 'Sorry, something went wrong.', isUser: false }
        return updated
      })
    }

    setIsResponding(false)
  }

const extractChartData = (text: string): { cleanText: string; chart: any | null } => {
  const chartMatch = text.match(/\[CHART_DATA\]\s*([\s\S]*?)\s*\[\/CHART_DATA\]/)
  if (chartMatch) {
    try {
      const chart = JSON.parse(chartMatch[1].trim())
      const cleanText = text.replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/, '').trim()
      return { cleanText, chart }
    } catch {
      return { cleanText: text.replace(/\[CHART_DATA\][\s\S]*?\[\/CHART_DATA\]/, '').trim(), chart: null }
    }
  }
  return { cleanText: text, chart: null }
}

  // Login Screen
 if (!isLoggedIn) {
  return (
    <div className="min-h-screen bg-[#080E1A] relative overflow-hidden flex">
      
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl -top-48 -left-24 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-3xl top-1/2 -right-32 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-sky-400/5 blur-3xl bottom-0 left-1/3 animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        {[
          { l: 5, t: 15, d: 8, dl: 1.2 }, { l: 15, t: 72, d: 12, dl: 3.1 },
          { l: 25, t: 33, d: 6, dl: 0.5 }, { l: 35, t: 85, d: 10, dl: 2.8 },
          { l: 45, t: 20, d: 14, dl: 4.2 }, { l: 55, t: 60, d: 7, dl: 1.9 },
          { l: 65, t: 42, d: 11, dl: 3.5 }, { l: 75, t: 88, d: 9, dl: 0.8 },
          { l: 85, t: 28, d: 13, dl: 2.3 }, { l: 92, t: 55, d: 6, dl: 4.7 },
          { l: 10, t: 48, d: 8, dl: 1.6 }, { l: 30, t: 12, d: 11, dl: 3.9 },
          { l: 50, t: 78, d: 7, dl: 0.3 }, { l: 70, t: 35, d: 13, dl: 2.1 },
          { l: 88, t: 65, d: 9, dl: 4.4 }, { l: 8, t: 90, d: 10, dl: 1.0 },
          { l: 42, t: 5, d: 12, dl: 3.3 }, { l: 62, t: 92, d: 6, dl: 2.6 },
          { l: 78, t: 18, d: 14, dl: 0.7 }, { l: 20, t: 52, d: 8, dl: 4.0 },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-sky-400/100 rounded-full"
            style={{
              left: `${p.l}%`,
              top: `${p.t}%`,
              animation: `float ${5 + p.d}s ease-in-out infinite`,
              animationDelay: `${p.dl}s`,
            }}
          />
        ))}
      </div>

      {/* Left side — Auth */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative flex items-center justify-center w-24 h-24 mb-4">
              <div className="absolute inset-0 rounded-full bg-sky-400/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-2 rounded-full bg-sky-400/15 animate-pulse" style={{ animationDuration: '1.6s' }} />
              <Image src="/fiscallogo_nobg.png" alt="FISCAL" width={80} height={80} className="relative z-10" priority />
            </div>
            <h1 className="text-white text-2xl font-bold">FISCAL</h1>
            <p className="text-slate-400 text-sm mt-1">Your AI Budgeting Assistant</p>
          </div>

          {/* Auth Card */}
          <div className="bg-[#0D1B2E]/80 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-6">
            
            {/* Tab Toggle */}
            <div className="flex bg-[#111827] rounded-xl p-1 mb-6">
              <button
                onClick={() => { setAuthMode('signin'); setAuthError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  authMode === 'signin' ? 'bg-sky-400 text-[#080E1A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  authMode === 'signup' ? 'bg-sky-400 text-[#080E1A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={authMode === 'signin' ? handleLogin : handleSignUp} className="flex flex-col gap-3">
              <div className={`grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300 ${
                authMode === 'signup' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <input type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none text-sm" />
                <input type="text" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none text-sm" />
              </div>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none text-sm" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none text-sm" />

              <div className={`overflow-hidden transition-all duration-300 ${authMode === 'signup' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-sky-400" />
                  <span className="text-slate-400 text-xs leading-relaxed">
                    I agree to the{' '}
                    <a href="/privacy" target="_blank" className="text-sky-400 underline hover:text-sky-300">Privacy Policy</a>
                    {' '}and{' '}
                    <a href="/terms" target="_blank" className="text-sky-400 underline hover:text-sky-300">Terms of Service</a>
                  </span>
                </label>
              </div>

              {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}

              <button type="submit" disabled={isAuthLoading || (authMode === 'signup' && !acceptedTerms)} className="bg-sky-400 text-[#080E1A] py-3 rounded-xl font-bold hover:bg-sky-300 transition disabled:opacity-50">
                {isAuthLoading ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...') : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-xs">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {authMode === 'signup' && !acceptedTerms ? (
              <button disabled className="w-full flex items-center justify-center gap-3 bg-white/50 text-gray-400 py-3 rounded-xl font-semibold cursor-not-allowed">
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>
            ) : (
              <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-100 transition">
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right side — Video (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-slate-800/50 shadow-2xl shadow-sky-500/5">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto rounded-2xl"
          >
            <source src="/FiscalLogo_long.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  )
}

  // Chat Screen
  return (
    <div className="h-screen bg-[#080E1A] flex overflow-hidden">

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

     {/* Sidebar */}
<aside className={`fixed md:relative z-30 h-screen bg-[#0D1B2E] border-r border-slate-800 flex flex-col transition-all duration-300 ${
  sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
} ${sidebarCollapsed ? 'md:w-14' : 'w-72'}`}>
  
  {/* Sidebar Header */}
  <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
    {!sidebarCollapsed && (
      <div className="flex items-center gap-2">
        <Image src="/fiscallogo_nobg.png" alt="FISCAL" width={24} height={24} />
        <span className="text-white font-bold text-sm">FISCAL</span>
      </div>
    )}
    <button
      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      className="text-slate-400 hover:text-white transition ml-auto hidden md:block"
    >
      {sidebarCollapsed ? '→' : '←'}
    </button>
    <button
      onClick={() => setSidebarOpen(false)}
      className="text-slate-400 hover:text-white transition md:hidden"
    >
      ✕
    </button>
  </div>

  {!sidebarCollapsed && (
    <>
{/* New Conversation */}
<div className="p-3 shrink-0">
  <button
    onClick={newConversation}
    className="w-full bg-sky-400 text-[#080E1A] py-2 rounded-xl font-semibold text-sm hover:bg-sky-300 transition"
  >
    + New Conversation
  </button>
  <button
    onClick={async () => {
      setActiveTab('calendar')
      setSidebarOpen(false)
      if (plaidAccessToken && !calendarData) {
        setCalendarLoading(true)
        try {
          const res = await fetch(`${HF_URL}/plaid/recurring`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ message: '', access_token: plaidAccessToken })
          })
          const data = await res.json()
          setCalendarData(data)
        } catch (e) {
          console.error('Calendar data error:', e)
        }
        setCalendarLoading(false)
      }
    }}
    className={`w-full mt-2 py-2 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
      activeTab === 'calendar'
        ? 'bg-sky-400/10 text-sky-400 border border-sky-400/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700'
    }`}
  >
    📅 Calendar
  </button>
</div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-center bg-[#111827] rounded-xl px-3 py-2 border border-slate-700 focus-within:border-sky-400/50 transition">
          <span className="text-slate-500 text-xs mr-2">🔍</span>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-white placeholder-slate-500 outline-none text-xs flex-1"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        {conversations.length === 0 && (
          <p className="text-slate-500 text-xs text-center mt-4">No conversations yet</p>
        )}
        {conversations
          .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(conv => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer group mb-1 ${
                currentConvId === conv.id ? 'bg-sky-400/10 border border-sky-400/20' : 'hover:bg-slate-800'
              }`}
            >
              <span className="text-slate-300 text-xs truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="text-slate-600 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        {searchQuery && conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
          <p className="text-slate-500 text-xs text-center mt-4">No results found</p>
        )}
      </div>

{/* Bank + Sign Out */}
<div className="p-4 border-t border-slate-800 shrink-0 flex flex-col gap-3">
<PlaidLinkButton
  authToken={authToken}
  plaidLinked={plaidLinked}
  triggerOpen={triggerPlaidLink}
  onTriggered={() => setTriggerPlaidLink(false)}

  onSuccess={async (accessToken) => {
  setPlaidAccessToken(accessToken)
  setPlaidLinked(true)
  setCalendarData(null)  // Force refetch
  setChartData(null)
  // Wait for Plaid to sync transactions
  if (activeTab === 'calendar') {
    setCalendarLoading(true)
    fetchCalendarData(accessToken)

    // Delay 3 seconds to let Plaid sync
    await new Promise(resolve => setTimeout(resolve, 3000))
    try {
      const res = await fetch(`${HF_URL}/plaid/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: '', access_token: accessToken })
      })
      const data = await res.json()
      setCalendarData(data)
    } catch (e) {
      console.error('Calendar fetch error:', e)
    }
    setCalendarLoading(false)
  }
}}
  onDisconnect={() => {
    setPlaidLinked(false)
    setPlaidAccessToken('')
    setCalendarData(null)
    setChartData(null)
  }}
/>
  <button
    onClick={async () => {
      await supabase.auth.signOut()
      setIsLoggedIn(false)
      setMessages([])
      setAuthToken('')
      setConversations([])
      setPlaidLinked(false)
      setPlaidAccessToken('')
    }}
    className="text-slate-400 hover:text-white text-sm transition w-full text-left"
  >
    Sign Out
  </button>
  </div>
    </>
  )}

  {/* Collapsed state — just icons */}
  {sidebarCollapsed && (
    <div className="flex flex-col items-center gap-4 py-4">
      <button
        onClick={newConversation}
        className="text-sky-400 hover:text-sky-300 transition text-lg"
        title="New Conversation"
      >
        ✏️
      </button>
    </div>
  )}
</aside>

 {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Mobile Header */}
        <header className="flex items-center px-4 py-4 border-b border-slate-800 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white mr-3"
          >
            ☰
          </button>
          <span className="text-white font-bold">FISCAL</span>
        </header>

        {/* Tab Toggle — always visible */}
        <div className="flex border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              activeTab === 'chat'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Chat
          </button>
      <button
        onClick={async () => {
          setActiveTab('dashboard')
          if (plaidAccessToken && !chartData) loadChartData()
          if (canadianBanks.length === 0 && authToken) {
            try {
              const res = await fetch(`${HF_URL}/plaid/canadian_banks`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
              })
              const data = await res.json()
              if (data.banks) setCanadianBanks(data.banks)
            } catch (e) {
              console.error('Banks fetch error:', e)
            }
          }
        }}
        className={`flex-1 py-3 text-sm font-semibold transition ${
          activeTab === 'dashboard'
            ? 'text-sky-400 border-b-2 border-sky-400'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        Dashboard
      </button>
        </div>

  {activeTab === 'calendar' ? (
  /* Calendar view — paste the entire calendar JSX here */
  <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full min-h-0">
    {calendarLoading ? (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <div className="w-8 h-8 border-[3px] border-sky-400 border-t-transparent rounded-full animate-spin" />
    <div className="text-sky-400 text-sm">Analyzing your transactions...</div>
    <p className="text-slate-500 text-xs">This can take a minute after connecting your bank</p>
  </div>
) : !calendarData ? (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="text-4xl">📅</span>
        <p className="text-slate-400 text-sm">Connect your bank to see your financial calendar</p>
        <button onClick={() => setTriggerPlaidLink(true)} className="bg-sky-400 text-[#080E1A] px-6 py-3 rounded-xl font-semibold hover:bg-sky-300 transition">
          🔗 Connect Your Bank
        </button>
      </div>
    ) : (
      <div className="space-y-6">
        {calendarData && (
          <div className="bg-[#0D1B2E] rounded-xl p-3 border border-slate-800 flex items-center justify-between mb-4">
            <p className="text-slate-400 text-xs">
              Found {calendarData.recurring_expenses?.length || 0} recurring expenses and {calendarData.recurring_income?.length || 0} income sources
            </p>
            <button
              onClick={() => {
                setCalendarData(null)
                fetchCalendarData(plaidAccessToken)
              }}
              className="text-sky-400 hover:text-sky-300 text-xs transition"
            >
              ↻ Refresh
            </button>
          </div>
        )}
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            className="text-slate-400 hover:text-white transition px-3 py-1"
          >
            ← Prev
          </button>
          <h2 className="text-white font-bold text-lg">
            {calendarMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            className="text-slate-400 hover:text-white transition px-3 py-1"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[#111827] rounded-2xl border border-slate-800 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-slate-500 text-xs py-2 font-semibold">{d}</div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {(() => {
              const year = calendarMonth.getFullYear()
              const month = calendarMonth.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const today = new Date()
              const cells = []

              // Empty cells before first day
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-800/50" />)
              }

              // Day cells
              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
                const events = calendarData.projected_events?.filter((e: any) => e.date === dateStr) || []

                cells.push(
                  <div key={day} className={`min-h-[80px] border-b border-r border-slate-800/50 p-1 ${isToday ? 'bg-sky-400/5' : ''}`}>
                    <span className={`text-xs font-semibold block mb-1 ${isToday ? 'text-sky-400' : 'text-slate-400'}`}>
                      {day}
                    </span>
                    {events.map((event: any, idx: number) => (
                      <div
                        key={idx}
                        className={`text-[9px] px-1.5 py-0.5 rounded mb-0.5 truncate ${
                          event.is_income
                            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                            : 'bg-red-400/10 text-red-400 border border-red-400/20'
                        }`}
                        title={`${event.merchant} - $${event.amount} (${event.frequency})`}
                      >
                        {event.is_income ? '+' : '-'}${event.amount} {event.merchant.slice(0, 12)}
                      </div>
                    ))}
                  </div>
                )
              }

              return cells
            })()}
          </div>
        </div>

        {/* Recurring Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Income */}
          <div className="bg-[#111827] rounded-2xl p-4 border border-slate-800">
            <h3 className="text-emerald-400 font-bold text-sm mb-3">💰 Recurring Income</h3>
            {calendarData.recurring_income?.length === 0 ? (
              <p className="text-slate-500 text-xs">No recurring income detected yet</p>
            ) : (
              <div className="space-y-2">
                {calendarData.recurring_income?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#0D1B2E] rounded-xl p-3 border border-slate-700">
                    <div>
                      <p className="text-white text-xs font-semibold">{item.merchant}</p>
                      <p className="text-slate-500 text-[10px]">{item.frequency} • {item.consecutive_months} months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-sm font-bold">+${item.amount.toFixed(2)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        item.status === 'confirmed' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-yellow-400/10 text-yellow-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-[#111827] rounded-2xl p-4 border border-slate-800">
            <h3 className="text-red-400 font-bold text-sm mb-3">💸 Recurring Expenses</h3>
            {calendarData.recurring_expenses?.length === 0 ? (
              <p className="text-slate-500 text-xs">No recurring expenses detected yet</p>
            ) : (
              <div className="space-y-2">
                {calendarData.recurring_expenses?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#0D1B2E] rounded-xl p-3 border border-slate-700">
                    <div>
                      <p className="text-white text-xs font-semibold">{item.merchant}</p>
                      <p className="text-slate-500 text-[10px]">{item.frequency} • {item.consecutive_months} months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 text-sm font-bold">-${item.amount.toFixed(2)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        item.status === 'confirmed' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-yellow-400/10 text-yellow-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Export to Google Calendar */}
        <div className="flex justify-center gap-4 pb-4">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`${HF_URL}/plaid/calendar_export`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({ message: '', access_token: plaidAccessToken })
                })
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'fiscal-calendar.ics'
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                console.error('Calendar export error:', e)
              }
            }}
            className="bg-sky-400 text-[#080E1A] px-6 py-3 rounded-xl font-semibold hover:bg-sky-300 transition flex items-center gap-2"
          >
            📥 Export to Calendar (.ics)
          </button>
          <button
            onClick={() => fetchCalendarData(plaidAccessToken)}
            className="text-sky-400 hover:text-sky-300 text-sm transition px-4 py-3"
          >
            ↻ Refresh
          </button>
        </div>
      </div>
    )}
  </div>
) : activeTab === 'chat' ? (
  <>
    {/* Messages */}
    <div className="flex-1 overflow-y-auto px-4 py-6 max-w-5xl mx-auto w-full min-h-0">
      
      {/* Logo — transitions from center to top */}
      <div className={`flex flex-col items-center transition-all duration-700 ease-in-out ${
        hasStarted ? 'mb-6' : 'mt-20 mb-8'
      }`}>
        <div className={`relative flex items-center justify-center transition-all duration-700 ${
          hasStarted ? 'w-16 h-16' : 'w-40 h-40'
        }`}>
          <div className="absolute inset-0 rounded-full bg-sky-400/10 animate-ping" style={{ animationDuration: isResponding ? '0.8s' : '2s' }} />
          <div className="absolute inset-2 rounded-full bg-sky-400/15 animate-pulse" style={{ animationDuration: isResponding ? '0.6s' : '1.6s' }} />
          <div className="absolute inset-4 rounded-full bg-sky-400/20 animate-pulse" style={{ animationDuration: isResponding ? '0.6s' : '1.6s' }} />
          <Image src="/fiscallogo_nobg.png" alt="FISCAL" width={hasStarted ? 48 : 120} height={hasStarted ? 48 : 120} className="relative z-10 transition-all duration-700" />
        </div>
        <div className={`transition-all duration-500 overflow-hidden ${hasStarted ? 'max-h-0 opacity-0 mt-0' : 'max-h-40 opacity-100 mt-4'}`}>
          <p className="text-slate-400 text-center max-w-sm">Ask me anything about your Canadian finances — budgeting, investing, TFSAs, RRSPs, and more.</p>
        </div>
      </div>

      {/* Suggestion chips */}
      {!hasStarted && (
        <div className="flex flex-col items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md px-4">
            {['How do I start investing?', 'What is a TFSA?', 'Help me budget', 'Best savings account?'].map(s => (
              <button key={s} onClick={() => setInput(s)} className="bg-[#111827] text-slate-300 text-sm px-4 py-3 rounded-xl border border-slate-700 hover:border-sky-400/50 transition text-left">{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex flex-col gap-4">
{messages.map((msg, i) => (
  <div key={i}>
    <div className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      {!msg.isUser && (
        <div className="w-7 h-7 shrink-0 mr-3 mt-1">
          <Image src="/fiscallogo_nobg.png" alt="F" width={28} height={28} className="rounded-lg w-full h-full object-contain" />
        </div>
      )}
      
      {/* Message + Chart side by side when chart exists */}
{msg.chartData && !msg.isUser && msg.chartData.type ? (
  <div className="flex flex-col lg:flex-row gap-4 max-w-4xl">
    <div className="flex-1 bg-[#111827] px-4 py-3 rounded-2xl text-sm leading-relaxed text-slate-200 rounded-bl-sm">
      <ReactMarkdown components={{
        p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({children}) => <strong className="font-semibold text-sky-300">{children}</strong>,
        ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
        ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
        li: ({children}) => <li className="ml-2">{children}</li>,
        code: ({children}) => <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-300 text-xs">{children}</code>,
      }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
    </div>
    <div className="w-full lg:w-[450px] shrink-0 animate-chartFadeIn">
      <InlineChart chart={msg.chartData} />
    </div>
  </div>
) : inlineChartLoading && !msg.isUser && i === messages.length - 1 ? (
  <div className="flex flex-col lg:flex-row gap-4 max-w-4xl">
    <div className="flex-1 bg-[#111827] px-4 py-3 rounded-2xl text-sm leading-relaxed text-slate-200 rounded-bl-sm">
      <ReactMarkdown components={{
        p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({children}) => <strong className="font-semibold text-sky-300">{children}</strong>,
        ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
        ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
        li: ({children}) => <li className="ml-2">{children}</li>,
        code: ({children}) => <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-300 text-xs">{children}</code>,
      }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
    </div>
    <div className="w-full lg:w-[450px] shrink-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Generating chart...</span>
      </div>
    </div>
  </div>
) : (
   <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.isUser ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-[#111827] text-slate-200 rounded-bl-sm'}`}>
    {msg.text ? (
      msg.isUser ? msg.text : (
        <ReactMarkdown components={{
          p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({children}) => <strong className="font-semibold text-sky-300">{children}</strong>,
          ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
          ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
          li: ({children}) => <li className="ml-2">{children}</li>,
          h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
          code: ({children}) => <code className="bg-slate-800 px-1 py-0.5 rounded text-sky-300 text-xs">{children}</code>,
        }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
      )
    ) : (isResponding && i === messages.length - 1 ? (
      <span className="flex gap-1">
        <span className="animate-bounce">●</span>
        <span className="animate-bounce" style={{animationDelay:'0.1s'}}>●</span>
        <span className="animate-bounce" style={{animationDelay:'0.2s'}}>●</span>
      </span>
    ) : '')}
  </div>
)}
    </div>
  </div>
))}

      </div>
      <div ref={messagesEndRef} />
    </div>

    {/* Input */}
    <div className="px-4 py-4 border-t border-slate-800 max-w-3xl mx-auto w-full shrink-0">
      <div className="flex gap-3 bg-[#111827] rounded-2xl px-4 py-3 border border-slate-700 focus-within:border-sky-400/50 transition">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask FISCAL"
          className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isResponding}
          className="bg-sky-400 text-[#080E1A] w-8 h-8 rounded-lg flex items-center justify-center font-bold disabled:opacity-40 hover:bg-sky-300 transition shrink-0"
        >
          ➤
        </button>
      </div>
      <p className="text-slate-600 text-xs text-center mt-2">FISCAL can make mistakes. Verify important financial decisions.</p>
    </div>
  </>
) : (
  /* Dashboard */
  
<div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full min-h-0">
   
    {chartLoading ? (
      <div className="flex items-center justify-center h-full">
        <div className="text-sky-400 animate-pulse text-lg">Loading your financial data...</div>
      </div>
    ) : !chartData ? (
      
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <div className="w-16 h-16 rounded-full bg-[#111827] flex items-center justify-center border border-slate-800">
      <span className="text-3xl">🏦</span>
    </div>
    <p className="text-slate-400 text-sm">No bank data available</p>
    <p className="text-slate-500 text-xs text-center max-w-xs">Connect your bank account in the sidebar to see your spending velocity, balances, and more.</p>
     {/* Bank Selection Row — always visible */}
  <div className="mb-6">
    <p className="text-slate-400 text-xs mb-3">Connect your bank</p>
    <div className="flex gap-3 overflow-x-auto pb-2">
      {canadianBanks.map((bank) => (
        <button
          key={bank.institution_id}
          onClick={() => {
            if (!plaidLinked) setTriggerPlaidLink(true)
          }}
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition shrink-0 w-24 ${
            bankInfo?.name === bank.name
              ? 'bg-sky-400/10 border-sky-400/30'
              : 'bg-[#111827] border-slate-800 hover:border-slate-600'
          }`}
        >
          {bank.logo ? (
            <img
              src={`data:image/png;base64,${bank.logo}`}
              alt={bank.name}
              className="w-10 h-10 rounded-lg"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: bank.color || '#38bdf8' }}
            >
              {bank.name.charAt(0)}
            </div>
          )}
          <span className="text-slate-300 text-[10px] text-center leading-tight">{bank.name}</span>
          {bankInfo?.name === bank.name && (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>
      ))}
      
      {/* Other bank button */}
      <button
        onClick={() => setTriggerPlaidLink(true)}
        className="flex flex-col items-center gap-2 p-4 rounded-2xl border bg-[#111827] border-slate-800 hover:border-slate-600 transition shrink-0 w-24"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 text-xl">
          +
        </div>
        <span className="text-slate-300 text-[10px] text-center leading-tight">Other Bank</span>
      </button>
    </div>
  </div>
  </div>
  
    ) : (
      <div className="space-y-8">

        {/* Account Balances */}
        <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800">
          <h2 className="text-white font-bold text-lg mb-4">Account Balances</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {chartData.accounts?.map((acc: any) => (
              <div key={acc.name} className="bg-[#0D1B2E] rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-xs">{acc.type}</p>
                <p className="text-white font-semibold text-sm mt-1">{acc.name}</p>
                <p className="text-sky-400 text-xl font-bold mt-2">${acc.balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Income vs Expenses Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 text-center">
            <p className="text-slate-400 text-xs mb-1">Income This Month</p>
            <p className="text-emerald-400 text-2xl font-bold">+${(chartData.income_total || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 text-center">
            <p className="text-slate-400 text-xs mb-1">Spent This Month</p>
            <p className="text-red-400 text-2xl font-bold">-${(chartData.expense_total || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Burn-Down Velocity Chart */}
        {chartData.burndown?.length > 0 ? (
  <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800">
    <div className="flex justify-between items-start mb-6">
      <div>
        <h2 className="text-white font-bold text-lg">Spending Velocity</h2>
        <p className="text-slate-500 text-xs">How your balance is moving this month</p>
      </div>
      <div className="text-right">
        <p className="text-sky-400 text-2xl font-bold">
          ${chartData.burndown[chartData.burndown.length - 1]?.balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-slate-500 text-xs">Current balance</p>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={(() => {
          const data = chartData.burndown;
          const lastBalance = data[data.length - 1]?.balance || 0;
          const daysElapsed = data.length;
          const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          const daysLeft = totalDays - daysElapsed;
          const dailyBurnRate = daysElapsed > 1 
            ? (data[0]?.balance - lastBalance) / (daysElapsed - 1)
            : 0;

          // Add projected days
          const projected = [...data.map((d: any) => ({ ...d, projected: null }))];
          
          // Set last real day as start of projection
          if (projected.length > 0) {
            projected[projected.length - 1].projected = lastBalance;
          }

          for (let i = 1; i <= daysLeft; i++) {
            const projDate = new Date(new Date().getFullYear(), new Date().getMonth(), daysElapsed + i);
            const projBalance = Math.max(0, lastBalance - (dailyBurnRate * i));
            projected.push({
              date: projDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              balance: null,
              spent: 0,
              projected: Math.round(projBalance * 100) / 100,
            });
          }
          return projected;
        })()}
        margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
      >
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          interval={3}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(v) => `$${v.toLocaleString()}`}
          width={65}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#0D1B2E', border: '1px solid #1e293b', borderRadius: '12px' }}
          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
          formatter={(value: any, name: any) => {
            if (value === null) return ['-', name]
            return [`$${Number(value).toFixed(2)}`, name === 'balance' ? 'Balance' : 'Projected']
          }}
        />
        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
        {/* Actual balance */}
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#38bdf8"
          strokeWidth={2.5}
          fill="url(#balanceGradient)"
          dot={false}
          activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0D1B2E', strokeWidth: 2 }}
          connectNulls={false}
        />
        {/* Projected trend */}
        <Area
          type="monotone"
          dataKey="projected"
          stroke="#f87171"
          strokeWidth={2}
          strokeDasharray="6 4"
          fill="url(#projectedGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#f87171', stroke: '#0D1B2E', strokeWidth: 2 }}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    <div className="flex items-center justify-center gap-6 mt-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-sky-400 rounded" />
        <span className="text-slate-400 text-xs">Actual</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-red-400 rounded" style={{ borderTop: '2px dashed #f87171' }} />
        <span className="text-slate-400 text-xs">Projected</span>
      </div>
    </div>
  </div>
) : (
  <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 text-center">
    <p className="text-slate-400">Transaction data is still loading from your bank. Try refreshing in a moment.</p>
  </div>
)}

        {/* Refresh button */}
        <div className="text-center pb-4">
          <button
            onClick={loadChartData}
            className="text-sky-400 hover:text-sky-300 text-sm transition"
          >
            ↻ Refresh Data
          </button>
         {/* <button
  onClick={async () => {
    const res = await fetch(`${HF_URL}/plaid/debug_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ message: '', access_token: plaidAccessToken })
    })
    const data = await res.json()
    console.log('DEBUG RAW PLAID DATA:', JSON.stringify(data, null, 2))
  }}
  className="text-slate-500 hover:text-white text-xs transition"
>
  Debug: View Raw Data
</button> */} 
        </div>
      </div>
    )}
  
  
  </div>
  
)} 
      </div>
    </div>
  )
}