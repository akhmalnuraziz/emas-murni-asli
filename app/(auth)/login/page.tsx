'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const wasIdle      = searchParams.get('reason') === 'idle'
  const supabase     = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email atau password salah.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      {wasIdle && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm text-amber-700 bg-amber-50 border border-amber-100 text-center">
          ⏱️ Sesi kamu habis karena tidak aktif. Silakan login lagi.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Masuk ke Sistem</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md hover:from-violet-700 hover:to-violet-600 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg mb-4">
            <span className="text-white text-base font-black tracking-tighter">EMA</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">PT Emas Murni Asli</h1>
          <p className="text-sm text-slate-500 mt-1">Production & Inventory System</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          © 2026 PT Emas Murni Asli · ERP v4.0
        </p>
      </div>
    </div>
  )
}
