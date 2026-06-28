'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowLeft, Trophy, AlertTriangle, TrendingDown, TrendingUp, CheckCircle2, XCircle } from 'lucide-react'

interface Row {
  kode: string; tanggal: string | null; supplier: string | null; status: string | null
  bahanBaku: number; produksiJadi: number; sb: number; serbuk: number; reject: number
  totalLoses: number; losesPct: number; efisiensiPct: number
}

const fmt2 = (n: number) => n.toFixed(2)
const fmtPct = (n: number) => `${n.toFixed(2)}%`

export default function EfisiensiClient({ rows, dateFrom, dateTo }: { rows: Row[]; dateFrom: string; dateTo: string }) {
  const router = useRouter()
  const [from, setFrom] = useState(dateFrom)
  const [to, setTo]     = useState(dateTo)

  function applyFilter() {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to)   p.set('to', to)
    router.push(`/laporan/efisiensi?${p.toString()}`)
  }

  if (rows.length === 0) return (
    <div className="space-y-4">
      <Header from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={applyFilter} />
      <div className="text-center py-20 text-slate-400">Tidak ada data batch pada rentang tanggal ini.</div>
    </div>
  )

  const efisiensiRata  = rows.reduce((s, r) => s + r.efisiensiPct, 0) / rows.length
  const losesRata      = rows.reduce((s, r) => s + r.losesPct, 0) / rows.length
  const totalBahan     = rows.reduce((s, r) => s + r.bahanBaku, 0)
  const totalProduksi  = rows.reduce((s, r) => s + r.produksiJadi, 0)
  const totalLoses     = rows.reduce((s, r) => s + r.totalLoses, 0)
  const best  = [...rows].sort((a, b) => a.losesPct - b.losesPct)[0]
  const worst = [...rows].sort((a, b) => b.losesPct - a.losesPct)[0]
  const baikCount = rows.filter(r => r.efisiensiPct >= 85).length
  const tidakBaik = rows.length - baikCount

  const chartData = [...rows].sort((a, b) => b.losesPct - a.losesPct).slice(0, 20).map(r => ({
    name: r.kode.replace(/^[A-Z]+\/\d+\/\d+\//, '').replace(/^BATCH\s*/i, 'B'),
    loses: parseFloat(r.losesPct.toFixed(2)),
    full: r.kode,
  }))

  return (
    <div className="space-y-5 pb-12">
      <Link href="/laporan/batch" className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-violet-600 transition-colors">
        <ArrowLeft size={12} /> Kembali ke Laporan Batch
      </Link>

      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Efisiensi & Losses — Per Batch</h1>
        <p className="text-[13px] text-slate-400 mt-1">Perbandingan bahan baku masuk vs produksi jadi, serbuk, dan loses fisik</p>
      </div>

      <Header from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={applyFilter} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Efisiensi Rata-rata', value: fmtPct(efisiensiRata), icon: TrendingUp,    bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100' },
          { label: 'Loses Rata-rata',     value: fmtPct(losesRata),     icon: TrendingDown,  bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100' },
          { label: 'Total Batch',         value: rows.length,            icon: null,          bg: 'bg-slate-50',  text: 'text-slate-700',  border: 'border-slate-100' },
          { label: 'Efisiensi ≥ 85%',    value: baikCount,              icon: CheckCircle2,  bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-100' },
          { label: 'Efisiensi < 85%',    value: tidakBaik,              icon: XCircle,       bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
        ].map(({ label, value, icon: Icon, bg, text, border }) => (
          <div key={label} className={`rounded-2xl p-4 border ${bg} ${border} flex items-center gap-3`}>
            {Icon && <Icon size={16} className={text} />}
            <div>
              <p className="text-[10px] font-medium text-slate-400">{label}</p>
              <p className={`text-[17px] font-bold tabular-nums ${text}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Best / Worst / Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
          <Trophy size={16} className="text-emerald-600 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium">Best Batch</p>
            <p className="text-[13px] font-bold text-emerald-700 font-mono">{best.kode}</p>
            <p className="text-[11px] text-emerald-600">{fmtPct(best.efisiensiPct)} efisiensi</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium">Worst Batch</p>
            <p className="text-[13px] font-bold text-red-700 font-mono">{worst.kode}</p>
            <p className="text-[11px] text-red-600">{fmtPct(worst.efisiensiPct)} efisiensi</p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] text-slate-400 font-medium">Total Bahan Masuk</p>
          <p className="text-[15px] font-bold text-slate-800 tabular-nums">{fmt2(totalBahan)} gr</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] text-slate-400 font-medium">Total Produksi Jadi</p>
          <p className="text-[15px] font-bold text-slate-800 tabular-nums">{fmt2(totalProduksi)} gr</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Loses fisik total: {fmt2(totalLoses)} gr</p>
        </div>
      </div>

      {/* Chart: Loses per batch (top 20 terburuk) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-slate-700 mb-4">Loses % per Batch {chartData.length < rows.length ? `(Top ${chartData.length} Tertinggi)` : ''}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(value: any) => [`${value}%`, 'Loses']}
              labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.full ?? label}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="loses" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.loses > 5 ? '#ef4444' : entry.loses > 3 ? '#f97316' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-end text-[10px] text-slate-400">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500 mr-1"/>≤ 3%</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1"/>3–5%</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1"/>&gt; 5%</span>
        </div>
      </div>

      {/* Tabel per batch */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-700">Tabel Efisiensi Per Batch</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 min-w-[140px]">Batch</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Bahan Baku (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Produksi Jadi (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">SB (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Serbuk (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Reject Blm Lebur (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Total Loses (gr)</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Loses %</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Efisiensi %</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => {
                const isGood = r.efisiensiPct >= 85
                const isBest  = r.kode === best.kode
                const isWorst = r.kode === worst.kode
                return (
                  <tr key={r.kode} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-white group-hover:bg-slate-50">
                      <div className="flex items-center gap-1.5">
                        {isBest  && <Trophy size={10} className="text-emerald-500 shrink-0"/>}
                        {isWorst && <AlertTriangle size={10} className="text-red-400 shrink-0"/>}
                        <Link href={`/laporan/batch/${encodeURIComponent(r.kode)}`}
                          className="font-mono font-semibold text-slate-700 hover:text-violet-600 transition-colors text-[11px]">
                          {r.kode}
                        </Link>
                      </div>
                      {r.tanggal && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(r.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmt2(r.bahanBaku)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmt2(r.produksiJadi)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{fmt2(r.sb)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmt2(r.serbuk)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-orange-500">{r.reject > 0 ? fmt2(r.reject) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.totalLoses > 1 ? 'text-red-600' : r.totalLoses < -0.5 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {fmt2(r.totalLoses)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.losesPct > 5 ? 'text-red-600' : r.losesPct > 3 ? 'text-orange-500' : 'text-slate-600'}`}>
                      {fmtPct(r.losesPct)}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.efisiensiPct >= 99 ? 'text-emerald-600' : r.efisiensiPct >= 95 ? 'text-green-600' : r.efisiensiPct >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                      {fmtPct(r.efisiensiPct)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {isGood ? '✅ BAIK' : '❌ PERLU PERHATIAN'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot className="bg-slate-100 font-semibold text-[11px] border-t-2 border-slate-200">
              <tr>
                <td className="px-4 py-3 sticky left-0 bg-slate-100 text-slate-600">TOTAL / RATA-RATA</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-800">{fmt2(totalBahan)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-800">{fmt2(totalProduksi)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-700">{fmt2(rows.reduce((s, r) => s + r.sb, 0))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt2(rows.reduce((s, r) => s + r.serbuk, 0))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt2(rows.reduce((s, r) => s + r.reject, 0))}</td>
                <td className="px-3 py-3 text-right tabular-nums text-red-700">{fmt2(totalLoses)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-red-700">{fmtPct(losesRata)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-green-700">{fmtPct(efisiensiRata)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function Header({ from, to, setFrom, setTo, onApply }: {
  from: string; to: string
  setFrom: (v: string) => void; setTo: (v: string) => void
  onApply: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
      <p className="text-[12px] font-semibold text-slate-500">Filter Tanggal:</p>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-400">Dari</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="h-8 px-2 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300/40" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-400">Sampai</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="h-8 px-2 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300/40" />
      </div>
      <button onClick={onApply}
        className="h-8 px-4 bg-violet-600 text-white text-[11px] font-semibold rounded-lg hover:bg-violet-700 transition-colors">
        Terapkan
      </button>
      {(from || to) && (
        <button onClick={() => { setFrom(''); setTo(''); onApply() }}
          className="text-[11px] text-slate-400 hover:text-slate-600">
          Reset
        </button>
      )}
    </div>
  )
}
