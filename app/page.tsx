'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'
import { usePlaidLink } from 'react-plaid-link'

const supabase = createClient(
  'https://iymwleromrtbsthtlptk.supabase.co',
  'sb_publishable_AZafK1NNF2CmXg4cTmTxhg_-sxIpa-d'
)

const HF_URL = 'https://mj-prod-fiscal.hf.space'

interface Message {
  text: string
  isUser: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  created_at: string
}

function PlaidLinkButton({ authToken, plaidLinked, onSuccess, onDisconnect }: { 
  authToken: string
  plaidLinked: boolean
  onSuccess: (accessToken: string) => void
  onDisconnect: () => void
}) {
  const [linkToken, setLinkToken] = useState('')

  useEffect(() => {
    const fetchToken = async () => {
      if (plaidLinked) return // don't fetch if already linked
      const res = await fetch(`${HF_URL}/plaid/create_link_token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      setLinkToken(data.link_token || '')
    }
    if (authToken) fetchToken()
  }, [authToken, plaidLinked])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
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
    }
  })

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
  const [plaidToken, setPlaidToken] = useState('')
  const [plaidLinked, setPlaidLinked] = useState(false)
  const [plaidAccessToken, setPlaidAccessToken] = useState('')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

 useEffect(() => {
  const init = async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      setAuthToken(data.session.access_token)
      setUserId(data.session.user.id)
      setIsLoggedIn(true)
      // Don't reset here — let user pick a conversation
      await loadConversations(data.session.user.id)
    }
  }
  init()
}, [])

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

  const handleSignUp = async () => {
    setIsAuthLoading(true)
    setAuthError('')

    const { data, error } = await supabase.auth.signUp({ email, password })

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

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isResponding) return
    setHasStarted(true)

    setInput('')
    setIsResponding(true)

    const newMessages: Message[] = [...messages, { text, isUser: true }, { text: '', isUser: false }]
    setMessages(newMessages)

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
              const chunk = json.chunk || ''
              if (chunk) {
                fullResponse += chunk
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { text: fullResponse, isUser: false }
                  return updated
                })
              }
            } catch {}
          }
        }
      }

      // Save after response complete
      const finalMessages: Message[] = [
        ...messages,
        { text, isUser: true },
        { text: fullResponse, isUser: false }
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

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#080E1A] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="relative flex items-center justify-center w-24 h-24 mb-4">
              <div className="absolute inset-0 rounded-full bg-sky-400/10 animate-ping" style={{animationDuration: '2s'}} />
              <div className="absolute inset-2 rounded-full bg-sky-400/15 animate-pulse" style={{animationDuration: '1.6s'}} />
              <Image src="/fiscallogo_nobg.png" alt="FISCAL" width={80} height={80} className="relative z-10" />
            </div>
            <h1 className="text-white text-2xl font-bold">FISCAL</h1>
            <p className="text-slate-400 text-sm mt-1">Your AI Financial Assistant</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-[#111827] text-white placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-700 focus:border-sky-400 outline-none"
            />

            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="bg-sky-400 text-[#080E1A] py-3 rounded-xl font-bold hover:bg-sky-300 transition disabled:opacity-50"
            >
              {isAuthLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={handleSignUp}
              disabled={isAuthLoading}
              className="border border-sky-400 text-sky-400 py-3 rounded-xl font-bold hover:bg-sky-400/10 transition disabled:opacity-50"
            >
              Create Account
            </button>
          </form>
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
  onSuccess={(accessToken) => {
    setPlaidAccessToken(accessToken)
    setPlaidLinked(true)
  }}
  onDisconnect={() => {
    setPlaidLinked(false)
    setPlaidAccessToken('')
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
        {/* Header */}
        <header className="flex items-center px-4 py-4 border-b border-slate-800 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white mr-3"
          >
            ☰
          </button>
          <span className="text-white font-bold">FISCAL</span>
        </header>

       {/* Messages */}
<div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full min-h-0">
  
  {/* Logo — transitions from center to top */}
  <div className={`flex flex-col items-center transition-all duration-700 ease-in-out ${
    hasStarted ? 'mb-6' : 'mt-20 mb-8'
  }`}>
    <div className={`relative flex items-center justify-center transition-all duration-700 ${
      hasStarted ? 'w-16 h-16' : 'w-40 h-40'
    }`}>
      {/* Glow rings — speed up when responding */}
      <div 
        className="absolute inset-0 rounded-full bg-sky-400/10 animate-ping" 
        style={{ animationDuration: isResponding ? '0.8s' : '2s' }} 
      />
      <div 
        className="absolute inset-2 rounded-full bg-sky-400/15 animate-pulse" 
        style={{ animationDuration: isResponding ? '0.6s' : '1.6s' }} 
      />
      <div 
        className="absolute inset-4 rounded-full bg-sky-400/20 animate-pulse" 
        style={{ animationDuration: isResponding ? '0.6s' : '1.6s' }} 
      />
      <Image
        src="/fiscallogo_nobg.png"
        alt="FISCAL"
        width={hasStarted ? 48 : 120}
        height={hasStarted ? 48 : 120}
        className="relative z-10 transition-all duration-700"
      />
    </div>

    {/* Subtitle — fades out when conversation starts */}
    <div className={`transition-all duration-500 overflow-hidden ${
      hasStarted ? 'max-h-0 opacity-0 mt-0' : 'max-h-40 opacity-100 mt-4'
    }`}>
      <p className="text-slate-400 text-center max-w-sm">
        Ask me anything about your Canadian finances — budgeting, investing, TFSAs, RRSPs, and more.
      </p>
    </div>
  </div>

  {/* Suggestion chips — fade out when conversation starts */}
  {!hasStarted && (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md px-4">
        {['How do I start investing?', 'What is a TFSA?', 'Help me budget', 'Best savings account?'].map(s => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="bg-[#111827] text-slate-300 text-sm px-4 py-3 rounded-xl border border-slate-700 hover:border-sky-400/50 transition text-left"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )}

  {/* Messages */}
  <div className="flex flex-col gap-4">
    {messages.map((msg, i) => (
      <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
        {!msg.isUser && (
          <div className="w-7 h-7 shrink-0 mr-3 mt-1">
            <Image src="/fiscallogo_nobg.png" alt="F" width={28} height={28} className="rounded-lg w-full h-full object-contain" />
          </div>
        )}
        <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          msg.isUser
            ? 'bg-sky-500 text-white rounded-br-sm'
            : 'bg-[#111827] text-slate-200 rounded-bl-sm'
        }`}>
          {msg.text || (isResponding && i === messages.length - 1 ? (
            <span className="flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce" style={{animationDelay:'0.1s'}}>●</span>
              <span className="animate-bounce" style={{animationDelay:'0.2s'}}>●</span>
            </span>
          ) : '')}
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
      </div>
    </div>
  )
}