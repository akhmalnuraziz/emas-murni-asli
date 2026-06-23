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

  // Logout via server-side route — cookie terhapus bersih
  function handleLogoutNow() {
    window.location.href = '/api/auth/signout?reason=idle'
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const countdownStr = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-amber-50 border border-amber-100">
                <Clock size={22} className="text-amber-500" />
              </div>
              <h2 className="text-[15px] font-semibold text-slate-900">Sesi hampir berakhir</h2>
              <p className="text-[13px] text-slate-500 mt-1 font-normal">
                Tidak ada aktivitas terdeteksi. Ingin tetap login?
              </p>
            </div>

            {/* Countdown */}
            <div className={`mx-6 mb-5 rounded-xl py-4 text-center border transition-colors ${
              secondsLeft <= 30
                ? 'bg-red-50 border-red-100'
                : 'bg-amber-50 border-amber-100'
            }`}>
              <p className={`text-4xl font-bold tabular-nums tracking-tight ${
                secondsLeft <= 30 ? 'text-red-600' : 'text-amber-600'
              }`}>
                {countdownStr}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium uppercase tracking-wide">
                {secondsLeft <= 30 ? 'Segera logout' : 'Tersisa sebelum logout'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 px-6 pb-6">
              <button
                onClick={handleLogoutNow}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                  text-[13px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200
                  border border-slate-200 transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
              <button
                onClick={handleStayLoggedIn}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                  text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700
                  border border-violet-600 transition-colors"
              >
                <RefreshCw size={14} />
                Tetap Login
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
