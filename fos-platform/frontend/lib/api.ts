const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent?: string
  tools?: string[]
  timestamp: Date
}

export interface ChatRequest {
  message: string
  user_id?: string
  session_id?: string
  conversation_id?: string
  agent?: string
  stream?: boolean
  tools?: string[]
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export async function* streamChat(request: ChatRequest): AsyncGenerator<{ type: string; [key: string]: any }> {
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ ...request, stream: true }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6))
        } catch {}
      }
    }
  }
}

export async function sendChat(request: ChatRequest) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Memory ─────────────────────────────────────────────────────────────────────

export async function getMemories(type?: string) {
  const url = type ? `${API_URL}/api/memory?memory_type=${type}` : `${API_URL}/api/memory`
  const res = await fetch(url, { headers: getAuthHeaders() })
  return res.json()
}

export async function addMemory(content: string, type = 'knowledge', tags: string[] = []) {
  const res = await fetch(`${API_URL}/api/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ content, memory_type: type, tags, user_id: 'default' }),
  })
  return res.json()
}

export async function deleteMemory(id: string) {
  const res = await fetch(`${API_URL}/api/memory/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  return res.json()
}

export async function searchMemory(query: string) {
  const res = await fetch(`${API_URL}/api/memory/search?q=${encodeURIComponent(query)}`, { headers: getAuthHeaders() })
  return res.json()
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function uploadDocument(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return res.json()
}

export async function getDocuments() {
  const res = await fetch(`${API_URL}/api/documents`, { headers: getAuthHeaders() })
  return res.json()
}

export async function askDocument(docId: string, question: string) {
  const formData = new FormData()
  formData.append('question', question)
  const res = await fetch(`${API_URL}/api/documents/${docId}/ask`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })
  return res.json()
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function search(query: string, sources = ['web', 'memory']) {
  const res = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, sources, user_id: 'default' }),
  })
  return res.json()
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function getProviders() {
  const res = await fetch(`${API_URL}/api/providers`)
  return res.json()
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations() {
  const res = await fetch(`${API_URL}/api/conversations`, { headers: getAuthHeaders() })
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  const data = await res.json()
  localStorage.setItem('fos_token', data.access_token)
  return data
}

export async function register(username: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Registration failed')
  const data = await res.json()
  localStorage.setItem('fos_token', data.access_token)
  return data
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('fos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
