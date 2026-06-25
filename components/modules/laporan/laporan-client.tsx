'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, TrendingUp, Package, ArrowLeftRight, RotateCcw,
  ShoppingCart, Layers, Wallet, TrendingDown, Calendar, ExternalLink, Download,
  Scale, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { formatRupiah, formatDate, cn } from '@/lib/utils'

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
  penjualanByGramasiPeriode: Array<{ gramasi: string; pcs: number; omzet: number; hpp: number; profit: number; margin: number }>
  batchList: Array<{
    kode: string; tanggal: string; supplier: string | null
    timbangan_akhir: number | null; hpp_gr: number | null; status: string | null
  }>
  userRole: string
  period: string
  dateFrom: string
  dateTo: string
  labaRugi: {
    omzet: number
    hpp: number
    labaKotor: number
    pengeluaran: number
    labaBersih: number
    penjualanCount: number
    buybackCount: number
  }
  channelBreakdown: Array<{ channel: string; omzet: number; pcs: number }>
  penjualanList: any[]
  pengeluaranList: any[]
  neraca: {
    masukBatch: number
    stokAktifGram: number
    stokTransitGram: number
    gramTerjual: number
    gramWIP: number
    gramRejectBelumDilebur: number
    gramRejectSudahDilebur: number
    totalTertracking: number
    selisihGram: number
  }
}

const canSeeHpp = (role: string) => ['owner', 'admin_pusat', 'accounting'].includes(role)

function exportLaporan(
  penjualanList: any[],
  pengeluaranList: any[],
  labaRugi: Props['labaRugi'],
  periodLabel: string,
) {
  const rows: string[][] = []

  rows.push([`LAPORAN LABA RUGI — ${periodLabel}`])
  rows.push([])
  rows.push(['RINGKASAN'])
  rows.push(['Omzet', String(labaRugi.omzet)])
  rows.push(['HPP', String(labaRugi.hpp)])
  rows.push(['Laba Kotor', String(labaRugi.labaKotor)])
  rows.push(['Total Pengeluaran', String(labaRugi.pengeluaran)])
  rows.push(['Laba Bersih', String(labaRugi.labaBersih)])
  rows.push([])

  rows.push(['DETAIL PENJUALAN'])
  rows.push(['Tanggal', 'Faktur', 'Customer', 'Channel', 'Pcs', 'Total Harga', 'HPP', 'Profit'])
  for (const p of penjualanList) {
    rows.push([
      p.tanggal ?? '',
      p.no_faktur ?? p.nomor_invoice ?? '',
      p.nama_customer ?? '',
      p.channel ?? p.source ?? '',
      String(p.pcs ?? 0),
      String(p.total_harga_jual ?? p.harga_jual ?? 0),
      String(p.hpp_total ?? 0),
      String(p.profit ?? 0),
    ])
  }
  rows.push([])

  rows.push(['DETAIL PENGELUARAN'])
  rows.push(['Tanggal', 'Nama', 'Kategori', 'Nominal'])
  for (const p of pengeluaranList) {
    rows.push([
      p.tanggal ?? '',
      p.nama ?? '',
      p.kategori?.nama ?? '',
      String(p.nominal ?? 0),
    ])
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `laporan-laba-rugi-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week',  label: '7 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Kustom' },
]

function PeriodSelector({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(period === 'custom')
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo,   setCustomTo]   = useState(dateTo)

  function navigate(p: string, from?: string, to?: string) {
    const params = new URLSearchParams()
    params.set('period', p)
    if (p === 'custom' && from && to) { params.set('from', from); params.set('to', to) }
    startTransition(() => router.push(`/laporan?${params.toString()}`))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={13} className="text-slate-400" />
        {PERIOD_OPTIONS.map(opt => (
          <button key={opt.value}
            onClick={() => { if (opt.value === 'custom') { setShowCustom(true); return } setShowCustom(false); navigate(opt.value) }}
            className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all',
              (period === opt.value && opt.value !== 'custom') || (showCustom && opt.value === 'custom')
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200 hover:text-violet-600'
            )}>
            {opt.label}
          </button>
        ))}
        {isPending && <span className="text-[10px] text-slate-400 ml-1">Memuat...</span>}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl px-3 py-2 border border-slate-200">
          <span className="text-[12px] text-slate-400 font-medium">Dari</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <span className="text-[12px] text-slate-400 font-medium">s/d</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <button onClick={() => navigate('custom', customFrom, customTo)}
            className="px-3 py-1 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors">
            Terapkan
          </button>
        </div>
      )}
    </div>
  )
}

export default function LaporanClient({
  summary, penjualanByGramasi, penjualanByGramasiPeriode, batchList, userRole,
  period, dateFrom, dateTo,
  labaRugi, channelBreakdown, penjualanList, pengeluaranList, neraca,
}: Props) {
  const [tab, setTab] = useState<'laba-rugi' | 'penjualan' | 'batch' | 'ringkasan' | 'neraca'>('laba-rugi')
  const showHpp = canSeeHpp(userRole)

  const periodLabel = period === 'today' ? 'Hari Ini'
    : period === 'week'   ? '7 Hari Terakhir'
    : period === 'custom' ? `${dateFrom} – ${dateTo}`
    : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const TABS = [
    ...(showHpp ? [['laba-rugi', 'Laba Rugi', TrendingUp]] : []),
    ['penjualan', 'Per Gramasi', ShoppingCart],
    ['batch', 'Batch', Layers],
    ['ringkasan', 'Ringkasan', Package],
    ['neraca', 'Neraca Emas', Scale],
  ] as const

  return (
    <div className="space-y-5 pb-8">

      {/* Period Selector */}
      <PeriodSelector period={period} dateFrom={dateFrom} dateTo={dateTo} />

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(([key, label, Icon], i) => (
          <button key={i} onClick={() => setTab(key as any)}
            className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-semibold transition-all',
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}>
            {(Icon as any) && <Icon size={12} />} {label}
          </button>
        ))}
      </div>

      {tab === 'laba-rugi' && showHpp && (
        <LabaRugiTab
          labaRugi={labaRugi}
          channelBreakdown={channelBreakdown}
          penjualanList={penjualanList}
          pengeluaranList={pengeluaranList}
          periodLabel={periodLabel}
        />
      )}
      {tab === 'penjualan' && <PenjualanTab rowsAllTime={penjualanByGramasi} rowsPeriode={penjualanByGramasiPeriode} showHpp={showHpp} periodLabel={periodLabel} />}
      {tab === 'batch'     && <BatchTab rows={batchList} showHpp={showHpp} />}
      {tab === 'ringkasan' && <RingkasanTab summary={summary} />}
      {tab === 'neraca'    && <NeracaTab neraca={neraca} />}
    </div>
  )
}

// ── Laba Rugi Tab ─────────────────────────────────────────────────────────────

function LabaRugiTab({ labaRugi, channelBreakdown, penjualanList, pengeluaranList, periodLabel }: {
  labaRugi: Props['labaRugi']
  channelBreakdown: Props['channelBreakdown']
  penjualanList: any[]
  pengeluaranList: any[]
  periodLabel: string
}) {
  const [showDetail, setShowDetail] = useState<'penjualan' | 'pengeluaran' | null>(null)
  const profitPositif = labaRugi.labaBersih >= 0

  return (
    <div className="space-y-4">
      {/* P&L Summary Card */}
      <div className={`border-0 rounded-xl p-6 text-white ${profitPositif ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-red-600 to-red-700'}`}>
        <p className="text-[12px] font-semibold opacity-80 mb-1">Laba Bersih — {periodLabel}</p>
        <p className="text-4xl font-semibold">{formatRupiah(labaRugi.labaBersih)}</p>
        <p className="text-[13px] opacity-70 mt-1">{profitPositif ? '▲ Profit' : '▼ Rugi'}</p>
      </div>

      {/* Export CSV */}
      <div className="flex justify-end">
        <button
          onClick={() => exportLaporan(penjualanList, pengeluaranList, labaRugi, periodLabel)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* 3-kolom: Omzet, HPP, Pengeluaran */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => setShowDetail(showDetail === 'penjualan' ? null : 'penjualan')}
          className="rounded-xl p-5 text-left hover:shadow-sm transition-shadow"
          >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-emerald-50">
            <ShoppingCart size={15} className="text-green-600" />
          </div>
          <p className="text-[18px] font-semibold text-slate-800">{formatRupiah(labaRugi.omzet)}</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Omzet</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{labaRugi.penjualanCount} transaksi · tap detail</p>
        </button>

        <div className="rounded-xl p-5"
          >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-amber-50">
            <Package size={15} className="text-amber-500" />
          </div>
          <p className="text-[18px] font-semibold text-slate-800">{formatRupiah(labaRugi.hpp)}</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1">HPP</p>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Laba Kotor: <span className={labaRugi.labaKotor >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {formatRupiah(labaRugi.labaKotor)}
            </span>
          </p>
        </div>

        <button onClick={() => setShowDetail(showDetail === 'pengeluaran' ? null : 'pengeluaran')}
          className="rounded-xl p-5 text-left hover:shadow-sm transition-shadow"
          >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-red-50">
            <TrendingDown size={15} className="text-red-500" />
          </div>
          <p className="text-[18px] font-semibold text-slate-800">{formatRupiah(labaRugi.pengeluaran)}</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Pengeluaran</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{pengeluaranList.length} item · tap detail</p>
        </button>
      </div>

      {/* Channel breakdown */}
      {channelBreakdown.length > 0 && (
        <div className="rounded-xl p-5"
          >
          <p className="text-[12px] font-medium text-slate-400 mb-4">Omzet per Channel</p>
          <div className="space-y-3">
            {channelBreakdown.map(ch => {
              const pct = labaRugi.omzet > 0 ? (ch.omzet / labaRugi.omzet * 100) : 0
              return (
                <div key={ch.channel} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold text-slate-700 capitalize truncate">{ch.channel}</p>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-[12px] font-semibold text-slate-800">{formatRupiah(ch.omzet)}</p>
                        <p className="text-[10px] text-slate-400">{ch.pcs} pcs</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Penjualan detail */}
      {showDetail === 'penjualan' && (
        <div className="rounded-xl overflow-hidden"
          >
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-[13px] font-semibold text-slate-800">Detail Penjualan</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  {['Tanggal', 'Faktur', 'Customer', 'Channel', 'Pcs', 'Omzet', 'HPP', 'Profit', 'Margin'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {penjualanList.map((p: any) => {
                  const omzet  = Number(p.total_harga_jual ?? p.harga_jual ?? 0)
                  const hpp    = Number(p.hpp_total ?? 0)
                  const profit = Number(p.total_profit ?? p.profit ?? omzet - hpp)
                  const margin = omzet > 0 ? (profit / omzet * 100) : 0
                  return (
                    <tr key={p.id} className="border-t border-slate-50 hover:bg-violet-50/10">
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                      <td className="px-4 py-2.5">
                        <a href={`/penjualan/faktur/${p.id}`} target="_blank"
                          className="text-[12px] font-mono text-violet-600 hover:underline flex items-center gap-1">
                          {p.no_faktur ?? p.nomor_invoice ?? `#${p.id}`}
                          <ExternalLink size={10} />
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-700 truncate max-w-[100px]">{p.nama_customer ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 capitalize">{p.channel ?? p.source ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-700 text-center">{p.pcs}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-green-700 whitespace-nowrap">{formatRupiah(omzet)}</td>
                      <td className="px-4 py-2.5 text-[12px] text-amber-700 whitespace-nowrap">{formatRupiah(hpp)}</td>
                      <td className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(profit)}</td>
                      <td className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap ${margin >= 10 ? 'text-violet-700' : margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-600" colSpan={5}>Total</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-green-700 whitespace-nowrap">{formatRupiah(labaRugi.omzet)}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-amber-700 whitespace-nowrap">{formatRupiah(labaRugi.hpp)}</td>
                  <td className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap ${labaRugi.labaKotor >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(labaRugi.labaKotor)}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-violet-700">{labaRugi.omzet > 0 ? (labaRugi.labaKotor / labaRugi.omzet * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Pengeluaran detail */}
      {showDetail === 'pengeluaran' && (
        <div className="rounded-xl overflow-hidden"
          >
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-800">Detail Pengeluaran</p>
            <a href="/pengeluaran" className="text-[12px] text-violet-500 font-semibold hover:underline">Kelola →</a>
          </div>
          <div className="divide-y divide-slate-50">
            {pengeluaranList.map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{p.nama}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">{formatDate(p.tanggal)}</span>
                    {p.kategori && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${p.kategori.warna}22`, color: p.kategori.warna }}>
                        {p.kategori.nama}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[13px] font-semibold text-red-600">{formatRupiah(Number(p.nominal))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ringkasan Tab ─────────────────────────────────────────────────────────────

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
        <div key={c.label} className="rounded-xl p-5"
          >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: c.bg }}>
            <c.icon size={16} style={{ color: c.color }} />
          </div>
          <p className="text-[10px] font-medium text-slate-400">{c.label}</p>
          <p className="text-[18px] font-semibold text-slate-800 mt-0.5">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Per Gramasi Tab ───────────────────────────────────────────────────────────

function PenjualanTab({
  rowsAllTime, rowsPeriode, showHpp, periodLabel,
}: {
  rowsAllTime: Props['penjualanByGramasi']
  rowsPeriode: Props['penjualanByGramasiPeriode']
  showHpp: boolean
  periodLabel: string
}) {
  const [view, setView] = useState<'periode' | 'alltime'>('periode')
  const rows = rowsPeriode

  if (rows.length === 0 && view === 'periode') {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setView('periode')} className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold', view === 'periode' ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500')}>Periode</button>
          <button onClick={() => setView('alltime')} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white border border-slate-200 text-slate-500">Semua Waktu</button>
        </div>
        <Empty text={`Belum ada penjualan di periode ${periodLabel}.`} />
      </div>
    )
  }

  const displayRows = view === 'periode' ? rowsPeriode : rowsAllTime.map(r => ({ gramasi: r.gramasi, pcs: r.pcs, omzet: r.total, hpp: 0, profit: 0, margin: 0 }))
  const totalOmzet  = displayRows.reduce((a, r) => a + r.omzet, 0)
  const totalHpp    = displayRows.reduce((a, r) => a + r.hpp, 0)
  const totalProfit = displayRows.reduce((a, r) => a + r.profit, 0)
  const totalMargin = totalOmzet > 0 ? (totalProfit / totalOmzet * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setView('periode')} className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all', view === 'periode' ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-violet-200')}>
          {periodLabel}
        </button>
        <button onClick={() => setView('alltime')} className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all', view === 'alltime' ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-violet-200')}>
          Semua Waktu
        </button>
      </div>

      <div className="rounded-xl overflow-hidden"
        >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-violet-50/20 border-b border-violet-500/10">
                <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400">Gramasi</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400">Terjual</th>
                {showHpp && <>
                  <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">Omzet</th>
                  {view === 'periode' && <>
                    <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400">HPP</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400">Profit</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-medium text-slate-400">Margin</th>
                  </>}
                </>}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => (
                <tr key={r.gramasi} className={`hover:bg-violet-50/10 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{r.gramasi}gr</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">{r.pcs} pcs</td>
                  {showHpp && <>
                    <td className="px-5 py-3.5 font-semibold text-green-600 whitespace-nowrap">{formatRupiah(r.omzet)}</td>
                    {view === 'periode' && <>
                      <td className="px-5 py-3.5 text-amber-700 whitespace-nowrap">{formatRupiah(r.hpp)}</td>
                      <td className={`px-5 py-3.5 font-semibold whitespace-nowrap ${r.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(r.profit)}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-[12px] font-semibold px-2 py-0.5 rounded-full', r.margin >= 10 ? 'bg-violet-50 text-violet-700' : r.margin >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>
                          {r.margin.toFixed(1)}%
                        </span>
                      </td>
                    </>}
                  </>}
                </tr>
              ))}
            </tbody>
            {showHpp && (
              <tfoot>
                <tr className="border-t-2 border-violet-500/20 bg-violet-50/20">
                  <td className="px-5 py-3.5 font-semibold text-slate-800" colSpan={2}>Total</td>
                  <td className="px-5 py-3.5 font-semibold text-green-700 whitespace-nowrap">{formatRupiah(totalOmzet)}</td>
                  {view === 'periode' && <>
                    <td className="px-5 py-3.5 font-semibold text-amber-700 whitespace-nowrap">{formatRupiah(totalHpp)}</td>
                    <td className={`px-5 py-3.5 font-semibold whitespace-nowrap ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(totalProfit)}</td>
                    <td className="px-5 py-3.5 font-semibold text-violet-700">{totalMargin.toFixed(1)}%</td>
                  </>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Batch Tab ─────────────────────────────────────────────────────────────────

function BatchTab({ rows, showHpp }: { rows: Props['batchList']; showHpp: boolean }) {
  if (rows.length === 0) return <Empty text="Belum ada batch." />
  return (
    <div className="rounded-xl overflow-hidden"
      >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="bg-violet-50/20 border-b border-violet-500/10">
              {['Kode Batch', 'Tanggal', 'Supplier', 'Berat Akhir', showHpp ? 'HPP/gr' : null, 'Status'].filter(Boolean).map(h => (
                <th key={h!} className="px-4 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.kode} className={`hover:bg-violet-50/10 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                <td className="px-4 py-3.5">
                  <Link href={`/laporan/batch/${encodeURIComponent(b.kode)}`}
                    className="font-mono font-semibold text-violet-700 text-[12px] hover:underline flex items-center gap-1">
                    {b.kode} <ExternalLink size={9} />
                  </Link>
                </td>
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
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
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
    <div className="bg-white border border-slate-200 rounded-xl py-16 text-center"
      >
      <FileText size={28} className="text-slate-200 mx-auto mb-2" />
      <p className="text-[13px] text-slate-400">{text}</p>
    </div>
  )
}

// ── Neraca Emas Tab ────────────────────────────────────────────────────────────

function NeracaTab({ neraca }: { neraca: Props['neraca'] }) {
  const fmt = (n: number) => `${Math.abs(n).toFixed(3)} gr`
  const selisihOk = Math.abs(neraca.selisihGram) < 0.5

  const rows: { label: string; value: number; color: string; desc: string; href?: string }[] = [
    {
      label: 'Stok Aktif (ShieldTag)',
      value: neraca.stokAktifGram,
      color: '#7C3AED',
      desc: 'Shieldtag status Aktif di gudang',
      href: '/shieldtag',
    },
    {
      label: 'Transit ke Cabang',
      value: neraca.stokTransitGram,
      color: '#0EA5E9',
      desc: 'Shieldtag status Terdistribusi, belum diterima',
      href: '/mutasi',
    },
    {
      label: 'WIP Produksi',
      value: neraca.gramWIP,
      color: '#F97316',
      desc: 'Item produksi masih dalam pipeline (Cutting/Pas Berat/Annealing/Siap Packing)',
      href: '/produksi',
    },
    {
      label: 'Sudah Terjual',
      value: neraca.gramTerjual,
      color: '#16A34A',
      desc: 'Total gram dari semua penjualan (gramasi × pcs)',
      href: '/penjualan',
    },
    {
      label: 'Reject Belum Dilebur',
      value: neraca.gramRejectBelumDilebur,
      color: '#EF4444',
      desc: 'Reject emas yang belum kembali jadi bahan baku',
      href: '/bahan-baku',
    },
  ]

  return (
    <div className="space-y-4">

      {/* Status banner */}
      <div className={`rounded-xl p-5 flex items-start gap-4 ${selisihOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selisihOk ? 'bg-emerald-100' : 'bg-red-100'}`}>
          {selisihOk
            ? <CheckCircle2 size={22} className="text-green-600" />
            : <AlertTriangle size={22} className="text-red-500" />}
        </div>
        <div>
          <p className={`text-[14px] font-semibold ${selisihOk ? 'text-green-700' : 'text-red-700'}`}>
            {selisihOk ? 'Neraca Emas Seimbang ✅' : 'Ada Selisih Emas — Perlu Dicek! ⚠️'}
          </p>
          <p className={`text-[13px] font-semibold mt-0.5 ${selisihOk ? 'text-green-600' : 'text-red-600'}`}>
            Selisih: {neraca.selisihGram >= 0 ? '+' : ''}{neraca.selisihGram.toFixed(3)} gr
            {!selisihOk && ' — Total masuk tidak sesuai dengan yang tertracking'}
          </p>
          <p className="text-[12px] text-slate-400 mt-1">
            Data real-time · reject sudah dilebur ({fmt(neraca.gramRejectSudahDilebur)} gr) tidak dihitung karena sudah kembali jadi bahan baku
          </p>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="rounded-xl p-5"
        >
        <div className="flex items-center gap-2 mb-5">
          <Scale size={15} className="text-violet-500" />
          <h3 className="font-semibold text-slate-800 text-[13px]">Alur Emas — All Time</h3>
        </div>

        {/* Masuk */}
        <div className="rounded-xl p-4 mb-4 bg-violet-50/40 border border-violet-500/[0.12]">
          <p className="text-[10px] font-medium text-slate-400 mb-1">Total Masuk</p>
          <p className="text-[20px] font-semibold text-violet-700">{fmt(neraca.masukBatch)}</p>
          <p className="text-[12px] text-slate-400 mt-0.5">dari semua batch bahan baku</p>
        </div>

        <p className="text-[10px] font-medium text-slate-300 text-center mb-3">= Tersebar ke</p>

        {/* Breakdown rows */}
        <div className="space-y-2">
          {rows.map(r => (
            <a key={r.label} href={r.href ?? '#'}
              className="flex items-center justify-between p-3 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: `${r.color}08`, border: `1px solid ${r.color}18` }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: r.color }}>{r.label}</p>
                <p className="text-[10px] text-slate-400">{r.desc}</p>
              </div>
              <p className="text-[13px] font-semibold text-slate-700 flex-shrink-0 ml-3">{fmt(r.value)}</p>
            </a>
          ))}
        </div>

        {/* Total tracked vs masuk */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Total Tertracking</p>
            <p className="text-[10px] text-slate-400">stok aktif + transit + WIP + terjual + reject belum dilebur</p>
          </div>
          <p className="text-[14px] font-semibold text-slate-800">{fmt(neraca.totalTertracking)}</p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-slate-500">Selisih (Masuk − Tertracking)</p>
          <p className={`text-[14px] font-semibold ${selisihOk ? 'text-green-600' : 'text-red-600'}`}>
            {neraca.selisihGram >= 0 ? '+' : ''}{neraca.selisihGram.toFixed(3)} gr
          </p>
        </div>
      </div>

    </div>
  )
}
