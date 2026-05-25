'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import { usePathname } from 'next/navigation'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Ringkasan aktivitas produksi dan stok' },
  '/bahan-baku': { title: 'Bahan Baku & Batch', subtitle: 'Manajemen kedatangan bahan baku dan kode batch' },
  '/produksi': { title: 'Alur Produksi', subtitle: 'Proses gramasi, annealing, packing, dan reject' },
  '/shieldtag': { title: 'Shieldtag', subtitle: 'Registrasi dan tracking ID unik per pcs emas' },
  '/inventory': { title: 'Inventory Gudang', subtitle: 'Stok gudang pusat dan cabang realtime' },
  '/mutasi': { title: 'Mutasi Cabang', subtitle: 'Transfer stok antar cabang dengan tracking' },
  '/penjualan': { title: 'Penjualan', subtitle: 'Transaksi penjualan toko dan marketplace' },
  '/po-cabang': { title: 'PO Cabang', subtitle: 'Purchase order dari cabang ke gudang pusat' },
  '/laporan': { title: 'Laporan', subtitle: 'Laporan produksi, inventory, dan keuangan' },
  '/audit-log': { title: 'Audit Log', subtitle: 'Histori seluruh aktivitas sistem' },
  '/pengaturan': { title: 'Pengaturan', subtitle: 'Manajemen user, cabang, dan konfigurasi' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const meta = PAGE_META[pathname] ?? { title: 'ERP System', subtitle: '' }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
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
