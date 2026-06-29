'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import IdleLogoutProvider from '@/components/layout/idle-logout-provider'
import AiChatbot from '@/components/layout/ai-chatbot'
import { usePathname } from 'next/navigation'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':             { title: 'Dashboard',             subtitle: 'Ringkasan aktivitas produksi dan stok hari ini' },
  '/bahan-baku':            { title: 'Bahan Baku',            subtitle: 'Manajemen batch, peleburan, dan rekonsiliasi gram' },
  '/produksi':              { title: 'Produksi',              subtitle: 'Tracking serah-terima per tahap — Cutting → Pas Berat → Annealing → Siap Packing' },
  '/packing-log':           { title: 'Packing Log',           subtitle: 'Kelola packing & validasi vs Shieldtag' },
  '/shieldtag':             { title: 'Shieldtag',             subtitle: 'Registrasi dan distribusi ID unik per PCS' },
  '/inventory':             { title: 'Inventory',             subtitle: 'Stok per lokasi berbasis Shieldtag — realtime' },
  '/mutasi':                { title: 'Pemindahan Barang',     subtitle: 'Keluar (cabang/toko) & masuk (buyback/retur)' },
  '/barang-keluar':         { title: 'Barang Keluar',         subtitle: 'Distribusi & penjualan dari Gudang Pusat — berbasis Shieldtag' },
  '/penjualan':             { title: 'Penjualan',             subtitle: 'Rekap dari Accurate + cetak receipt' },
  '/stok-cabang':           { title: 'Stok Cabang',           subtitle: 'Ready stock, outstanding PO, dan adjustment per cabang' },
  '/po-cabang':             { title: 'PO Cabang',             subtitle: 'Purchase order dari cabang ke pusat' },
  '/po-vendor-packaging':   { title: 'PO Vendor Packaging',  subtitle: 'Manajemen PO, QC, dan retur akrilik dari vendor' },
  '/prioritas-produksi':    { title: 'Prioritas Produksi',   subtitle: 'Auto-ranking P1/P2/P3 berdasar PO dan safety stock' },
  '/kpi-tim':               { title: 'KPI Tim',              subtitle: 'Rating bintang per tim per proses — efisiensi, loss, kecepatan' },
  '/pengeluaran':           { title: 'Pengeluaran',           subtitle: 'Pencatatan biaya operasional per periode' },
  '/laporan':               { title: 'Laporan',              subtitle: 'Per batch, laba rugi, performa cabang' },
  '/scrap':                 { title: 'Scrap Inventory',      subtitle: 'Sisa lebihan proses produksi' },
  '/backup':                { title: 'Backup Data',          subtitle: 'Unduh data sebagai CSV untuk arsip' },
  '/audit-log':             { title: 'Audit Log',            subtitle: 'Riwayat semua aksi penting di sistem' },
  '/pengaturan':            { title: 'Pengaturan',           subtitle: 'Master tim, admin, toleransi, gramasi, dan konfigurasi sistem' },
  '/stock-opname':          { title: 'Stock Opname',         subtitle: 'Rekonsiliasi fisik vs sistem per lokasi' },
  '/pelanggan':             { title: 'Database Pelanggan',   subtitle: 'Manajemen data pelanggan tetap' },
  '/retur-penjualan':       { title: 'Retur Penjualan',      subtitle: 'Pencatatan retur dan pengembalian barang' },
  '/buyback':               { title: 'Buyback',              subtitle: 'Pembelian kembali emas dari pelanggan' },
  '/shieldtag-explorer':    { title: 'Shieldtag Explorer',   subtitle: 'Lacak posisi dan riwayat lengkap per kode shieldtag' },
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
    <IdleLogoutProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-violet-50/30 to-indigo-50/20">
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          serverProfile={serverProfile}
        />
        <div className="lg:ml-60 flex flex-col min-h-screen">
          <Header
            title={meta.title}
            subtitle={meta.subtitle}
            onMenuClick={() => setSidebarOpen(true)}
            serverProfile={serverProfile}
          />
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
      <AiChatbot />
    </IdleLogoutProvider>
  )
}
