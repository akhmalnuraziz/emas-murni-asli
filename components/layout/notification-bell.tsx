'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Bell, X, ExternalLink, CheckCheck, Info, AlertTriangle, CheckCircle, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotifRead } from '@/app/(dashboard)/notifikasi/actions'
import { cn } from '@/lib/utils'

interface Notif {
  id: number
  judul: string
  pesan: string
  tipe: string
  icon: string | null
  link: string | null
  untuk_role: string[]
  is_read_by: Record<string, boolean> | null
  created_at: string
}

function tipeIcon(tipe: string) {
  if (tipe === 'warning') return <AlertTriangle size={14} className="text-amber-500" />
  if (tipe === 'success') return <CheckCircle size={14} className="text-green-500" />
  if (tipe === 'produksi') return <Package size={14} className="text-violet-500" />
  return <Info size={14} className="text-blue-500" />
}

function tipeBg(tipe: string) {
  if (tipe === 'warning') return 'rgba(245,158,11,0.08)'
  if (tipe === 'success') return 'rgba(34,197,94,0.08)'
  if (tipe === 'produksi') return 'rgba(124,58,237,0.08)'
  return 'rgba(59,130,246,0.08)'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

interface Props {
  userId: string
  userRole: string
}

export default function NotificationBell({ userId, userRole }: Props) {
  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.is_read_by?.[userId]).length

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchNotifs() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('notifikasi')
      .select('*')
      .or(`untuk_role.cs.{${userRole}},untuk_role.eq.{}`)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifs((data as Notif[]) ?? [])
    setLoading(false)
  }

  // Fetch on open
  useEffect(() => {
    if (open) fetchNotifs()
  }, [open])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifikasi-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifikasi',
      }, () => {
        fetchNotifs()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userRole])

  // Poll unread count every 60s
  useEffect(() => {
    fetchNotifs()
    const timer = setInterval(fetchNotifs, 60000)
    return () => clearInterval(timer)
  }, [])

  function handleClick(notif: Notif) {
    if (!notif.is_read_by?.[userId]) {
      startTransition(async () => {
        await markNotifRead(notif.id)
        setNotifs(prev => prev.map(n =>
          n.id === notif.id
            ? { ...n, is_read_by: { ...n.is_read_by, [userId]: true } }
            : n
        ))
      })
    }
    if (notif.link) {
      window.location.href = notif.link
      setOpen(false)
    }
  }

  function markAllRead() {
    const unreadNotifs = notifs.filter(n => !n.is_read_by?.[userId])
    startTransition(async () => {
      await Promise.all(unreadNotifs.map(n => markNotifRead(n.id)))
      setNotifs(prev => prev.map(n => ({
        ...n,
        is_read_by: { ...n.is_read_by, [userId]: true },
      })))
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative flex-shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-[9px] font-black text-white leading-none">{unread > 9 ? '9+' : unread}</span>
          </span>
        )}
        {unread === 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-800">Notifikasi</span>
              {unread > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                  {unread} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} disabled={isPending}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                  title="Tandai semua sudah dibaca">
                  <CheckCheck size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">Memuat...</div>
            ) : notifs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifs.map(n => {
                  const isRead = !!n.is_read_by?.[userId]
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors',
                        isRead ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50'
                      )}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: tipeBg(n.tipe) }}>
                        {tipeIcon(n.tipe)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className={cn('text-xs leading-snug', isRead ? 'font-medium text-slate-600' : 'font-bold text-slate-800')}>
                            {n.judul}
                          </p>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.pesan}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                          {n.link && (
                            <span className="text-[10px] text-violet-500 flex items-center gap-0.5">
                              <ExternalLink size={9} /> Buka
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
