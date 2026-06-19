'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, MessageSquare, Database, FileText, Search, Users, Settings, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { href: '/chat', icon: MessageSquare, label: 'Chat', desc: 'AI conversations' },
  { href: '/memory', icon: Database, label: 'Memory', desc: 'Long-term context' },
  { href: '/documents', icon: FileText, label: 'Documents', desc: 'Files & knowledge' },
  { href: '/research', icon: Search, label: 'Research', desc: 'Web & deep analysis' },
  { href: '/agents', icon: Zap, label: 'Agents', desc: 'Specialized AI agents' },
  { href: '/community', icon: Users, label: 'Community', desc: 'Community tools' },
  { href: '/settings', icon: Settings, label: 'Settings', desc: 'Configuration' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-[#111113] border-r border-[#2a2a2b] h-full flex-shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-[#2a2a2b]">
        <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">FOS</div>
            <div className="text-xs text-[#8a8a9a] truncate">Founder OS</div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, desc }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all group ${
                active
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                  : 'text-[#8a8a9a] hover:text-white hover:bg-[#1a1a1b]'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-400' : ''}`} />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium truncate">
                  {label}
                </motion.span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse button */}
      <div className="px-2 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 text-[#8a8a9a] hover:text-white hover:bg-[#1a1a1b] rounded-xl transition-colors text-sm"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
