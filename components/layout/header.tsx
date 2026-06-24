'use client'

import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
  serverProfile?: { id: string; name: string | null; role: string } | null
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 lg:px-6 h-[64px] flex items-center">
      <div className="flex items-center gap-3 w-full">

        {/* Mobile menu */}
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 p-1.5 -ml-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
          aria-label="Buka menu"
        >
          <Menu size={18} />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight truncate leading-none">{title}</h1>
          {subtitle && (
            <p className="text-[12px] text-slate-400 mt-1 hidden sm:block truncate leading-none font-normal">{subtitle}</p>
          )}
        </div>

      </div>
    </header>
  )
}
