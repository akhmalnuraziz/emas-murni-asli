'use client'

import { Bell, Menu, Search } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const [searchValue, setSearchValue] = useState('')

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5">
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 hover:text-violet-600 p-1 -ml-1"
        >
          <Menu size={20} />
        </button>

        {/* Page title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>

        {/* Search bar — hidden on mobile */}
        <div className="relative hidden md:flex items-center">
          <Search size={13} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Cari batch, shieldtag, produksi..."
            className="pl-8 pr-4 h-9 w-64 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50"
          />
        </div>

        {/* Notification bell */}
        <button className="relative p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
