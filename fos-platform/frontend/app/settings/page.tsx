'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { getProviders, getUserKeys, saveUserKeys } from '@/lib/api'
import { Settings, Key, Cpu, User, Save, Eye, EyeOff, CheckCircle, Cloud } from 'lucide-react'
import toast from 'react-hot-toast'

const MODELS = {
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  gemini: ['gemini-2.0-flash-exp', 'gemini-2.5-pro-exp-03-25'],
  ollama: ['llama3', 'mistral', 'qwen2', 'deepseek-coder'],
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<any>(null)
  const [profile, setProfile] = useState({ name: '', role: '', context: '' })
  const [preferredProvider, setPreferredProvider] = useState('anthropic')
  const [fastModel, setFastModel] = useState('claude-haiku-4-5-20251001')
  const [smartModel, setSmartModel] = useState('claude-sonnet-4-6')
  const [deepModel, setDeepModel] = useState('claude-opus-4-8')

  // API key fields
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [keysSaved, setKeysSaved] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {})
    getUserKeys().then(data => {
      if (data.keys?.anthropic) setAnthropicKey(data.keys.anthropic)
      if (data.keys?.openai) setOpenaiKey(data.keys.openai)
      if (data.keys?.gemini) setGeminiKey(data.keys.gemini)
      if (data.preferred_provider) setPreferredProvider(data.preferred_provider)
    }).catch(() => {})
    const stored = localStorage.getItem('fos_profile')
    if (stored) setProfile(JSON.parse(stored))
    const prov = localStorage.getItem('fos_preferred_provider')
    if (prov) setPreferredProvider(prov)
    const fm = localStorage.getItem('fos_fast_model'); if (fm) setFastModel(fm)
    const sm = localStorage.getItem('fos_smart_model'); if (sm) setSmartModel(sm)
    const dm = localStorage.getItem('fos_deep_model'); if (dm) setDeepModel(dm)
  }, [])

  function saveProfile() {
    localStorage.setItem('fos_profile', JSON.stringify(profile))
    toast.success('Profile saved')
  }

  async function handleSaveKeys() {
    setSavingKeys(true)
    try {
      await saveUserKeys(
        { anthropic: anthropicKey, openai: openaiKey, gemini: geminiKey },
        preferredProvider,
      )
      setKeysSaved(true)
      toast.success('API keys saved to your account')
      setTimeout(() => setKeysSaved(false), 3000)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save keys')
    } finally {
      setSavingKeys(false)
    }
  }

  function saveModelPrefs() {
    localStorage.setItem('fos_preferred_provider', preferredProvider)
    localStorage.setItem('fos_fast_model', fastModel)
    localStorage.setItem('fos_smart_model', smartModel)
    localStorage.setItem('fos_deep_model', deepModel)
    toast.success('Model preferences saved')
  }

  const toggleShow = (key: string) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))

  function KeyField({ label, value, onChange, placeholder, fieldKey }: {
    label: string; value: string; onChange: (v: string) => void; placeholder: string; fieldKey: string
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm text-[#c8c8d0]">{label}</label>
        <div className="relative">
          <input
            type={showKeys[fieldKey] ? 'text' : 'password'}
            value={value}
            onChange={e => { onChange(e.target.value); setKeysSaved(false) }}
            placeholder={placeholder}
            className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500 pr-10"
          />
          <button
            type="button"
            onClick={() => toggleShow(fieldKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a6a] hover:text-white"
          >
            {showKeys[fieldKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-semibold text-white">Settings</h1>
          </div>

          {/* Profile */}
          <section className="bg-[#111113] border border-[#2a2a2b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Your Profile</h2>
            </div>
            <p className="text-xs text-[#8a8a9a]">FOS uses this to personalize responses for your context.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#c8c8d0] block mb-1.5">Name</label>
                <input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Caleb"
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-sm text-[#c8c8d0] block mb-1.5">Role / Title</label>
                <input
                  value={profile.role}
                  onChange={e => setProfile(p => ({ ...p, role: e.target.value }))}
                  placeholder="e.g. Founder & CEO at Vihiga Startup Hub"
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-sm text-[#c8c8d0] block mb-1.5">Context (what should FOS know about you?)</label>
                <textarea
                  value={profile.context}
                  onChange={e => setProfile(p => ({ ...p, context: e.target.value }))}
                  placeholder="Building startup ecosystems in Africa, focused on fintech and agritech. Looking to raise seed funding and grow my LinkedIn presence..."
                  rows={4}
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500 resize-none"
                />
              </div>
              <button onClick={saveProfile} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white transition-colors">
                <Save className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </section>

          {/* API Keys */}
          <section className="bg-[#111113] border border-[#2a2a2b] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">API Keys</h2>
              <span className="ml-auto flex items-center gap-1 text-xs text-[#5a5a6a]">
                <Cloud className="w-3 h-3" /> Stored in your account
              </span>
            </div>
            <p className="text-xs text-[#8a8a9a]">
              Your own API keys override the shared system key. Keys are stored encrypted in your account and never logged.
            </p>

            {providers?.providers && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(providers.providers).map(([name, available]: [string, any]) => (
                  <span key={name} className={`text-xs px-2.5 py-1 rounded-full border ${available ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-[#1a1a1b] text-[#5a5a6a] border-[#2a2a2b]'}`}>
                    {available ? '● ' : '○ '}{name}
                  </span>
                ))}
              </div>
            )}

            <KeyField label="Anthropic (Claude)" value={anthropicKey} onChange={setAnthropicKey} placeholder="sk-ant-..." fieldKey="anthropic" />
            <KeyField label="OpenAI (GPT-4o)" value={openaiKey} onChange={setOpenaiKey} placeholder="sk-..." fieldKey="openai" />
            <KeyField label="Google Gemini" value={geminiKey} onChange={setGeminiKey} placeholder="AIza..." fieldKey="gemini" />

            <button
              onClick={handleSaveKeys}
              disabled={savingKeys}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
            >
              {keysSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savingKeys ? 'Saving...' : keysSaved ? 'Saved!' : 'Save API Keys'}
            </button>
          </section>

          {/* Model preferences */}
          <section className="bg-[#111113] border border-[#2a2a2b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Model Preferences</h2>
            </div>
            <p className="text-xs text-[#8a8a9a]">FOS auto-selects models by task complexity. Override defaults here.</p>

            <div>
              <label className="text-sm text-[#c8c8d0] block mb-1.5">Preferred Provider</label>
              <select
                value={preferredProvider}
                onChange={e => setPreferredProvider(e.target.value)}
                className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#c8c8d0] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="auto">Auto (best for task)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Fast (quick tasks)', value: fastModel, set: setFastModel },
                { label: 'Smart (standard)', value: smartModel, set: setSmartModel },
                { label: 'Deep (complex analysis)', value: deepModel, set: setDeepModel },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-xs text-[#8a8a9a] block mb-1.5">{label}</label>
                  <select
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#c8c8d0] text-xs rounded-lg px-3 py-2 outline-none focus:border-brand-500"
                  >
                    {Object.values(MODELS).flat().map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={saveModelPrefs} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white transition-colors">
              <Save className="w-4 h-4" /> Save Preferences
            </button>
          </section>

          <p className="text-center text-xs text-[#5a5a6a] pb-4">
            FOS Platform · Powered by Claude, GPT-4, Gemini
          </p>
        </div>
      </main>
    </div>
  )
}
