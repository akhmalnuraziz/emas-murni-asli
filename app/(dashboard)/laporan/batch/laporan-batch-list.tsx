'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, CheckCircle2, Clock, Layers, Tag, Package2,
  Search, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Urutan pipeline yang ditampilkan di card
const PIPELINE_ROWS = [
  { key: 'Cutting',       label: 'Cutting',        color: '#2563EB', bg: '#EFF6FF' },
  { key: 'Annealing',     label: 'Annealing',      color: '#D97706', bg: '#FFFBEB' },
  { key: 'Pas Berat',     label: 'Pas Berat',      color: '#EA580C', bg: '#FFF7ED' },
  { key: 'QC',            label: 'QC',             color: '#0891B2', bg: '#ECFEFF' },
  { key: 'Siap Packing',  label: 'Siap Packing',   color: '#16A34A', bg: '#F0FDF4' },
  { key: 'Sudah Packing', label: 'Sudah Packing',  color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'Reject',        label: 'Reject',          color: '#DC2626', bg: '#FEF2F2' },
]

interface Props {
  batches: any[]
  stMap: Record<string, any>
  packMap: Record<string, number>
  lebMap: Record<string, { dikasih: number; diterima: number }>
  pipelineMap: Record<string, Record<string, number>>
  stats: { totalBatch: number; totalAktif: number; totalTidakAktif: number; totalPcs: number; totalShieldtag: number }
  currentQ: string
  currentStatus: string
  page: number
  totalPages: number
  pageSize: number
}

export default function LaporanBatchList({
  batches, stMap, packMap, lebMap, pipelineMap, stats,
  currentQ, currentStatus, page, totalPages,
}: Props) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ)

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams()
    const merged = { q: currentQ, status: currentStatus, page: String(page), ...overrides }
    if (merged.q) params.set('q', String(merged.q))
    if (merged.status && merged.status !== 'semua') params.set('status', String(merged.status))
    if (Number(merged.page) > 1) params.set('page', String(merged.page))
    return `/laporan/batch?${params.toString()}`
  }

  function search() {
    router.push(buildUrl({ q, page: 1 }))
  }

  return (
    <div className="space-y-5 pb-12">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Laporan Per Batch</h1>
        <p className="text-[13px] text-slate-400 mt-1">Ringkasan produksi, pipeline status, dan distribusi shieldtag per batch</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Batch',     value: stats.totalBatch,                           bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Layers },
          { label: 'Batch Aktif',     value: stats.totalAktif,                           bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100',  icon: Clock },
          { label: 'Tidak Aktif',     value: stats.totalTidakAktif,                      bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100',  icon: CheckCircle2 },
          { label: 'Total Packing',   value: `${stats.totalPcs.toLocaleString()} pcs`,   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100',   icon: Package2 },
          { label: 'Total Shieldtag', value: stats.totalShieldtag.toLocaleString(),      bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: Tag },
        ].map(({ label, value, bg, text, border, icon: Icon }) => (
          <div key={label} className={`rounded-2xl p-4 border ${bg} ${border} flex items-center gap-3`}>
            <Icon size={16} className={text} />
            <div>
              <p className="text-[10px] font-medium text-slate-400">{label}</p>
              <p className={`text-[17px] font-bold tabular-nums ${text}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Cari kode batch..."
            className="w-full h-9 pl-8 pr-8 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 bg-white text-slate-800"
          />
          {q && (
            <button onClick={() => { setQ(''); router.push(buildUrl({ q: '', page: 1 })) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[
            { val: 'semua',      label: 'Semua' },
            { val: 'aktif',      label: 'Aktif' },
            { val: 'tidak-aktif', label: 'Tidak Aktif' },
          ].map(opt => (
            <a key={opt.val} href={buildUrl({ status: opt.val, page: 1 })}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border',
                currentStatus === opt.val
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      {/* Batch cards — 3 kolom, 4 baris = 12 per halaman */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {batches.map(b => {
          const st = stMap[b.kode] ?? { aktif: 0, terjual: 0, transit: 0, total: 0 }
          const leb = lebMap[b.kode] ?? { dikasih: 0, diterima: 0 }
          const pipeline = pipelineMap[b.kode] ?? {}
          const loss = leb.dikasih > 0 ? ((leb.dikasih - leb.diterima) / leb.dikasih * 100) : 0
          const isAktif = b.status === 'aktif'
          const sisaBahan = Number(b.bahan_siap_cetak ?? 0)
          const stTotal = st.total || 1
          const wAktif   = Math.round(st.aktif   / stTotal * 100)
          const wTerjual = Math.round(st.terjual  / stTotal * 100)
          const wTransit = Math.round(st.transit  / stTotal * 100)

          // Pipeline rows yang ada datanya
          const activePipeline = PIPELINE_ROWS.filter(r => (pipeline[r.key] ?? 0) > 0)

          return (
            <Link key={b.kode} href={`/laporan/batch/${encodeURIComponent(b.kode)}`}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col">

              {/* Top accent */}
              <div className={`h-1 w-full ${isAktif
                ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} />

              <div className="p-4 flex-1 flex flex-col gap-3">

                {/* Identity + status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[14px] text-slate-900 group-hover:text-violet-700 transition-colors">{b.kode}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {b.supplier ? ` · ${b.supplier}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${isAktif ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {isAktif ? <Clock size={9}/> : <CheckCircle2 size={9}/>}
                    {isAktif ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>

                {/* Bahan baku ringkasan */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-slate-400 font-medium">Bahan Masuk</p>
                    <p className="text-[12px] font-bold text-slate-700 tabular-nums mt-0.5">
                      {b.bahan_dari_pusat ? `${Number(b.bahan_dari_pusat).toFixed(0)} gr` : '—'}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-2 text-center border border-amber-100">
                    <p className="text-[9px] text-amber-600 font-medium">Sisa Bahan</p>
                    <p className="text-[12px] font-bold text-amber-700 tabular-nums mt-0.5">
                      {sisaBahan > 0 ? `${sisaBahan.toFixed(2)} gr` : '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-slate-400 font-medium">Loss Lebur</p>
                    <p className={`text-[12px] font-bold tabular-nums mt-0.5 ${loss > 2 ? 'text-red-600' : loss > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                      {loss > 0 ? `${loss.toFixed(2)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Pipeline detail — tiap status tampil */}
                {activePipeline.length > 0 && (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Status Produksi</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {activePipeline.map(({ key, label, color, bg }) => {
                        const pcs = pipeline[key] ?? 0
                        return (
                          <div key={key} className="flex items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                              <p className="text-[11px] text-slate-600">{label}</p>
                            </div>
                            <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md" style={{ color, background: bg }}>
                              {pcs} pcs
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Shieldtag distribution */}
                {st.total > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-medium text-slate-400">Shieldtag <span className="text-slate-600 font-semibold">{st.total}</span></p>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-green-400 mr-0.5"/>Aktif {st.aktif}</span>
                        {st.terjual > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-violet-400 mr-0.5"/>Terjual {st.terjual}</span>}
                        {st.transit > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-sm bg-blue-400 mr-0.5"/>Transit {st.transit}</span>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-slate-100 flex">
                      {wAktif   > 0 && <div className="bg-green-400  h-full" style={{ width: `${wAktif}%` }} />}
                      {wTerjual > 0 && <div className="bg-violet-400 h-full" style={{ width: `${wTerjual}%` }} />}
                      {wTransit > 0 && <div className="bg-blue-400   h-full" style={{ width: `${wTransit}%` }} />}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Lihat detail laporan</p>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          )
        })}

        {batches.length === 0 && (
          <div className="col-span-3 py-24 text-center text-slate-400">
            <Layers size={36} className="mx-auto mb-3 opacity-20"/>
            <p className="text-[14px] font-medium">
              {currentQ ? `Tidak ada batch untuk "${currentQ}"` : 'Belum ada batch terdaftar'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <a href={page > 1 ? buildUrl({ page: page - 1 }) : '#'}
            className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
              page > 1 ? 'border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 bg-white' : 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50')}>
            <ChevronLeft size={14} />
          </a>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
            // Show: first, last, current ±1, ellipsis
            const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1
            const ellipsisBefore = p === 2 && page > 4
            const ellipsisAfter  = p === totalPages - 1 && page < totalPages - 3
            if (!show) return null
            if (ellipsisBefore || ellipsisAfter) return (
              <span key={p} className="text-[12px] text-slate-400 px-1">…</span>
            )
            return (
              <a key={p} href={buildUrl({ page: p })}
                className={cn('w-8 h-8 rounded-lg border text-[12px] font-semibold flex items-center justify-center transition-colors',
                  p === page
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 bg-white')}>
                {p}
              </a>
            )
          })}

          <a href={page < totalPages ? buildUrl({ page: page + 1 }) : '#'}
            className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
              page < totalPages ? 'border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 bg-white' : 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50')}>
            <ChevronRight size={14} />
          </a>

          <span className="text-[11px] text-slate-400 ml-2">
            Hal {page} dari {totalPages} · {stats.totalBatch} batch
          </span>
        </div>
      )}
    </div>
  )
}
