'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Clock } from 'lucide-react'

const IDLE_MS     = 30 * 60 * 1000  // 30 menit tidak aktif → logout
const WARNING_MS  =  2 * 60 * 1000  // tampilkan warning 2 menit sebelum logout
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

export default function SessionGuard() {
  const router              = useRouter()
  const supabase            = createClient()
  const idleTimer           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null) // detik tersisa
  const countdownInterval   = useRef<ReturnType<typeof setInterval> | null>(null)

  const doSignOut = useCallback(async (reason: 'idle' | 'expired') => {
    clearTimeout(idleTimer.current!)
    clearTimeout(warningTimer.current!)
    clearInterval(countdownInterval.current!)
    await supabase.auth.signOut()
    router.push(`/login?reason=${reason}`)
  }, [router, supabase])

  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current!)
    clearTimeout(warningTimer.current!)
    clearInterval(countdownInterval.current!)
    setCountdown(null)

    // Warning 2 menit sebelum timeout
    warningTimer.current = setTimeout(() => {
      let secs = Math.floor(WARNING_MS / 1000)
      setCountdown(secs)
      countdownInterval.current = setInterval(() => {
        secs -= 1
        setCountdown(secs)
        if (secs <= 0) clearInterval(countdownInterval.current!)
      }, 1000)
    }, IDLE_MS - WARNING_MS)

    // Auto logout setelah idle
    idleTimer.current = setTimeout(() => doSignOut('idle'), IDLE_MS)
  }, [doSignOut])

  useEffect(() => {
    // Monitor auth state — jika token expired / user sign out dari tab lain
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login?reason=expired')
      }
      if (event === 'TOKEN_REFRESHED' && !session) {
        doSignOut('expired')
      }
    })

    // Pasang idle listeners
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle() // mulai timer pertama

    return () => {
      subscription.unsubscribe()
      clearTimeout(idleTimer.current!)
      clearTimeout(warningTimer.current!)
      clearInterval(countdownInterval.current!)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdle))
    }
  }, [supabase, resetIdle, doSignOut, router])

  // Tidak ada warning = tidak render apa-apa
  if (countdown === null) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const label = mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : `${secs}d`

  return (
    <div className="fixed bottom-5 right-5 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold"
        style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <Clock size={16} className="flex-shrink-0 animate-pulse" />
        <div>
          <p className="text-xs font-bold opacity-80 uppercase tracking-wider">Sesi hampir habis</p>
          <p>Auto logout dalam <span className="font-black text-yellow-300">{label}</span></p>
        </div>
        <button
          onClick={resetIdle}
          className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold whitespace-nowrap">
          Tetap Login
        </button>
        <button
          onClick={() => doSignOut('idle')}
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors opacity-70">
          <LogOut size={13} />
        </button>
      </div>
    </div>
  )
}
