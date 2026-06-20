'use client'

import { useState, useCallback } from 'react'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useIdleLogout } from '@/hooks/use-idle-logout'

export default function IdleLogoutProvider({ children }: { children: React.ReactNode }) {
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(120)

  const handleWarning = useCallback((secs: number) => {
    setSecondsLeft(secs)
    setShowWarning(true)

    // Countdown tiap detik
    let remaining = secs
    const interval = setInterval(() => {
      remaining -= 1
      setSecondsLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
  }, [])

  const { stayLoggedIn } = useIdleLogout({ onWarning: handleWarning })

  function handleStayLoggedIn() {
    setShowWarning(false)
    stayLoggedIn()
  }

  function handleLogoutNow() {
    window.location.href = '/login?reason=idle'
  }

  return (
    <>
      {children}

      {/* Warning dialog */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.1)' }}>
                <Clock size={26} className="text-amber-500" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Sesi hampir habis</h2>
              <p className="text-sm text-slate-500 mt-1">
                Kamu tidak aktif cukup lama. Mau tetap login?
              </p>
            </div>

            {/* Countdown */}
            <div className="mx-6 mb-5 rounded-2xl py-4 text-center"
              style={{ background: secondsLeft <= 30 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                       border: `1px solid ${secondsLeft <= 30 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
              <p className={`text-3xl font-black tabular-nums ${secondsLeft <= 30 ? 'text-red-500' : 'text-amber-500'}`}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {secondsLeft <= 30 ? 'Hampir logout nih!' : 'Otomatis logout dalam'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleLogoutNow}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                <LogOut size={14} /> Logout
              </button>
              <button onClick={handleStayLoggedIn}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
                <RefreshCw size={14} /> Tetap Login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
