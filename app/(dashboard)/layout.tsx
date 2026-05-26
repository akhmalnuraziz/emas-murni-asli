'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import { usePathname } from 'next/navigation'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':   { title: 'Dashboard',      subtitle: 'Ringkasan aktivitas produksi dan stok hari ini' },
  '/bahan-baku':  { title: 'Bahan Baku',     subtitle: 'Manajemen batch dan HPP bahan baku emas' },
  '/produksi':    { title: 'Produksi',       subtitle: 'Tracking status produksi per item' },
  '/shieldtag':   { title: 'Shieldtag',      subtitle: 'Registrasi dan distribusi ID unik per PCS' },
  '/inventory':   { title: 'Inventory',      subtitle: 'Stok gudang pusat dan cabang realtime' },
  '/mutasi':      { title: 'Mutasi Cabang',  subtitle: 'Transfer stok antar cabang' },
  '/penjualan':   { title: 'Penjualan',      subtitle: 'Transaksi toko dan marketplace' },
  '/po-cabang':   { title: 'PO Cabang',      subtitle: 'Purchase order dari cabang' },
  '/laporan':     { title: 'Laporan',        subtitle: 'Laporan produksi, stok, dan keuangan' },
  '/audit-log':   { title: 'Audit Log',      subtitle: 'Riwayat semua aktivitas sistem' },
  '/pengaturan':  { title: 'Pengaturan',     subtitle: 'Konfigurasi sistem dan manajemen user' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const meta = PAGE_META[pathname] ?? { title: 'ERP System', subtitle: '' }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar — fixed di semua breakpoint */}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — lg:ml-64 supaya tidak overlap dengan sidebar */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}