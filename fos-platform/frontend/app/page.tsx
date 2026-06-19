'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  useEffect(() => { router.replace('/chat') }, [router])
  return (
    <div className="h-screen flex items-center justify-center bg-[#0f0f10]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-white">F</span>
        </div>
        <p className="text-[#8a8a9a] text-sm">Loading FOS...</p>
      </div>
    </div>
  )
}
