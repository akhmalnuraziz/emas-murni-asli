'use client'

import { useState } from 'react'
import { Star, TrendingUp, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface KpiEntry {
  id: number; nama: string; warna: string | null
  anggota: { id: number; nama: string; aktif: boolean }[]
  kpi: { efisiensiScore: number; lossScore: number; kecepatanScore: number; totalScore: number } | null
  bintang: number
  stats: {
    totalSerah: number; totalTerima: number; totalLoss: number; lossRate: number
    count: number; onTimeCount: number; lateCount: number
  } | null
}

interface Props {
  kpiList: KpiEntry[]
  bobot: { efisiensi: number; loss: number; kecepatan: number }
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
      ))}
    </div>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{Math.round(value)}</span>
    </div>
  )
}

export default function KpiTimClient({ kpiList, bobot }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const sorted = [...kpiList].sort((a, b) => (b.bintang ?? 0) - (a.bintang ?? 0))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
          <Star size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">KPI Tim Produksi</h1>
          <p className="text-xs text-slate-400">
            Rating bintang · Efisiensi {bobot.efisiensi}% · Loss {bobot.loss}% · Kecepatan {bobot.kecepatan}%
          </p>
        </div>
      </div>

      {/* Legend bobot */}
      <div className="rounded-3xl p-4 flex gap-4 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
        {[
          { label: 'Efisiensi', pct: bobot.efisiensi, color: '#7C3AED', desc: 'Output / Input (gain wajar tidak dihukum)' },
          { label: 'Loss',      pct: bobot.loss,      color: '#EF4444', desc: 'Loss rendah = skor tinggi' },
          { label: 'Kecepatan', pct: bobot.kecepatan, color: '#0EA5E9', desc: '% selesai sebelum target' },
        ].map(({ label, pct, color, desc }) => (
          <div key={label} className="flex items-center gap-2 min-w-[180px]">
            <div className="w-2 h-8 rounded-full" style={{ background: color }} />
            <div>
              <p className="text-sm font-bold text-slate-800">{label} <span className="text-xs font-normal text-slate-400">({pct}%)</span></p>
              <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tim list */}
      <div className="space-y-3">
        {sorted.map((tim, rank) => (
          <div key={tim.id} className="rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
            {/* Header row */}
            <button
              onClick={() => setExpanded(expanded === tim.id ? null : tim.id)}
              className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors">
              {/* Rank */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                style={{ background: tim.warna ?? '#7F6DC6' }}>
                {rank + 1}
              </div>
              {/* Tim info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{tim.nama}</p>
                <p className="text-xs text-slate-400">
                  {tim.anggota.filter(a => a.aktif).length} anggota
                  {tim.stats ? ` · ${tim.stats.count} proses` : ''}
                </p>
              </div>
              {/* Stars + score */}
              <div className="flex items-center gap-3">
                {tim.kpi ? (
                  <>
                    <Stars n={tim.bintang} />
                    <span className="text-sm font-black text-slate-600 w-10 text-right">
                      {Math.round(tim.kpi.totalScore)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-300 italic">Belum ada data</span>
                )}
                {expanded === tim.id ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === tim.id && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4">
                {tim.kpi && tim.stats ? (
                  <>
                    {/* Score bars */}
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between mb-1">
                          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                            <TrendingUp size={11} className="text-violet-500" /> Efisiensi
                          </p>
                        </div>
                        <ScoreBar value={tim.kpi.efisiensiScore} color="#7C3AED" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                          <AlertTriangle size={11} className="text-red-400" /> Loss
                        </p>
                        <ScoreBar value={tim.kpi.lossScore} color="#EF4444" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                          <Clock size={11} className="text-sky-400" /> Kecepatan
                        </p>
                        <ScoreBar value={tim.kpi.kecepatanScore} color="#0EA5E9" />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Total Serah',  value: `${tim.stats.totalSerah.toFixed(2)} gr` },
                        { label: 'Total Terima', value: `${tim.stats.totalTerima.toFixed(2)} gr` },
                        { label: 'Total Loss',   value: `${tim.stats.totalLoss.toFixed(3)} gr` },
                        { label: 'Loss Rate',    value: `${tim.stats.lossRate.toFixed(2)}%` },
                        { label: 'On-Time',      value: `${tim.stats.onTimeCount} / ${tim.stats.onTimeCount + tim.stats.lateCount}` },
                        { label: 'Total Proses', value: `${tim.stats.count}x` },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl p-3 text-center"
                          style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.08)' }}>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                          <p className="text-sm font-black text-slate-700 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Anggota */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Anggota Tim</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tim.anggota.filter(a => a.aktif).map(a => (
                          <span key={a.id} className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: `${tim.warna ?? '#7F6DC6'}18`, color: tim.warna ?? '#7F6DC6' }}>
                            {a.nama}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-xs text-slate-300">Belum ada data proses untuk tim ini.</p>
                    <p className="text-[11px] text-slate-300 mt-1">KPI akan muncul setelah ada data cutting/pas berat/annealing.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {kpiList.length === 0 && (
        <div className="rounded-3xl py-20 text-center"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <Star size={32} className="mx-auto text-slate-200 mb-2" />
          <p className="text-slate-300 text-sm">Belum ada tim produksi yang aktif.</p>
        </div>
      )}
    </div>
  )
}
