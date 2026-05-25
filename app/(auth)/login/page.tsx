'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Lock, Mail, Shield, Gem } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email atau password salah. Silakan coba lagi.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex rounded-2xl overflow-hidden shadow-2xl shadow-violet-200">

        {/* LEFT — Form Panel */}
        <div className="flex-[0_0_44%] bg-white flex flex-col justify-center px-10 py-12">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Gem size={18} color="white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 uppercase tracking-widest leading-none">
                PT Emas Murni Asli
              </p>
              <p className="text-[9px] font-semibold text-violet-500 uppercase tracking-widest mt-0.5">
                Production System
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Selamat Datang</h1>
          <p className="text-sm text-slate-400 mb-8">
            Masuk untuk mengakses dashboard sistem
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@perusahaan.com"
                  required
                  className="w-full h-11 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="w-full h-11 pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="text-right -mt-2">
              <a href="#" className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                Lupa password?
              </a>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold tracking-wide transition-all duration-200',
                loading && 'opacity-60 cursor-not-allowed'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Masuk Sekarang'}
            </button>
          </form>

          {/* Security badge */}
          <div className="mt-8 flex items-center gap-2.5 bg-violet-50 rounded-xl px-4 py-3 border border-violet-100">
            <Shield size={14} className="text-violet-600 flex-shrink-0" />
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Sistem Aman</span> · SSL Enkripsi · Audit Log · RBAC
            </p>
          </div>
        </div>

        {/* RIGHT — Welcome Panel */}
        <div className="flex-1 bg-violet-600 flex flex-col justify-between px-10 py-12 relative overflow-hidden">
          {/* Background circles */}
          <div className="absolute top-[-60px] right-[-60px] w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute bottom-[-80px] right-[20px] w-44 h-44 rounded-full bg-white/5" />
          <div className="absolute bottom-[80px] left-[-20px] w-28 h-28 rounded-full bg-amber-400/10" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Top content */}
          <div className="relative z-10">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-5 flex items-center gap-2">
              <span className="w-5 h-[1.5px] bg-white/30 inline-block" />
              Internal Access Only
            </p>

            {/* Gold bars illustration */}
            <div className="flex items-end gap-2 mb-7">
              {[32, 52, 44, 28, 18].map((h, i) => (
                <div
                  key={i}
                  className="w-4 rounded-sm bg-amber-400"
                  style={{ height: h, opacity: 0.7 + i * 0.05 }}
                />
              ))}
            </div>

            <h2 className="text-[26px] font-bold text-white leading-[1.4] mb-4">
              Selamat kembali ke<br />
              <span className="text-amber-300">PT Emas Murni Asli.</span>
            </h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-[260px]">
              Sudah siap bekerja hari ini? Semua aktivitas produksi, inventory, dan laporan menunggu kamu di dalam. Ayo login dan mulai shift-mu! 💪
            </p>

            {/* Role chips */}
            <div className="flex gap-2 flex-wrap mt-6">
              {['Produksi', 'Inventory', 'Shieldtag', 'Laporan'].map((chip) => (
                <span
                  key={chip}
                  className="text-[10px] font-semibold px-3 py-1 rounded-full border border-white/20 text-white/70 bg-white/8 uppercase tracking-wider"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="relative z-10">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { num: '14+', label: 'Modul Aktif' },
                { num: 'Realtime', label: 'Inventory Sync' },
                { num: '1 : 1', label: 'Shieldtag Tracking' },
                { num: 'Multi', label: 'Cabang Support' },
              ].map((s) => (
                <div key={s.label} className="bg-white/8 border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-amber-300 font-bold text-lg leading-none">{s.num}</p>
                  <p className="text-white/50 text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/25 leading-relaxed">
              © 2026 PT Emas Murni Asli · Sistem Internal · Dilarang akses tanpa izin
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
