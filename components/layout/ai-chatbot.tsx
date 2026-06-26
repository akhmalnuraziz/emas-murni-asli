'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, ChevronDown, RefreshCcw, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google - Tercepat & Gratis', providerKey: 'gemini' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', provider: 'Meta (via Groq) - Terbaru', providerKey: 'groq' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Meta (via Groq)', providerKey: 'groq' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'OpenAI (via Groq)', providerKey: 'groq' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Meta (via Groq) - Cepat', providerKey: 'groq' },
]

const IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 menit

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [apiStatus, setApiStatus] = useState<'ok' | 'error' | 'checking'>('checking')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearChat = useCallback(() => {
    setMessages([])
    setShowClearConfirm(false)
  }, [])

  // Auto-reset setelah 10 menit idle
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (messages.length > 0) {
        clearChat()
      }
    }, IDLE_TIMEOUT_MS)
  }, [messages.length, clearChat])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      checkApiStatus()
      resetIdleTimer()
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [isOpen, resetIdleTimer])

  // Reset timer setiap user activity
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      resetIdleTimer()
    }
  }, [messages, isOpen, resetIdleTimer])

  const checkApiStatus = async () => {
    setApiStatus('checking')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          model: selectedModel,
        }),
      })
      setApiStatus(res.ok ? 'ok' : 'error')
    } catch {
      setApiStatus('error')
    }
  }

  const sendMessage = async (retryMessage?: Message) => {
    const messageToSend = retryMessage || { role: 'user' as const, content: input.trim() }
    
    if (!messageToSend.content || loading) return

    setMessages(prev => {
      const filtered = prev.filter(m => m.role !== 'error')
      return retryMessage ? filtered : [...filtered, messageToSend]
    })
    
    if (!retryMessage) setInput('')
    setLoading(true)
    resetIdleTimer()

    try {
      const messagesForApi = retryMessage
        ? messages.filter(m => m.role !== 'error').map(m => ({ role: m.role, content: m.content }))
        : [...messages, messageToSend].map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          model: selectedModel,
          provider: AVAILABLE_MODELS.find(m => m.id === selectedModel)?.providerKey || 'groq',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let assistantMessage = ''
      let hasError = false
      let errorMsg = ''

      setMessages(prev => [...prev.filter(m => m.role !== 'error'), { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          const trimmed = line.replace(/^data: /, '')
          if (trimmed === '[DONE]') break

          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.error) {
              hasError = true
              errorMsg = parsed.error
              break
            }
            if (parsed.content) {
              assistantMessage += parsed.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage,
                }
                return updated
              })
            }
          } catch {}
        }
        if (hasError) break
      }

      if (hasError && !assistantMessage) {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'error', content: errorMsg || 'Layanan AI tidak tersedia. Coba ganti model atau coba lagi nanti.' },
        ])
      }
    } catch (error) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'error', content: 'Gagal mengirim pesan. Periksa koneksi internet dan coba lagi.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full',
          'bg-gradient-to-br from-violet-500 to-violet-600',
          'hover:from-violet-600 hover:to-violet-700',
          'shadow-lg hover:shadow-xl transition-all duration-200',
          'flex items-center justify-center',
          'text-white hover:scale-105',
          isOpen && 'hidden'
        )}
        title="AI Assistant"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <p className="text-[13px] font-semibold">AI Assistant</p>
                <p className="text-[10px] text-violet-200">{currentModel?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Clear Chat */}
              {messages.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowClearConfirm(!showClearConfirm)}
                    className="p-1.5 hover:bg-violet-500 rounded-lg transition-colors"
                    title="Hapus semua pesan"
                  >
                    <Trash2 size={14} />
                  </button>
                  {showClearConfirm && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-10">
                      <p className="px-3 py-1 text-[11px] text-slate-500">Hapus semua pesan?</p>
                      <div className="flex gap-1 px-2 pt-1">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="flex-1 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={clearChat}
                          className="flex-1 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* API Status */}
              <div className={cn(
                'w-2 h-2 rounded-full mr-2',
                apiStatus === 'ok' ? 'bg-green-400' : apiStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
              )} title={apiStatus === 'ok' ? 'API Online' : apiStatus === 'error' ? 'API Offline' : 'Checking...'} />
              {/* Model Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="p-1.5 hover:bg-violet-500 rounded-lg transition-colors text-[10px]"
                >
                  <ChevronDown size={14} />
                </button>
                {showModelPicker && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-10">
                    {AVAILABLE_MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id)
                          setShowModelPicker(false)
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors',
                          selectedModel === model.id && 'bg-violet-50'
                        )}
                      >
                        <p className="text-[12px] font-medium text-slate-800">{model.name}</p>
                        <p className="text-[10px] text-slate-400">{model.provider}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-violet-500 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={40} className="mx-auto text-violet-300 mb-3" />
                <p className="text-[13px] text-slate-500 font-medium">Halo! Ada yang bisa saya bantu?</p>
                <p className="text-[11px] text-slate-400 mt-1">Tanya tentang stok, produksi, penjualan, atau data lainnya.</p>
                <p className="text-[10px] text-slate-300 mt-2">Chat otomatis dihapus setelah 10 menit tidak dipakai</p>
                {apiStatus === 'error' && (
                  <p className="text-[11px] text-red-400 mt-3 flex items-center justify-center gap-1">
                    <AlertCircle size={12} />
                    Layanan AI sedang tidak tersedia
                  </p>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-violet-600" />
                  </div>
                )}
                {msg.role === 'error' && (
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={14} className="text-red-500" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-md'
                      : msg.role === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  )}
                >
                  {msg.content || (loading && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : null)}
                  {msg.role === 'error' && !loading && (
                    <button
                      onClick={() => {
                        const lastUserMsg = messages.slice(0, i).reverse().find(m => m.role === 'user')
                        if (lastUserMsg) sendMessage(lastUserMsg)
                      }}
                      className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-red-600 hover:text-red-700"
                    >
                      <RefreshCcw size={12} />
                      Coba lagi
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-slate-600" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={apiStatus === 'error' ? 'Layanan AI sedang tidak tersedia...' : 'Ketik pesan...'}
                rows={1}
                disabled={apiStatus === 'error'}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-violet-400 bg-slate-50 max-h-20 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '38px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || apiStatus === 'error'}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
                  input.trim() && !loading && apiStatus !== 'error'
                    ? 'bg-violet-600 hover:bg-violet-700 text-white'
                    : 'bg-slate-100 text-slate-400'
                )}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
