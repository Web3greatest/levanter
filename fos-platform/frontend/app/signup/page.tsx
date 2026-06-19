'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brain, Mail, Lock, User, Eye, EyeOff, Chrome } from 'lucide-react'
import { register } from '@/lib/api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Email and password are required')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await register(email, password, name)
      toast.success('Account created! Welcome to FOS.')
      router.push('/chat')
    } catch (err: any) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Founder OS</h1>
          <p className="text-[#8a8a9a] text-sm mt-1">Your AI co-pilot for building great companies</p>
        </div>

        {/* Card */}
        <div className="bg-[#111113] border border-[#2a2a2b] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#8a8a9a] mb-1.5">Name (optional)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Caleb"
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-brand-500 transition-colors"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#8a8a9a] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@startup.com"
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-brand-500 transition-colors"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#8a8a9a] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-[#1a1a1b] border border-[#2a2a2b] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-brand-500 transition-colors"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a6a] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2a2a2b]" />
            </div>
            <div className="relative flex justify-center text-xs text-[#5a5a6a]">
              <span className="bg-[#111113] px-3">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast('Google OAuth — connect your Google Client ID in Settings', { icon: 'ℹ️' })}
            className="w-full flex items-center justify-center gap-3 bg-[#1a1a1b] border border-[#2a2a2b] hover:border-[#3a3a3b] text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            <Chrome className="w-4 h-4" />
            Continue with Google
          </button>

          <p className="text-center text-sm text-[#8a8a9a] mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#5a5a6a] mt-6">
          By signing up you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  )
}
