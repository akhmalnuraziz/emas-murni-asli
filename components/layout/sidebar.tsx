'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Hammer, Tag, Warehouse,
  ArrowLeftRight, ShoppingCart, Store, FileText,
  ScrollText, Settings, LogOut, X, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',     icon: LayoutDashboard, module: 'dashboard'  },
  { href: '/bahan-baku', label: 'Bahan Baku',    icon: Package,         module: 'bahan-baku' },
  { href: '/produksi',   label: 'Produksi',      icon: Hammer,          module: 'produksi'   },
  { href: '/shieldtag',  label: 'Shieldtag',     icon: Tag,             module: 'shieldtag'  },
  { href: '/inventory',  label: 'Inventory',     icon: Warehouse,       module: 'inventory'  },
  { href: '/mutasi',     label: 'Mutasi Cabang', icon: ArrowLeftRight,  module: 'mutasi'     },
  { href: '/penjualan',  label: 'Penjualan',     icon: ShoppingCart,    module: 'penjualan'  },
  { href: '/po-cabang',  label: 'PO Cabang',     icon: Store,           module: 'po-cabang'  },
  { href: '/laporan',    label: 'Laporan',       icon: FileText,        module: 'laporan'    },
]

const BOTTOM_NAV = [
  { href: '/audit-log',  label: 'Audit Log',  icon: ScrollText, module: 'audit-log'  },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings,   module: 'pengaturan' },
]

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

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
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar — pakai inline style untuk transform, Tailwind hanya untuk visual */}
      <aside
  className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-violet-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-[10px] font-black">EMA</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">PT Emas Murni</p>
              <p className="text-[9px] text-slate-400 leading-tight">Production System</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-slate-400 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {NAV_ITEMS.filter(item => hasAccess(item.module as any)).map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                )}
              >
                <Icon size={16} className={active ? 'text-violet-600' : 'text-slate-400'} />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight size={13} className="text-violet-400" />}
              </Link>
            )
          })}
        </nav>

        {/* Bottom nav */}
        <div className="px-3 py-2 border-t border-slate-100 space-y-0.5">
          {BOTTOM_NAV.filter(item => hasAccess(item.module as any)).map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                )}
              >
                <Icon size={16} className={active ? 'text-violet-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User */}
        <div className="px-3 pb-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <span className="text-violet-700 text-[10px] font-bold">{getInitials(profile?.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{profile?.name ?? '—'}</p>
              <p className="text-[10px] text-slate-400 capitalize">{profile?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={signOut} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
