'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { getMemories, addMemory, deleteMemory, searchMemory } from '@/lib/api'
import { Plus, Trash2, Search, Tag, Brain } from 'lucide-react'
import toast from 'react-hot-toast'

const MEMORY_TYPES = ['all', 'user', 'project', 'knowledge', 'conversation']

export default function MemoryPage() {
  const [memories, setMemories] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [activeType, setActiveType] = useState('all')
  const [query, setQuery] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState('knowledge')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMemories()
  }, [])

  async function loadMemories() {
    setLoading(true)
    try {
      const data = await getMemories()
      setMemories(data)
      setFiltered(data)
    } catch { toast.error('Failed to load memories') }
    finally { setLoading(false) }
  }

  async function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setFiltered(activeType === 'all' ? memories : memories.filter(m => m.type === activeType))
      return
    }
    try {
      const results = await searchMemory(q)
      setFiltered(results)
    } catch { toast.error('Search failed') }
  }

  function handleTypeFilter(type: string) {
    setActiveType(type)
    setFiltered(type === 'all' ? memories : memories.filter(m => m.type === type))
  }

  async function handleAdd() {
    if (!newContent.trim()) return
    try {
      await addMemory(newContent, newType)
      toast.success('Memory saved')
      setNewContent('')
      setShowAdd(false)
      await loadMemories()
    } catch { toast.error('Failed to save memory') }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMemory(id)
      toast.success('Memory deleted')
      setMemories(prev => prev.filter(m => m.id !== id))
      setFiltered(prev => prev.filter(m => m.id !== id))
    } catch { toast.error('Failed to delete') }
  }

  const TYPE_COLORS: Record<string, string> = {
    user: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    project: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    knowledge: 'bg-green-500/15 text-green-400 border-green-500/20',
    conversation: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2b]">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-brand-400" />
            <h1 className="text-lg font-semibold text-white">Memory</h1>
            <span className="text-sm text-[#8a8a9a]">{memories.length} items</span>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Memory
          </button>
        </div>

        {/* Add memory */}
        {showAdd && (
          <div className="px-6 py-4 bg-[#111113] border-b border-[#2a2a2b]">
            <div className="flex gap-3">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="bg-[#1a1a1b] border border-[#2a2a2b] text-[#c8c8d0] text-sm rounded-lg px-3 py-2 outline-none"
              >
                {MEMORY_TYPES.filter(t => t !== 'all').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="What should FOS remember?"
                className="flex-1 bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2 outline-none focus:border-brand-500"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button onClick={handleAdd} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white">Save</button>
            </div>
          </div>
        )}

        {/* Search & filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#2a2a2b]">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#8a8a9a] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search memories..."
              className="w-full bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex gap-1">
            {MEMORY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => handleTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeType === t ? 'bg-brand-600 text-white' : 'bg-[#1a1a1b] text-[#8a8a9a] hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-[#8a8a9a]">Loading memories...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 text-[#4a4a5a] mx-auto mb-3" />
              <p className="text-[#8a8a9a]">No memories yet. Start chatting or add one above.</p>
            </div>
          ) : (
            filtered.map(mem => (
              <div key={mem.id} className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-4 group hover:border-[#3a3a3b] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[#c8c8d0] text-sm leading-relaxed flex-1">{mem.content}</p>
                  <button
                    onClick={() => handleDelete(mem.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[#8a8a9a] hover:text-red-400 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TYPE_COLORS[mem.type] || 'bg-[#222224] text-[#8a8a9a] border-[#2a2a2b]'}`}>
                    {mem.type}
                  </span>
                  {mem.tags?.map((tag: string) => (
                    <span key={tag} className="text-xs text-[#8a8a9a] flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />{tag}
                    </span>
                  ))}
                  {'score' in mem && (
                    <span className="text-xs text-[#5a5a6a] ml-auto">relevance: {mem.score}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
