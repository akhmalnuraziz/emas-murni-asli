'use client'

import { useState } from 'react'
import { FileText, TrendingUp, Package, ArrowLeftRight, RotateCcw, ShoppingCart, Layers } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'

interface Props {
  summary: {
    totalProduksiGram: number
    totalPackingPcs: number
    totalShieldtagAktif: number
    totalTerjual: number
    totalBuyback: number
    totalMutasiKeluar: number
  }
  penjualanByGramasi: Array<{ gramasi: string; pcs: number; total: number }>
  batchList: Array<{
    kode: string; tanggal: string; supplier: string | null
    timbangan_akhir: number | null; hpp_gr: number | null; status: string | null
  }>
  userRole: string
}

const canSeeHpp = (role: string) => ['owner', 'admin_pusat', 'accounting'].includes(role)

export default function LaporanClient({ summary, penjualanByGramasi, batchList, userRole }: Props) {
  const [tab, setTab] = useState<'ringkasan' | 'penjualan' | 'batch'>('ringkasan')
  const showHpp = canSeeHpp(userRole)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Laporan</h1>
          <p className="text-xs text-slate-400">Ringkasan operasional produksi &amp; penjualan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          ['ringkasan', 'Ringkasan', TrendingUp],
          ['penjualan', 'Per Gramasi', ShoppingCart],
          ['batch', 'Batch', Layers],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={tab === key
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }
              : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'ringkasan' && <RingkasanTab summary={summary} />}
      {tab === 'penjualan' && <PenjualanTab rows={penjualanByGramasi} showHpp={showHpp} />}
      {tab === 'batch' && <BatchTab rows={batchList} showHpp={showHpp} />}
    </div>
  )
}

function RingkasanTab({ summary }: { summary: Props['summary'] }) {
  const cards = [
    { label: 'Total Produksi', value: `${Number(summary.totalProduksiGram ?? 0).toFixed(3)} gr`, icon: Package, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
    { label: 'Total Packing', value: `${summary.totalPackingPcs ?? 0} pcs`, icon: Package, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    { label: 'Shieldtag Aktif', value: `${summary.totalShieldtagAktif ?? 0} pcs`, icon: Package, color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
    { label: 'Terjual', value: `${summary.totalTerjual ?? 0} pcs`, icon: ShoppingCart, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
    { label: 'Buyback', value: `${summary.totalBuyback ?? 0} pcs`, icon: RotateCcw, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    { label: 'Mutasi Keluar', value: `${summary.totalMutasiKeluar ?? 0} pcs`, icon: ArrowLeftRight, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
            style={{ background: c.bg }}>
            <c.icon size={16} style={{ color: c.color }} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</p>
          <p className="text-xl font-black text-slate-800 mt-0.5">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function PenjualanTab({ rows, showHpp }: { rows: Props['penjualanByGramasi']; showHpp: boolean }) {
  if (rows.length === 0) return (
    <Empty text="Belum ada data penjualan." />
  )
  const total = rows.reduce((a, r) => a + r.total, 0)
  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
            {['Gramasi', 'Terjual (pcs)', showHpp ? 'Total Omzet' : null].filter(Boolean).map(h => (
              <th key={h!} className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.gramasi} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.04)' }}
              className="hover:bg-violet-50/10">
              <td className="px-5 py-3.5 font-bold text-slate-800">{r.gramasi}gr</td>
              <td className="px-5 py-3.5 font-semibold text-slate-700">{r.pcs} pcs</td>
              {showHpp && <td className="px-5 py-3.5 font-semibold text-green-600">{formatRupiah(r.total)}</td>}
            </tr>
          ))}
        </tbody>
        {showHpp && (
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(139,92,246,0.15)', background: 'rgba(139,92,246,0.04)' }}>
              <td className="px-5 py-3.5 font-bold text-slate-800" colSpan={2}>Total</td>
              <td className="px-5 py-3.5 font-black text-violet-700">{formatRupiah(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function BatchTab({ rows, showHpp }: { rows: Props['batchList']; showHpp: boolean }) {
  if (rows.length === 0) return <Empty text="Belum ada batch." />
  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr style={{ background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
              {['Kode Batch', 'Tanggal', 'Supplier', 'Berat Akhir', showHpp ? 'HPP/gr' : null, 'Status'].filter(Boolean).map(h => (
                <th key={h!} className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.kode} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.04)' }}
                className="hover:bg-violet-50/10">
                <td className="px-4 py-3.5 font-mono font-bold text-violet-700 text-xs">{b.kode}</td>
                <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{formatDate(b.tanggal)}</td>
                <td className="px-4 py-3.5 text-slate-600">{b.supplier ?? '—'}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-800">
                  {b.timbangan_akhir ? `${Number(b.timbangan_akhir).toFixed(3)} gr` : '—'}
                </td>
                {showHpp && (
                  <td className="px-4 py-3.5 font-semibold text-amber-700">
                    {b.hpp_gr ? formatRupiah(b.hpp_gr) : '—'}
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    b.status === 'Selesai' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>{b.status ?? 'Proses'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl py-20 text-center"
      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <FileText size={28} className="text-slate-200 mx-auto mb-2" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}
