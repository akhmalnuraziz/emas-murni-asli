'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star, TrendingUp, AlertTriangle, Clock, ChevronDown, ChevronUp, Calendar, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiEntry {
  id: number; nama: string; warna: string | null
  anggota: { id: number; nama: string; aktif: boolean }[]
  kpi: { efisiensiScore: number; lossScore: number; kecepatanScore: number; totalScore: number } | null
  bintang: number
  stats: {
    totalSerah: number; totalTerima: number; totalLoss: number; lossRate: number
    count: number; onTimeCount: number; lateCount: number
  } | null
  targetSerah: number
  achievementPct: number | null
}

interface Props {
  kpiList: KpiEntry[]
  bobot: { efisiensi: number; loss: number; kecepatan: number }
  period: string
  dateFrom: string
  dateTo: string
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week',  label: '7 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Kustom' },
]

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

function AchievementBar({ pct, targetSerah, actual }: { pct: number; targetSerah: number; actual: number }) {
  const clamped = Math.min(120, pct)
  const color   = pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Target size={10} /> Achievement Target
        </p>
        <span className="text-[12px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>Aktual: <b className="text-slate-600">{actual.toFixed(2)} gr</b></span>
        <span>Target: <b className="text-slate-600">{targetSerah.toFixed(0)} gr</b></span>
      </div>
    </div>
  )
}

function PeriodSelector({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(period === 'custom')
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo, setCustomTo]     = useState(dateTo)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={13} className="text-slate-400" />
        {PERIOD_OPTIONS.map(opt => {
          if (opt.value === 'custom') return (
            <button key="custom" onClick={() => setShowCustom(v => !v)}
              className={cn('px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all',
                showCustom ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200 hover:text-violet-600'
              )}>{opt.label}</button>
          )
          return (
            <a key={opt.value} href={`/kpi-tim?period=${opt.value}`}
              className={cn('px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer',
                period === opt.value && !showCustom ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200 hover:text-violet-600'
              )}>{opt.label}</a>
          )
        })}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl px-3 py-2 border border-slate-200">
          <span className="text-[12px] text-slate-400">Dari</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-400" />
          <span className="text-[12px] text-slate-400">s/d</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-400" />
          <button onClick={() => startTransition(() => router.push(`/kpi-tim?period=custom&from=${customFrom}&to=${customTo}`))}
            className="px-3 py-1 rounded-xl bg-violet-600 text-white text-[12px] font-bold">Terapkan</button>
        </div>
      )}
    </div>
  )
}

export default function KpiTimClient({ kpiList, bobot, period, dateFrom, dateTo }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const sorted = [...kpiList].sort((a, b) => (b.bintang ?? 0) - (a.bintang ?? 0))

  const periodLabel = period === 'today' ? 'Hari Ini'
    : period === 'week'   ? '7 Hari Terakhir'
    : period === 'custom' ? `${dateFrom} – ${dateTo}`
    : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500">
          <Star size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-slate-900">KPI Tim Produksi</h1>
          <p className="text-[12px] text-slate-400">
            {periodLabel} · Efisiensi {bobot.efisiensi}% · Loss {bobot.loss}% · Kecepatan {bobot.kecepatan}%
          </p>
        </div>
      </div>

      {/* Period selector */}
      <PeriodSelector period={period} dateFrom={dateFrom} dateTo={dateTo} />

      {/* Legend bobot */}
      <div className="rounded-xl p-4 flex gap-4 flex-wrap"
        >
        {[
          { label: 'Efisiensi', pct: bobot.efisiensi, color: '#7C3AED', desc: 'Output / Input (gain wajar tidak dihukum)' },
          { label: 'Loss',      pct: bobot.loss,      color: '#EF4444', desc: 'Loss rendah = skor tinggi' },
          { label: 'Kecepatan', pct: bobot.kecepatan, color: '#0EA5E9', desc: '% selesai sebelum target' },
        ].map(({ label, pct, color, desc }) => (
          <div key={label} className="flex items-center gap-2 min-w-[180px]">
            <div className="w-2 h-8 rounded-full" style={{ background: color }} />
            <div>
              <p className="text-[13px] font-bold text-slate-800">{label} <span className="text-[12px] font-normal text-slate-400">({pct}%)</span></p>
              <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tim list */}
      <div className="space-y-3">
        {sorted.map((tim, rank) => (
          <div key={tim.id} className="rounded-xl overflow-hidden"
            >
            <button
              onClick={() => setExpanded(expanded === tim.id ? null : tim.id)}
              className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                style={{ background: tim.warna ?? '#7F6DC6' }}>
                {rank + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{tim.nama}</p>
                <p className="text-[12px] text-slate-400">
                  {tim.anggota.filter(a => a.aktif).length} anggota
                  {tim.stats ? ` · ${tim.stats.count} proses · ${tim.stats.totalSerah.toFixed(1)} gr serah` : ''}
                </p>
              </div>
              {/* Achievement badge jika ada target */}
              {tim.achievementPct !== null && (
                <div className="flex-shrink-0 text-center hidden sm:block">
                  <p className="text-[10px] text-slate-400 font-semibold">Target</p>
                  <p className="text-[13px] font-bold" style={{ color: tim.achievementPct >= 100 ? '#16a34a' : tim.achievementPct >= 70 ? '#d97706' : '#dc2626' }}>
                    {tim.achievementPct.toFixed(0)}%
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 flex-shrink-0">
                {tim.kpi ? (
                  <>
                    <Stars n={tim.bintang} />
                    <span className="text-[13px] font-bold text-slate-600 w-10 text-right">
                      {Math.round(tim.kpi.totalScore)}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-slate-300 italic">Belum ada data</span>
                )}
                {expanded === tim.id ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
              </div>
            </button>

            {expanded === tim.id && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4">
                {tim.kpi && tim.stats ? (
                  <>
                    {/* Achievement vs Target */}
                    {tim.targetSerah > 0 && tim.achievementPct !== null && (
                      <div className="rounded-xl p-4 bg-slate-400/5 border border-slate-400/10">
                        <AchievementBar
                          pct={tim.achievementPct}
                          targetSerah={tim.targetSerah}
                          actual={tim.stats.totalSerah}
                        />
                      </div>
                    )}
                    {tim.targetSerah === 0 && (
                      <p className="text-[11px] text-slate-300 italic">
                        Target serah belum diset. Atur di Pengaturan → KPI untuk tim ini.
                      </p>
                    )}

                    {/* Score bars */}
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 mb-1">
                          <TrendingUp size={11} className="text-violet-500" /> Efisiensi
                        </p>
                        <ScoreBar value={tim.kpi.efisiensiScore} color="#7C3AED" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 mb-1">
                          <AlertTriangle size={11} className="text-red-400" /> Loss
                        </p>
                        <ScoreBar value={tim.kpi.lossScore} color="#EF4444" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 mb-1">
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
                        <div key={label} className="rounded-xl p-3 text-center bg-slate-400/[0.06] border border-slate-400/[0.08]">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                          <p className="text-[13px] font-bold text-slate-700 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Anggota */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Anggota Tim</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tim.anggota.filter(a => a.aktif).map(a => (
                          <span key={a.id} className="text-[12px] px-2.5 py-1 rounded-full font-medium"
                            style={{ background: `${tim.warna ?? '#7F6DC6'}18`, color: tim.warna ?? '#7F6DC6' }}>
                            {a.nama}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-[12px] text-slate-300">Belum ada data proses untuk tim ini di periode {periodLabel}.</p>
                    <p className="text-[11px] text-slate-300 mt-1">KPI akan muncul setelah ada data cutting/pas berat/annealing.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {kpiList.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center"
          >
          <Star size={32} className="mx-auto text-slate-200 mb-2" />
          <p className="text-slate-300 text-[13px]">Belum ada tim produksi yang aktif.</p>
        </div>
      )}
    </div>
  )
}
