'use client'

import { Menu, Search } from 'lucide-react'
import { useState } from 'react'
import NotificationBell from './notification-bell'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
  serverProfile?: { id: string; name: string | null; role: string } | null
}

export default function Header({ title, subtitle, onMenuClick, serverProfile }: HeaderProps) {
  const [searchValue, setSearchValue] = useState('')

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
        <div className="relative hidden md:flex items-center">
          <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Cari batch, shieldtag, produksi..."
            className="pl-8 pr-4 h-9 w-60 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
          />
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
