'use client'

import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 lg:px-6 py-3.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 p-2 -ml-1 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
          aria-label="Buka menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  )
}
