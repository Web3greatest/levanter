'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Search, Globe, BookOpen, Zap, Loader, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const RESEARCH_MODES = [
  { id: 'search', label: 'Web Search', icon: '🌐', desc: 'Quick web search with top results' },
  { id: 'deep', label: 'Deep Research', icon: '🔬', desc: 'AI-synthesized multi-source analysis' },
  { id: 'url', label: 'Analyze URL', icon: '🔗', desc: 'Extract insights from any webpage' },
]

const QUICK_QUERIES = [
  'Top VC investors in African fintech 2024',
  'How to build a startup ecosystem from scratch',
  'LinkedIn growth strategies for founders',
  'Fundraising strategies for pre-seed startups in emerging markets',
  'Best practices for community-led growth',
  'How to find product-market fit quickly',
]

type SearchResult = { title: string; url: string; snippet: string; source?: string }

export default function ResearchPage() {
  const [mode, setMode] = useState('search')
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [analysis, setAnalysis] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  async function runSearch() {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setAnalysis('')
    try {
      const res = await fetch(`${API}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, max_results: 8 }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  async function runDeepResearch() {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setAnalysis('')
    try {
      const res = await fetch(`${API}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: query }),
      })
      const data = await res.json()
      setAnalysis(data.analysis || data.result || '')
      setResults(data.sources || [])
    } catch { toast.error('Research failed') }
    finally { setLoading(false) }
  }

  async function analyzeUrl() {
    if (!url.trim()) return
    setLoading(true)
    setResults([])
    setAnalysis('')
    try {
      const res = await fetch(`${API}/api/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      setAnalysis(data.analysis || data.summary || '')
    } catch { toast.error('URL analysis failed') }
    finally { setLoading(false) }
  }

  function handleSubmit() {
    if (mode === 'url') analyzeUrl()
    else if (mode === 'deep') runDeepResearch()
    else runSearch()
  }

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a2a2b]">
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-brand-400" /> Research
          </h1>

          {/* Mode tabs */}
          <div className="flex gap-2 mt-3">
            {RESEARCH_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setResults([]); setAnalysis('') }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${mode === m.id ? 'bg-brand-600/15 border border-brand-500/30 text-brand-400' : 'bg-[#1a1a1b] text-[#8a8a9a] hover:text-white border border-transparent'}`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="px-6 py-4 border-b border-[#2a2a2b]">
          <p className="text-xs text-[#8a8a9a] mb-3">{RESEARCH_MODES.find(m => m.id === mode)?.desc}</p>
          <div className="flex gap-2">
            {mode === 'url' ? (
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/article..."
                className="flex-1 bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            ) : (
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={mode === 'deep' ? 'Topic to research deeply...' : 'Search the web...'}
                className="flex-1 bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-white text-sm flex items-center gap-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : mode === 'deep' ? <Zap className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {mode === 'deep' ? 'Research' : mode === 'url' ? 'Analyze' : 'Search'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Quick queries */}
          {!loading && !results.length && !analysis && mode !== 'url' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8a8a9a] uppercase tracking-wider mb-3">Try these</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(q); }}
                    className="text-left px-4 py-3 bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl text-sm text-[#c8c8d0] hover:border-brand-500/50 transition-colors flex items-center gap-2"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#5a5a6a] flex-shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-[#8a8a9a]">
              <Loader className="w-8 h-8 animate-spin text-brand-400" />
              <p className="text-sm">{mode === 'deep' ? 'Researching across multiple sources...' : mode === 'url' ? 'Analyzing webpage...' : 'Searching the web...'}</p>
            </div>
          )}

          {/* Analysis (deep research / URL) */}
          {analysis && (
            <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-white">{mode === 'url' ? 'Page Analysis' : 'Research Summary'}</span>
              </div>
              <div className="text-[#c8c8d0] text-sm leading-relaxed whitespace-pre-wrap">{analysis}</div>
            </div>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.length > 0 && !analysis && (
                <p className="text-xs text-[#8a8a9a] mb-3">{results.length} results for "{query}"</p>
              )}
              {analysis && results.length > 0 && (
                <p className="text-xs text-[#8a8a9a] mb-3 uppercase tracking-wider">Sources</p>
              )}
              {results.map((r, i) => (
                <div key={i} className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-[#1e1e20] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {r.source && <span className="text-xs text-[#5a5a6a]">{r.source}</span>}
                      </div>
                      <p className="text-sm font-medium text-[#e8e8ea] line-clamp-1">{r.title}</p>
                      <p className="text-xs text-[#8a8a9a] mt-0.5 truncate">{r.url}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1 text-[#5a5a6a] hover:text-brand-400 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {expandedIdx === i ? <ChevronUp className="w-4 h-4 text-[#5a5a6a]" /> : <ChevronDown className="w-4 h-4 text-[#5a5a6a]" />}
                    </div>
                  </button>
                  {expandedIdx === i && r.snippet && (
                    <div className="px-4 pb-3 border-t border-[#2a2a2b] pt-3">
                      <p className="text-sm text-[#c8c8d0] leading-relaxed">{r.snippet}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
