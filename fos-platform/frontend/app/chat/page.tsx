import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <div className="flex h-screen bg-[#0f0f10]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <ChatInterface />
      </main>
    </div>
  )
}
