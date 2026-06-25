'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState<string | null>(null)
  const [done,     setDone]       = useState(false)
  const [ready,    setReady]      = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  // Session already established by /auth/confirm server route
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError('Link tidak valid atau sudah kedaluwarsa.')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Password tidak cocok.'); return }
    if (password.length < 8)  { setError('Password minimal 8 karakter.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="PT Emas Murni Asli" className="w-20 h-20 mx-auto mb-3 object-contain"/>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">PT Emas Murni Asli</h1>
          <p className="text-[13px] text-slate-500 mt-1">Buat password baru</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900">Reset Password</p>
          </div>

          {done ? (
            <div className="px-6 py-8 text-center">
              <p className="text-[24px] mb-2">✅</p>
              <p className="text-[13px] font-semibold text-green-700">Password berhasil diubah!</p>
              <p className="text-[12px] text-slate-400 mt-1">Mengalihkan ke dashboard…</p>
            </div>
          ) : error && !ready ? (
            <div className="px-6 py-8 text-center space-y-3">
              <p className="text-[13px] text-red-600">{error}</p>
              <button onClick={() => router.push('/login')}
                className="text-[12px] text-violet-600 hover:text-violet-700 font-medium">
                ← Kembali ke login
              </button>
            </div>
          ) : !ready ? (
            <div className="px-6 py-8 text-center text-[13px] text-slate-400">Memverifikasi link…</div>
          ) : (
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Password baru</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter" required minLength={8} autoFocus
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Konfirmasi password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Ketik ulang password" required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <span>✗</span><span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold rounded-lg transition-all disabled:opacity-50">
                {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          © {new Date().getFullYear()} PT Emas Murni Asli · ERP v4.0
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
