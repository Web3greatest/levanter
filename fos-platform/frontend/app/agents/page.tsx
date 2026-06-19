'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Zap, Play, Plus, Trash2, ChevronRight, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { runAgent as apiRunAgent } from '@/lib/api'

const AGENTS = [
  {
    id: 'executive',
    icon: '📋',
    name: 'Executive Assistant',
    desc: 'Manages tasks, emails, calendar, follow-ups, and daily operations.',
    examples: ['Draft a follow-up email to investor John Smith', 'Create my weekly priority list', 'Summarize my action items from last meeting'],
    color: 'border-blue-500/30 bg-blue-500/5',
    badge: 'bg-blue-500/15 text-blue-400',
  },
  {
    id: 'research',
    icon: '🔬',
    name: 'Research Agent',
    desc: 'Deep web research, market analysis, competitor intelligence, trend spotting.',
    examples: ['Research the top 10 fintech VCs in Africa', 'Analyze market size for mobile money in Nigeria', 'Find competitors to my SaaS product'],
    color: 'border-purple-500/30 bg-purple-500/5',
    badge: 'bg-purple-500/15 text-purple-400',
  },
  {
    id: 'content',
    icon: '✍️',
    name: 'Content Agent',
    desc: 'LinkedIn posts, Twitter threads, blog articles, newsletters, and brand content.',
    examples: ['Write a LinkedIn post about my startup journey', 'Create a Twitter thread on lessons from fundraising', 'Draft my monthly newsletter'],
    color: 'border-green-500/30 bg-green-500/5',
    badge: 'bg-green-500/15 text-green-400',
  },
  {
    id: 'investor',
    icon: '💰',
    name: 'Investor Relations',
    desc: 'Pitch decks, investor outreach, due diligence prep, term sheet analysis.',
    examples: ['Review my pitch deck and suggest improvements', 'Find investors for my agritech startup', 'Help me prepare for a Series A meeting'],
    color: 'border-yellow-500/30 bg-yellow-500/5',
    badge: 'bg-yellow-500/15 text-yellow-400',
  },
  {
    id: 'crm',
    icon: '🤝',
    name: 'CRM & Relationships',
    desc: 'Track relationships, follow-up scheduling, contact enrichment, network mapping.',
    examples: ['Who should I follow up with this week?', 'Summarize my relationship with Sarah from TechCrunch', 'Help me prepare for a coffee chat with a mentor'],
    color: 'border-orange-500/30 bg-orange-500/5',
    badge: 'bg-orange-500/15 text-orange-400',
  },
  {
    id: 'community',
    icon: '👥',
    name: 'Community Manager',
    desc: 'Grow and manage communities, engagement strategies, event planning.',
    examples: ['Plan a monthly virtual event for my community', 'Write a community update post', 'Suggest engagement activities for my Slack group'],
    color: 'border-pink-500/30 bg-pink-500/5',
    badge: 'bg-pink-500/15 text-pink-400',
  },
  {
    id: 'operations',
    icon: '⚙️',
    name: 'Operations Agent',
    desc: 'SOPs, process documentation, OKRs, hiring, vendor management.',
    examples: ['Create an SOP for onboarding new team members', 'Help me define Q3 OKRs', 'Draft a vendor evaluation framework'],
    color: 'border-cyan-500/30 bg-cyan-500/5',
    badge: 'bg-cyan-500/15 text-cyan-400',
  },
]

type WorkflowStep = { agent: string; task: string }

export default function AgentsPage() {
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [task, setTask] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'single' | 'workflow'>('single')
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { agent: 'research', task: '' },
    { agent: 'content', task: '' },
  ])

  async function runAgent() {
    if (!activeAgent || !task.trim()) return
    setLoading(true)
    setResult('')
    try {
      const data = await apiRunAgent(activeAgent, task)
      setResult(data.result || data.error || 'No response')
    } catch (e: any) { toast.error(e.message || 'Agent failed') }
    finally { setLoading(false) }
  }

  async function runWorkflow() {
    const validSteps = workflowSteps.filter(s => s.task.trim())
    if (validSteps.length === 0) { toast.error('Add at least one step with a task'); return }
    setLoading(true)
    setResult('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/agents/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: validSteps.map(s => ({ agent_type: s.agent, query: s.task })) }),
      })
      const data = await res.json()
      const output = data.results?.map((r: any, i: number) => `**Step ${i + 1} (${validSteps[i].agent}):**\n${r.result}`).join('\n\n---\n\n')
      setResult(output || 'Workflow completed')
    } catch { toast.error('Workflow failed') }
    finally { setLoading(false) }
  }

  const agent = AGENTS.find(a => a.id === activeAgent)

  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 flex min-w-0 overflow-hidden">
        {/* Agent list */}
        <div className="w-72 flex flex-col border-r border-[#2a2a2b] overflow-y-auto">
          <div className="px-4 py-4 border-b border-[#2a2a2b]">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-400" /> Agents
            </h1>
            <div className="flex gap-1 mt-3">
              {(['single', 'workflow'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${mode === m ? 'bg-brand-600 text-white' : 'bg-[#1a1a1b] text-[#8a8a9a] hover:text-white'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="py-2 space-y-1 px-2">
            {AGENTS.map(a => (
              <button
                key={a.id}
                onClick={() => { setActiveAgent(a.id); setResult('') }}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all ${activeAgent === a.id ? `border ${a.color}` : 'hover:bg-[#1a1a1b]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-sm font-medium text-[#c8c8d0]">{a.name}</span>
                </div>
                <p className="text-xs text-[#8a8a9a] mt-1 line-clamp-2">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {mode === 'single' ? (
            activeAgent && agent ? (
              <>
                <div className="px-6 py-4 border-b border-[#2a2a2b]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                      <p className="text-sm text-[#8a8a9a]">{agent.desc}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {/* Example prompts */}
                  {!result && !loading && (
                    <div className="space-y-2 mb-6">
                      <p className="text-xs text-[#8a8a9a] uppercase tracking-wider">Try these</p>
                      {agent.examples.map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => setTask(ex)}
                          className="w-full text-left px-4 py-3 bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl text-sm text-[#c8c8d0] hover:border-brand-500/50 transition-colors flex items-center gap-2"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-[#5a5a6a] flex-shrink-0" />
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}

                  {loading && (
                    <div className="flex items-center gap-3 text-[#8a8a9a] py-8">
                      <Loader className="w-5 h-5 animate-spin text-brand-400" />
                      <span className="text-sm">{agent.name} is working...</span>
                    </div>
                  )}

                  {result && (
                    <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${agent.badge}`}>{agent.icon} {agent.name}</span>
                      </div>
                      <p className="text-[#c8c8d0] text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
                    </div>
                  )}
                </div>

                <div className="px-6 pb-4">
                  <div className="flex gap-2">
                    <textarea
                      value={task}
                      onChange={e => setTask(e.target.value)}
                      placeholder={`Give ${agent.name} a task...`}
                      rows={2}
                      className="flex-1 bg-[#1a1a1b] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand-500 resize-none"
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), runAgent())}
                    />
                    <button
                      onClick={runAgent}
                      disabled={loading || !task.trim()}
                      className="px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-white flex items-center gap-2 text-sm self-end"
                    >
                      {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Run
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-[#4a4a5a] mx-auto mb-4" />
                  <p className="text-[#8a8a9a]">Select an agent to get started</p>
                </div>
              </div>
            )
          ) : (
            /* Workflow mode */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2a2a2b]">
                <h2 className="text-lg font-semibold text-white">Multi-Agent Workflow</h2>
                <p className="text-sm text-[#8a8a9a]">Chain multiple agents to run sequentially</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {workflowSteps.map((step, i) => (
                  <div key={i} className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8a8a9a] uppercase tracking-wider">Step {i + 1}</span>
                      {workflowSteps.length > 1 && (
                        <button onClick={() => setWorkflowSteps(prev => prev.filter((_, j) => j !== i))} className="text-[#8a8a9a] hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <select
                      value={step.agent}
                      onChange={e => setWorkflowSteps(prev => prev.map((s, j) => j === i ? { ...s, agent: e.target.value } : s))}
                      className="w-full bg-[#111113] border border-[#2a2a2b] text-[#c8c8d0] text-sm rounded-lg px-3 py-2 outline-none"
                    >
                      {AGENTS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                    </select>
                    <input
                      value={step.task}
                      onChange={e => setWorkflowSteps(prev => prev.map((s, j) => j === i ? { ...s, task: e.target.value } : s))}
                      placeholder="Task for this agent..."
                      className="w-full bg-[#111113] border border-[#2a2a2b] text-[#e8e8ea] text-sm rounded-lg px-4 py-2.5 outline-none focus:border-brand-500"
                    />
                  </div>
                ))}

                <button
                  onClick={() => setWorkflowSteps(prev => [...prev, { agent: 'research', task: '' }])}
                  className="w-full py-3 border border-dashed border-[#2a2a2b] rounded-xl text-sm text-[#8a8a9a] hover:border-brand-500/50 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>

                {result && (
                  <div className="bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl p-4">
                    <p className="text-xs text-[#8a8a9a] mb-3 uppercase tracking-wider">Workflow Results</p>
                    <p className="text-[#c8c8d0] text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 border-t border-[#2a2a2b] pt-4">
                <button
                  onClick={runWorkflow}
                  disabled={loading}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-white text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Workflow
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
