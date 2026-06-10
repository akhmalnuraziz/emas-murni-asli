'use client'
import { useState, useCallback, useMemo } from 'react'
import { fetchBatchReport } from '@/app/(dashboard)/laporan/actions'
import { FileText, ChevronDown, BarChart2, Printer, RefreshCw, Layers, Hammer, TrendingDown, Sparkles, Package2 } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fgr  = (v: any) => v == null ? '—' : Number(v).toLocaleString('id-ID',{minimumFractionDigits:3,maximumFractionDigits:3})
const fgr2 = (v: any) => v == null ? '—' : Number(v).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})
const fnum = (v: any) => v == null ? '—' : Number(v).toLocaleString('id-ID')
const fRp  = (v: any) => v == null ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID')
const fD   = (d: any) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const pct  = (a: number, b: number) => b === 0 ? 0 : (a / b) * 100

interface Props {
  batches: any[]
  userRole: string
  userName: string
}

const canSeeHpp = (role: string) => ['owner','admin_pusat','accounting'].includes(role)

// ── Apple-style Donut Chart ──────────────────────────────────────────────────
function DonutChart({ segments, total, label }: { segments: {label:string, value:number, color:string}[], total: number, label: string }) {
  const size = 180, strokeWidth = 24, radius = (size - strokeWidth) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative" style={{width:size, height:size}}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth={strokeWidth}/>
          {segments.map((s, i) => {
            if (s.value <= 0) return null
            const arc = (s.value / Math.max(total, 1)) * circumference
            const dashArray = `${arc} ${circumference - arc}`
            const el = (
              <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
                stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={dashArray} strokeDashoffset={-offset}
                style={{transition:'all .6s cubic-bezier(0.4,0,0.2,1)'}}/>
            )
            offset += arc
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{fnum(total)}</p>
        </div>
      </div>
      <div className="space-y-1.5 w-full max-w-[220px]">
        {segments.map((s,i) => s.value > 0 && (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:s.color}}/>
            <span className="flex-1 text-gray-600 font-medium truncate">{s.label}</span>
            <span className="font-bold text-gray-800 tabular-nums">{fnum(s.value)}</span>
            <span className="text-gray-400 tabular-nums text-[10px] w-10 text-right">{pct(s.value,total).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Progress Bar (Apple-style) ───────────────────────────────────────────────
function ProgressBar({ value, max, color = '#8B5CF6', height = 6 }: { value: number, max: number, color?: string, height?: number }) {
  const p = Math.min(100, pct(value, max))
  return (
    <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{height}}>
      <div className="h-full rounded-full transition-all duration-700 ease-out"
        style={{width:`${p}%`, background:`linear-gradient(90deg, ${color}, ${color}dd)`}}/>
    </div>
  )
}

export default function LaporanClient({ batches, userRole }: Props) {
  const [selectedKode, setSelectedKode] = useState<string>('')
  const [data, setData]                 = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [tab, setTab]                   = useState<'ringkasan'|'peleburan'|'produksi'|'packing'>('ringkasan')
  const [expandedItem, setExpandedItem] = useState<Set<number>>(new Set())
  const showHpp = canSeeHpp(userRole)

  const fetchDetail = useCallback(async (kode: string) => {
    if (!kode) return
    setLoading(true); setData(null)
    try {
      const result = await fetchBatchReport(kode)
      if ('error' in result && result.error) { console.error('Laporan error:', result.error); return }
      setData(result as any); setTab('ringkasan')
    } catch (e) { console.error('fetchDetail error:', e) }
    finally { setLoading(false) }
  }, [])

  function handleSelect(kode: string) {
    setSelectedKode(kode); setData(null)
    if (kode) fetchDetail(kode)
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return null
    const b = data.batch
    const items: any[] = data.produksiItems ?? []
    const pbs: any[]   = data.peleburan ?? []

    const bahanMasuk      = Number(b?.timbangan_akhir ?? b?.bahan_dari_pusat ?? 0)
    const sisaFisik       = Number(b?.sisa_fisik ?? 0)
    const totalDikasih    = pbs.reduce((s,p:any)=>s+Number(p.dikasih_gram??0),0)
    const totalDiterima   = pbs.reduce((s,p:any)=>s+Number(p.diterima_gram??0),0)
    const lossesPeleburan = pbs.reduce((s,p:any)=>s+Number(p.losses_gram??0),0)

    const totalSerahProd  = items.reduce((s,i:any)=>s+Number(i.serah_gram??i.berat_awal??0),0)
    const totalTerimaProd = items.reduce((s,i:any)=>s+Number(i.terima_gram??0),0)
    const rejectCut       = items.reduce((s,i:any)=>s+Number(i.reject_cutting_gram??0),0)
    const lossesCut       = items.reduce((s,i:any)=>s+Number(i.losses_cutting??0),0)

    let stgLosses = 0, totalSerbuk = 0, stgReject = 0
    items.forEach((i:any) => {
      const hs: any[] = Array.isArray(i.stage_handover) ? i.stage_handover.filter((h:any)=>!h.voided_at&&h.status==='selesai') : []
      hs.forEach((h:any) => {
        stgLosses   += Number(h.losses_gram??0)
        totalSerbuk += Number(h.sisa_serbuk??0)
        stgReject   += Number(h.reject_gram??0)
      })
    })

    const totalLosses      = lossesPeleburan + lossesCut + stgLosses
    const totalReject      = rejectCut + stgReject
    const totalGramasiJadi = totalTerimaProd
    const efisiensiPersen  = bahanMasuk > 0 ? ((bahanMasuk - totalLosses) / bahanMasuk * 100) : 0

    let totalPcsPacked = 0
    items.forEach((i:any) => {
      const pks: any[] = Array.isArray(i.packing) ? i.packing.filter((p:any)=>!p.voided_at) : (i.packing&&!i.packing.voided_at?[i.packing]:[])
      totalPcsPacked += pks.reduce((s,p:any)=>s+Number(p.pcs_dipack??p.pcs??0),0)
    })

    const totalPcsProd = items.reduce((s,i:any)=>s+Number(i.pcs??i.pcs_good??0),0)
    const statusCount: Record<string, number> = {}
    items.forEach((i:any) => { statusCount[i.current_status] = (statusCount[i.current_status]||0)+1 })

    const gramasiBreak: Record<string, {pcs:number, totalGram:number}> = {}
    items.forEach((i:any) => {
      const g = i.gramasi
      if (!gramasiBreak[g]) gramasiBreak[g] = {pcs:0, totalGram:0}
      const itemPcs = Number(i.pcs_good ?? i.pcs ?? 0)
      gramasiBreak[g].pcs += itemPcs
      gramasiBreak[g].totalGram += itemPcs * parseFloat(g)
    })

    return {
      bahanMasuk, sisaFisik, totalDikasih, totalDiterima, lossesPeleburan,
      totalSerahProd, totalTerimaProd, rejectCut, lossesCut, stgLosses, stgReject,
      totalSerbuk, totalLosses, totalReject, totalGramasiJadi, efisiensiPersen,
      totalPcsPacked, totalPcsProd, itemCount: items.length,
      statusCount, gramasiBreak,
    }
  }, [data])

  const donutSegments = useMemo(() => {
    if (!stats) return []
    const COLORS: Record<string,string> = {
      'Cutting':'#3B82F6','Pas Berat':'#F97316','Annealing':'#EAB308',
      'Siap Packing':'#A78BFA','Sudah Packing':'#22C55E','Reject':'#EF4444','QC':'#06B6D4','Press Stamp':'#EC4899'
    }
    return Object.entries(stats.statusCount).map(([label, value]) => ({
      label, value: Number(value), color: COLORS[label] ?? '#94A3B8'
    }))
  }, [stats])

  const donutTotal = useMemo(() => donutSegments.reduce((s,seg)=>s+seg.value, 0), [donutSegments])

  return (
    <div className="min-h-screen pb-24" style={{background:'linear-gradient(170deg,#F5F5F7 0%,#EEF0F4 40%,#F5F0FA 100%)'}}>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900 leading-none">Laporan Per Batch</h1>
            <p className="text-sm text-gray-500 mt-1.5 font-medium">Analytics produksi dari bahan baku hingga packing</p>
          </div>
          {data && (
            <button onClick={()=>window.print()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-600 rounded-2xl border border-violet-200 hover:bg-violet-50 active:scale-95 transition-all print:hidden"
              style={{background:'rgba(255,255,255,0.6)',backdropFilter:'blur(10px)'}}>
              <Printer size={14}/> Print Laporan
            </button>
          )}
        </div>

        {/* Selector */}
        <div className="rounded-3xl p-5 print:hidden"
          style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 8px 32px rgba(139,92,246,0.08)'}}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">Pilih Batch</p>
          <div className="relative">
            <select value={selectedKode} onChange={e=>handleSelect(e.target.value)}
              className="w-full appearance-none px-4 py-3.5 pr-10 text-sm font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all cursor-pointer"
              style={{background:'linear-gradient(135deg,rgba(248,246,255,0.9),rgba(255,255,255,0.7))',border:'1px solid rgba(139,92,246,0.18)',color:selectedKode?'#1F2937':'#9CA3AF'}}>
              <option value="">— Pilih batch untuk lihat laporan lengkap —</option>
              {batches.map(b=>(
                <option key={b.kode} value={b.kode}>
                  {b.kode} · {b.nama_batch??'Tanpa Nama'} ({fD(b.tanggal)}) — {b.status?.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none"/>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 rounded-3xl"
            style={{background:'rgba(255,255,255,0.6)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.7)'}}>
            <RefreshCw size={20} className="text-violet-400 animate-spin mr-3"/>
            <span className="text-sm text-gray-400 font-medium">Memuat laporan...</span>
          </div>
        )}

        {/* Report */}
        {data && stats && (
          <>
            {/* Hero Batch Card */}
            <div className="rounded-3xl p-6 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,#8B5CF6 0%,#A78BFA 60%,#C4B5FD 100%)',boxShadow:'0 16px 48px rgba(139,92,246,0.28)'}}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{background:'rgba(255,255,255,0.12)',filter:'blur(20px)'}}/>
              <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full" style={{background:'rgba(255,255,255,0.08)',filter:'blur(30px)'}}/>
              <div className="relative flex items-start justify-between flex-wrap gap-3">
                <div className="text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80 mb-1">BATCH</p>
                  <h2 className="text-3xl font-extrabold leading-none">{data.batch.kode}</h2>
                  <p className="text-base font-semibold opacity-90 mt-1.5">{data.batch.nama_batch??'—'}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs font-medium opacity-90">
                    <span>📅 {fD(data.batch.tanggal)}</span>
                    <span>·</span>
                    <span>🏭 {data.batch.supplier??'—'}</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-full text-white"
                  style={{background:data.batch.status==='aktif'?'rgba(34,197,94,0.9)':data.batch.status==='terkunci'?'rgba(245,158,11,0.9)':'rgba(107,114,128,0.9)',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
                  {data.batch.status?.toUpperCase()}
                </span>
              </div>
              {showHpp && (
                <div className="relative mt-5 pt-4 border-t border-white/15 flex flex-wrap gap-5 text-xs text-white">
                  <div><span className="opacity-70 font-medium">Harga Beli</span><p className="text-sm font-bold mt-0.5">{fRp(data.batch.harga_beli)}</p></div>
                  <div><span className="opacity-70 font-medium">HPP per gram</span><p className="text-sm font-bold mt-0.5">{fRp(data.batch.hpp_gr)}</p></div>
                  <div><span className="opacity-70 font-medium">Total HPP</span><p className="text-sm font-bold mt-0.5">{fRp(data.batch.total_hpp)}</p></div>
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-3xl p-5 col-span-2 lg:col-span-1 relative overflow-hidden"
                style={{background:'linear-gradient(135deg,rgba(34,197,94,0.06),rgba(255,255,255,0.9))',backdropFilter:'blur(20px)',border:'1px solid rgba(34,197,94,0.18)',boxShadow:'0 4px 24px rgba(34,197,94,0.08)'}}>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                    style={{background:'linear-gradient(135deg,#22C55E,#16A34A)',boxShadow:'0 4px 12px rgba(34,197,94,0.3)'}}>
                    <Sparkles size={16} className="text-white"/>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.efisiensiPersen >= 95 ? 'bg-green-100 text-green-700' : stats.efisiensiPersen >= 90 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {stats.efisiensiPersen >= 95 ? '✓ Optimal' : stats.efisiensiPersen >= 90 ? '⚠ OK' : '✗ Rendah'}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Efisiensi Bahan Baku</p>
                <p className="text-[36px] font-extrabold mt-1 leading-none tabular-nums"
                  style={{background:'linear-gradient(135deg,#16A34A,#22C55E)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                  {stats.efisiensiPersen.toFixed(1)}<span className="text-lg">%</span>
                </p>
                <div className="mt-3"><ProgressBar value={stats.efisiensiPersen} max={100} color="#22C55E"/></div>
              </div>

              <div className="rounded-3xl p-5"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-2"
                  style={{background:'linear-gradient(135deg,#3B82F6,#2563EB)',boxShadow:'0 4px 12px rgba(59,130,246,0.25)'}}>
                  <Hammer size={16} className="text-white"/>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Item Produksi</p>
                <p className="text-[28px] font-extrabold mt-1 text-gray-900 leading-none tabular-nums">{fnum(stats.itemCount)}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">{fnum(stats.totalPcsProd)} PCS total</p>
              </div>

              <div className="rounded-3xl p-5"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-2"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 12px rgba(139,92,246,0.25)'}}>
                  <Package2 size={16} className="text-white"/>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">PCS Packed</p>
                <p className="text-[28px] font-extrabold mt-1 text-gray-900 leading-none tabular-nums">{fnum(stats.totalPcsPacked)}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">{stats.totalPcsProd > 0 ? pct(stats.totalPcsPacked, stats.totalPcsProd).toFixed(0) : 0}% dari produksi</p>
              </div>

              <div className="rounded-3xl p-5"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-2"
                  style={{background:'linear-gradient(135deg,#EF4444,#DC2626)',boxShadow:'0 4px 12px rgba(239,68,68,0.25)'}}>
                  <TrendingDown size={16} className="text-white"/>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Total Losses</p>
                <p className="text-[28px] font-extrabold mt-1 text-gray-900 leading-none tabular-nums">{fgr2(stats.totalLosses)}<span className="text-sm font-bold text-gray-400 ml-1">gr</span></p>
                <p className="text-[11px] text-red-500 font-semibold mt-1">{pct(stats.totalLosses, stats.bahanMasuk).toFixed(2)}% dari bahan</p>
              </div>
            </div>

            {/* Donut + Ringkasan */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="rounded-3xl p-6 lg:col-span-2 flex flex-col"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart2 size={14} className="text-violet-500"/>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status Item Produksi</p>
                </div>
                {donutSegments.length > 0 ? (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <DonutChart segments={donutSegments} total={donutTotal} label="Total Item"/>
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-400 italic py-12">Belum ada item produksi</p>
                )}
              </div>

              <div className="rounded-3xl overflow-hidden lg:col-span-3"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{background:'rgba(139,92,246,0.04)',borderBottom:'1px solid rgba(139,92,246,0.08)'}}>
                  <Layers size={14} className="text-violet-500"/>
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Ringkasan Batch</p>
                </div>
                <div className="divide-y" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                  {[
                    {label:'Bahan Baku Masuk',     val:stats.bahanMasuk,             color:'text-gray-800', bold:true,  bg:'rgba(139,92,246,0.03)'},
                    {label:'Diserahkan ke Peleburan',val:stats.totalDikasih,         color:'text-gray-600'},
                    {label:'Diterima dari Peleburan',val:stats.totalDiterima,        color:'text-gray-600'},
                    {label:'Losses Peleburan',    val:stats.lossesPeleburan,       color:'text-orange-500', bold:true},
                    {label:'Total Gramasi Jadi',  val:stats.totalGramasiJadi,      color:'text-blue-600',   bold:true},
                    {label:'Losses Cutting',      val:stats.lossesCut,             color:'text-orange-500'},
                    {label:'Reject Cutting',      val:stats.rejectCut,             color:'text-red-500'},
                    {label:'Total Sisa Serbuk',   val:stats.totalSerbuk,           color:'text-violet-600'},
                    {label:'Losses Tahap Lain',   val:stats.stgLosses,             color:'text-amber-500'},
                    {label:'Reject Tahap Lain',   val:stats.stgReject,             color:'text-red-500'},
                    {label:'Total Losses',        val:stats.totalLosses,           color:'text-red-600',    bold:true, bg:'rgba(239,68,68,0.04)'},
                    {label:'Sisa Bahan Fisik',    val:stats.sisaFisik,             color:'text-gray-700'},
                  ].map(r => (
                    <div key={r.label} className="px-5 py-2.5 flex items-center justify-between" style={{background:r.bg??'transparent'}}>
                      <span className={`text-xs ${r.bold?'font-bold':'font-medium'} ${r.color}`}>{r.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${r.color}`}>{fgr(r.val)} <span className="text-[10px] text-gray-400">gr</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Breakdown per Gramasi */}
            {Object.keys(stats.gramasiBreak).length > 0 && (
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{background:'rgba(139,92,246,0.04)',borderBottom:'1px solid rgba(139,92,246,0.08)'}}>
                  <Package2 size={14} className="text-violet-500"/>
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Breakdown per Gramasi</p>
                </div>
                <div className="p-3 space-y-2">
                  {Object.entries(stats.gramasiBreak)
                    .sort(([a],[b]) => parseFloat(a) - parseFloat(b))
                    .map(([gram, d]) => {
                      const maxGram = Math.max(...Object.values(stats.gramasiBreak).map((x:any)=>x.totalGram))
                      return (
                        <div key={gram} className="rounded-2xl p-3 flex items-center gap-3" style={{background:'rgba(255,255,255,0.6)'}}>
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-extrabold text-xs"
                            style={{background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(167,139,250,0.06))',color:'#8B5CF6',border:'1px solid rgba(139,92,246,0.15)'}}>
                            {gram}gr
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-800">{d.pcs} PCS</span>
                              <span className="text-xs font-bold text-gray-600 tabular-nums">{fgr2(d.totalGram)} gr</span>
                            </div>
                            <ProgressBar value={d.totalGram} max={maxGram} color="#8B5CF6" height={5}/>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-extrabold text-violet-600 tabular-nums">{pct(d.totalGram, stats.totalGramasiJadi).toFixed(1)}%</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
              {([
                {key:'ringkasan', label:'Rincian'},
                {key:'peleburan', label:'Peleburan'},
                {key:'produksi',  label:'Produksi'},
                {key:'packing',   label:'Packing'},
              ] as const).map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className="px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
                  style={tab===t.key
                    ?{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:'0 4px 14px rgba(139,92,246,0.35)'}
                    :{background:'rgba(255,255,255,0.7)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.45)',backdropFilter:'blur(10px)'}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Rincian */}
            {tab==='ringkasan'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{background:'rgba(139,92,246,0.04)',borderBottom:'1px solid rgba(139,92,246,0.08)'}}>
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Rincian Entry Produksi</p>
                  <span className="ml-auto text-[10px] font-bold text-gray-400">{data.produksiItems.length} item</span>
                </div>
                {data.produksiItems.length === 0
                  ? <p className="text-center py-16 text-sm text-gray-400 italic">Belum ada item produksi</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:'rgba(0,0,0,0.015)'}}>
                            {['#','Tanggal','Kode','Gramasi','PCS','Total (gr)','Status','Losses (gr)'].map(h=>(
                              <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.produksiItems.map((item:any, i:number) => {
                            const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at&&h.status==='selesai') : []
                            const stgL = handovers.reduce((s,h:any)=>s+Number(h.losses_gram??0),0)
                            const totalLoss = Number(item.losses_cutting??0) + stgL
                            const SC: Record<string,string> = {
                              'Cutting':'#3B82F6','Pas Berat':'#F97316','Annealing':'#EAB308',
                              'Siap Packing':'#A78BFA','Sudah Packing':'#22C55E','Reject':'#EF4444','QC':'#06B6D4','Press Stamp':'#EC4899'
                            }
                            const dot = SC[item.current_status] ?? '#94A3B8'
                            return (
                              <tr key={item.id} className="border-t hover:bg-violet-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                                <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                                <td className="px-4 py-3 text-gray-600">{fD(item.tanggal_mulai??item.tanggal??item.tanggal_produksi)}</td>
                                <td className="px-4 py-3 font-bold text-violet-600">{item.kode}</td>
                                <td className="px-4 py-3 font-bold text-gray-700">{item.gramasi} gr</td>
                                <td className="px-4 py-3 font-bold text-gray-700 tabular-nums">{item.pcs_good??item.pcs??0}</td>
                                <td className="px-4 py-3 font-mono text-gray-600">{fgr(item.terima_gram??item.serah_gram??item.berat_awal)}</td>
                                <td className="px-4 py-3">
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background:`${dot}18`,color:dot}}>
                                    {item.current_status}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 font-bold tabular-nums ${totalLoss>0?'text-red-500':'text-gray-300'}`}>
                                  {totalLoss>0?fgr(totalLoss):'—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
            )}

            {/* Tab Peleburan */}
            {tab==='peleburan'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{background:'rgba(234,179,8,0.05)',borderBottom:'1px solid rgba(234,179,8,0.1)'}}>
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Riwayat Peleburan</p>
                  <span className="ml-auto text-[10px] font-bold text-gray-400">{data.peleburan.length} lebur</span>
                </div>
                {data.peleburan.length === 0
                  ? <p className="text-center py-16 text-sm text-gray-400 italic">Belum ada peleburan</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:'rgba(0,0,0,0.015)'}}>
                            {['Kode','Tanggal','Status','Operator','Diserahkan','Diterima','Losses','%'].map(h=>(
                              <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.peleburan.map((p:any) => (
                            <tr key={p.id} className="border-t hover:bg-amber-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-4 py-3 font-bold text-amber-600">{p.kode}</td>
                              <td className="px-4 py-3 text-gray-600">{fD(p.tanggal)}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                  {p.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{p.operator??'—'}</td>
                              <td className="px-4 py-3 font-mono text-gray-700">{fgr(p.dikasih_gram)} gr</td>
                              <td className="px-4 py-3 font-mono font-bold text-gray-700">{p.diterima_gram?fgr(p.diterima_gram)+' gr':'—'}</td>
                              <td className="px-4 py-3 font-mono font-bold text-orange-500">{p.losses_gram?fgr(p.losses_gram)+' gr':'—'}</td>
                              <td className="px-4 py-3 font-bold text-orange-500">{p.dikasih_gram&&p.losses_gram?pct(Number(p.losses_gram),Number(p.dikasih_gram)).toFixed(2)+'%':'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
            )}

            {/* Tab Produksi */}
            {tab==='produksi'&&(
              <div className="space-y-3">
                {data.produksiItems.length === 0
                  ? <div className="text-center py-16 rounded-3xl" style={{background:'rgba(255,255,255,0.6)'}}>
                      <p className="text-sm text-gray-400 italic">Belum ada item produksi</p>
                    </div>
                  : data.produksiItems.map((item:any)=>{
                      const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
                      const stgLoss = handovers.filter((h:any)=>h.status==='selesai').reduce((s:number,h:any)=>s+Number(h.losses_gram??0),0)
                      const totalLoss = Number(item.losses_cutting??0) + stgLoss
                      const isExp = expandedItem.has(item.id)
                      const packings: any[] = Array.isArray(item.packing) ? item.packing.filter((p:any)=>!p.voided_at) : (item.packing&&!item.packing.voided_at?[item.packing]:[])
                      const totalPacked = packings.reduce((s:number,p:any)=>s+(Number(p.pcs_dipack??p.pcs??0)),0)

                      const SC: Record<string,string> = {
                        'Cutting':'#3B82F6','Pas Berat':'#F97316','Annealing':'#EAB308',
                        'Siap Packing':'#A78BFA','Sudah Packing':'#22C55E','Reject':'#EF4444'
                      }
                      const dot = SC[item.current_status] ?? '#94A3B8'

                      return (
                        <div key={item.id} className="rounded-2xl overflow-hidden"
                          style={{background:'rgba(255,255,255,0.75)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.8)',borderLeft:`3px solid ${dot}`,boxShadow:'0 2px 12px rgba(0,0,0,0.03)'}}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
                              style={{background:`${dot}15`,color:dot,border:`1px solid ${dot}30`}}>
                              {item.gramasi}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-gray-900">{item.nama_item??item.kode}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${dot}15`,color:dot}}>{item.current_status}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{item.kode} · {item.gramasi}gr × {item.pcs_good??item.pcs??'?'} pcs</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-3 text-xs flex-shrink-0 mr-2">
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px] font-medium uppercase">Serah</p>
                                <p className="font-bold text-gray-700 tabular-nums">{fgr(item.serah_gram??item.berat_awal)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px] font-medium uppercase">Losses</p>
                                <p className={`font-bold tabular-nums ${totalLoss>0?'text-red-500':'text-gray-400'}`}>{totalLoss>0?fgr(totalLoss):'—'}</p>
                              </div>
                              {totalPacked > 0 && (
                                <div className="text-center">
                                  <p className="text-gray-400 text-[9px] font-medium uppercase">Packed</p>
                                  <p className="font-bold text-green-600">{totalPacked}</p>
                                </div>
                              )}
                            </div>
                            <button onClick={()=>setExpandedItem(prev=>{const n=new Set(prev);n.has(item.id)?n.delete(item.id):n.add(item.id);return n})}
                              className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 flex-shrink-0 transition-colors active:scale-95">
                              <ChevronDown size={13} className={`text-gray-500 transition-transform ${isExp?'rotate-180':''}`}/>
                            </button>
                          </div>

                          {isExp && (
                            <div className="px-4 pb-4 pt-2 border-t space-y-2.5" style={{borderColor:'rgba(0,0,0,0.06)',background:'rgba(248,246,255,0.4)'}}>
                              <div className="rounded-xl overflow-hidden border border-blue-100">
                                <div className="px-3 py-2 text-[9px] font-bold text-blue-600 uppercase tracking-wide bg-blue-50/50">🔪 Cutting</div>
                                <div className="grid grid-cols-2 sm:grid-cols-4">
                                  {[
                                    {l:'Serah', v:fgr(item.serah_gram??item.berat_awal)+' gr'},
                                    {l:'Terima', v:item.terima_gram?fgr(item.terima_gram)+' gr':'—'},
                                    {l:'Reject', v:Number(item.reject_cutting_gram??0)>0?fgr(item.reject_cutting_gram)+' gr':'—'},
                                    {l:'Losses', v:Number(item.losses_cutting??0)>0?fgr(item.losses_cutting)+' gr':'—'},
                                  ].map((f,fi)=>(
                                    <div key={f.l} className={`px-3 py-2 ${fi<3?'border-r border-blue-50':''}`}>
                                      <p className="text-[9px] text-gray-400">{f.l}</p>
                                      <p className="text-xs font-bold text-gray-700">{f.v}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {handovers.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-violet-100">
                                  <div className="px-3 py-2 text-[9px] font-bold text-violet-600 uppercase tracking-wide bg-violet-50/50">⛓ Serah-Terima Per Tahap</div>
                                  {handovers.map((h:any)=>{
                                    const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                                    return (
                                      <div key={h.id} className="px-3 py-2 border-t border-violet-50 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                        <div><p className="text-[9px] text-gray-400">Tahap</p><p className="font-bold text-gray-700">{tl[h.tahap]??h.tahap}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Serah</p><p className="font-semibold text-gray-600">{h.serah_gram?fgr(h.serah_gram):'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Terima</p><p className="font-semibold text-gray-600">{h.terima_gram?fgr(h.terima_gram):'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Reject</p><p className={`font-semibold ${Number(h.reject_gram??0)>0?'text-red-500':'text-gray-400'}`}>{Number(h.reject_gram??0)>0?fgr(h.reject_gram):'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Losses</p><p className={`font-semibold ${Number(h.losses_gram??0)>0?'text-orange-500':'text-gray-400'}`}>{Number(h.losses_gram??0)>0?fgr(h.losses_gram):'—'}</p></div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {packings.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-green-100">
                                  <div className="px-3 py-2 text-[9px] font-bold text-green-600 uppercase tracking-wide bg-green-50/50">📦 Packing</div>
                                  {packings.map((pk:any)=>(
                                    <div key={pk.id} className="px-3 py-2 border-t border-green-50 flex items-center gap-3 text-xs">
                                      <span className="font-bold text-gray-700">{pk.kode}</span>
                                      <span className="text-gray-400">{fD(pk.tanggal)}</span>
                                      <span className="font-semibold text-green-600">{pk.pcs_dipack??pk.pcs} PCS</span>
                                      {pk.shieldtag_count>0&&<span className="text-violet-500 font-semibold">{pk.shieldtag_count} Shieldtag</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                }
              </div>
            )}

            {/* Tab Packing */}
            {tab==='packing'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.8)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{background:'rgba(34,197,94,0.04)',borderBottom:'1px solid rgba(34,197,94,0.1)'}}>
                  <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Packing Summary</p>
                </div>
                {(() => {
                  const allPackings = data.produksiItems.flatMap((i:any) => {
                    const pks = Array.isArray(i.packing) ? i.packing.filter((p:any)=>!p.voided_at) : (i.packing&&!i.packing.voided_at?[i.packing]:[])
                    return pks.map((p:any) => ({...p, nama_item: i.nama_item, gramasi_item: i.gramasi}))
                  })
                  if (allPackings.length === 0) return <p className="text-sm text-gray-400 italic text-center py-16">Belum ada packing</p>
                  const totalPcs = allPackings.reduce((s:number,p:any)=>s+(Number(p.pcs_dipack??p.pcs??0)),0)
                  const totalShieldtag = allPackings.reduce((s:number,p:any)=>s+(Number(p.shieldtag_count??0)),0)
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'rgba(0,0,0,0.015)'}}>
                          {['Kode','Nama Item','Gramasi','Tanggal','PCS','Shieldtag','Catatan'].map(h=>(
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {allPackings.map((p:any,i:number)=>(
                            <tr key={p.id??i} className="border-t hover:bg-green-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-4 py-3 font-bold text-green-600">{p.kode}</td>
                              <td className="px-4 py-3 font-semibold text-gray-700">{p.nama_item??'—'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.gramasi_item} gr</td>
                              <td className="px-4 py-3 text-gray-600">{fD(p.tanggal)}</td>
                              <td className="px-4 py-3 font-bold text-gray-700">{p.pcs_dipack??p.pcs??0}</td>
                              <td className="px-4 py-3 font-semibold text-violet-600">{p.shieldtag_count??0}</td>
                              <td className="px-4 py-3 text-gray-400 italic">{p.catatan??'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-green-200 bg-green-50">
                            <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 text-xs uppercase">TOTAL</td>
                            <td className="px-4 py-3 font-extrabold text-gray-700 tabular-nums">{totalPcs} pcs</td>
                            <td className="px-4 py-3 font-extrabold text-violet-600 tabular-nums">{totalShieldtag}</td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {!selectedKode && !loading && (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl"
            style={{background:'rgba(255,255,255,0.5)',backdropFilter:'blur(24px)',border:'1px dashed rgba(139,92,246,0.2)'}}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
              style={{background:'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(167,139,250,0.04))',border:'1px solid rgba(139,92,246,0.1)'}}>
              <FileText size={32} className="text-violet-300"/>
            </div>
            <p className="text-sm font-semibold text-gray-500">Pilih batch untuk lihat laporan lengkap</p>
            <p className="text-xs text-gray-400 mt-1">{batches.length} batch tersedia</p>
          </div>
        )}
      </div>
    </div>
  )
}
