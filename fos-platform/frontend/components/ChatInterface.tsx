'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Mic, StopCircle, ChevronDown, Zap, Brain, Globe, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, uploadDocument, Message } from '@/lib/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const AGENT_OPTIONS = [
  { value: '', label: 'Auto', icon: '🧠', desc: 'Smart routing' },
  { value: 'executive', label: 'Executive', icon: '📋', desc: 'Tasks & email' },
  { value: 'research', label: 'Research', icon: '🔬', desc: 'Deep analysis' },
  { value: 'content', label: 'Content', icon: '✍️', desc: 'Writing & posts' },
  { value: 'investor', label: 'Investor', icon: '💰', desc: 'Pitch & funding' },
  { value: 'crm', label: 'CRM', icon: '🤝', desc: 'Relationships' },
  { value: 'community', label: 'Community', icon: '👥', desc: 'Community mgmt' },
  { value: 'operations', label: 'Operations', icon: '⚙️', desc: 'Ops & process' },
]

const QUICK_PROMPTS = [
  "Write a LinkedIn post about my startup journey",
  "Analyze my pitch deck and suggest improvements",
  "Help me find relevant investors for my fintech startup",
  "Draft a professional follow-up email to an investor",
  "Create a 90-day go-to-market plan",
  "Summarize key metrics I should track for my SaaS",
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-brand-500 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-brand-500 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-brand-500 typing-dot" />
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-6`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${isUser ? 'bg-brand-600 text-white' : 'bg-[#1e1e20] text-brand-500 border border-[#2a2a3b]'}`}>
        {isUser ? 'C' : 'F'}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {msg.agent && !isUser && (
          <span className="text-xs text-[#8a8a9a] px-1">
            {AGENT_OPTIONS.find(a => a.value === msg.agent)?.icon} {msg.agent} agent
          </span>
        )}
        <div className={`rounded-2xl px-4 py-3 ${isUser
          ? 'bg-brand-600 text-white rounded-tr-sm'
          : 'bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose max-w-none text-[15px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {msg.tools && msg.tools.length > 0 && (
          <div className="flex gap-1 flex-wrap px-1">
            {msg.tools.map(t => (
              <span key={t} className="text-xs bg-[#1a1a1b] border border-[#2a2a2b] text-[#8a8a9a] px-2 py-0.5 rounded-full">
                {t === 'web_search' ? '🌐' : t === 'search_memory' ? '🧠' : '📄'} {t}
              </span>
            ))}
          </div>
        )}
        <span className="text-xs text-[#5a5a6a] px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [showAgents, setShowAgents] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingAgent, setStreamingAgent] = useState('')
  const [streamingTools, setStreamingTools] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setStreamingContent('')
    setStreamingAgent('')
    setStreamingTools([])

    try {
      let fullContent = ''
      let agent = ''
      let tools: string[] = []

      for await (const event of streamChat({
        message: userMessage,
        session_id: sessionId,
        agent: selectedAgent || undefined,
        stream: true,
      })) {
        if (event.type === 'agent') { agent = event.agent; setStreamingAgent(event.agent) }
        if (event.type === 'tools') { tools = event.tools; setStreamingTools(event.tools) }
        if (event.type === 'chunk') { fullContent += event.content; setStreamingContent(fullContent) }
        if (event.type === 'done') {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullContent,
            agent,
            tools,
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, assistantMsg])
          setStreamingContent('')
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
      setStreamingContent('')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, sessionId, selectedAgent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (file: File) => {
    const toastId = toast.loading(`Uploading ${file.name}...`)
    try {
      const doc = await uploadDocument(file)
      toast.success(`Uploaded: ${doc.filename}`, { id: toastId })
      setInput(prev => prev + ` [File: ${doc.filename}] `)
    } catch {
      toast.error('Upload failed', { id: toastId })
    }
  }

  const agentInfo = AGENT_OPTIONS.find(a => a.value === selectedAgent)

  return (
    <div className="flex flex-col h-full bg-[#0f0f10]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Founder Operating System</h1>
            <p className="text-xs text-[#8a8a9a]">Powered by Claude · GPT-4 · Gemini</p>
          </div>
        </div>

        {/* Agent selector */}
        <div className="relative">
          <button
            onClick={() => setShowAgents(!showAgents)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1b] border border-[#2a2a2b] rounded-lg text-sm text-[#c8c8d0] hover:border-brand-500 transition-colors"
          >
            <span>{agentInfo?.icon}</span>
            <span>{agentInfo?.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <AnimatePresence>
            {showAgents && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-10 w-56 bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                {AGENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSelectedAgent(opt.value); setShowAgents(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#252527] transition-colors ${selectedAgent === opt.value ? 'bg-brand-600/10 text-brand-400' : 'text-[#c8c8d0]'}`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <div className="text-left">
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-[#8a8a9a]">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-brand-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Founder Operating System</h2>
              <p className="text-[#8a8a9a] text-sm max-w-md">
                Your AI co-pilot for building, fundraising, content, research, and operations.
                What are we working on today?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="text-left px-4 py-3 bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl text-sm text-[#c8c8d0] hover:border-brand-500/50 hover:bg-[#1e1e20] transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Streaming message */}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold bg-[#1e1e20] text-brand-500 border border-[#2a2a3b]">F</div>
            <div className="max-w-[85%] flex flex-col gap-1">
              {streamingAgent && (
                <span className="text-xs text-[#8a8a9a] px-1">
                  {AGENT_OPTIONS.find(a => a.value === streamingAgent)?.icon} {streamingAgent} agent
                </span>
              )}
              <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-2xl rounded-tl-sm px-4 py-3">
                {streamingContent ? (
                  <div className="prose max-w-none text-[15px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                  </div>
                ) : (
                  <TypingIndicator />
                )}
              </div>
              {streamingTools.length > 0 && (
                <div className="flex gap-1 flex-wrap px-1">
                  {streamingTools.map(t => (
                    <span key={t} className="text-xs bg-[#1a1a1b] border border-[#2a2a2b] text-brand-400 px-2 py-0.5 rounded-full animate-pulse">
                      {t === 'web_search' ? '🌐 searching...' : '🧠 recalling...'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-2xl focus-within:border-brand-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything — strategy, content, research, operations..."
            rows={1}
            className="w-full bg-transparent px-4 pt-3 pb-2 text-[15px] text-[#e8e8ea] placeholder:text-[#4a4a5a] resize-none outline-none max-h-[200px] min-h-[52px]"
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 200) + 'px'
            }}
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-[#8a8a9a] hover:text-white hover:bg-[#252527] rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-[#8a8a9a] hover:text-white hover:bg-[#252527] rounded-lg transition-colors" title="Voice input">
                <Mic className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-[#8a8a9a] hover:text-white hover:bg-[#252527] rounded-lg transition-colors" title="Web search">
                <Globe className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5a5a6a]">⏎ send · ⇧⏎ newline</span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {loading ? <StopCircle className="w-4 h-4 text-white" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.csv,.xlsx,.txt,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />
      </div>
    </div>
  )
}
