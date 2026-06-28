'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import {
  Tag, Hammer, Package2, AlertTriangle, ArrowLeftRight,
  TrendingUp, ShoppingCart, RotateCcw, Layers, Flame,
  Scale, Thermometer, CheckCircle2, Clock, Truck, ClipboardCheck,
  BoxSelect, TriangleAlert, Boxes, Wallet, Calendar, ChevronRight,
  Sparkles, Loader2, X, RefreshCcw,
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
  { key: 'Cutting',      label: 'Cutting',      icon: Hammer,       color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  { key: 'Pas Berat',    label: 'Pas Berat',    icon: Scale,        color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  { key: 'Annealing',    label: 'Annealing',    icon: Thermometer,  color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  { key: 'Siap Packing', label: 'Siap Packing', icon: Package2,     color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
]

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week',  label: '7 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Kustom' },
]

function PeriodSelector({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const router = useRouter()
  const [showCustom, setShowCustom] = useState(period === 'custom')
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo,   setCustomTo]   = useState(dateTo)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIOD_OPTIONS.map(opt => {
          const isActive = opt.value === 'custom' ? showCustom : period === opt.value
          if (opt.value === 'custom') {
            return (
              <button key="custom"
                onClick={() => setShowCustom(v => !v)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[12px] font-semibold transition-all border',
                  isActive
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                )}>
                {opt.label}
              </button>
            )
          }
          return (
            <a key={opt.value}
              href={`/dashboard?period=${opt.value}`}
              className={cn(
                'px-3 py-1 rounded-lg text-[12px] font-semibold transition-all border cursor-pointer',
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              )}>
              {opt.label}
            </a>
          )
        })}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl px-3 py-2.5 border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Dari</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400 bg-white" />
          <span className="text-[11px] text-slate-500 font-medium">s/d</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400 bg-white" />
          <button
            onClick={() => router.push(`/dashboard?period=custom&from=${customFrom}&to=${customTo}`)}
            className="px-3 py-1 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors">
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
  const [aiAnalysis, setAiAnalysis] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)

  const now  = new Date()
  const jam  = now.getHours()
  const greeting = jam < 12 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 19 ? 'Selamat sore' : 'Selamat malam'

  const periodLabel = period === 'today' ? 'Hari Ini'
    : period === 'week'  ? '7 Hari Terakhir'
    : period === 'custom' ? `${dateFrom} – ${dateTo}`
    : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const alerts: string[] = []
  if (reject.count > 0)               alerts.push(`${reject.count} item reject emas (${reject.gram.toFixed(2)} gr) menunggu dilebur`)
  if (Math.abs(balanceSelisih) > 0.5) alerts.push(`Neraca emas selisih ${balanceSelisih >= 0 ? '+' : ''}${balanceSelisih.toFixed(3)} gr`)
  if (transit.pcs > 20)               alerts.push(`${transit.pcs} pcs dalam perjalanan ke cabang, belum dikonfirmasi`)
  if (poPackaging.pendingQc > 0)      alerts.push(`${poPackaging.pendingQc} batch akrilik menunggu QC`)
  if (poPackaging.rejectPendingQty > 0) alerts.push(`${poPackaging.rejectPendingQty} pcs akrilik reject belum ditangani`)

  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const runAiAnalysis = async () => {
    setAiLoading(true)
    setShowAiPanel(true)
    setAiAnalysis('')

    const dashboardData = {
      periode: periodLabel,
      stok,
      transit,
      penjualan,
      reject,
      pipeline,
      poPackaging,
      totalPengeluaran,
      packingHariIni: packingHariIni.length,
      balanceSelisih,
    }

    try {
      const response = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dashboardData,
          question: 'Buat analisis kondisi bisnis emas saat ini berdasarkan data dashboard.',
        }),
      })

      if (!response.ok) {
        setAiAnalysis('Gagal terhubung ke server AI. Silakan coba lagi.')
        setAiLoading(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setAiAnalysis('Gagal membaca respons dari server.')
        setAiLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let result = ''
      let hasError = false
      let errorMsg = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          const trimmed = line.replace(/^data: /, '')
          if (trimmed === '[DONE]') break

          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.error) {
              hasError = true
              errorMsg = parsed.error
              break
            }
            if (parsed.content) {
              result += parsed.content
              setAiAnalysis(result)
            }
          } catch {
            // Skip
          }
        }
        if (hasError) break
      }

      if (hasError && !result) {
        setAiAnalysis(errorMsg || 'Layanan AI sedang tidak tersedia. Coba lagi dalam beberapa menit.')
      } else if (!result) {
        setAiAnalysis('Tidak ada respons dari AI. Silakan coba lagi.')
      }
    } catch {
      setAiAnalysis('Gagal terhubung ke server. Periksa koneksi internet anda.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-5 pb-8 max-w-[1280px]">

      {/* ── Greeting + Period ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-slate-800 leading-tight">
            {greeting}, <span className="text-violet-600">{userName || 'Tim'}</span>
          </p>
          <p className="text-[12px] text-slate-400 mt-0.5 font-normal">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAiAnalysis}
            disabled={aiLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all border',
              aiLoading
                ? 'bg-violet-50 text-violet-400 border-violet-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white border-transparent hover:from-violet-600 hover:to-purple-600 shadow-sm hover:shadow-md'
            )}
          >
            {aiLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {aiLoading ? 'Menganalisis...' : 'AI Analysis'}
          </button>
          <PeriodSelector period={period} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      </div>

      {/* ── Alert banner ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={14} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-red-700">
              {alerts.length} item perlu perhatian
            </p>
            <ul className="mt-1 space-y-0.5">
              {alerts.map((a, i) => (
                <li key={i} className="text-[12px] text-red-600 flex items-start gap-1.5">
                  <span className="flex-shrink-0 mt-px">·</span>{a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── AI Analysis Panel ─────────────────────────────────────────── */}
      {showAiPanel && (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              <p className="text-[13px] font-semibold text-violet-700">AI Analysis</p>
            </div>
            <div className="flex items-center gap-2">
              {!aiLoading && aiAnalysis && (
                <button
                  onClick={runAiAnalysis}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-100 rounded-lg transition-colors"
                >
                  <RefreshCcw size={12} />
                  Ulangi
                </button>
              )}
              <button
                onClick={() => setShowAiPanel(false)}
                className="p-1 text-violet-400 hover:text-violet-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
            {aiAnalysis || (
              <span className="inline-flex items-center gap-2 text-violet-500">
                <Loader2 size={14} className="animate-spin" />
                Sedang menganalisis data...
              </span>
            )}
          </div>
          {!aiLoading && aiAnalysis && aiAnalysis.includes('Gagal') && (
            <button
              onClick={runAiAnalysis}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-violet-600 bg-white border border-violet-200 hover:bg-violet-50 rounded-lg transition-colors"
            >
              <RefreshCcw size={12} />
              Coba Lagi
            </button>
          )}
        </div>
      )}

      {/* ── KPI Row 1: Stok Emas ─────────────────────────────────────── */}
      <Section label="Stok Emas — Shieldtag" icon={<Tag size={13} className="text-violet-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            label="Stok Aktif"
            value={stok.pcs.toLocaleString('id-ID') + ' pcs'}
            sub={stok.gram.toFixed(2) + ' gr'}
            sub2={canSeeRp && stok.nilaiRp > 0 ? formatRupiah(stok.nilaiRp) : undefined}
            icon={Tag} iconColor="text-violet-600" iconBg="bg-violet-50"
          />
          <KpiCard
            label="Transit Cabang"
            value={transit.pcs.toLocaleString('id-ID') + ' pcs'}
            sub={transit.gram.toFixed(2) + ' gr'}
            icon={ArrowLeftRight} iconColor="text-sky-600" iconBg="bg-sky-50"
            alert={transit.pcs > 0}
          />
          <KpiCard
            label="Reject Belum Dilebur"
            value={reject.count + ' item'}
            sub={reject.gram.toFixed(2) + ' gr'}
            icon={AlertTriangle}
            iconColor={reject.count > 0 ? 'text-red-600' : 'text-slate-400'}
            iconBg={reject.count > 0 ? 'bg-red-50' : 'bg-slate-50'}
            alert={reject.count > 0}
          />
        </div>
      </Section>

      {/* ── Stok Emas per Gramasi ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-violet-500" />
            <h3 className="text-[13px] font-semibold text-slate-800">Stok Emas per Gramasi</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">{stok.pcs} pcs total</span>
        </div>
        {gramasiChartData.length > 0 ? (
          <>
            {/* Text chips — angka eksplisit per gramasi */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-4">
              {gramasiChartData.map((d, i) => (
                <div key={d.gramasi} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2.5 text-center">
                  <p className={cn('text-[16px] font-bold tabular-nums leading-none', i % 2 === 0 ? 'text-violet-700' : 'text-indigo-600')}>{d.pcs}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{d.gramasi}</p>
                </div>
              ))}
            </div>
            {/* Visual bar chart */}
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={gramasiChartData} barSize={18} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <XAxis dataKey="gramasi" tick={{ fontSize: 10, fill: '#9A9A94', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #E4E4E0', fontSize: 12, fontFamily: 'Inter', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(100,80,214,0.05)' }}
                />
                <Bar dataKey="pcs" radius={[5, 5, 0, 0]}>
                  {gramasiChartData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#6450D6' : '#9585F5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : <EmptyState text="Belum ada stok shieldtag aktif" />}
      </Card>

      {/* ── Pipeline Produksi ─────────────────────────────────────────── */}
      <Section label="Pipeline Produksi" icon={<Hammer size={13} className="text-slate-400" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(({ key, label, icon: Icon, color, bg }) => {
            const count = pipeline[key] ?? 0
            return (
              <a key={key} href="/produksi"
                className={cn(
                  'bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 transition-all duration-150',
                  'hover:shadow-md hover:border-slate-300 cursor-pointer'
                )}>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-[22px] font-semibold text-slate-900 leading-none tabular-nums">{count}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</p>
                </div>
              </a>
            )
          })}
        </div>
      </Section>

      {/* ── KPI Row 2: Akrilik ────────────────────────────────────────── */}
      <Section label={`Akrilik — ${periodLabel}`} icon={<Package2 size={13} className="text-blue-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="PO Berjalan"     value={poPackaging.openCount + ' PO'}      sub="open / partial"
            icon={Boxes}         iconColor="text-blue-600"   iconBg="bg-blue-50" />
          <KpiCard label="Datang Periode"  value={poPackaging.datangBulan.toLocaleString('id-ID') + ' pcs'} sub="dari semua PO"
            icon={Truck}         iconColor="text-sky-600"    iconBg="bg-sky-50" />
          <KpiCard label="ACC QC"          value={poPackaging.accBulan.toLocaleString('id-ID') + ' pcs'}
            sub={`reject: ${poPackaging.rejectBulan.toLocaleString('id-ID')} pcs`}
            icon={ClipboardCheck} iconColor="text-green-600" iconBg="bg-green-50" />
          <KpiCard label="Pending QC"      value={poPackaging.pendingQc + ' batch'}
            sub={poPackaging.rejectPendingQty > 0 ? `${poPackaging.rejectPendingQty} pcs reject pending` : 'Semua selesai'}
            icon={poPackaging.pendingQc > 0 ? TriangleAlert : CheckCircle2}
            iconColor={poPackaging.pendingQc > 0 ? 'text-orange-600' : 'text-green-600'}
            iconBg={poPackaging.pendingQc > 0 ? 'bg-orange-50' : 'bg-green-50'}
            alert={poPackaging.pendingQc > 0} />
        </div>
      </Section>

      {/* ── Stok Akrilik per Gramasi ──────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package2 size={15} className="text-blue-500" />
            <h3 className="text-[13px] font-semibold text-slate-800">Stok Akrilik per Gramasi</h3>
          </div>
          <a href="/po-vendor-packaging"
            className="text-[12px] text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1 transition-colors">
            Kelola <ChevronRight size={12} />
          </a>
        </div>
        {stokAkrilik.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {stokAkrilik.map((s) => (
              <div key={s.produk_kode}
                className="rounded-xl py-3 px-2 text-center bg-white border border-slate-200 transition-all">
                <p className={cn('text-[18px] font-semibold leading-none tabular-nums', s.stok_qty > 0 ? 'text-slate-800' : 'text-slate-300')}>
                  {s.stok_qty.toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">{s.gramasi}gr</p>
              </div>
            ))}
          </div>
        ) : <EmptyState text="Belum ada stok akrilik" />}
      </Card>

      {/* ── Packing Hari Ini ──────────────────────────────────────────── */}
      <Section label="Packing Hari Ini" icon={<Package2 size={13} className="text-green-500" />}>
        <a href="/packing-log" className="block">
          <Card hoverable>
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
                      <p className="text-[24px] font-semibold text-slate-900 leading-none tabular-nums">{totalPcs.toLocaleString('id-ID')} pcs</p>
                      {targetPackingHarian > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1 font-normal">Target: {targetPackingHarian.toLocaleString('id-ID')} pcs/hari</p>
                      )}
                    </div>
                    <Badge variant="success">{packingHariIni.length} lot</Badge>
                  </div>
                  {targetPackingHarian > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-slate-400 font-medium">Progress Harian</span>
                        <span className={cn('text-[11px] font-semibold tabular-nums',
                          pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-500' : 'text-slate-500')}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: pct >= 100 ? '#16A34A' : pct >= 70 ? '#F59E0B' : '#6450D6' }} />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(byGramasi)
                      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      .map(([g, v]) => (
                        <div key={g} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-[13px] font-semibold text-slate-800 tabular-nums">{v.pcs} pcs</p>
                          <p className="text-[10px] text-slate-400 font-medium">{g}gr</p>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })() : (
              <div className="flex items-center gap-3">
                <Package2 size={24} className="text-slate-200" />
                <p className="text-[13px] text-slate-400">Belum ada packing hari ini</p>
              </div>
            )}
          </Card>
        </a>
      </Section>

      {/* ── Siap Packing ─────────────────────────────────────────────── */}
      {siapPacking.length > 0 && (() => {
        // Group by gramasi
        const byGramasi: Record<string, { pcs: number; batches: string[] }> = {}
        for (const item of siapPacking) {
          const g = item.gramasi ?? '?'
          if (!byGramasi[g]) byGramasi[g] = { pcs: 0, batches: [] }
          byGramasi[g].pcs++
          if (item.batch_kode && !byGramasi[g].batches.includes(item.batch_kode))
            byGramasi[g].batches.push(item.batch_kode)
        }
        const totalPcs = siapPacking.length
        const entries = Object.entries(byGramasi).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        return (
          <Section label={`Siap Packing — ${totalPcs} pcs menunggu`} icon={<CheckCircle2 size={13} className="text-green-500" />}>
            <a href="/produksi" className="block">
              <Card hoverable>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[22px] font-bold text-green-700 tabular-nums leading-none">{totalPcs} pcs</p>
                  <span className="text-[11px] text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-semibold border border-green-100">Siap Packing</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {entries.map(([g, v]) => (
                    <div key={g} className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-[18px] font-bold text-green-700 tabular-nums leading-none">{v.pcs} pcs</p>
                      <p className="text-[11px] font-semibold text-green-600 mt-0.5">{g} gram</p>
                      <p className="text-[9px] text-slate-400 mt-1 truncate">
                        {v.batches.slice(0, 2).join(', ')}{v.batches.length > 2 ? ` +${v.batches.length - 2}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
                {siapPacking.length >= 30 && (
                  <p className="text-[11px] text-slate-400 text-center">Tampil 30 teratas · klik untuk lihat semua →</p>
                )}
              </Card>
            </a>
          </Section>
        )
      })()}

      {/* ── Reject Belum Dilebur ──────────────────────────────────────── */}
      {rejectList.length > 0 && (
        <Section label={`Reject Belum Dilebur — ${rejectList.length} item`} icon={<AlertTriangle size={13} className="text-red-500" />}>
          <a href="/bahan-baku" className="block">
            <Card hoverable className="border-red-100">
              <div className="space-y-2">
                {rejectList.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-[12px] font-mono font-semibold text-red-600">{item.kode}</p>
                      <p className="text-[11px] text-slate-400">Batch {item.batch_kode} · {item.gramasi}gr</p>
                    </div>
                    <span className="text-[13px] font-semibold text-red-500 tabular-nums">{Number(item.berat_reject).toFixed(2)} gr</span>
                  </div>
                ))}
                {rejectList.length > 8 && (
                  <p className="text-[11px] text-slate-400 text-center pt-1">+{rejectList.length - 8} item lainnya →</p>
                )}
              </div>
            </Card>
          </a>
        </Section>
      )}


      {/* ── Trend Produksi ─────────────────────────────────────────────── */}
      <TrendProduksi trend={produksiTrend} />

      {/* ── Mutasi + Batch ───────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-sky-500" />
            <h3 className="text-[13px] font-semibold text-slate-800">Mutasi Menunggu Konfirmasi</h3>
          </div>
          {mutasiTransit.length > 0 ? (
            <div className="space-y-2">
              {mutasiTransit.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{m.ke_lokasi ?? m.tujuan_cabang ?? 'Cabang'}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(m.tanggal_kirim)}</p>
                  </div>
                  <span className="text-[13px] font-semibold text-sky-600 tabular-nums">{m.pcs_dikirim ?? m.pcs} pcs</span>
                </div>
              ))}
            </div>
          ) : <EmptyState text="Tidak ada mutasi yang menunggu" icon="✓" success />}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-amber-500" />
              <h3 className="text-[13px] font-semibold text-slate-800">Batch Emas Terbaru</h3>
            </div>
            <a href="/bahan-baku" className="text-[11px] text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
              Lihat semua <ChevronRight size={11} />
            </a>
          </div>
          {batchTerbaru.length > 0 ? (
            <div className="space-y-0 divide-y divide-slate-50">
              {batchTerbaru.map((b: any) => {
                const sisaBahan = Number(b.bahan_siap_cetak ?? 0)
                return (
                  <div key={b.kode} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-[12px] font-mono font-semibold text-violet-700">{b.kode}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(b.tanggal)} · {b.supplier ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-slate-700 tabular-nums">
                        {b.timbangan_akhir ? `${Number(b.timbangan_akhir).toFixed(2)} gr` : '—'}
                      </p>
                      {sisaBahan > 0 && (
                        <p className="text-[10px] text-amber-600 font-medium tabular-nums">sisa {sisaBahan.toFixed(2)} gr</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <EmptyState text="Belum ada batch" />}
          {/* Total sisa bahan aktif */}
          {(() => {
            const totalSisa = batchTerbaru.reduce((s: number, b: any) => s + Number(b.bahan_siap_cetak ?? 0), 0)
            if (totalSisa <= 0) return null
            return (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Total sisa bahan (aktif batch)</p>
                <p className="text-[13px] font-bold text-amber-700 tabular-nums">{totalSisa.toFixed(2)} gr</p>
              </div>
            )
          })()}
        </Card>
      </div>

    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
      </div>
      {children}
    </div>
  )
}

function Card({ children, className, hoverable }: { children: React.ReactNode; className?: string; hoverable?: boolean }) {
  return (
    <div className={cn(
      'bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm',
      hoverable && 'transition-all duration-150 hover:shadow-md hover:border-slate-300',
      className
    )}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, sub2, icon: Icon, iconColor, iconBg, alert }: {
  label: string; value: string; sub?: string; sub2?: string
  icon: any; iconColor: string; iconBg: string; alert?: boolean
}) {
  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 transition-all duration-150 hover:shadow-sm',
      alert ? 'border-red-200' : 'border-slate-200'
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-medium text-slate-500 leading-tight">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon size={15} className={iconColor} />
        </div>
      </div>
      <p className="text-[22px] font-semibold text-slate-900 leading-none tabular-nums">{value}</p>
      {sub  && <p className="text-[11px] text-slate-400 mt-1.5 font-normal">{sub}</p>}
      {sub2 && <p className="text-[11px] text-violet-600 font-medium">{sub2}</p>}
    </div>
  )
}

function EmptyState({ text, icon = '—', success }: { text: string; icon?: string; success?: boolean }) {
  return (
    <div className="h-20 flex items-center gap-2.5 text-slate-400">
      <span className={cn('text-[16px]', success ? 'text-green-400' : 'opacity-30')}>{icon}</span>
      <p className="text-[12px]">{text}</p>
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
  const [view, setView] = useState<'grid' | 'chart'>('grid')
  const { gramasi, trendMap, dailyTotal, allDays, bulan, totalPcs } = trend

  const activeDays = allDays.filter(d => (dailyTotal[d] ?? 0) > 0)
  const avgPerDay  = activeDays.length > 0 ? Math.round(totalPcs / activeDays.length) : 0

  const chartData = allDays.map(d => ({ day: d, pcs: dailyTotal[d] ?? 0 }))

  const [yr, mo] = bulan.split('-')
  const bulanLabel = new Date(Number(yr), Number(mo) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const totalPerGramasi: Record<string, number> = {}
  for (const g of gramasi) {
    totalPerGramasi[g] = Object.values(trendMap[g] ?? {}).reduce((a, b) => a + b, 0)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Hammer size={14} className="text-violet-500" />
          <h3 className="text-[13px] font-semibold text-slate-800">Trend Produksi Harian</h3>
          <span className="text-[11px] text-slate-400 font-normal">— {bulanLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[13px] font-semibold text-slate-800 tabular-nums">{totalPcs.toLocaleString('id-ID')} pcs</p>
            <p className="text-[10px] text-slate-400">Ø {avgPerDay}/hari aktif</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['chart', 'grid'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  view === v ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                )}>
                {v === 'chart' ? 'Grafik' : 'Tabel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'chart' && (
        <div className="px-5 py-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9A9A94', fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#9A9A94', fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E4E4E0', fontSize: 12, fontFamily: 'Inter', padding: '6px 10px' }}
                cursor={{ fill: 'rgba(100,80,214,0.04)' }}
                formatter={(v: any) => [`${Number(v).toLocaleString('id-ID')} pcs`, 'Produksi']}
                labelFormatter={(l: any) => `Tgl ${l}`}
              />
              {avgPerDay > 0 && (
                <ReferenceLine y={avgPerDay} stroke="#9585F5" strokeDasharray="4 3"
                  label={{ value: `Ø ${avgPerDay}`, fontSize: 10, fill: '#6450D6', position: 'insideTopRight', fontFamily: 'Inter' }} />
              )}
              <Bar dataKey="pcs" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pcs >= avgPerDay && avgPerDay > 0 ? '#6450D6' : '#B8ADFA'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 text-center mt-1">Ungu = di atas rata-rata harian</p>
        </div>
      )}

      {view === 'grid' && gramasi.length === 0 && (
        <div className="px-5 py-8 text-center text-[12px] text-slate-400">
          Belum ada data packing untuk periode ini
        </div>
      )}

      {view === 'grid' && gramasi.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-[11px] min-w-max w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 bg-slate-50 px-4 py-2.5 text-left font-semibold text-slate-500 border-r border-slate-200 min-w-[60px] text-[11px]">
                  Gramasi / Tgl
                </th>
                {allDays.map(d => (
                  <th key={d} className={cn(
                    'px-2 py-2.5 text-center font-semibold min-w-[28px] text-[11px]',
                    (dailyTotal[d] ?? 0) > 0 ? 'text-violet-600' : 'text-slate-300'
                  )}>
                    {d}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600 border-l border-slate-200 min-w-[56px] text-[11px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {gramasi.map((g, ri) => (
                <tr key={g} className={cn('border-b border-slate-50', ri % 2 === 0 ? '' : 'bg-slate-50/40')}>
                  <td className="sticky left-0 bg-white px-4 py-2 font-semibold text-slate-700 border-r border-slate-200">
                    {g}gr
                  </td>
                  {allDays.map(d => {
                    const v = trendMap[g]?.[d] ?? 0
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        {v > 0 ? (
                          <span className={cn('font-semibold tabular-nums',
                            v >= 100 ? 'text-violet-700' : v >= 50 ? 'text-violet-500' : 'text-violet-400')}>
                            {v}
                          </span>
                        ) : (
                          <span className="text-slate-200">·</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-semibold text-slate-700 border-l border-slate-200 tabular-nums">
                    {totalPerGramasi[g].toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-violet-50 border-t-2 border-violet-100">
                <td className="sticky left-0 bg-violet-50 px-4 py-2.5 font-semibold text-violet-700 border-r border-violet-100 text-[11px]">
                  Total
                </td>
                {allDays.map(d => {
                  const v = dailyTotal[d] ?? 0
                  return (
                    <td key={d} className="px-2 py-2.5 text-center font-semibold tabular-nums">
                      {v > 0
                        ? <span className="text-violet-700">{v}</span>
                        : <span className="text-slate-200">0</span>}
                    </td>
                  )
                })}
                <td className="px-4 py-2.5 text-right font-semibold text-violet-800 border-l border-violet-100 text-[11px] tabular-nums">
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
