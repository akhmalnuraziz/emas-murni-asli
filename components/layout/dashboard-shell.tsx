'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import { usePathname } from 'next/navigation'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':           { title: 'Dashboard',             subtitle: 'Ringkasan aktivitas produksi dan stok hari ini' },
  '/bahan-baku':          { title: 'Bahan Baku',            subtitle: 'Manajemen batch, peleburan, dan rekonsiliasi gram' },
  '/produksi':            { title: 'Produksi',              subtitle: 'Tracking serah-terima per tahap — Cutting → Pas Berat → Annealing → Siap Packing' },
  '/packing-log':         { title: 'Packing Log',           subtitle: 'Kelola packing & validasi vs Shieldtag' },
  '/shieldtag':           { title: 'Shieldtag',             subtitle: 'Registrasi dan distribusi ID unik per PCS' },
  '/inventory':           { title: 'Inventory',             subtitle: 'Stok per lokasi berbasis Shieldtag — realtime' },
  '/mutasi':              { title: 'Pemindahan Barang',      subtitle: 'Keluar (cabang/toko) & masuk (buyback/retur)' },
  '/penjualan':           { title: 'Penjualan',             subtitle: 'Rekap dari Accurate + cetak receipt' },
  '/po-cabang':           { title: 'Toko & PO',             subtitle: 'Stok ready toko dan pre-order' },
  '/prioritas-produksi':  { title: 'Prioritas Produksi',    subtitle: 'Auto-ranking P1/P2/P3 berdasar PO dan safety stock' },
  '/kpi-tim':             { title: 'KPI Tim',               subtitle: 'Rating bintang ⭐ per tim per proses — efisiensi, loss, kecepatan' },
  '/laporan':             { title: 'Laporan',               subtitle: 'Per batch, laba rugi, performa cabang' },
  '/audit-log':           { title: 'Audit Log',             subtitle: 'Riwayat semua aksi penting di sistem' },
  '/pengaturan':          { title: 'Pengaturan',            subtitle: 'Master tim, admin, toleransi, gramasi, dan konfigurasi sistem' },
}

export default function DashboardShell({
  children,
  serverProfile,
}: {
  children: React.ReactNode
  serverProfile: { id: string; name: string | null; role: string } | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const meta = PAGE_META[pathname] ?? { title: 'ERP System', subtitle: '' }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        serverProfile={serverProfile}
      />
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
