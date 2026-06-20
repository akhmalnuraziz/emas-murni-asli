'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Hammer, Tag, Warehouse,
  ArrowLeftRight, ShoppingCart, FileText,
  ScrollText, Settings, LogOut, X, ChevronRight,
  TrendingUp, Star, Store, ClipboardList, RotateCcw, SearchCode, Truck, Wallet, Recycle, HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { ROLE_ACCESS } from '@/lib/types/database'

const NAV_GROUPS = [
  {
    label: 'Produksi',
    items: [
      { href: '/dashboard',    label: 'Dashboard',            icon: LayoutDashboard, module: 'dashboard'   },
      { href: '/bahan-baku',   label: 'Bahan Baku',           icon: Package,         module: 'bahan-baku'  },
      { href: '/produksi',     label: 'Produksi',             icon: Hammer,          module: 'produksi'    },
      { href: '/packing-log',  label: 'Packing Log',          icon: Package,         module: 'packing-log' },
      { href: '/shieldtag',          label: 'Shieldtag',            icon: Tag,          module: 'shieldtag'          },
      { href: '/shieldtag-explorer', label: 'Shieldtag Explorer',   icon: SearchCode,   module: 'shieldtag-explorer' },
    ],
  },
  {
    label: 'Gudang & Distribusi',
    items: [
      { href: '/inventory',      label: 'Inventory',            icon: Warehouse,       module: 'inventory'           },
      { href: '/mutasi',         label: 'Pemindahan Barang',    icon: ArrowLeftRight,  module: 'mutasi'              },
      { href: '/stock-opname',   label: 'Stock Opname',         icon: ClipboardList,   module: 'stock-opname'        },
      { href: '/po-cabang',           label: 'Toko & PO',       icon: Store,   module: 'po-cabang'           },
      { href: '/po-vendor-packaging', label: 'PO Vendor Packaging', icon: Truck, module: 'po-vendor-packaging' },
      { href: '/prioritas-produksi', label: 'Prioritas Produksi', icon: TrendingUp, module: 'prioritas-produksi'  },
    ],
  },
  {
    label: 'Bisnis',
    items: [
      { href: '/penjualan',    label: 'Penjualan',            icon: ShoppingCart,    module: 'penjualan'    },
      { href: '/buyback',      label: 'Buyback',              icon: RotateCcw,       module: 'buyback'      },
      { href: '/pengeluaran',  label: 'Pengeluaran',          icon: Wallet,          module: 'pengeluaran'  },
      { href: '/laporan',      label: 'Laporan',              icon: FileText,        module: 'laporan'      },
      { href: '/scrap',        label: 'Scrap Inventory',      icon: Recycle,         module: 'scrap'        },
      { href: '/kpi-tim',      label: 'KPI Tim',              icon: Star,            module: 'kpi-tim'      },
    ],
  },
]

const BOTTOM_NAV = [
  { href: '/audit-log',   label: 'Audit Log',   icon: ScrollText,  module: 'audit-log'  },
  { href: '/backup',      label: 'Backup Data', icon: HardDrive,   module: 'backup'     },
  { href: '/pengaturan',  label: 'Pengaturan',  icon: Settings,    module: 'pengaturan' },
]

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
  serverProfile?: { id: string; name: string | null; role: string } | null
}

export default function Sidebar({ mobileOpen, onClose, serverProfile }: SidebarProps) {
  const pathname  = usePathname()
  const { profile: clientProfile, signOut } = useAuth()
  const profile   = serverProfile ?? clientProfile
  const isActive  = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const roleAccess = (module: string) => {
    if (!profile) return true
    if (profile.role === 'owner') return true
    return ROLE_ACCESS[profile.role as keyof typeof ROLE_ACCESS]?.includes(module) ?? false
  }
  const canShow = (module: string) => roleAccess(module)

  const renderItem = (item: {
    href: string; label: string; icon: React.ElementType;
    module: string; disabled?: boolean
  }) => {
    const Icon   = item.icon
    const active = isActive(item.href)

    if (item.disabled) {
      return (
        <div
          key={item.href}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 cursor-not-allowed select-none"
          title="Segera hadir"
        >
          <Icon size={15} className="text-slate-300 flex-shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
            Segera
          </span>
        </div>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-violet-50 text-violet-700 font-semibold'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        )}
      >
        <Icon
          size={15}
          className={cn('flex-shrink-0', active ? 'text-violet-600' : 'text-slate-400')}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
        )}
      </Link>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 flex flex-col z-50',
        'transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-[65px] flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-400 to-gold-600 shadow-sm">
              <span className="text-white text-[9px] font-black tracking-tight">EMA</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight tracking-tight">PT Emas Murni</p>
              <p className="text-[9px] text-slate-400 leading-tight">Production System</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items
                  .filter(item => canShow(item.module as any))
                  .map(item => renderItem(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="px-2.5 py-2 border-t border-slate-100 space-y-0.5">
          {BOTTOM_NAV.filter(item => canShow(item.module as any)).map(item =>
            renderItem(item)
          )}
        </div>

        {/* User */}
        <div className="px-3 pb-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white text-[10px] font-bold">{getInitials(profile?.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{profile?.name ?? '—'}</p>
              <p className="text-[10px] text-slate-400 capitalize">{profile?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={signOut} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
