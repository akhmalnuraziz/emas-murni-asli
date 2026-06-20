'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS = 60 * 60 * 1000 // 60 menit
const WARNING_BEFORE_MS = 2 * 60 * 1000  // warning 2 menit sebelum logout

const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keydown',
  'scroll', 'touchstart', 'click', 'wheel',
]

interface Options {
  onWarning?: (secondsLeft: number) => void
  onLogout?: () => void
}

export function useIdleLogout({ onWarning, onLogout }: Options = {}) {
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningFiredRef = useRef(false)

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    onLogout?.()
    window.location.href = '/login?reason=idle'
  }, [onLogout])

  const resetTimer = useCallback(() => {
    if (timerRef.current)        clearTimeout(timerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    warningFiredRef.current = false

    // Warning 2 menit sebelum logout
    warningTimerRef.current = setTimeout(() => {
      warningFiredRef.current = true
      onWarning?.(Math.round(WARNING_BEFORE_MS / 1000))
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Actual logout
    timerRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS)
  }, [logout, onWarning])

  useEffect(() => {
    resetTimer()

    const handleActivity = () => {
      // Kalau warning sudah muncul, biarkan user dismiss dulu — jangan auto-reset
      if (!warningFiredRef.current) resetTimer()
    }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      if (timerRef.current)        clearTimeout(timerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [resetTimer])

  // Public method: user klik "Tetap Login" di warning dialog
  const stayLoggedIn = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  return { stayLoggedIn }
}
