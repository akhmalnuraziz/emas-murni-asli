'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const reason       = searchParams.get('reason')
  const wasIdle      = reason === 'idle'
  const wasExpired   = reason === 'expired'
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
    <div className="w-full max-w-[360px]">

      {/* Brand */}
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="PT Emas Murni Asli" className="w-20 h-20 mx-auto mb-3 object-contain"/>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">PT Emas Murni Asli</h1>
        <p className="text-[13px] text-slate-500 mt-1 font-normal">Production & Inventory System</p>
      </div>

      {/* Session notices */}
      {wasIdle && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[12px] text-amber-700 bg-amber-50 border border-amber-200">
          <span className="text-base leading-none mt-px">⏱</span>
          <span>Di-logout otomatis karena tidak aktif selama 30 menit.</span>
        </div>
      )}
      {wasExpired && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[12px] text-slate-600 bg-slate-100 border border-slate-200">
          <span className="text-base leading-none mt-px">🔒</span>
          <span>Sesi telah berakhir. Silakan login kembali.</span>
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-2 border-b border-slate-200">
          <p className="text-[13px] font-semibold text-slate-900">Masuk ke Sistem</p>
        </div>

        <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px]
                text-slate-900 placeholder:text-slate-400 font-normal
                focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100
                transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-[13px]
                  text-slate-900 placeholder:text-slate-400 font-normal
                  focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100
                  transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
              >
                {showPass ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <span className="flex-shrink-0">✗</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800
              text-white text-[13px] font-semibold rounded-lg
              shadow-sm hover:shadow-md
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Memproses…
              </span>
            ) : 'Masuk'}
          </button>
        </form>
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-6">
        © {new Date().getFullYear()} PT Emas Murni Asli · ERP v4.0
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
