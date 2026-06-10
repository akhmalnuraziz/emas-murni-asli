'use client'
import React, { useState, useCallback } from 'react'
import { fetchBatchReport } from '@/app/(dashboard)/laporan/actions'
import { ChevronDown, Printer, RefreshCw, TrendingDown, Package, Layers, BarChart2, Hammer, Box, Search } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fg  = (v: any, d=3) => v == null ? '—' : Number(v).toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d})
const fp  = (n:any, d:any) => (!n||!d||Number(d)===0) ? '—' : (Number(n)/Number(d)*100).toFixed(1)+'%'
const fD  = (d:any) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const fRp = (v:any) => v==null ? '—' : 'Rp '+Number(v).toLocaleString('id-ID')
const canSeeHpp = (r:string) => ['owner','admin_pusat','accounting'].includes(r)

// ── SVG Donut Chart ───────────────────────────────────────────────────────────
function DonutChart({ slices, total, label }: { slices:{label:string;val:number;color:string}[]; total:number; label:string }) {
  const r = 46; const sw = 14; const circ = 2 * Math.PI * r
  let cum = 0
  const segments = slices.map(s => {
    const len = total > 0 ? (s.val / total) * circ : 0
    const seg = { ...s, offset: cum, len }
    cum += len; return seg
  })
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Track */}
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth={sw}/>
      {segments.filter(s=>s.len>0).map((s,i)=>(
        <circle key={i} cx="60" cy="60" r={r} fill="none"
          stroke={s.color} strokeWidth={sw-2}
          strokeDasharray={`${s.len-1.5} ${circ-s.len+1.5}`}
          strokeDashoffset={circ*0.25 - s.offset}
          strokeLinecap="round"/>
      ))}
      <text x="60" y="55" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1F2937" fontFamily="inherit">{total}</text>
      <text x="60" y="69" textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="inherit">{label}</text>
    </svg>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color, label, sub }: { value:number; max:number; color:string; label:string; sub:string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-bold" style={{color}}>{sub}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(0,0,0,0.06)'}}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{width:`${pct}%`, background:color, boxShadow:`0 0 8px ${color}40`}}/>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent, icon }: { label:string; value:string; sub?:string; accent:string; icon:React.ReactNode }) {
  return (
    <div className="rounded-3xl p-4 flex flex-col justify-between min-h-[110px] overflow-hidden relative"
      style={{background:'rgba(255,255,255,0.75)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -translate-y-4 translate-x-4"
        style={{background:accent}}/>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{background:`${accent}18`}}>
          <div style={{color:accent}}>{icon}</div>
        </div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none" style={{color:accent}}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LaporanClient({ batches, userRole }: { batches:any[]; userRole:string }) {
  const [selectedKode, setSelectedKode] = useState('')
  const [data, setData]                 = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [tab, setTab]                   = useState<'ringkasan'|'peleburan'|'produksi'|'packing'>('ringkasan')
  const [search, setSearch]             = useState('')
  const showHpp = canSeeHpp(userRole)

  const fetchDetail = useCallback(async (kode:string) => {
    if (!kode) return
    setLoading(true); setData(null)
    try {
      const result = await fetchBatchReport(kode)
      if ('error' in result && result.error) return
      setData(result as any); setTab('ringkasan')
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  function handleSelect(kode:string) { setSelectedKode(kode); if(kode) fetchDetail(kode) }

  // ── Computed ────────────────────────────────────────────────────────────────
  const S = data ? (() => {
    const b = data.batch
    const items:any[] = data.produksiItems ?? []
    const pbs:any[]   = data.peleburan   ?? []

    const bahan       = Number(b?.timbangan_akhir ?? b?.bahan_dari_pusat ?? 0)
    const peleburIn   = pbs.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0)
    const peleburOut  = pbs.reduce((s:number,p:any)=>s+Number(p.diterima_gram??0),0)
    const lossLebur   = Math.max(0, peleburIn - peleburOut)

    const lossCutting = items.reduce((s:number,i:any)=>s+Number(i.losses_cutting??0),0)
    const rejCutting  = items.reduce((s:number,i:any)=>s+Number(i.reject_cutting_gram??0),0)
    const lossStage   = items.reduce((s:number,i:any)=>{
      const hs:any[] = Array.isArray(i.stage_handover) ? i.stage_handover.filter((h:any)=>!h.voided_at&&h.status==='selesai') : []
      return s + hs.reduce((a:number,h:any)=>a+Number(h.losses_gram??0),0)
    },0)
    const totalLoss   = lossLebur + lossCutting + lossStage
    const serahTotal  = items.reduce((s:number,i:any)=>s+Number(i.serah_gram??i.berat_awal??0),0)

    // Efisiensi: bahan yg bisa jadi produk / bahan masuk
    const efisiensi   = bahan > 0 ? ((bahan - totalLoss) / bahan * 100) : 0
    const yieldAkhir  = bahan > 0 ? ((bahan - totalLoss) / bahan * 100).toFixed(1) : '—'
    const lossRate    = bahan > 0 ? (totalLoss / bahan * 100).toFixed(1) : '—'

    const packedPcs   = items.reduce((s:number,i:any)=>{
      const pks:any[] = Array.isArray(i.packing) ? i.packing.filter((p:any)=>!p.voided_at) : (i.packing&&!i.packing.voided_at?[i.packing]:[])
      return s + pks.reduce((a:number,p:any)=>a+(Number(p.pcs_dipack??p.pcs??0)),0)
    },0)

    const statusMap:Record<string,{count:number;color:string}> = {
      'Cutting':      {count:0,color:'#3B82F6'},
      'Pas Berat':    {count:0,color:'#F97316'},
      'Annealing':    {count:0,color:'#EAB308'},
      'Siap Packing': {count:0,color:'#8B5CF6'},
      'Sudah Packing':{count:0,color:'#22C55E'},
      'Reject':       {count:0,color:'#EF4444'},
    }
    items.forEach((i:any)=>{
      if (statusMap[i.current_status]) statusMap[i.current_status].count++
      else statusMap[i.current_status] = {count:1, color:'#94A3B8'}
    })

    // Gramasi breakdown
    const gramasiMap:Record<string,{jml_pcs:number;total_gram:number}> = {}
    items.forEach((i:any)=>{
      const g = String(i.gramasi??'?')
      if (!gramasiMap[g]) gramasiMap[g] = {jml_pcs:0,total_gram:0}
      gramasiMap[g].jml_pcs += (i.pcs_good??i.pcs??0)
      gramasiMap[g].total_gram += Number(i.terima_gram??i.total_gram??0)
    })

    const gramasiTotalPcs  = Object.values(gramasiMap).reduce((s,d)=>s+d.jml_pcs, 0)
    const gramasiTotalGram = Object.values(gramasiMap).reduce((s,d)=>s+d.total_gram, 0)
    return { bahan, peleburIn, peleburOut, lossLebur, lossCutting, rejCutting, lossStage, totalLoss,
             serahTotal, efisiensi, yieldAkhir, lossRate, packedPcs, statusMap, gramasiMap,
             gramasiTotalPcs, gramasiTotalGram,
             itemCount: items.length, peleburanCount: pbs.length }
  })() : null

  const TABS = [
    {key:'ringkasan',label:'📊 Ringkasan'},
    {key:'peleburan',label:'🔥 Peleburan'},
    {key:'produksi', label:'🔪 Produksi'},
    {key:'packing',  label:'📦 Packing'},
  ] as const

  const filteredItems = (data?.produksiItems??[]).filter((i:any)=>{
    if (!search) return true
    const q = search.toLowerCase()
    return i.kode?.toLowerCase().includes(q)||i.nama_item?.toLowerCase().includes(q)||String(i.gramasi).includes(q)
  })

  return (
    <div className="min-h-screen pb-28" style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Laporan Batch</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">Rekonsiliasi & analitik produksi per batch</p>
          </div>
          {data && (
            <button onClick={()=>window.print()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all hover:opacity-80 print:hidden"
              style={{background:'rgba(139,92,246,0.1)',color:'#7C3AED',border:'1px solid rgba(139,92,246,0.2)'}}>
              <Printer size={14}/> Print
            </button>
          )}
        </div>

        {/* ── Batch Selector ──────────────────────────────────────────────── */}
        <div className="rounded-3xl p-4"
          style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(139,92,246,0.06)'}}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Pilih Batch</p>
          <div className="relative">
            <select value={selectedKode} onChange={e=>handleSelect(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-3.5 text-sm font-bold rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
              style={{background:'rgba(248,246,255,0.9)',border:'1px solid rgba(139,92,246,0.2)',color:selectedKode?'#1F2937':'#9CA3AF'}}>
              <option value="">— Pilih batch untuk melihat laporan —</option>
              {batches.map(b=>(
                <option key={b.kode} value={b.kode}>
                  {b.kode} · {b.nama_batch??'Tanpa Nama'} · {fD(b.tanggal)} · {b.status?.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none"/>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20 rounded-3xl"
            style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.5)'}}>
            <RefreshCw size={20} className="text-violet-400 animate-spin mr-3"/>
            <span className="text-sm text-gray-400 font-medium">Memuat data laporan...</span>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {data && S && (
          <>
            {/* Batch identity card */}
            <div className="rounded-3xl p-5"
              style={{background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(167,139,250,0.06))',border:'1px solid rgba(139,92,246,0.18)'}}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Laporan Batch</p>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{data.batch.kode}</h2>
                  <p className="text-sm font-semibold text-violet-600 mt-0.5">{data.batch.nama_batch??'—'}</p>
                  <p className="text-xs text-gray-400 mt-1.5 flex flex-wrap gap-3">
                    <span>📅 {fD(data.batch.tanggal)}</span>
                    {data.batch.supplier && <span>🏭 {data.batch.supplier}</span>}
                    <span>⚖️ {fg(data.batch.timbangan_akhir??data.batch.bahan_dari_pusat)} gr masuk</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.batch.status==='aktif'?'bg-green-100 text-green-700':data.batch.status==='terkunci'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>
                    {data.batch.status?.toUpperCase()}
                  </span>
                  {showHpp && data.batch.hpp_gr && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">
                      HPP {fRp(data.batch.hpp_gr)}/gr
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <KPICard label="Efisiensi Bahan"
                value={`${S.efisiensi.toFixed(1)}%`}
                sub={`Losses ${S.lossRate} dari ${fg(S.bahan)} gr`}
                accent="#22C55E"
                icon={<TrendingDown size={14}/>}/>
              <KPICard label="Total Losses"
                value={`${fg(S.totalLoss)} gr`}
                sub={`${fp(S.totalLoss,S.bahan)} dari bahan masuk`}
                accent="#EF4444"
                icon={<BarChart2 size={14}/>}/>
              <KPICard label="Item Produksi"
                value={String(S.itemCount)}
                sub={`${S.peleburanCount} peleburan`}
                accent="#8B5CF6"
                icon={<Hammer size={14}/>}/>
              <KPICard label="PCS Packed"
                value={String(S.packedPcs)}
                sub="Sudah di-packing"
                accent="#3B82F6"
                icon={<Box size={14}/>}/>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                  style={tab===t.key
                    ?{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:'0 4px 16px rgba(139,92,246,0.35)'}
                    :{background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══ TAB RINGKASAN ═════════════════════════════════════════════ */}
            {tab==='ringkasan'&&(
              <div className="space-y-4">

                {/* Donut + Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Donut chart */}
                  <div className="rounded-3xl p-5"
                    style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Distribusi Status Produksi</p>
                    <div className="flex items-center gap-5">
                      <div className="w-32 h-32 flex-shrink-0">
                        <DonutChart
                          slices={Object.entries(S.statusMap).filter(([,v])=>v.count>0).map(([label,v])=>({label,val:v.count,color:v.color}))}
                          total={S.itemCount}
                          label="ITEM"/>
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        {Object.entries(S.statusMap).filter(([,v])=>v.count>0).map(([status,v])=>(
                          <div key={status} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:v.color}}/>
                            <p className="text-xs text-gray-600 flex-1 truncate font-medium">{status}</p>
                            <p className="text-xs font-bold" style={{color:v.color}}>{v.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Losses breakdown */}
                  <div className="rounded-3xl p-5"
                    style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Breakdown Losses</p>
                    <div className="space-y-4">
                      <ProgressBar
                        value={S.lossLebur} max={S.bahan}
                        color="#F59E0B"
                        label="Losses Peleburan"
                        sub={`${fg(S.lossLebur)} gr (${fp(S.lossLebur,S.bahan)})`}/>
                      <ProgressBar
                        value={S.lossCutting} max={S.bahan}
                        color="#F97316"
                        label="Losses Cutting"
                        sub={`${fg(S.lossCutting)} gr (${fp(S.lossCutting,S.bahan)})`}/>
                      <ProgressBar
                        value={S.rejCutting} max={S.bahan}
                        color="#EF4444"
                        label="Reject Cutting"
                        sub={`${fg(S.rejCutting)} gr (${fp(S.rejCutting,S.bahan)})`}/>
                      <ProgressBar
                        value={S.lossStage} max={S.bahan}
                        color="#8B5CF6"
                        label="Losses Tahap Lain"
                        sub={`${fg(S.lossStage)} gr (${fp(S.lossStage,S.bahan)})`}/>
                    </div>
                    {/* Total */}
                    <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{borderColor:'rgba(0,0,0,0.06)'}}>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Losses</p>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-red-600">{fg(S.totalLoss)} gr</p>
                        <p className="text-[10px] text-gray-400">{fp(S.totalLoss,S.bahan)} dari bahan masuk</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rekonsiliasi Bahan */}
                <div className="rounded-3xl overflow-hidden"
                  style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                  <div className="px-5 py-3.5 border-b flex items-center gap-2"
                    style={{background:'rgba(139,92,246,0.05)',borderColor:'rgba(139,92,246,0.1)'}}>
                    <div className="w-1.5 h-4 rounded-full" style={{background:'#8B5CF6'}}/>
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Rekonsiliasi Bahan Baku</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{background:'rgba(0,0,0,0.015)'}}>
                          <th className="px-5 py-3 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide">Keterangan</th>
                          <th className="px-5 py-3 text-right font-bold text-gray-400 text-[10px] uppercase tracking-wide">Gram</th>
                          <th className="px-5 py-3 text-right font-bold text-gray-400 text-[10px] uppercase tracking-wide">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {k:'Bahan Masuk (Timbangan Gudang)',         v:S.bahan,                     pct:'100%',         style:'font-bold text-violet-700 bg-violet-50/50'},
                          {k:'  → Diserahkan ke Peleburan',            v:S.peleburIn,                 pct:fp(S.peleburIn,S.bahan),  style:'text-gray-600'},
                          {k:'  → Diterima dari Peleburan',            v:S.peleburOut,                pct:fp(S.peleburOut,S.bahan), style:'text-gray-600'},
                          {k:'  → Losses Peleburan',                   v:S.lossLebur,                 pct:fp(S.lossLebur,S.bahan),  style:'text-amber-600 font-semibold'},
                          {k:'Digunakan Produksi (Serah Cutting)',      v:S.serahTotal,                pct:fp(S.serahTotal,S.bahan), style:'text-blue-600 font-semibold'},
                          {k:'  → Losses Cutting',                     v:S.lossCutting,               pct:fp(S.lossCutting,S.bahan),style:'text-orange-500 font-semibold'},
                          {k:'  → Reject Cutting',                     v:S.rejCutting,                pct:fp(S.rejCutting,S.bahan), style:'text-red-500 font-semibold'},
                          {k:'  → Losses Tahap Lain (Pas Berat, dst)', v:S.lossStage,                 pct:fp(S.lossStage,S.bahan),  style:'text-purple-500 font-semibold'},
                          {k:'TOTAL LOSSES',                           v:S.totalLoss,                 pct:fp(S.totalLoss,S.bahan),  style:'font-extrabold text-red-600 bg-red-50'},
                          {k:'ESTIMASI HASIL BERSIH',                  v:S.bahan-S.totalLoss,         pct:`${S.efisiensi.toFixed(1)}%`, style:'font-extrabold text-green-700 bg-green-50'},
                        ].map((row,i)=>(
                          <tr key={i} className={`border-t text-xs ${row.style}`}
                            style={{borderColor:'rgba(0,0,0,0.04)'}}>
                            <td className={`px-5 py-3 ${row.style}`}>{row.k}</td>
                            <td className={`px-5 py-3 text-right font-mono ${row.style}`}>{fg(row.v)} gr</td>
                            <td className={`px-5 py-3 text-right ${row.style}`}>{row.pct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Breakdown per Gramasi */}
                {Object.keys(S.gramasiMap).length > 0 && (
                  <div className="rounded-3xl overflow-hidden"
                    style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                    <div className="px-5 py-3.5 border-b flex items-center gap-2"
                      style={{background:'rgba(59,130,246,0.05)',borderColor:'rgba(59,130,246,0.1)'}}>
                      <div className="w-1.5 h-4 rounded-full" style={{background:'#3B82F6'}}/>
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Breakdown per Gramasi</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'rgba(0,0,0,0.015)'}}>
                          {['Gramasi','Jml PCS','Total Gram','% dari Batch'].map(h=>(
                            <th key={h} className="px-5 py-3 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {Object.entries(S.gramasiMap)
                            .sort(([a],[b])=>Number(b)-Number(a))
                            .map(([gramasi,d]:any)=>(
                            <tr key={gramasi} className="border-t hover:bg-blue-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-5 py-3 font-bold text-gray-800">{gramasi} gr</td>
                              <td className="px-5 py-3 font-semibold text-gray-700">{d.jml_pcs} pcs</td>
                              <td className="px-5 py-3 font-mono text-gray-700">{fg(d.total_gram)} gr</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[80px]" style={{background:'rgba(0,0,0,0.06)'}}>
                                    <div className="h-full rounded-full" style={{width:S.bahan>0?`${Math.min(100,d.total_gram/S.bahan*100)}%`:'0%',background:'#3B82F6'}}/>
                                  </div>
                                  <span className="text-[11px] font-semibold text-blue-600">{fp(d.total_gram,S.bahan)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2" style={{borderColor:'rgba(59,130,246,0.2)',background:'rgba(59,130,246,0.03)'}}>
                            <td className="px-5 py-3 font-extrabold text-gray-700 text-[11px] uppercase">Total</td>
                            <td className="px-5 py-3 font-extrabold text-gray-700">{S.gramasiTotalPcs} pcs</td>
                            <td className="px-5 py-3 font-mono font-extrabold text-gray-700">{fg(S.gramasiTotalGram)} gr</td>
                            <td className="px-5 py-3 font-bold text-blue-600">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB PELEBURAN ═════════════════════════════════════════════ */}
            {tab==='peleburan'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3.5 border-b flex items-center gap-2"
                  style={{background:'rgba(245,158,11,0.06)',borderColor:'rgba(245,158,11,0.15)'}}>
                  <div className="w-1.5 h-4 rounded-full" style={{background:'#F59E0B'}}/>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Riwayat Peleburan ({data.peleburan.length} lebur)</p>
                </div>
                {data.peleburan.length === 0
                  ? <p className="text-sm text-gray-400 italic text-center py-14">Belum ada peleburan</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'rgba(0,0,0,0.015)'}}>
                          {['Kode','Tanggal','Status','Operator','Diserahkan (gr)','Diterima (gr)','Losses (gr)','Losses %'].map(h=>(
                            <th key={h} className="px-4 py-3 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {data.peleburan.map((p:any)=>(
                            <tr key={p.id} className="border-t hover:bg-amber-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-4 py-3 font-bold text-amber-600">{p.kode}</td>
                              <td className="px-4 py-3 text-gray-500">{fD(p.tanggal)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                  {p.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500">{p.operator??'—'}</td>
                              <td className="px-4 py-3 font-mono text-gray-700">{fg(p.dikasih_gram)}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-gray-800">{p.diterima_gram?fg(p.diterima_gram):'—'}</td>
                              <td className="px-4 py-3 font-mono font-bold text-orange-500">{p.losses_gram?fg(p.losses_gram):'—'}</td>
                              <td className="px-4 py-3 font-semibold text-orange-400">{fp(p.losses_gram,p.dikasih_gram)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2" style={{borderColor:'rgba(245,158,11,0.25)',background:'rgba(245,158,11,0.04)'}}>
                            <td colSpan={4} className="px-4 py-3 font-extrabold text-gray-600 text-[11px] uppercase">Total</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-gray-700">{fg(data.peleburan.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0))}</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-gray-700">{fg(data.peleburan.reduce((s:number,p:any)=>s+Number(p.diterima_gram??0),0))}</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-orange-600">{fg(S.lossLebur)}</td>
                            <td className="px-4 py-3 font-extrabold text-orange-600">{fp(S.lossLebur,S.bahan)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                }
              </div>
            )}

            {/* ══ TAB PRODUKSI ══════════════════════════════════════════════ */}
            {tab==='produksi'&&(
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Cari kode, nama, gramasi..."
                    className="w-full pl-9 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
                    style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(209,213,219,0.4)'}}/>
                </div>
                {filteredItems.length === 0
                  ? <p className="text-sm text-gray-400 italic text-center py-12">Belum ada item produksi</p>
                  : filteredItems.map((item:any) => {
                      const hs:any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
                      const stgLoss = hs.filter((h:any)=>h.status==='selesai').reduce((s:number,h:any)=>s+Number(h.losses_gram??0),0)
                      const totalL  = Number(item.losses_cutting??0) + stgLoss
                      const pks:any[] = Array.isArray(item.packing) ? item.packing.filter((p:any)=>!p.voided_at) : (item.packing&&!item.packing.voided_at?[item.packing]:[])
                      const packed = pks.reduce((s:number,p:any)=>s+(Number(p.pcs_dipack??p.pcs??0)),0)
                      const STATUS_DOT:Record<string,string> = {
                        'Cutting':'#3B82F6','Pas Berat':'#F97316','Annealing':'#EAB308',
                        'Siap Packing':'#8B5CF6','Sudah Packing':'#22C55E','Reject':'#EF4444'
                      }
                      const dot = STATUS_DOT[item.current_status] ?? '#9CA3AF'

                      return (
                        <div key={item.id} className="rounded-2xl overflow-hidden"
                          style={{background:'rgba(255,255,255,0.85)',border:'1px solid rgba(209,213,219,0.3)',borderLeft:`3px solid ${dot}`}}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-extrabold"
                              style={{background:`${dot}18`,color:dot}}>{item.gramasi}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-gray-900 truncate">{item.nama_item??item.kode}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${dot}18`,color:dot}}>{item.current_status}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{item.kode} · {item.gramasi}gr × {item.pcs_good??item.pcs??'?'} pcs = {fg(item.total_gram)} gr</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-4 text-xs flex-shrink-0">
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px]">Serah</p>
                                <p className="font-bold text-gray-700">{fg(item.serah_gram??item.berat_awal)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px]">Losses</p>
                                <p className={`font-bold ${totalL>0?'text-red-500':'text-gray-300'}`}>{totalL>0?fg(totalL)+' gr':'—'}</p>
                              </div>
                              {packed>0&&<div className="text-center">
                                <p className="text-gray-400 text-[9px]">Packed</p>
                                <p className="font-bold text-green-600">{packed} pcs</p>
                              </div>}
                            </div>
                          </div>
                          {/* Stage handover inline */}
                          {hs.length>0&&(
                            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {hs.sort((a:any,b:any)=>['pas_berat','annealing','siap_packing'].indexOf(a.tahap)-['pas_berat','annealing','siap_packing'].indexOf(b.tahap)).map((h:any)=>{
                                const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                                const tc:Record<string,string>={pas_berat:'#F97316',annealing:'#EAB308',siap_packing:'#8B5CF6'}
                                return (
                                  <div key={h.id} className="rounded-xl p-2.5 text-xs"
                                    style={{background:`${tc[h.tahap]??'#8B5CF6'}08`,border:`1px solid ${tc[h.tahap]??'#8B5CF6'}20`}}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{background:tc[h.tahap]}}/>
                                      <p className="font-bold text-gray-600 text-[10px]">{tl[h.tahap]??h.tahap}</p>
                                      {h.status==='selesai'&&<span className="text-green-600 text-[9px] font-bold ml-auto">✓</span>}
                                    </div>
                                    <p className="font-semibold text-gray-700">{h.serah_gram?fg(h.serah_gram)+' gr':'—'} → {h.terima_gram?fg(h.terima_gram)+' gr':'⏳'}</p>
                                    {Number(h.losses_gram??0)>0&&<p className="text-orange-500 font-bold text-[10px] mt-0.5">losses {fg(h.losses_gram)} gr</p>}
                                    {Number(h.reject_gram??0)>0&&<p className="text-red-500 font-semibold text-[10px]">reject {fg(h.reject_gram)} gr</p>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                }
              </div>
            )}

            {/* ══ TAB PACKING ═══════════════════════════════════════════════ */}
            {tab==='packing'&&(()=>{
              const allPk = data.produksiItems.flatMap((i:any)=>{
                const pks = Array.isArray(i.packing)?i.packing.filter((p:any)=>!p.voided_at):(i.packing&&!i.packing.voided_at?[i.packing]:[])
                return pks.map((p:any)=>({...p,nama_item:i.nama_item,gramasi:i.gramasi}))
              })
              const totPcs = allPk.reduce((s:number,p:any)=>s+Number(p.pcs_dipack??p.pcs??0),0)
              const totSt  = allPk.reduce((s:number,p:any)=>s+Number(p.shieldtag_count??0),0)
              return (
                <div className="rounded-3xl overflow-hidden"
                  style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                  <div className="px-5 py-3.5 border-b flex items-center gap-2"
                    style={{background:'rgba(34,197,94,0.05)',borderColor:'rgba(34,197,94,0.15)'}}>
                    <div className="w-1.5 h-4 rounded-full" style={{background:'#22C55E'}}/>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Packing Summary · {allPk.length} log · {totPcs} pcs</p>
                  </div>
                  {allPk.length===0
                    ? <p className="text-sm text-gray-400 italic text-center py-14">Belum ada packing</p>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr style={{background:'rgba(0,0,0,0.015)'}}>
                            {['Kode','Nama Item','Gramasi','Tanggal','PCS','Shieldtag','Catatan'].map(h=>(
                              <th key={h} className="px-4 py-3 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {allPk.map((p:any,i:number)=>(
                              <tr key={p.id??i} className="border-t hover:bg-green-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                                <td className="px-4 py-3 font-bold text-green-600">{p.kode}</td>
                                <td className="px-4 py-3 font-semibold text-gray-700">{p.nama_item??'—'}</td>
                                <td className="px-4 py-3 text-gray-500">{p.gramasi} gr</td>
                                <td className="px-4 py-3 text-gray-500">{fD(p.tanggal)}</td>
                                <td className="px-4 py-3 font-bold text-gray-800">{p.pcs_dipack??p.pcs??0} pcs</td>
                                <td className="px-4 py-3 font-bold text-violet-600">{p.shieldtag_count??0}</td>
                                <td className="px-4 py-3 text-gray-400 italic">{p.catatan??'—'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2" style={{borderColor:'rgba(34,197,94,0.25)',background:'rgba(34,197,94,0.04)'}}>
                              <td colSpan={4} className="px-4 py-3 font-extrabold text-gray-600 text-[11px] uppercase">Total</td>
                              <td className="px-4 py-3 font-extrabold text-gray-800">{totPcs} pcs</td>
                              <td className="px-4 py-3 font-extrabold text-violet-600">{totSt}</td>
                              <td/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                  }
                </div>
              )
            })()}
          </>
        )}

        {/* Empty state */}
        {!selectedKode && !loading && (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl"
            style={{background:'rgba(255,255,255,0.5)',backdropFilter:'blur(20px)',border:'1px dashed rgba(139,92,246,0.2)'}}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
              style={{background:'rgba(139,92,246,0.08)'}}>
              <BarChart2 size={28} className="text-violet-300"/>
            </div>
            <p className="text-sm font-semibold text-gray-400">Pilih batch di atas untuk melihat laporan</p>
            <p className="text-xs text-gray-300 mt-1">{batches.length} batch tersedia</p>
          </div>
        )}
      </div>
    </div>
  )
}
