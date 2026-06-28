'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, CheckCircle2, Clock, Layers, Tag, Package2,
  Search, X, Hammer, Scale, Thermometer, ClipboardCheck, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PIPELINE_CFG = [
  { key: 'Cutting',      label: 'Cutting',      color: 'text-blue-600',   bg: 'bg-blue-50' },
  { key: 'Annealing',    label: 'Annealing',    color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { key: 'Pas Berat',    label: 'Pas Berat',    color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'QC',           label: 'QC',           color: 'text-cyan-600',   bg: 'bg-cyan-50' },
  { key: 'Siap Packing', label: 'Siap Packing', color: 'text-green-600',  bg: 'bg-green-50' },
]

interface Props {
  batches: any[]
  stMap: Record<string, any>
  packMap: Record<string, number>
  lebMap: Record<string, { dikasih: number; diterima: number }>
  pipelineMap: Record<string, Record<string, number>>
  stats: { totalBatch: number; totalAktif: number; totalSelesai: number; totalPcs: number; totalShieldtag: number }
  currentQ: string
  currentStatus: string
}

export default function LaporanBatchList({ batches, stMap, packMap, lebMap, pipelineMap, stats, currentQ, currentStatus }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ)

  function applySearch(val: string, status?: string) {
    const params = new URLSearchParams()
    if (val) params.set('q', val)
    if (status ?? currentStatus) params.set('status', status ?? currentStatus)
    router.push(`/laporan/batch?${params.toString()}`)
  }

  return (
    <div className="space-y-5 pb-12">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Laporan Per Batch</h1>
        <p className="text-[13px] text-slate-400 mt-1">Ringkasan produksi, pipeline, dan distribusi shieldtag per batch</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Batch',    value: stats.totalBatch,    icon: Layers,       bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
          { label: 'Batch Aktif',    value: stats.totalAktif,    icon: Clock,        bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100' },
          { label: 'Selesai',        value: stats.totalSelesai,  icon: CheckCircle2, bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100' },
          { label: 'Total Packing',  value: `${stats.totalPcs.toLocaleString()} pcs`, icon: Package2, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
          { label: 'Total Shieldtag',value: stats.totalShieldtag.toLocaleString(), icon: Tag, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
        ].map(({ label, value, icon: Icon, bg, text, border }) => (
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
            onKeyDown={e => e.key === 'Enter' && applySearch(q)}
            placeholder="Cari kode batch..."
            className="w-full h-9 pl-8 pr-8 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 bg-white text-slate-800"
          />
          {q && (
            <button onClick={() => { setQ(''); applySearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {[
            { val: 'semua', label: 'Semua' },
            { val: 'aktif', label: 'Aktif' },
            { val: 'selesai', label: 'Selesai' },
          ].map(opt => (
            <button key={opt.val} onClick={() => applySearch(q, opt.val)}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border',
                currentStatus === opt.val
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>
              {opt.label}
            </button>
          ))}
        </div>
        {currentQ && (
          <p className="text-[12px] text-slate-400">{batches.length} hasil untuk "<span className="font-semibold text-slate-700">{currentQ}</span>"</p>
        )}
      </div>

      {/* Batch cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {batches.map(b => {
          const st = stMap[b.kode] ?? { aktif: 0, terjual: 0, transit: 0, total: 0 }
          const pcs = packMap[b.kode] ?? 0
          const leb = lebMap[b.kode] ?? { dikasih: 0, diterima: 0 }
          const pipeline = pipelineMap[b.kode] ?? {}
          const loss = leb.dikasih > 0 ? ((leb.dikasih - leb.diterima) / leb.dikasih * 100) : 0
          const isSelesai = b.status === 'terkunci'
          const sisaBahan = Number(b.bahan_siap_cetak ?? 0)
          const stTotal = st.total || 1
          const wAktif   = Math.round(st.aktif   / stTotal * 100)
          const wTerjual = Math.round(st.terjual  / stTotal * 100)
          const wTransit = Math.round(st.transit  / stTotal * 100)

          // Pipeline in-progress stages (exclude Sudah Packing & Reject for WIP count)
          const wipStages = PIPELINE_CFG.filter(s => (pipeline[s.key] ?? 0) > 0)
          const sudahPacking = pipeline['Sudah Packing'] ?? pcs

          return (
            <Link key={b.kode} href={`/laporan/batch/${encodeURIComponent(b.kode)}`}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col">

              {/* Top accent */}
              <div className={`h-1 w-full ${isSelesai ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`} />

              <div className="p-4 flex-1 flex flex-col gap-3">

                {/* Identity */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[14px] text-slate-900 group-hover:text-violet-700 transition-colors leading-tight">{b.kode}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {b.supplier ? ` · ${b.supplier}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${isSelesai ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSelesai ? <CheckCircle2 size={9}/> : <Clock size={9}/>}
                    {b.status === 'terkunci' ? 'Selesai' : b.status === 'aktif' ? 'Aktif' : b.status ?? 'Proses'}
                  </span>
                </div>

                {/* Gram stats row */}
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { label: 'Bahan Masuk', val: b.bahan_dari_pusat ? `${Number(b.bahan_dari_pusat).toFixed(0)} gr` : '—', color: 'text-slate-700' },
                    { label: 'Sisa Bahan',  val: sisaBahan > 0 ? `${sisaBahan.toFixed(2)} gr` : '—', color: sisaBahan > 0 ? 'text-amber-600' : 'text-slate-300' },
                    { label: 'Sudah Pack',  val: sudahPacking > 0 ? `${sudahPacking} pcs` : '—', color: 'text-blue-700' },
                    { label: 'Loss Lebur',  val: loss > 0 ? `${loss.toFixed(2)}%` : '—', color: loss > 2 ? 'text-red-600' : 'text-green-600' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[9px] font-medium text-slate-400 leading-tight">{label}</p>
                      <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${color}`}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Pipeline WIP */}
                {wipStages.length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Pipeline WIP</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wipStages.map(({ key, label, color, bg }) => (
                        <div key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${bg} ${color}`}>
                          {label}
                          <span className="font-bold tabular-nums">{pipeline[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shieldtag distribution */}
                {st.total > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-medium text-slate-400">Shieldtag <span className="text-slate-600 font-semibold">{st.total}</span></p>
                      <div className="flex items-center gap-2 text-[9px] font-medium text-slate-400">
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-green-400 inline-block"/>Aktif {st.aktif}</span>
                        {st.terjual > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-violet-400 inline-block"/>Terjual {st.terjual}</span>}
                        {st.transit > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block"/>Transit {st.transit}</span>}
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
            <p className="text-[14px] font-medium">{currentQ ? `Tidak ada batch untuk "${currentQ}"` : 'Belum ada batch terdaftar'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
