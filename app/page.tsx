'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'
import { usePlaidLink } from 'react-plaid-link'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import PrescriptionDashboard from '@/components/PrescriptionDashboard'
import CashFlowDashboard from '@/components/CashFlowDashboard'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, ReferenceLine
} from 'recharts'
import YearSphereDashboard from '@/components/YearSphereDashboard'




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

function PlaidLinkButton({ authToken, plaidLinked, onSuccess, onDisconnect, triggerOpen, onTriggered, isTrialMode }: { 
  authToken: string
  plaidLinked: boolean
  onSuccess: (accessToken: string) => void
  onDisconnect: () => void
  triggerOpen?: boolean
  onTriggered?: () => void
  isTrialMode?: boolean
}) {
  const [linkToken, setLinkToken] = useState('')
  const linkTokenFetched = useRef(false)

  // Detect if we're returning from an OAuth redirect (RBC, etc.)
  const isOAuthReturn = typeof window !== 'undefined' && 
    window.location.href.includes('oauth_state_id')

  useEffect(() => {
    // If we're returning from OAuth, restore the saved link_token
    if (isOAuthReturn) {
      const savedToken = sessionStorage.getItem('plaid_link_token')
      if (savedToken) {
        setLinkToken(savedToken)
      }
      return
    }
    
    if (linkTokenFetched.current || plaidLinked) return
    if (!authToken && !isTrialMode) return
    linkTokenFetched.current = true
    
    const fetchToken = async () => {
      try {
        const url = isTrialMode 
          ? `${HF_URL}/trial/plaid/create_link_token`
          : `${HF_URL}/plaid/create_link_token`
        
        const headers: Record<string, string> = {}
        if (!isTrialMode) {
          headers['Authorization'] = `Bearer ${authToken}`
        }
        
        const res = await fetch(url, { method: 'POST', headers })
        const data = await res.json()
        const token = data.link_token || ''
        
        // Save the link_token so we can restore it after the OAuth redirect
        if (token) {
          sessionStorage.setItem('plaid_link_token', token)
        }
        
        setLinkToken(token)
      } catch (e) {
        console.error('Link token error:', e)
      }
    }
    fetchToken()
  }, [authToken, plaidLinked, isTrialMode, isOAuthReturn])

  const { open, ready } = usePlaidLink({
    token: linkToken || null,
    // Tell Plaid Link this is an OAuth return so it picks up where it left off
    receivedRedirectUri: isOAuthReturn ? window.location.href : undefined,
    onSuccess: async (public_token) => {
      // Clear the saved token on success
      sessionStorage.removeItem('plaid_link_token')
      
      try {
        const url = isTrialMode
          ? `${HF_URL}/trial/plaid/exchange_token`
          : `${HF_URL}/plaid/exchange_token`
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        if (!isTrialMode) {
          headers['Authorization'] = `Bearer ${authToken}`
        }
        
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ public_token })
        })
        const data = await res.json()
        if (data.access_token) {
          onSuccess(data.access_token)
        }
      } catch (e) {
        console.error('Exchange token error:', e)
      }
    },
    onExit: (err, metadata) => {
      console.log('Plaid Link exit:', { err, metadata })
      sessionStorage.removeItem('plaid_link_token')
      if (err) {
        alert(
          "Bank connection didn't complete. If your bank uses 2-step verification, make sure to finish all the verification steps before closing the window. You can also try demo mode."
        )
      }
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid event:', eventName, metadata)
    }
  })

  useEffect(() => {
    if (triggerOpen && ready && !plaidLinked) {
      open()
      onTriggered?.()
    }
  }, [triggerOpen, ready, plaidLinked])

  // Auto-open Plaid Link when returning from OAuth
  useEffect(() => {
    if (isOAuthReturn && ready && linkToken) {
      open()
    }
  }, [isOAuthReturn, ready, linkToken])

  useEffect(() => {
    if (!plaidLinked) {
      linkTokenFetched.current = false
    }
  }, [plaidLinked])

  if (plaidLinked) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-teal-600 text-sm">✅ Bank Connected</span>
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
      className="text-slate-400 hover:text-slate-900 text-sm transition text-left disabled:opacity-40"
    >
      🏦 Link Bank Account
    </button>
  )
}

function InlineChart({ chart }: { chart: any }) {
  const COLORS = ['#0d9488', '#facc15', '#f472b6', '#34d399', '#f87171', '#818cf8', '#2dd4bf', '#fb923c', '#e879f9', '#a78bfa']

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
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <h3 className="text-slate-900 font-bold text-sm mb-1">{chart.title}</h3>
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
            <span className="text-slate-900 text-xs font-semibold">{item.name}</span>
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
  const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false)
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [plaidLinked, setPlaidLinked] = useState(false)
  const [plaidAccessToken, setPlaidAccessToken] = useState('')
  const [chartData, setChartData] = useState<any>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const inChartRef = useRef(false)
  const [firstNameDisplay, setFirstNameDisplay] = useState('')
  const [inlineChartLoading, setInlineChartLoading] = useState(false)
  const [canadianBanks, setCanadianBanks] = useState<any[]>([])
  const [triggerPlaidLink, setTriggerPlaidLink] = useState(false)
  const [bankInfo, setBankInfo] = useState<any>(null)
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'calendar' | 'cashflow'>('chat')
  const [calendarData, setCalendarData] = useState<any>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [isTrialMode, setIsTrialMode] = useState(false)
  const [trialPromptsUsed, setTrialPromptsUsed] = useState(0)
  const [trialPopup, setTrialPopup] = useState(false)
  const TRIAL_LIMIT = 50

useEffect(() => {
  const init = async () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setAuthToken(session.access_token)
        const meta = session.user.user_metadata
        const name = meta?.first_name 
          || meta?.full_name?.split(' ')[0] 
          || meta?.name?.split(' ')[0] 
          || ''
        setFirstNameDisplay(name)  // ← add this
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
      const meta = data.session.user.user_metadata
      const name = meta?.first_name 
        || meta?.full_name?.split(' ')[0] 
        || meta?.name?.split(' ')[0] 
        || ''
      setFirstNameDisplay(name)
      await loadConversations(data.session.user.id)
    }
  }
  init()
}, [])

useEffect(() => {
  if (!plaidAccessToken) return
  if (!authToken && !isTrialMode) return
  
  if (activeTab === 'calendar' && !calendarData) {
    fetchCalendarData(plaidAccessToken)
  }

  if (activeTab === 'dashboard' && !chartData) {
    loadChartData()
  }

  if (activeTab === 'dashboard' && !calendarData) {
    fetchCalendarData(plaidAccessToken)
  }
}, [plaidAccessToken, activeTab, authToken])

const fetchCalendarData = async (accessToken: string, token?: string) => {
  const auth = token || authToken
  setCalendarLoading(true)
  
  for (let i = 0; i < 6; i++) {
    try {
      const url = isTrialMode
        ? `${HF_URL}/trial/plaid/recurring`
        : `${HF_URL}/plaid/recurring`
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (!isTrialMode) {
        headers['Authorization'] = `Bearer ${auth}`
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: '', access_token: accessToken })
      })
      const data = await res.json()
      
      if (data.not_ready) {
        console.log(`Plaid not ready, retry ${i + 1}/6...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
        continue
      }
      
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
    
    if (isTrialMode) {
      await fetch(`${HF_URL}/trial/reset`, { method: 'POST' })
    } else {
      await fetch(`${HF_URL}/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
    }
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
  if (!plaidAccessToken) return
  setChartLoading(true)
  try {
    const url = isTrialMode
      ? `${HF_URL}/trial/plaid/chart_data`
      : `${HF_URL}/plaid/chart_data`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (!isTrialMode) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: '', access_token: plaidAccessToken })
    })
    const data = await res.json()
    setChartData(data)
  } catch (e) {
    console.error('Chart data error:', e)
  }
  setChartLoading(false)
}

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isResponding) return

    if (isTrialMode) {
      if (trialPromptsUsed >= TRIAL_LIMIT) {
        setMessages(prev => [...prev, {
          text: `You've used all ${TRIAL_LIMIT} free prompts. Create a free account to continue using Cheque up with unlimited conversations.`,
          isUser: false
        }])
        return
      }
      
      const newCount = trialPromptsUsed + 1
      setTrialPromptsUsed(newCount)
      localStorage.setItem('fiscal_trial', JSON.stringify({
        ...JSON.parse(localStorage.getItem('fiscal_trial') || '{}'),
        promptsUsed: newCount
      }))
    }

    setHasStarted(true)
    inChartRef.current = false
    setInput('')
    setIsResponding(true)

 const newMessages: Message[] = [...messages, { text, isUser: true }, { text: '', isUser: false }]
    setMessages(newMessages)
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)

  const endpoint = isTrialMode 
        ? `${HF_URL}/trial/chat/stream` 
        : `${HF_URL}/chat/stream`
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (!isTrialMode) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
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
 if (!isLoggedIn && !isTrialMode) {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex">
      
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl -top-48 -left-24 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-3xl top-1/2 -right-32 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-teal-600/5 blur-3xl bottom-0 left-1/3 animate-pulse" style={{ animationDuration: '10s' }} />
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
            className="absolute w-1 h-1 bg-teal-600/100 rounded-full"
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
 {/* Asymmetrical Split-View Container (60/40 Layout on Large Screens) */}
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-12 px-6 lg:px-16 xl:px-24 relative z-10 w-full min-h-[85vh]">
      
      {/* LEFT SIDE: Massive Logo & Brand Block (Takes up 7/12 of the width) */}
      <div className="lg:col-span-7 flex items-center justify-center lg:justify-start w-full">
        <div className="flex flex-row items-center gap-8 justify-start select-none">
          
          {/* Cinematic, Ultra-Scaled Logo Icon */}
          <div className="relative flex items-center justify-center w-72 h-72 xl:w-[450px] xl:h-[450px] flex-shrink-0">
            {/* Ambient Pulse Ring scaled to match the new size */}
            <div 
              className="absolute inset-4 rounded-full bg-teal-600/10 animate-ping" 
              style={{ animationDuration: '3.5s' }} 
            />
            <Image 
              src="/chequeuplogo.png" 
              alt="Cheque up" 
              width={500} 
              height={500} 
              className="relative z-10 object-contain w-full h-full" 
              priority 
            />
          </div>
          {/* Typography Exact Match to Cheque-Up-Wordmark.png */}
          <div className="flex flex-col justify-center">
            <h1 className="text-6xl xl:text-7xl font-bold tracking-tight leading-none">
              <span className="text-[#0f3c3a]">Cheque</span>
              <span className="text-[#0d9488]"> Up</span>
            </h1>
            <p className="text-slate-400 text-base xl:text-lg mt-4 font-medium max-w-sm leading-relaxed">
              Know where your money goes. Before it's too late.
            </p>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE: Auth Card (Takes up 5/12 of the width, cleanly right-aligned) */}
      <div className="lg:col-span-5 flex items-center justify-center lg:justify-end w-full">
      
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 max-w-md w-full">
          
          {/* Tab Toggle */}
          <div className="flex bg-white rounded-xl p-1 mb-6">
            <button
              onClick={() => { setAuthMode('signin'); setAuthError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                authMode === 'signin' ? 'bg-teal-600 text-[#080E1A]' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                authMode === 'signup' ? 'bg-teal-600 text-[#080E1A]' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={authMode === 'signin' ? handleLogin : handleSignUp} className="flex flex-col gap-3">
            <div className={`grid grid-cols-2 gap-3 overflow-hidden transition-all duration-300 ${
              authMode === 'signup' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <input type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-white text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-600 outline-none text-sm" />
              <input type="text" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-white text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-600 outline-none text-sm" />
            </div>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="bg-white text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-600 outline-none text-sm" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="bg-white text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-600 outline-none text-sm" />

            <div className={`overflow-hidden transition-all duration-300 ${authMode === 'signup' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-teal-600" />
                <span className="text-slate-400 text-xs leading-relaxed">
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" className="text-teal-600 underline hover:text-sky-300">Privacy Policy</a>
                  {' '}and{' '}
                  <a href="/terms" target="_blank" className="text-teal-600 underline hover:text-sky-300">Terms of Service</a>
                </span>
              </label>
            </div>

            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}

            <button type="submit" disabled={isAuthLoading || (authMode === 'signup' && !acceptedTerms)} className="bg-teal-600 text-[#080E1A] py-3 rounded-xl font-bold hover:bg-sky-300 transition disabled:opacity-50">
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Try Cheque up button */}
          <button
            type="button"
            onClick={() => {
              const trialData = localStorage.getItem('fiscal_trial')
              if (trialData) {
                const parsed = JSON.parse(trialData)
                const elapsed = Date.now() - parsed.startedAt
                const hoursElapsed = elapsed / (1000 * 60 * 60)
                
                if (hoursElapsed >= 24) {
                  localStorage.setItem('fiscal_trial', JSON.stringify({
                    promptsUsed: 0,
                    startedAt: Date.now()
                  }))
                  setTrialPromptsUsed(0)
                } else if (parsed.promptsUsed >= TRIAL_LIMIT) {
                  setAuthError(`Trial limit reached. Create a free account or try again in ${Math.ceil(24 - hoursElapsed)} hours.`)
                  return
                } else {
                  setTrialPromptsUsed(parsed.promptsUsed)
                }
              } else {
                localStorage.setItem('fiscal_trial', JSON.stringify({
                  promptsUsed: 0,
                  startedAt: Date.now()
                }))
              }
              setIsTrialMode(true)
              setPlaidLinked(true)
              setPlaidAccessToken('trial-mock-access-token')
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm text-yellow-500 border border-yellow-400 hover:bg-yellow-50 transition"
          >
            ✨ Try Cheque up — no account needed
          </button>
        </div>
      </div>

    </div>

      {/* Footer */}
    <footer className="absolute bottom-0 left-0 right-0 z-10 py-4 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
        <p className="text-xs text-slate-500">
          © 2026 Fiscal Technologies Inc. All rights reserved.
        </p>
        <div className="flex gap-4 text-xs text-slate-500">
          <a href="/privacy" target="_blank" className="hover:text-teal-600 transition">Privacy</a>
          <a href="/terms" target="_blank" className="hover:text-teal-600 transition">Terms</a>
          <a href="mailto:marco.pastore63@gmail.com" className="hover:text-teal-600 transition">Contact</a>
        </div>
      </div>
    </footer>
    
    </div>

  )
}

  // Chat Screen
  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">

     {/* Sidebar */}


 {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
      

      {/* Input — or sign up prompt when trial exhausted */}
        {isTrialMode && trialPromptsUsed >= TRIAL_LIMIT ? (
          <div className="px-4 py-6 border-t border-slate-200 max-w-3xl mx-auto w-full shrink-0 text-center">
            <p className="text-slate-900 font-semibold mb-2">You've used all {TRIAL_LIMIT} free prompts</p>
            <p className="text-slate-400 text-sm mb-4">
              {plaidLinked 
                ? "Create a free account to keep your bank connection and get unlimited conversations." 
                : "Create a free account to continue with unlimited conversations, bank connection, and more."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setIsTrialMode(false)
                  setMessages([])
                  setHasStarted(false)
                  setAuthMode('signup')
                }}
                className="bg-teal-600 text-[#080E1A] px-6 py-3 rounded-xl font-bold hover:bg-sky-300 transition"
              >
                Create Free Account
              </button>
              <button
                onClick={() => {
                  setIsTrialMode(false)
                  setMessages([])
                  setHasStarted(false)
                }}
                className="border border-slate-200 text-slate-400 px-6 py-3 rounded-xl font-semibold hover:border-teal-600 hover:text-teal-600 transition"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (<p></p>)}

{activeTab === 'calendar' ? (
  /* Year Sphere replaces the old calendar */
  <div className="flex-1 overflow-hidden px-4 pt-6 pb-24 max-w-6xl mx-auto w-full min-h-0">
    <YearSphereDashboard />
  </div>
) : activeTab === 'chat' ?  (
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
          <div className="absolute inset-0 rounded-full bg-teal-600/10 animate-ping" style={{ animationDuration: isResponding ? '0.8s' : '2s' }} />
          <Image src="/chequeuplogo.png" alt="Cheque up" width={hasStarted ? 48 : 120} height={hasStarted ? 48 : 120} className="relative z-10 transition-all duration-700" />
        </div>
        <div className={`transition-all duration-500 overflow-hidden ${hasStarted ? 'max-h-0 opacity-0 mt-0' : 'max-h-40 opacity-100 mt-4'}`}>
        <p className="text-slate-400 text-center max-w-sm">
          {firstNameDisplay 
            ? `Hello ${firstNameDisplay}, how can I assist today?` 
            : 'Hello, how can I assist today?'}
        </p>       
      </div>
      </div>

      {/* Suggestion chips */}
      {!hasStarted && (
        <div className="flex flex-col items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md px-4">
            {['Where does my money actually go each month?', 'Why am I always broke by the 25th?', 'Help me make sense of my spending', 'What does the 50/30/20 budget rule look like?'].map(s => (
              <button key={s} onClick={() => setInput(s)} className="bg-white text-slate-300 text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-600/50 transition text-left">{s}</button>
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
          <Image src="/chequeuplogo.png" alt="F" width={28} height={28} className="rounded-lg w-full h-full object-contain" />
        </div>
      )}
      
      {/* Message + Chart side by side when chart exists */}
{msg.chartData && !msg.isUser && msg.chartData.type ? (
  <div className="flex flex-col lg:flex-row gap-4 max-w-4xl">
    <div className="flex-1 bg-white px-4 py-3 rounded-2xl text-sm leading-relaxed text-[#004B57] rounded-bl-sm">
  <ReactMarkdown components={{
    p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
    strong: ({children}) => <strong className="font-semibold text-[#E07A5F]">{children}</strong>,
        ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
        ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
        li: ({children}) => <li className="ml-2">{children}</li>,
        code: ({children}) => <code className="bg-slate-100 text-[#004B57] text-xs">{children}</code>,
      }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
    </div>
    <div className="w-full lg:w-[450px] shrink-0 animate-chartFadeIn">
      <InlineChart chart={msg.chartData} />
    </div>
  </div>
) : inlineChartLoading && !msg.isUser && i === messages.length - 1 ? (
  <div className="flex flex-col lg:flex-row gap-4 max-w-4xl">
    <div className="flex-1 bg-white px-4 py-3 rounded-2xl text-sm leading-relaxed text-slate-200 rounded-bl-sm">
  <ReactMarkdown components={{
    p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
    strong: ({children}) => <strong className="font-semibold text-sky-300">{children}</strong>,
        ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
        ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
        li: ({children}) => <li className="ml-2">{children}</li>,
        code: ({children}) => <code className="bg-slate-100 px-1 py-0.5 rounded text-[#004B57] text-xs">{children}</code>,
      }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
    </div>
    <div className="w-full lg:w-[450px] shrink-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Generating chart...</span>
      </div>
    </div>
  </div>
) : (
   <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.isUser ? 'bg-sky-500 text-slate-900 rounded-br-sm' : 'bg-white text-[#004B57] rounded-bl-sm'}`}>
    {msg.text ? (
      msg.isUser ? msg.text : (
        <ReactMarkdown components={{
          p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({children}) => <strong className="font-semibold text-[#E07A5F]">{children}</strong>,
          ol: ({children}) => <ol className="list-decimal list-inside space-y-3 my-2">{children}</ol>,
          ul: ({children}) => <ul className="list-disc list-inside space-y-3 my-2">{children}</ul>,
          li: ({children}) => <li className="ml-2">{children}</li>,
          h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
          code: ({children}) => <code className="bg-slate-100 px-1 py-0.5 rounded text-[#004B57] text-xs">{children}</code>,
        }}>{cleanMarkdown(msg.text)}</ReactMarkdown>
      )
    ) : (isResponding && i === messages.length - 1 ? (
        <span className="flex gap-1 text-yellow-400">
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
<div className="px-4 pt-4 pb-24 border-t border-slate-200 max-w-3xl mx-auto w-full shrink-0">
  <div className="flex gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-teal-600/50 transition">
    <input
      type="text"
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
      placeholder="Wanna check up?"
      className="flex-1 bg-transparent text-slate-900 placeholder-slate-500 outline-none text-sm"
    />
    <button
      onClick={sendMessage}
      disabled={!input.trim() || isResponding}
      className="bg-teal-600 text-[#080E1A] w-8 h-8 rounded-lg flex items-center justify-center font-bold disabled:opacity-40 hover:bg-sky-300 transition shrink-0"
    >
      ➤
    </button>
  </div>
  <p className="text-slate-600 text-xs text-center mt-2">Cheque up can make mistakes. Verify important financial decisions.</p>
  
  {isTrialMode && (
    <p className="text-slate-400 text-[10px] text-center leading-relaxed mt-1">
      Cheque up is AI. By using it, you agree to our{' '}
      <a href="/terms" target="_blank" className="text-teal-600 underline">Terms</a> &{' '}
      <a href="/privacy" target="_blank" className="text-teal-600 underline">Privacy Policy</a>. 
      Don't share sensitive info. Chats may be reviewed to improve our AI.
    </p>
  )}
</div>
  </>
)  : activeTab === 'cashflow' ? (
  /* Cash Flow bubbles */
  <div className="flex-1 overflow-hidden px-4 pt-6 pb-24 max-w-6xl mx-auto w-full min-h-0">
    <CashFlowDashboard />
  </div>
) : (
  /* Dashboard — prescription pad + diagnostic panel */
  <div className="flex-1 overflow-hidden px-4 pt-6 pb-4 max-w-6xl mx-auto w-full min-h-0">
    {chartLoading ? (
      <div className="flex items-center justify-center h-full">
        <div className="text-teal-600 animate-pulse text-lg">Loading your financial data...</div>
      </div>
    ) : !chartData ? (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-slate-400 text-sm">No bank data available</p>
      </div>
    ) : (
      <PrescriptionDashboard 
        chartData={chartData} 
        calendarData={calendarData}
      />
    )}
  </div>
)}
  


      </div>

{/* Floating Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl px-3 py-2 shadow-xl shadow-slate-300/40">
          
          {/* History */}
          <div 
            className="relative"
            onMouseEnter={() => setHistoryPopoverOpen(true)}
            onMouseLeave={() => setHistoryPopoverOpen(false)}
          >
            <button
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl hover:bg-slate-100 transition"
              title="Conversations"
            >
              <Image src="/History.png" alt="History" width={50} height={50} className="relative z-10 object-contain w-full h-full" priority />
            </button>

            {/* Popover — anchored above the button */}
            {historyPopoverOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/50 flex flex-col max-h-[70vh]">
                {/* invisible bridge so cursor can travel from button to popover without closing */}
                <div className="absolute -bottom-3 left-0 right-0 h-3" />
                
                <div className="p-3 border-b border-slate-200">
                  <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                    <span className="text-slate-500 text-xs mr-2">🔍</span>
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent text-slate-900 placeholder-slate-500 outline-none text-xs flex-1"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-900 text-xs">✕</button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {conversations.length === 0 && (
                    <p className="text-slate-500 text-xs text-center mt-4">No conversations yet</p>
                  )}
                  {conversations
                    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => { loadConversation(conv); setHistoryPopoverOpen(false) }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer group mb-1 ${
                          currentConvId === conv.id ? 'bg-teal-600/10 border border-teal-600/20' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-slate-700 text-xs truncate flex-1">{conv.title}</span>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="text-slate-400 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  {searchQuery && conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <p className="text-slate-500 text-xs text-center mt-4">No results found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* New Chat */}
          <button
            onClick={() => { newConversation(); setActiveTab('chat') }}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl hover:bg-slate-100 transition">
              <Image src="/New-Chat.png" alt="New Chat" width={36} height={36} className="object-contain" priority />
              <span className="text-[9px] font-medium text-slate-600 leading-tight">New</span>

          </button>

          <div className="w-px h-8 bg-slate-200 mx-1" />

          {/* Chat tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition ${activeTab === 'chat' ? 'bg-teal-600/10' : 'hover:bg-slate-100'}`}>
          <Image src="/Dashboard.png" alt="Chat" width={36} height={36} className="object-contain" priority />
          <span className="text-[9px] font-medium text-slate-600 leading-tight">Chat</span>

          </button>

          {/* Calendar tab */}
          <button
            onClick={async () => {
              setActiveTab('calendar')
              if (plaidAccessToken && !calendarData) fetchCalendarData(plaidAccessToken)
            }}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition ${activeTab === 'calendar' ? 'bg-teal-600/10' : 'hover:bg-slate-100'}`}>
          <Image src="/Calendar.png" alt="Calendar" width={36} height={36} className="object-contain" priority />
          <span className="text-[9px] font-medium text-slate-600 leading-tight">Calendar</span>

          </button>

          {/* Dashboard tab */}
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
                } catch (e) { console.error('Banks fetch error:', e) }
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-teal-600/10' : 'hover:bg-slate-100'}`}          
            title="Insights"
          >
            <Image src="/Insights.png" alt="Cash Flow" width={36} height={36} className="object-contain" priority />
          <span className="text-[9px] font-medium text-slate-600 leading-tight">
            Insights
          </span>
          </button>

          <div className="w-px h-8 bg-slate-200 mx-1" />

            {/* Cash Flow tab */}
         <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition ${
            activeTab === 'cashflow' ? 'bg-teal-600/10' : 'hover:bg-slate-100'
          }`}
          title="Cash Flow"
        >
          <Image 
            src="/microIcon.png" 
            alt="Cash Flow" 
            width={36} 
            height={36} 
            className="relative z-10 object-contain" 
            priority 
          />
          <span className="text-[9px] font-medium text-slate-600 leading-tight">
            Cash Flow
          </span>
        </button>
          

          {/* Bank */}
          <button
            onClick={() => {
              if (plaidLinked) {
                if (confirm('Disconnect your bank?')) {
                  setPlaidLinked(false)
                  setPlaidAccessToken('')
                  setCalendarData(null)
                  setChartData(null)
                }
              } else {
                setTriggerPlaidLink(true)
              }
            }}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl hover:bg-slate-100 transition relative">
           <Image src="/Bank.png" alt="Bank" width={36} height={36} className="object-contain" priority />
            <span className="text-[9px] font-medium text-slate-600 leading-tight">Bank</span>
            {plaidLinked && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </button>

          {/* Account */}
          <div className="relative">
            <button
              onClick={() => { setAccountPopoverOpen(!accountPopoverOpen); setHistoryPopoverOpen(false) }}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl hover:bg-slate-100 transition"
              title="Account"
            >
              <Image src="/Account.png" alt="Account" width={50} height={50} className="relative z-10 object-contain w-full h-full" priority />
            </button>

            {accountPopoverOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountPopoverOpen(false)} />
                <div className="absolute bottom-full right-0 mb-3 z-40 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/50 p-2">
                  {isTrialMode ? (
                    <button
                      onClick={() => {
                        setIsTrialMode(false)
                        setMessages([])
                        setHasStarted(false)
                        setPlaidLinked(false)
                        setPlaidAccessToken('')
                        setAccountPopoverOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 text-sm transition"
                    >
                      ← Back to Sign In
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut()
                        setIsLoggedIn(false)
                        setMessages([])
                        setAuthToken('')
                        setConversations([])
                        setPlaidLinked(false)
                        setPlaidAccessToken('')
                        setAccountPopoverOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 text-sm transition"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Plaid link button (needed so triggerPlaidLink still works) */}
      <div className="hidden">
        <PlaidLinkButton
          authToken={authToken}
          plaidLinked={plaidLinked}
          triggerOpen={triggerPlaidLink}
          onTriggered={() => setTriggerPlaidLink(false)}
          isTrialMode={isTrialMode}
          onSuccess={async (accessToken) => {
            setPlaidAccessToken(accessToken)
            setPlaidLinked(true)
            setCalendarData(null)
            setChartData(null)
            if (activeTab === 'calendar') fetchCalendarData(accessToken)
          }}
          onDisconnect={() => {
            setPlaidLinked(false)
            setPlaidAccessToken('')
          }}
        />
      </div>


      {/* Trial mode popup */}
{trialPopup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setTrialPopup(false)}>
    <div className="absolute inset-0 bg-black/50" />
    <div className="relative bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full animate-fadeIn" onClick={e => e.stopPropagation()}>
      <div className="text-center">
        <span className="text-3xl mb-3 block">🔒</span>
        <h3 className="text-slate-900 font-bold text-lg mb-2">Bank Connection Unavailable</h3>
        <p className="text-slate-400 text-sm mb-5">Bank connectivity is not available in trial mode. Create a free account to connect your bank and get personalized insights.</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setTrialPopup(false)
              setIsTrialMode(false)
              setMessages([])
              setHasStarted(false)
              setAuthMode('signup')
            }}
            className="bg-teal-600 text-[#080E1A] py-3 rounded-xl font-bold hover:bg-sky-300 transition"
          >
            Create Free Account
          </button>
          <button
            onClick={() => setTrialPopup(false)}
            className="text-slate-500 hover:text-slate-300 text-sm transition py-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>

    
  )

  
}