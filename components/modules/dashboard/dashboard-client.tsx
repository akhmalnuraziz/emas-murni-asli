'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import {
  Tag, Hammer, Package2, AlertTriangle, ArrowLeftRight,
  TrendingUp, ShoppingCart, RotateCcw, Layers, Flame,
  Scale, Thermometer, CheckCircle2, Clock, Truck, ClipboardCheck,
  BoxSelect, TriangleAlert, Boxes, Wallet, Calendar,
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

interface Props {
  userName: string
  userRole: string
  canSeeRp: boolean
  period: string
  dateFrom: string
  dateTo: string
  stok: { pcs: number; gram: number; nilaiRp: number }
  transit: { pcs: number; gram: number }
  penjualan: { pcs: number; omzetRp: number; buybackCount: number }
  reject: { count: number; gram: number }
  pipeline: Record<string, number>
  gramasiChartData: { gramasi: string; pcs: number }[]
  batchTerbaru: any[]
  mutasiTransit: any[]
  poPackaging: {
    openCount: number
    datangBulan: number
    accBulan: number
    rejectBulan: number
    pendingQc: number
    rejectPendingQty: number
  }
  stokAkrilik: { produk_nama: string; produk_kode: string; gramasi: number; stok_qty: number }[]
  totalPengeluaran: number
  packingHariIni: { kode: string; batch_kode: string; gramasi: string; pcs_dipack: number }[]
  siapPacking: { id: number; kode: string; gramasi: string; batch_kode: string }[]
  rejectList: { id: number; kode: string; gramasi: string; berat_reject: number; batch_kode: string }[]
  balanceSelisih: number
  targetPackingHarian: number
  produksiTrend: {
    gramasi: string[]
    trendMap: Record<string, Record<number, number>>
    dailyTotal: Record<number, number>
    allDays: number[]
    daysInMonth: number
    bulan: string
    totalPcs: number
  }
}

const PIPELINE_STAGES = [
  { key: 'Cutting',      label: 'Cutting',      icon: Hammer,       color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  { key: 'Pas Berat',    label: 'Pas Berat',    icon: Scale,        color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
  { key: 'Annealing',    label: 'Annealing',    icon: Thermometer,  color: '#EAB308', bg: 'rgba(234,179,8,0.08)'  },
  { key: 'Siap Packing', label: 'Siap Packing', icon: Package2,     color: '#22C55E', bg: 'rgba(34,197,94,0.08)'  },
]

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
    if (p === 'custom' && from && to) {
      params.set('from', from)
      params.set('to', to)
    }
    startTransition(() => router.push(`/dashboard?${params.toString()}`))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={13} className="text-slate-400" />
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              if (opt.value === 'custom') { setShowCustom(true); return }
              setShowCustom(false)
              navigate(opt.value)
            }}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              period === opt.value && opt.value !== 'custom'
                ? 'bg-violet-600 text-white shadow-sm'
                : showCustom && opt.value === 'custom'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200 hover:text-violet-600'
            )}
          >
            {opt.label}
          </button>
        ))}
        {isPending && <span className="text-[10px] text-slate-400 ml-1">Memuat...</span>}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-2xl px-3 py-2 border border-slate-200">
          <span className="text-xs text-slate-400 font-medium">Dari</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <span className="text-xs text-slate-400 font-medium">s/d</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <button
            onClick={() => navigate('custom', customFrom, customTo)}
            className="px-3 py-1 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
          >
            Terapkan
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardClient({
  userName, canSeeRp, period, dateFrom, dateTo,
  stok, transit, penjualan, reject, pipeline, gramasiChartData, batchTerbaru, mutasiTransit,
  poPackaging, stokAkrilik, totalPengeluaran, produksiTrend,
  packingHariIni, siapPacking, rejectList, balanceSelisih, targetPackingHarian,
}: Props) {
  const now  = new Date()
  const jam  = now.getHours()
  const greeting = jam < 12 ? 'Pagi' : jam < 15 ? 'Siang' : jam < 19 ? 'Sore' : 'Malam'

  const periodLabel = period === 'today' ? 'Hari Ini'
    : period === 'week'  ? '7 Hari Terakhir'
    : period === 'custom' ? `${dateFrom} – ${dateTo}`
    : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const alerts: string[] = []
  if (reject.count > 0)               alerts.push(`${reject.count} item reject emas (${reject.gram.toFixed(2)} gr) nunggu dilebur`)
  if (Math.abs(balanceSelisih) > 0.5) alerts.push(`Neraca emas selisih ${balanceSelisih >= 0 ? '+' : ''}${balanceSelisih.toFixed(3)} gr — cek tab Neraca di Laporan`)
  if (transit.pcs > 20)               alerts.push(`${transit.pcs} pcs lagi dalam perjalanan ke cabang, belum dikonfirmasi`)
  if (poPackaging.pendingQc > 0)      alerts.push(`${poPackaging.pendingQc} batch akrilik nunggu QC`)
  if (poPackaging.rejectPendingQty > 0) alerts.push(`${poPackaging.rejectPendingQty} pcs akrilik reject belum ditangani`)

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl px-6 py-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'white' }} />
        <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full opacity-5" style={{ background: 'white' }} />
        <p className="text-sm font-medium text-violet-200 relative">Hei {userName || 'Tim'}, {greeting}! 👋</p>
        <h2 className="text-xl font-black mt-1 relative">PT Emas Murni Asli</h2>
        <p className="text-violet-200 text-xs mt-1 relative">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Period Selector ───────────────────────────────────────────────── */}
      <PeriodSelector period={period} dateFrom={dateFrom} dateTo={dateTo} />

      {/* ── Alert banner ──────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="rounded-3xl px-5 py-4 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={15} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">Ada yang perlu dicek nih! ({alerts.length})</p>
            <div className="mt-1 space-y-0.5">
              {alerts.map((a, i) => (
                <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                  <span className="mt-0.5 flex-shrink-0">•</span>{a}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Row 1: Emas ───────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Tag size={12} className="text-violet-500"/>} label="Stok Emas (ShieldTag)" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Stok Aktif" value={stok.pcs.toLocaleString('id-ID') + ' pcs'}
            sub={stok.gram.toFixed(2) + ' gr'} sub2={canSeeRp ? formatRupiah(stok.nilaiRp) : undefined}
            icon={Tag} color="#7C3AED" bg="rgba(124,58,237,0.08)" />
          <KpiCard label="Transit Cabang" value={transit.pcs.toLocaleString('id-ID') + ' pcs'}
            sub={transit.gram.toFixed(2) + ' gr'} icon={ArrowLeftRight} color="#0EA5E9" bg="rgba(14,165,233,0.08)"
            alert={transit.pcs > 0} />
          <KpiCard label={`Terjual (${periodLabel})`} value={penjualan.pcs.toLocaleString('id-ID') + ' pcs'}
            sub={canSeeRp ? formatRupiah(penjualan.omzetRp) : undefined}
            sub2={penjualan.buybackCount > 0 ? `${penjualan.buybackCount} buyback` : undefined}
            icon={ShoppingCart} color="#16A34A" bg="rgba(22,163,74,0.08)" />
          <KpiCard label="Reject Belum Dilebur" value={reject.count + ' item'}
            sub={reject.gram.toFixed(2) + ' gr'}
            icon={AlertTriangle} color={reject.count > 0 ? '#EF4444' : '#94A3B8'}
            bg={reject.count > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.08)'}
            alert={reject.count > 0} />
        </div>
      </div>

      {/* ── Stok Emas per Gramasi ─────────────────────────────────────────── */}
      <div className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-violet-500" />
          <h3 className="font-bold text-slate-800 text-sm">Stok Emas per Gramasi</h3>
        </div>
        {gramasiChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={gramasiChartData} barSize={24}>
              <XAxis dataKey="gramasi" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }} cursor={{ fill: '#f5f3ff' }} />
              <Bar dataKey="pcs" radius={[6, 6, 0, 0]}>
                {gramasiChartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#7C3AED' : '#A78BFA'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart text="Belum ada stok shieldtag aktif" />}
      </div>

      {/* ── KPI Row 2: Akrilik (PO Packaging) ────────────────────────────── */}
      <div>
        <SectionLabel icon={<Package2 size={12} className="text-blue-500"/>} label={`Akrilik — ${periodLabel}`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="PO Berjalan" value={poPackaging.openCount + ' PO'}
            sub="open / partial" icon={Boxes} color="#3B82F6" bg="rgba(59,130,246,0.08)" />
          <KpiCard label="Datang Periode Ini" value={poPackaging.datangBulan.toLocaleString('id-ID') + ' pcs'}
            sub="dari semua PO" icon={Truck} color="#0EA5E9" bg="rgba(14,165,233,0.08)" />
          <KpiCard label="ACC QC" value={poPackaging.accBulan.toLocaleString('id-ID') + ' pcs'}
            sub={`reject: ${poPackaging.rejectBulan.toLocaleString('id-ID')} pcs`}
            icon={ClipboardCheck} color="#22C55E" bg="rgba(34,197,94,0.08)" />
          <KpiCard label="Pending QC / Reject" value={poPackaging.pendingQc + ' batch'}
            sub={poPackaging.rejectPendingQty > 0 ? `${poPackaging.rejectPendingQty} pcs reject pending` : 'reject tertangani ✅'}
            icon={poPackaging.pendingQc > 0 || poPackaging.rejectPendingQty > 0 ? TriangleAlert : CheckCircle2}
            color={poPackaging.pendingQc > 0 ? '#F97316' : '#22C55E'}
            bg={poPackaging.pendingQc > 0 ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)'}
            alert={poPackaging.pendingQc > 0} />
        </div>
      </div>

      {/* ── Stok Akrilik per Gramasi ──────────────────────────────────────── */}
      <div className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package2 size={15} className="text-blue-500" />
            <h3 className="font-bold text-slate-800 text-sm">Stok Akrilik per Gramasi</h3>
          </div>
          <a href="/po-vendor-packaging" className="text-xs text-violet-500 font-semibold hover:underline">Kelola →</a>
        </div>
        {stokAkrilik.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {stokAkrilik.map((s) => (
              <div key={s.produk_kode} className="rounded-2xl py-3 px-2 text-center"
                style={{ background: s.stok_qty > 0 ? 'rgba(59,130,246,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${s.stok_qty > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.05)'}` }}>
                <p className={`text-xl font-black ${s.stok_qty > 0 ? 'text-blue-700' : 'text-slate-300'}`}>
                  {s.stok_qty.toLocaleString('id-ID')}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">{s.gramasi}gr</p>
              </div>
            ))}
          </div>
        ) : <EmptyChart text="Belum ada stok akrilik" />}
      </div>

      {/* ── Pipeline Produksi ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Hammer size={12} className="text-blue-500"/>} label="Pipeline Produksi" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(({ key, label, icon: Icon, color, bg }) => {
            const count = pipeline[key] ?? 0
            return (
              <a key={key} href="/produksi"
                className="rounded-3xl p-4 flex items-center gap-3 hover:scale-[1.02] transition-transform cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-800">{count}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">{label}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* ── Packing Hari Ini ──────────────────────────────────────────────── */}
      <div>
        <SectionLabel icon={<Package2 size={12} className="text-green-500"/>} label="Packing Hari Ini" />
        <a href="/packing-log" className="block rounded-3xl p-5 hover:shadow-sm transition-shadow"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          {packingHariIni.length > 0 ? (() => {
            const byGramasi: Record<string, { pcs: number; batches: Set<string> }> = {}
            for (const p of packingHariIni) {
              const g = p.gramasi ?? '?'
              if (!byGramasi[g]) byGramasi[g] = { pcs: 0, batches: new Set() }
              byGramasi[g].pcs += Number(p.pcs_dipack ?? 0)
              if (p.batch_kode) byGramasi[g].batches.add(p.batch_kode)
            }
            const totalPcs = packingHariIni.reduce((s, p) => s + Number(p.pcs_dipack ?? 0), 0)
            const pct = targetPackingHarian > 0 ? Math.min(100, Math.round(totalPcs / targetPackingHarian * 100)) : 0
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-2xl font-black text-slate-800">{totalPcs.toLocaleString('id-ID')} pcs</p>
                    {targetPackingHarian > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">Target: {targetPackingHarian.toLocaleString('id-ID')} pcs/hari</p>
                    )}
                  </div>
                  <span className="text-xs text-green-600 font-bold bg-green-50 px-2.5 py-1 rounded-full">{packingHariIni.length} lot packing</span>
                </div>
                {targetPackingHarian > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400 font-semibold">Progress Target Harian</span>
                      <span className={`text-[11px] font-black ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-500' : 'text-slate-500'}`}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct >= 100 ? '#22C55E' : pct >= 70 ? '#F59E0B' : '#7C3AED' }} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byGramasi)
                    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                    .map(([g, v]) => (
                      <div key={g} className="rounded-2xl px-3 py-2 text-center"
                        style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <p className="text-sm font-black text-green-700">{v.pcs} pcs</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{g}gr</p>
                        <p className="text-[9px] text-slate-300">{[...v.batches].join(', ')}</p>
                      </div>
                    ))}
                </div>
              </div>
            )
          })() : (
            <div className="flex items-center gap-3">
              <Package2 size={28} className="text-slate-200" />
              <p className="text-sm text-slate-400">Belum ada packing hari ini</p>
            </div>
          )}
        </a>
      </div>

      {/* ── Siap Packing — Menunggu Dipacking ────────────────────────────── */}
      {siapPacking.length > 0 && (
        <div>
          <SectionLabel icon={<CheckCircle2 size={12} className="text-green-500"/>} label={`Siap Packing — ${siapPacking.length} item menunggu`} />
          <a href="/produksi" className="block rounded-3xl p-5 hover:shadow-sm transition-shadow"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="flex flex-wrap gap-2">
              {siapPacking.map((item) => (
                <div key={item.id} className="rounded-2xl px-3 py-2"
                  style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <p className="text-xs font-mono font-bold text-green-700">{item.kode}</p>
                  <p className="text-[10px] text-slate-400">{item.gramasi}gr · {item.batch_kode}</p>
                </div>
              ))}
            </div>
            {siapPacking.length >= 30 && (
              <p className="text-xs text-slate-300 mt-3 text-center">Tampil 30 teratas · klik untuk lihat semua →</p>
            )}
          </a>
        </div>
      )}

      {/* ── Reject Belum Dilebur ──────────────────────────────────────────── */}
      {rejectList.length > 0 && (
        <div>
          <SectionLabel icon={<AlertTriangle size={12} className="text-red-500"/>} label={`Reject Belum Dilebur — ${rejectList.length} item`} />
          <a href="/bahan-baku" className="block rounded-3xl p-5 hover:shadow-sm transition-shadow"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)', borderColor: 'rgba(239,68,68,0.15)' }}>
            <div className="space-y-2">
              {rejectList.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-mono font-bold text-red-600">{item.kode}</p>
                    <p className="text-[10px] text-slate-400">Batch {item.batch_kode} · {item.gramasi}gr</p>
                  </div>
                  <span className="text-sm font-black text-red-500">{Number(item.berat_reject).toFixed(2)} gr</span>
                </div>
              ))}
              {rejectList.length > 8 && (
                <p className="text-xs text-slate-300 text-center pt-1">+{rejectList.length - 8} item lainnya · klik untuk lihat semua →</p>
              )}
            </div>
          </a>
        </div>
      )}

      {/* ── Row: Pengeluaran + Penjualan summary ─────────────────────────── */}
      {canSeeRp && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label={`Omzet (${periodLabel})`}
            value={formatRupiah(penjualan.omzetRp)}
            sub={penjualan.pcs + ' pcs terjual'}
            icon={ShoppingCart} color="#16A34A" bg="rgba(22,163,74,0.08)" />
          <KpiCard label={`Pengeluaran (${periodLabel})`}
            value={formatRupiah(totalPengeluaran)}
            sub="biaya operasional"
            icon={Wallet} color="#EF4444" bg="rgba(239,68,68,0.08)"
            alert={totalPengeluaran > 0} />
          <KpiCard label="Estimasi Profit"
            value={formatRupiah(Math.max(0, penjualan.omzetRp - totalPengeluaran))}
            sub="omzet − pengeluaran"
            icon={TrendingUp}
            color={penjualan.omzetRp > totalPengeluaran ? '#16A34A' : '#EF4444'}
            bg={penjualan.omzetRp > totalPengeluaran ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)'} />
        </div>
      )}

      {/* ── Trend Produksi Harian ─────────────────────────────────────────── */}
      {produksiTrend.gramasi.length > 0 && (
        <TrendProduksi trend={produksiTrend} />
      )}

      {/* ── Row: Mutasi Transit + Batch Terbaru ───────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-sky-500" />
            <h3 className="font-bold text-slate-800 text-sm">Mutasi Menunggu Konfirmasi</h3>
          </div>
          {mutasiTransit.length > 0 ? (
            <div className="space-y-2">
              {mutasiTransit.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{m.tujuan_cabang ?? 'Cabang'}</p>
                    <p className="text-xs text-slate-400">{formatDate(m.tanggal_kirim)}</p>
                  </div>
                  <span className="text-sm font-bold text-sky-600">{m.pcs} pcs</span>
                </div>
              ))}
            </div>
          ) : <EmptyChart text="Tidak ada mutasi yang menunggu" icon="✅" />}
        </div>

        <div className="rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={15} className="text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">Batch Emas Terbaru</h3>
          </div>
          {batchTerbaru.length > 0 ? (
            <div className="space-y-2">
              {batchTerbaru.map((b: any) => (
                <div key={b.kode} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-mono font-bold text-violet-700">{b.kode}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(b.tanggal)} · {b.supplier ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-700">{b.timbangan_akhir ? `${Number(b.timbangan_akhir).toFixed(2)} gr` : '—'}</p>
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                      b.status === 'Selesai' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    )}>{b.status ?? 'Proses'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyChart text="Belum ada batch" />}
        </div>
      </div>

    </div>
  )
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      {icon}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function KpiCard({ label, value, sub, sub2, icon: Icon, color, bg, alert }: {
  label: string; value: string; sub?: string; sub2?: string
  icon: any; color: string; bg: string; alert?: boolean
}) {
  return (
    <div className={cn('rounded-3xl p-4', alert ? 'ring-1 ring-red-200' : '')}
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: bg }}>
        <Icon size={17} style={{ color }} />
      </div>
      <p className="text-xl font-black text-slate-800 leading-tight">{value}</p>
      {sub  && <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{sub}</p>}
      {sub2 && <p className="text-[11px] text-violet-500 font-semibold">{sub2}</p>}
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">{label}</p>
    </div>
  )
}

function EmptyChart({ text, icon = '📊' }: { text: string; icon?: string }) {
  return (
    <div className="h-32 flex flex-col items-center justify-center gap-2">
      <span className="text-2xl opacity-20">{icon}</span>
      <p className="text-xs text-slate-300">{text}</p>
    </div>
  )
}

function TrendProduksi({ trend }: {
  trend: {
    gramasi: string[]
    trendMap: Record<string, Record<number, number>>
    dailyTotal: Record<number, number>
    allDays: number[]
    daysInMonth: number
    bulan: string
    totalPcs: number
  }
}) {
  const [view, setView] = useState<'grid' | 'chart'>('chart')
  const { gramasi, trendMap, dailyTotal, allDays, bulan, totalPcs } = trend

  // Hitung rata-rata harian (hanya hari yang ada produksi)
  const activeDays = allDays.filter(d => (dailyTotal[d] ?? 0) > 0)
  const avgPerDay = activeDays.length > 0 ? Math.round(totalPcs / activeDays.length) : 0

  // Data chart
  const chartData = allDays.map(d => ({
    day: d,
    pcs: dailyTotal[d] ?? 0,
  }))

  // Format bulan
  const [yr, mo] = bulan.split('-')
  const bulanLabel = new Date(Number(yr), Number(mo) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  // Total per gramasi
  const totalPerGramasi: Record<string, number> = {}
  for (const g of gramasi) {
    totalPerGramasi[g] = Object.values(trendMap[g] ?? {}).reduce((a, b) => a + b, 0)
  }

  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Hammer size={15} className="text-violet-500" />
          <h3 className="font-bold text-slate-800 text-sm">Trend Produksi Harian</h3>
          <span className="text-[11px] text-slate-400 font-medium">— {bulanLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <p className="text-xs font-black text-slate-800">{totalPcs.toLocaleString('id-ID')} pcs</p>
            <p className="text-[10px] text-slate-400">Ø {avgPerDay}/hari aktif</p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            {(['chart', 'grid'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-bold transition-colors',
                  view === v ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                )}>
                {v === 'chart' ? 'Grafik' : 'Tabel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart view */}
      {view === 'chart' && (
        <div className="px-4 pb-5">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={16} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11, padding: '6px 10px' }}
                cursor={{ fill: '#f5f3ff' }}
                formatter={(v: any) => [`${Number(v).toLocaleString('id-ID')} pcs`, 'Produksi']}
                labelFormatter={(l: any) => `Tgl ${l}`}
              />
              {avgPerDay > 0 && (
                <ReferenceLine y={avgPerDay} stroke="#A78BFA" strokeDasharray="4 3"
                  label={{ value: `Ø ${avgPerDay}`, fontSize: 9, fill: '#7C3AED', position: 'insideTopRight' }} />
              )}
              <Bar dataKey="pcs" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pcs >= avgPerDay && avgPerDay > 0 ? '#7C3AED' : '#C4B5FD'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-300 text-center mt-1">Ungu tua = di atas rata-rata</p>
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && (
        <div className="overflow-x-auto pb-4">
          <table className="text-[10px] min-w-max">
            <thead>
              <tr style={{ background: 'rgba(139,92,246,0.06)' }}>
                <th className="sticky left-0 bg-white/90 px-3 py-2 text-left font-bold text-slate-500 border-r border-slate-100 min-w-[56px]">
                  Gramasi
                </th>
                {allDays.map(d => (
                  <th key={d} className={cn(
                    'px-1.5 py-2 text-center font-bold min-w-[28px]',
                    (dailyTotal[d] ?? 0) > 0 ? 'text-violet-600' : 'text-slate-300'
                  )}>
                    {d}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold text-slate-600 border-l border-slate-100 min-w-[52px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {gramasi.map((g, ri) => (
                <tr key={g} className={ri % 2 === 0 ? 'bg-slate-50/40' : ''}>
                  <td className="sticky left-0 bg-white/90 px-3 py-1.5 font-bold text-slate-700 border-r border-slate-100 backdrop-blur">
                    {g}gr
                  </td>
                  {allDays.map(d => {
                    const v = trendMap[g]?.[d] ?? 0
                    return (
                      <td key={d} className="px-1.5 py-1.5 text-center">
                        {v > 0 ? (
                          <span className={cn(
                            'font-bold',
                            v >= 100 ? 'text-violet-700' : v >= 50 ? 'text-violet-500' : 'text-violet-400'
                          )}>{v}</span>
                        ) : (
                          <span className="text-slate-200">·</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right font-black text-slate-700 border-l border-slate-100">
                    {totalPerGramasi[g].toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(139,92,246,0.08)', borderTop: '2px solid rgba(139,92,246,0.2)' }}>
                <td className="sticky left-0 bg-violet-50/80 px-3 py-2 font-black text-violet-700 border-r border-violet-100 backdrop-blur text-[11px]">
                  Total
                </td>
                {allDays.map(d => {
                  const v = dailyTotal[d] ?? 0
                  return (
                    <td key={d} className="px-1.5 py-2 text-center font-black">
                      {v > 0 ? (
                        <span className="text-violet-700">{v}</span>
                      ) : (
                        <span className="text-slate-200">0</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right font-black text-violet-800 border-l border-violet-100 text-[11px]">
                  {totalPcs.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
