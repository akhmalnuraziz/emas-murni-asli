'use client'

import { Menu, Search, Tag, Package, ArrowUpRight, Boxes, Truck, X } from 'lucide-react'
import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NotificationBell from './notification-bell'
import { globalSearch, type SearchResult } from '@/app/(dashboard)/search/actions'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
  serverProfile?: { id: string; name: string | null; role: string } | null
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  shieldtag: <Tag size={13} className="text-violet-500" />,
  batch:     <Package size={13} className="text-amber-500" />,
  po_cabang: <Boxes size={13} className="text-blue-500" />,
  mutasi:    <Truck size={13} className="text-emerald-500" />,
  produksi:  <Package size={13} className="text-orange-500" />,
}

const TYPE_LABEL: Record<string, string> = {
  shieldtag: 'Shieldtag',
  batch:     'Batch',
  po_cabang: 'PO Cabang',
  mutasi:    'Mutasi',
  produksi:  'Produksi',
}

export default function Header({ title, subtitle, onMenuClick, serverProfile }: HeaderProps) {
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<SearchResult[]>([])
  const [open,       setOpen]       = useState(false)
  const [isPending,  startTransition] = useTransition()
  const wrapRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router   = useRouter()

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch(val)
        setResults(res)
        setOpen(true)
      })
    }, 280)
  }

  function handleSelect(r: SearchResult) {
    setOpen(false)
    setQuery('')
    router.push(r.href)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 lg:px-6 h-[65px] flex items-center">
      <div className="flex items-center gap-3 w-full">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 p-2 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block truncate">{subtitle}</p>
          )}
        </div>

        {/* Global Search */}
        <div className="relative hidden md:flex items-center" ref={wrapRef}>
          <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Cari batch, shieldtag, PO..."
            className="pl-8 pr-8 h-9 w-60 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
          />
          {query && (
            <button onClick={handleClear}
              className="absolute right-2.5 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={12} />
            </button>
          )}

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
              {isPending ? (
                <div className="px-4 py-5 text-xs text-slate-400 text-center">Mencari...</div>
              ) : results.length === 0 ? (
                <div className="px-4 py-5 text-xs text-slate-400 text-center">Tidak ada hasil untuk "{query}"</div>
              ) : (
                <div className="py-1.5 max-h-80 overflow-y-auto">
                  {Object.entries(grouped).map(([type, items]) => (
                    <div key={type}>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                        {TYPE_LABEL[type] ?? type}
                      </p>
                      {items.map((r, i) => (
                        <button key={i} onClick={() => handleSelect(r)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left group">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50 group-hover:bg-white transition-colors border border-slate-100">
                            {TYPE_ICON[r.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800 font-mono truncate">{r.label}</p>
                            <p className="text-[11px] text-slate-400 truncate">{r.sub}</p>
                          </div>
                          <ArrowUpRight size={12} className="text-slate-300 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {serverProfile ? (
          <NotificationBell userId={serverProfile.id} userRole={serverProfile.role} />
        ) : (
          <div className="w-9 h-9" />
        )}
      </div>
    </header>
  )
}
