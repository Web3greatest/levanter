'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { getProviders } from '@/lib/api'
import { Settings, Key, Cpu, User, Save, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const MODELS = {
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  ollama: ['llama3', 'mistral', 'qwen2', 'deepseek-coder'],
}

function ApiKeyInput({ label, keyName, placeholder }: { label: string; keyName: string; placeholder: string }) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(keyName)
    if (stored) { setValue(stored); setSaved(true) }
  }, [keyName])

  function save() {
    if (!value.trim()) { localStorage.removeItem(keyName); setSaved(false); return }
    localStorage.setItem(keyName, value.trim())
    setSaved(true)
    toast.success(`${label} saved`)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-[#c8c8d0] flex items-center gap-2">
        {label}
        {saved && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => { setValue(e.target.value); setSaved(false) }}
            placeholder={placeholder}
            className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500 pr-10"
          />
          <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8a9a] hover:text-white">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={save} className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white transition-colors">
          Save
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<any>(null)
  const [profile, setProfile] = useState({ name: '', role: '', context: '' })
  const [preferredProvider, setPreferredProvider] = useState('anthropic')
  const [fastModel, setFastModel] = useState('claude-haiku-4-5-20251001')
  const [smartModel, setSmartModel] = useState('claude-sonnet-4-6')
  const [deepModel, setDeepModel] = useState('claude-opus-4-8')

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {})
    const stored = localStorage.getItem('fos_profile')
    if (stored) setProfile(JSON.parse(stored))
    const prov = localStorage.getItem('fos_preferred_provider')
    if (prov) setPreferredProvider(prov)
  }, [])

  function saveProfile() {
    localStorage.setItem('fos_profile', JSON.stringify(profile))
    toast.success('Profile saved')
  }

  function saveModelPrefs() {
    localStorage.setItem('fos_preferred_provider', preferredProvider)
    localStorage.setItem('fos_fast_model', fastModel)
    localStorage.setItem('fos_smart_model', smartModel)
    localStorage.setItem('fos_deep_model', deepModel)
    toast.success('Model preferences saved')
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
            </div>
            <p className="text-xs text-[#8a8a9a]">Keys are stored locally in your browser. Never sent to any third party.</p>

            {providers && (
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(providers).map(([name, info]: [string, any]) => (
                  <span key={name} className={`text-xs px-2.5 py-1 rounded-full border ${info.available ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-[#1a1a1b] text-[#5a5a6a] border-[#2a2a2b]'}`}>
                    {info.available ? '● ' : '○ '}{name}
                  </span>
                ))}
              </div>
            )}

            <ApiKeyInput label="Anthropic (Claude)" keyName="ANTHROPIC_API_KEY" placeholder="sk-ant-..." />
            <ApiKeyInput label="OpenAI (GPT-4)" keyName="OPENAI_API_KEY" placeholder="sk-..." />
            <ApiKeyInput label="Google Gemini" keyName="GEMINI_API_KEY" placeholder="AIza..." />
            <ApiKeyInput label="Tavily (Web Search)" keyName="TAVILY_API_KEY" placeholder="tvly-..." />
            <ApiKeyInput label="Serper (Google Search)" keyName="SERPER_API_KEY" placeholder="..." />
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
            FOS Platform · Powered by Claude, GPT-4, Gemini · Settings stored locally
          </p>
        </div>
      </main>
    </div>
  )
}
