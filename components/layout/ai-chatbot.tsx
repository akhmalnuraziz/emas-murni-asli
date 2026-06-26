'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'deepseek-3.2', name: 'DeepSeek 3.2', provider: 'DeepSeek' },
  { id: 'qwen3.7-max', name: 'Qwen 3.7 Max', provider: 'Alibaba' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let assistantMessage = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

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
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Maaf, terjadi kesalahan. Silakan coba lagi.' },
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
                <div
                  className={cn(
                    'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-md'
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
                placeholder="Ketik pesan..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-violet-400 bg-slate-50 max-h-20"
                style={{ minHeight: '38px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
                  input.trim() && !loading
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
