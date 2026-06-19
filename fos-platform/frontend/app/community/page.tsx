'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Users, Megaphone, Calendar, MessageSquare, TrendingUp, Loader, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const TOOLS = [
  {
    id: 'post',
    icon: <Megaphone className="w-5 h-5" />,
    label: 'Community Post',
    desc: 'Write an engaging post for your community',
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Slack', 'Discord', 'WhatsApp', 'Telegram', 'Circle', 'LinkedIn Group', 'Facebook Group'] },
      { key: 'topic', label: 'Topic / Purpose', type: 'text', placeholder: 'e.g. Welcome new members this week' },
      { key: 'tone', label: 'Tone', type: 'select', options: ['Warm & Friendly', 'Professional', 'Motivational', 'Informational', 'Celebratory'] },
    ],
  },
  {
    id: 'event',
    icon: <Calendar className="w-5 h-5" />,
    label: 'Event Plan',
    desc: 'Plan a community event from concept to execution',
    fields: [
      { key: 'event_type', label: 'Event Type', type: 'select', options: ['Virtual Meetup', 'Workshop', 'AMA Session', 'Pitch Night', 'Networking Event', 'Hackathon', 'Webinar'] },
      { key: 'audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. Early-stage founders in Africa' },
      { key: 'size', label: 'Expected Attendance', type: 'select', options: ['< 20 people', '20-50 people', '50-100 people', '100-500 people', '500+ people'] },
    ],
  },
  {
    id: 'engagement',
    icon: <TrendingUp className="w-5 h-5" />,
    label: 'Engagement Strategy',
    desc: 'Boost community activity and retention',
    fields: [
      { key: 'community_type', label: 'Community Type', type: 'text', placeholder: 'e.g. Startup founders, developers, investors' },
      { key: 'current_size', label: 'Current Size', type: 'select', options: ['< 100 members', '100-500', '500-1000', '1000-5000', '5000+'] },
      { key: 'challenge', label: 'Main Challenge', type: 'select', options: ['Low engagement', 'Member retention', 'Growing the community', 'Monetization', 'Content creation'] },
    ],
  },
  {
    id: 'welcome',
    icon: <MessageSquare className="w-5 h-5" />,
    label: 'Welcome Message',
    desc: 'Craft an onboarding message for new members',
    fields: [
      { key: 'community_name', label: 'Community Name', type: 'text', placeholder: 'e.g. Vihiga Startup Hub' },
      { key: 'mission', label: 'Community Mission', type: 'text', placeholder: 'e.g. Support African founders building world-class startups' },
      { key: 'next_steps', label: 'Key First Steps', type: 'text', placeholder: 'e.g. Introduce yourself, read the guidelines, join a call' },
    ],
  },
]

export default function CommunityPage() {
  const [activeTool, setActiveTool] = useState(TOOLS[0].id)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const tool = TOOLS.find(t => t.id === activeTool)!

  async function generate() {
    const missing = tool.fields.filter(f => !formData[f.key]?.trim())
    if (missing.length > 0) { toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return }

    setLoading(true)
    setResult('')
    try {
      const prompt = buildPrompt(activeTool, formData)
      const res = await fetch(`${API}/api/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: 'community', query: prompt, stream: false }),
      })
      const data = await res.json()
      setResult(data.result || data.error || 'No result')
    } catch { toast.error('Generation failed') }
    finally { setLoading(false) }
  }

  function buildPrompt(toolId: string, data: Record<string, string>): string {
    switch (toolId) {
      case 'post':
        return `Write an engaging community post for ${data.platform}. Topic: ${data.topic}. Tone: ${data.tone}. Include emojis, a clear call-to-action, and make it feel authentic and community-driven.`
      case 'event':
        return `Plan a ${data.event_type} for my community. Target audience: ${data.audience}. Expected attendance: ${data.size}. Provide: event name, date suggestion, agenda, promotion strategy, and logistics checklist.`
      case 'engagement':
        return `Create a 30-day community engagement strategy for a ${data.community_type} community with ${data.current_size} members. Main challenge: ${data.challenge}. Include specific tactics, content calendar ideas, and gamification ideas.`
      case 'welcome':
        return `Write a warm welcome message for new members joining ${data.community_name}. Our mission: ${data.mission}. First steps for new members: ${data.next_steps}. Make it welcoming, clear, and inspiring.`
      default:
        return JSON.stringify(data)
    }
  }

  async function copyResult() {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied!')
  }

  function setField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 flex min-w-0 overflow-hidden">
        {/* Tool list */}
        <div className="w-64 flex flex-col border-r border-[#2a2a2b]">
          <div className="px-4 py-4 border-b border-[#2a2a2b]">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-400" /> Community
            </h1>
            <p className="text-xs text-[#8a8a9a] mt-1">AI tools for community growth</p>
          </div>
          <nav className="flex-1 py-2 space-y-1 px-2">
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTool(t.id); setResult(''); setFormData({}) }}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all ${activeTool === t.id ? 'bg-brand-600/15 border border-brand-500/20' : 'hover:bg-[#1a1a1b]'}`}
              >
                <div className={`flex items-center gap-2 ${activeTool === t.id ? 'text-brand-400' : 'text-[#8a8a9a]'}`}>
                  {t.icon}
                  <span className="text-sm font-medium text-[#c8c8d0]">{t.label}</span>
                </div>
                <p className="text-xs text-[#8a8a9a] mt-1">{t.desc}</p>
              </button>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2a2a2b]">
            <div className={`flex items-center gap-2 text-brand-400`}>
              {tool.icon}
              <h2 className="text-lg font-semibold text-white">{tool.label}</h2>
            </div>
            <p className="text-sm text-[#8a8a9a] mt-0.5">{tool.desc}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Form */}
            {tool.fields.map(field => (
              <div key={field.key}>
                <label className="text-sm text-[#c8c8d0] block mb-1.5">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={formData[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#c8c8d0] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500"
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    value={formData[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500"
                  />
                )}
              </div>
            ))}

            <button
              onClick={generate}
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-white text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {loading ? 'Generating...' : `Generate ${tool.label}`}
            </button>

            {/* Result */}
            {result && (
              <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2b]">
                  <span className="text-sm font-medium text-white">Generated Content</span>
                  <button onClick={copyResult} className="flex items-center gap-1.5 text-xs text-[#8a8a9a] hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[#c8c8d0] text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
