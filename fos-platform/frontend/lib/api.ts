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
  provider?: string
  model?: string
}

export interface UserInfo {
  user_id: string
  email: string
  name: string
  preferred_provider?: string
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('fos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('fos_token')
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export async function login(email: string, password: string): Promise<UserInfo & { access_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Invalid credentials')
  }
  const data = await res.json()
  localStorage.setItem('fos_token', data.access_token)
  localStorage.setItem('fos_user', JSON.stringify({ user_id: data.user_id, name: data.name, email: data.email }))
  return data
}

export async function register(email: string, password: string, name?: string): Promise<UserInfo & { access_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Registration failed')
  }
  const data = await res.json()
  localStorage.setItem('fos_token', data.access_token)
  localStorage.setItem('fos_user', JSON.stringify({ user_id: data.user_id, name: data.name, email: data.email }))
  return data
}

export function logout(): void {
  localStorage.removeItem('fos_token')
  localStorage.removeItem('fos_user')
  window.location.href = '/login'
}

export function getCurrentUser(): UserInfo | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('fos_user')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function getMe(): Promise<UserInfo> {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

// ── User API keys ──────────────────────────────────────────────────────────────

export async function getUserKeys(): Promise<{ keys: Record<string, string>; preferred_provider?: string }> {
  const res = await fetch(`${API_URL}/api/user/keys`, { headers: getAuthHeaders() })
  if (!res.ok) return { keys: {} }
  return res.json()
}

export async function saveUserKeys(keys: Record<string, string>, preferred_provider?: string) {
  const res = await fetch(`${API_URL}/api/user/keys`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ keys, preferred_provider }),
  })
  if (!res.ok) throw new Error('Failed to save keys')
  return res.json()
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

// ── Research ──────────────────────────────────────────────────────────────────

export async function deepResearch(topic: string) {
  const res = await fetch(`${API_URL}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ topic }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function analyzeUrl(url: string) {
  const res = await fetch(`${API_URL}/api/analyze-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function runAgent(agent_type: string, query: string, context: Record<string, any> = {}) {
  const res = await fetch(`${API_URL}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ agent_type, query, context }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function search(query: string, sources = ['web', 'memory']) {
  const res = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, sources }),
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
