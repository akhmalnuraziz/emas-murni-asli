'use client'

import { useState, useTransition } from 'react'
import { Download, Database, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { fetchBackupData } from '@/app/(dashboard)/backup/actions'

const TABLES: { key: string; label: string; desc: string; group: string }[] = [
  { key: 'batch',             label: 'Batch Bahan Baku',     desc: 'Semua batch & timbangan',       group: 'Produksi' },
  { key: 'peleburan',         label: 'Peleburan',            desc: 'Riwayat lebur per batch',       group: 'Produksi' },
  { key: 'produksi_item',     label: 'Data Entry Produksi',  desc: 'Input harian gramasi & pcs',    group: 'Produksi' },
  { key: 'packing_log',       label: 'Packing Log',          desc: 'Log packing per batch',         group: 'Produksi' },
  { key: 'shieldtag',         label: 'Shieldtag',            desc: 'Semua kode shieldtag',          group: 'Produksi' },
  { key: 'scrap_inventory',   label: 'Scrap Inventory',      desc: 'Data scrap/sisa proses',        group: 'Produksi' },
  { key: 'penjualan',         label: 'Penjualan',            desc: 'Transaksi penjualan',           group: 'Keuangan' },
  { key: 'penjualan_item',    label: 'Item Penjualan',       desc: 'Detail item per transaksi',     group: 'Keuangan' },
  { key: 'penjualan_payment', label: 'Pembayaran',           desc: 'Data payment per transaksi',    group: 'Keuangan' },
  { key: 'buyback',           label: 'Buyback',              desc: 'Riwayat buyback emas',          group: 'Keuangan' },
  { key: 'pengeluaran',       label: 'Pengeluaran',          desc: 'Biaya operasional',             group: 'Keuangan' },
  { key: 'mutasi',            label: 'Mutasi / Pemindahan',  desc: 'Transfer barang antar lokasi',  group: 'Inventori' },
  { key: 'po_packaging',      label: 'PO Vendor Packaging',  desc: 'Purchase order akrilik',        group: 'Pengadaan' },
  { key: 'po_batch_penerimaan', label: 'Penerimaan PO',      desc: 'Batch datang dari vendor',      group: 'Pengadaan' },
  { key: 'users_profile',     label: 'Data User',            desc: 'Profil semua user sistem',      group: 'Master' },
  { key: 'cabang',            label: 'Cabang',               desc: 'Master cabang',                 group: 'Master' },
  { key: 'tim_produksi',      label: 'Tim Produksi',         desc: 'Master tim',                    group: 'Master' },
]

function toCSV(data: any[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h]
      if (v === null || v === undefined) return ''
      const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return '﻿' + [headers.join(','), ...rows].join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function BackupClient({ userRole }: { userRole: string }) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function downloadTable(key: string, label: string) {
    setStatus(s => ({ ...s, [key]: 'loading' }))
    startTransition(async () => {
      const r = await fetchBackupData(key)
      if (r.error || !r.data) {
        setStatus(s => ({ ...s, [key]: 'error' }))
        showToast(`Gagal: ${r.error}`, false)
        return
      }
      const date = new Date().toISOString().split('T')[0]
      downloadCSV(`${key}_${date}.csv`, toCSV(r.data))
      setStatus(s => ({ ...s, [key]: 'done' }))
      showToast(`✅ ${label} (${r.data.length} baris) diunduh`)
    })
  }

  async function downloadAll() {
    showToast('Mengunduh semua data...')
    for (const t of TABLES) {
      setStatus(s => ({ ...s, [t.key]: 'loading' }))
      const r = await fetchBackupData(t.key)
      if (r.data) {
        const date = new Date().toISOString().split('T')[0]
        downloadCSV(`${t.key}_${date}.csv`, toCSV(r.data))
        setStatus(s => ({ ...s, [t.key]: 'done' }))
        await new Promise(res => setTimeout(res, 300))
      } else {
        setStatus(s => ({ ...s, [t.key]: 'error' }))
      }
    }
    showToast('✅ Semua data selesai diunduh')
  }

  const groups = [...new Set(TABLES.map(t => t.group))]

  return (
    <div className="space-y-6 pb-16 max-w-3xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-[13px] font-semibold text-white shadow-2xl ${toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-black text-slate-800">Backup Data</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Unduh data sebagai CSV — kompatibel dengan Excel</p>
        </div>
        <button onClick={downloadAll} disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-white rounded-2xl disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#0891B2,#0E7490)', boxShadow: '0 4px 20px rgba(8,145,178,0.4)' }}>
          <Download size={14}/> Unduh Semua
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl px-4 py-3 text-[13px] text-blue-700" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <p className="font-bold mb-1">Cara backup:</p>
        <ul className="text-[12px] space-y-0.5 text-blue-600">
          <li>• Klik per-tabel untuk unduh satu file CSV</li>
          <li>• Klik <b>Unduh Semua</b> untuk unduh semua tabel sekaligus</li>
          <li>• File CSV bisa dibuka langsung di Excel / Google Sheets</li>
          <li>• Lakukan backup rutin: disarankan mingguan atau bulanan</li>
        </ul>
      </div>

      {/* Tables by group */}
      {groups.map(group => (
        <div key={group} className="space-y-2">
          <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest px-1">{group}</p>
          <div className="space-y-1.5">
            {TABLES.filter(t => t.group === group).map(t => {
              const st = status[t.key] ?? 'idle'
              return (
                <div key={t.key} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(8,145,178,0.08)' }}>
                      <Database size={14} className="text-cyan-600"/>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">{t.label}</p>
                      <p className="text-[11px] text-slate-400">{t.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadTable(t.key, t.label)}
                    disabled={st === 'loading' || isPending}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all disabled:opacity-50 ${
                      st === 'done' ? 'bg-green-50 text-green-600' :
                      st === 'error' ? 'bg-red-50 text-red-500' :
                      'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    }`}>
                    {st === 'loading' ? <Loader2 size={12} className="animate-spin"/> :
                     st === 'done' ? <Check size={12}/> :
                     st === 'error' ? <AlertTriangle size={12}/> :
                     <Download size={12}/>}
                    {st === 'loading' ? 'Mengunduh...' : st === 'done' ? 'Selesai' : st === 'error' ? 'Gagal' : 'Unduh CSV'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
