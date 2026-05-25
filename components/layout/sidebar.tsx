'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Hammer, Tag, Warehouse,
  ArrowLeftRight, ShoppingCart, FileText, Settings,
  ScrollText, Gem, LogOut, X, ChevronRight,
  Store
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { ROLE_LABELS } from '@/lib/types/database'
import { getInitials } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/bahan-baku', label: 'Bahan Baku', icon: Package, module: 'bahan-baku' },
  { href: '/produksi', label: 'Produksi', icon: Hammer, module: 'produksi' },
  { href: '/shieldtag', label: 'Shieldtag', icon: Tag, module: 'shieldtag' },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, module: 'inventory' },
  { href: '/mutasi', label: 'Mutasi Cabang', icon: ArrowLeftRight, module: 'mutasi' },
  { href: '/penjualan', label: 'Penjualan', icon: ShoppingCart, module: 'penjualan' },
  { href: '/po-cabang', label: 'PO Cabang', icon: Store, module: 'po-cabang' },
  { href: '/laporan', label: 'Laporan', icon: FileText, module: 'laporan' },
]

const BOTTOM_NAV = [
  { href: '/audit-log', label: 'Audit Log', icon: ScrollText, module: 'audit-log' },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, module: 'pengaturan' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { profile, signOut, hasAccess } = useAuth()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 flex flex-col z-50 transition-transform duration-300',
        'lg:translate-x-0 lg:static lg:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Gem size={15} color="white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest leading-none">
                Emas Murni Asli
              </p>
              <p className="text-[9px] text-violet-500 font-semibold uppercase tracking-widest mt-0.5">
                Production ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            Menu Utama
          </p>
          {NAV_ITEMS.map((item) => {
            if (!hasAccess(item.module)) return null
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  active
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <item.icon
                  size={16}
                  className={cn(active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600')}
                />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight size={13} className="text-violet-400" />}
              </Link>
            )
          })}

          <div className="pt-3 mt-2 border-t border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
              Sistem
            </p>
            {BOTTOM_NAV.map((item) => {
              if (!hasAccess(item.module)) return null
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    active
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon
                    size={16}
                    className={cn(active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600')}
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User profile */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[11px] font-bold">
                {getInitials(profile?.name ?? 'U')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {profile?.name ?? 'Loading...'}
              </p>
              <p className="text-[10px] text-violet-500 font-medium capitalize">
                {profile ? ROLE_LABELS[profile.role] : ''}
              </p>
            </div>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
              title="Keluar"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
