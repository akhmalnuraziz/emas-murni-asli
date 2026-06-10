'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, ChevronDown, Package, Layers, BarChart2, Printer, RefreshCw, TrendingDown, CheckCircle, Clock, AlertTriangle, Hammer, Box } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fgr  = (v: any) => v == null ? '—' : Number(v).toLocaleString('id-ID',{minimumFractionDigits:3,maximumFractionDigits:3})
const fRp  = (v: any) => v == null ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID')
const fD   = (d: any) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const fPct = (a: any, b: any) => (!a || !b || Number(b) === 0) ? '—' : (Number(a)/Number(b)*100).toFixed(1)+'%'

interface Props {
  batches: any[]
  userRole: string
  userName: string
}

const canSeeHpp = (role: string) => ['owner','admin_pusat','accounting'].includes(role)

export default function LaporanClient({ batches, userRole }: Props) {
  const [selectedKode, setSelectedKode] = useState<string>('')
  const [data, setData]                 = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [tab, setTab]                   = useState<'ringkasan'|'peleburan'|'produksi'|'packing'>('ringkasan')
  const [expandedItem, setExpandedItem] = useState<Set<number>>(new Set())
  const showHpp = canSeeHpp(userRole)

  const fetchDetail = useCallback(async (kode: string) => {
    if (!kode) return
    setLoading(true)
    try {
      const supabase = createClient()
      const [
        { data: batch },
        { data: peleburan },
        { data: produksiItems },
      ] = await Promise.all([
        supabase.from('batch').select('*').eq('kode', kode).single(),
        supabase.from('peleburan').select('*').eq('batch_kode', kode).is('voided_at', null).order('created_at'),
        supabase.from('produksi_item')
          .select('*, produksi_event(*), packing!left(*), stage_handover(*)')
          .eq('batch_kode', kode)
          .is('voided_at', null)
          .order('created_at'),
      ])
      setData({ batch, peleburan: peleburan??[], produksiItems: produksiItems??[] })
      setTab('ringkasan')
    } finally { setLoading(false) }
  }, [])

  function handleSelect(kode: string) {
    setSelectedKode(kode)
    setData(null)
    if (kode) fetchDetail(kode)
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = data ? (() => {
    const b    = data.batch
    const items: any[] = data.produksiItems ?? []
    const pbs: any[]   = data.peleburan ?? []

    const totalBahan       = Number(b?.timbangan_akhir ?? b?.bahan_dari_pusat ?? 0)
    const totalDikasih     = pbs.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0)
    const totalDiterima    = pbs.reduce((s:number,p:any)=>s+Number(p.diterima_gram??0),0)
    const totalLebur       = totalDikasih - totalDiterima

    const totalSerahProd   = items.reduce((s:number,i:any)=>s+Number(i.serah_gram??i.berat_awal??0),0)
    const totalTerimaProd  = items.reduce((s:number,i:any)=>s+Number(i.terima_gram??0),0)
    const totalRejectCut   = items.reduce((s:number,i:any)=>s+Number(i.reject_cutting_gram??0),0)
    const totalLossCut     = items.reduce((s:number,i:any)=>s+Number(i.losses_cutting??0),0)

    const totalStgLosses   = items.reduce((s:number,i:any)=>{
      const hs: any[] = Array.isArray(i.stage_handover) ? i.stage_handover.filter((h:any)=>!h.voided_at&&h.status==='selesai') : []
      return s + hs.reduce((a:number,h:any)=>a+Number(h.losses_gram??0),0)
    },0)

    const totalLossesAll   = totalLebur + totalLossCut + totalStgLosses
    const yieldPct         = totalBahan > 0 ? ((totalBahan - totalLossesAll) / totalBahan * 100).toFixed(2) : '—'

    const totalPacking     = items.reduce((s:number,i:any)=>{
      const p: any[] = Array.isArray(i.packing) ? i.packing.filter((p:any)=>!p.voided_at) : (i.packing&&!i.packing.voided_at?[i.packing]:[])
      return s + p.reduce((a:number,pk:any)=>a+(Number(pk.pcs_dipack??pk.pcs??0)),0)
    },0)

    const statusCount: Record<string,number> = {}
    items.forEach((i:any) => { statusCount[i.current_status] = (statusCount[i.current_status]||0)+1 })

    return { totalBahan, totalDikasih, totalDiterima, totalLebur, totalSerahProd, totalTerimaProd,
             totalRejectCut, totalLossCut, totalStgLosses, totalLossesAll, yieldPct, totalPacking,
             statusCount, itemCount: items.length }
  })() : null

  return (
    <div className="min-h-screen pb-24" style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Laporan Per Batch</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">Rekonsiliasi lengkap bahan baku → produksi → packing</p>
          </div>
          {data && (
            <button onClick={()=>window.print()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-600 rounded-2xl border border-violet-200 hover:bg-violet-50 transition-colors print:hidden">
              <Printer size={14}/> Print
            </button>
          )}
        </div>

        {/* ── Batch Selector ──────────────────────────────────────────────── */}
        <div className="rounded-3xl p-5 print:hidden"
          style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(139,92,246,0.06)'}}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pilih Batch</p>
          <div className="relative">
            <select value={selectedKode} onChange={e=>handleSelect(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 text-sm font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
              style={{background:'rgba(248,246,255,0.8)',border:'1px solid rgba(139,92,246,0.2)',color:selectedKode?'#1F2937':'#9CA3AF'}}>
              <option value="">-- Pilih batch untuk lihat laporan --</option>
              {batches.map(b=>(
                <option key={b.kode} value={b.kode}>
                  {b.kode} — {b.nama_batch??'Tanpa Nama'} ({fD(b.tanggal)}) [{b.status}]
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none"/>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20 rounded-3xl"
            style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)'}}>
            <RefreshCw size={20} className="text-violet-400 animate-spin mr-3"/>
            <span className="text-sm text-gray-400 font-medium">Memuat laporan...</span>
          </div>
        )}

        {/* ── Report ─────────────────────────────────────────────────────── */}
        {data && stats && (
          <>
            {/* Batch header info */}
            <div className="rounded-3xl p-5"
              style={{background:'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(167,139,250,0.06))',border:'1px solid rgba(139,92,246,0.15)'}}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">{data.batch.kode}</h2>
                  <p className="text-sm font-semibold text-violet-600 mt-0.5">{data.batch.nama_batch??'—'}</p>
                  <p className="text-xs text-gray-400 mt-1">Supplier: {data.batch.supplier??'—'} · Tanggal: {fD(data.batch.tanggal)}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.batch.status==='aktif'?'bg-green-100 text-green-700':data.batch.status==='terkunci'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>
                  {data.batch.status?.toUpperCase()}
                </span>
              </div>
              {showHpp && (
                <div className="mt-3 pt-3 border-t border-violet-100 flex flex-wrap gap-4 text-xs">
                  <div><span className="text-gray-400">Harga Beli: </span><span className="font-bold text-gray-700">{fRp(data.batch.harga_beli)}</span></div>
                  <div><span className="text-gray-400">HPP/gr: </span><span className="font-bold text-violet-600">{fRp(data.batch.hpp_gr)}</span></div>
                  <div><span className="text-gray-400">Total HPP: </span><span className="font-bold text-gray-700">{fRp(data.batch.total_hpp)}</span></div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
              {([
                {key:'ringkasan',   label:'📊 Ringkasan',     icon:BarChart2},
                {key:'peleburan',   label:'🔥 Peleburan',     icon:Layers},
                {key:'produksi',    label:'🔪 Produksi',      icon:Hammer},
                {key:'packing',     label:'📦 Packing',       icon:Box},
              ] as const).map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                  style={tab===t.key
                    ?{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:'0 4px 12px rgba(139,92,246,0.35)'}
                    :{background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Ringkasan ──────────────────────────────────────────── */}
            {tab==='ringkasan'&&(
              <div className="space-y-4">
                {/* Key stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    {label:'Bahan Masuk',    val:fgr(stats.totalBahan)+' gr',          color:'#8B5CF6'},
                    {label:'Yield Bersih',   val:stats.yieldPct,                         color:'#22C55E'},
                    {label:'Total Losses',   val:fgr(stats.totalLossesAll)+' gr',       color:'#EF4444'},
                    {label:'Total Item Prod',val:String(stats.itemCount)+' item',        color:'#3B82F6'},
                  ].map(s=>(
                    <div key={s.label} className="rounded-2xl px-4 py-3"
                      style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 2px 12px rgba(0,0,0,0.04)'}}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</p>
                      <p className="text-lg font-extrabold mt-0.5" style={{color:s.color}}>{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Rekonsiliasi bahan */}
                <div className="rounded-3xl overflow-hidden"
                  style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                  <div className="px-5 py-3 border-b" style={{background:'rgba(139,92,246,0.05)',borderColor:'rgba(139,92,246,0.1)'}}>
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">📋 Rekonsiliasi Bahan Baku</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{background:'rgba(0,0,0,0.02)'}}>
                          {['Keterangan','Gram','Persentase'].map(h=>(
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {label:'Bahan Masuk (Timbangan Gudang)',  val:stats.totalBahan,      pct:null,      style:'font-bold text-gray-800'},
                          {label:'→ Diserahkan ke Peleburan',        val:stats.totalDikasih,    pct:fPct(stats.totalDikasih,stats.totalBahan), style:'text-gray-600'},
                          {label:'→ Diterima dari Peleburan',        val:stats.totalDiterima,   pct:fPct(stats.totalDiterima,stats.totalBahan), style:'text-gray-600'},
                          {label:'Losses Peleburan',                 val:stats.totalLebur,      pct:fPct(stats.totalLebur,stats.totalBahan), style:'text-orange-500 font-semibold'},
                          {label:'Losses Cutting',                   val:stats.totalLossCut,    pct:fPct(stats.totalLossCut,stats.totalBahan), style:'text-orange-500 font-semibold'},
                          {label:'Reject Cutting',                   val:stats.totalRejectCut,  pct:fPct(stats.totalRejectCut,stats.totalBahan), style:'text-red-500 font-semibold'},
                          {label:'Losses Tahap Lain (Pas Berat dst)',val:stats.totalStgLosses,  pct:fPct(stats.totalStgLosses,stats.totalBahan), style:'text-amber-500 font-semibold'},
                          {label:'TOTAL LOSSES KESELURUHAN',         val:stats.totalLossesAll,  pct:fPct(stats.totalLossesAll,stats.totalBahan), style:'font-extrabold text-red-600'},
                          {label:'Siap Packing (estimasi)',          val:stats.totalBahan-stats.totalLossesAll, pct:stats.yieldPct, style:'font-bold text-green-600'},
                        ].map((row,i)=>(
                          <tr key={i} className={`border-t ${row.style?.includes('extrabold')?'bg-red-50':i===0?'bg-violet-50/50':''}`}
                            style={{borderColor:'rgba(0,0,0,0.04)'}}>
                            <td className={`px-4 py-2.5 ${row.style}`}>{row.label}</td>
                            <td className={`px-4 py-2.5 font-mono ${row.style}`}>{fgr(row.val)} gr</td>
                            <td className={`px-4 py-2.5 ${row.style}`}>{row.pct??'100%'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status produksi breakdown */}
                {Object.keys(stats.statusCount).length > 0 && (
                  <div className="rounded-3xl overflow-hidden"
                    style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)'}}>
                    <div className="px-5 py-3 border-b" style={{background:'rgba(139,92,246,0.05)',borderColor:'rgba(139,92,246,0.1)'}}>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">📊 Status Item Produksi</p>
                    </div>
                    <div className="flex flex-wrap gap-2 p-4">
                      {Object.entries(stats.statusCount).map(([status, count])=>(
                        <div key={status} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.06)'}}>
                          <span className="text-xs font-bold text-gray-600">{status}</span>
                          <span className="text-xs font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{String(count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Peleburan ──────────────────────────────────────────── */}
            {tab==='peleburan'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3 border-b" style={{background:'rgba(234,179,8,0.06)',borderColor:'rgba(234,179,8,0.15)'}}>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">🔥 Riwayat Peleburan ({data.peleburan.length} lebur)</p>
                </div>
                {data.peleburan.length === 0
                  ? <p className="text-sm text-gray-400 italic text-center py-12">Belum ada peleburan</p>
                  : <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:'rgba(0,0,0,0.02)'}}>
                            {['Kode','Tanggal','Status','Operator','Diserahkan (gr)','Diterima (gr)','Losses (gr)','Losses %'].map(h=>(
                              <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.peleburan.map((p:any, i:number)=>(
                            <tr key={p.id} className="border-t hover:bg-violet-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-4 py-3 font-bold text-violet-600">{p.kode}</td>
                              <td className="px-4 py-3 text-gray-600">{fD(p.tanggal)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${p.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                  {p.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{p.operator??'—'}</td>
                              <td className="px-4 py-3 font-mono text-gray-700">{fgr(p.dikasih_gram)}</td>
                              <td className="px-4 py-3 font-mono font-bold text-gray-700">{p.diterima_gram?fgr(p.diterima_gram):'—'}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-orange-500">{p.losses_gram?fgr(p.losses_gram):'—'}</td>
                              <td className="px-4 py-3 font-semibold text-orange-500">{fPct(p.losses_gram,p.dikasih_gram)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-amber-200 bg-amber-50">
                            <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 text-xs uppercase">TOTAL</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-gray-700">{fgr(data.peleburan.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0))}</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-gray-700">{fgr(data.peleburan.reduce((s:number,p:any)=>s+Number(p.diterima_gram??0),0))}</td>
                            <td className="px-4 py-3 font-mono font-extrabold text-orange-600">{fgr(data.peleburan.reduce((s:number,p:any)=>s+Number(p.losses_gram??0),0))}</td>
                            <td className="px-4 py-3"/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                }
              </div>
            )}

            {/* ── Tab: Produksi ──────────────────────────────────────────── */}
            {tab==='produksi'&&(
              <div className="space-y-3">
                {data.produksiItems.length === 0
                  ? <div className="text-center py-16 rounded-3xl" style={{background:'rgba(255,255,255,0.7)'}}>
                      <p className="text-sm text-gray-400 italic">Belum ada item produksi</p>
                    </div>
                  : data.produksiItems.map((item:any)=>{
                      const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
                      const stgLoss = handovers.filter((h:any)=>h.status==='selesai').reduce((s:number,h:any)=>s+Number(h.losses_gram??0),0)
                      const totalLoss = Number(item.losses_cutting??0) + stgLoss
                      const isExp = expandedItem.has(item.id)
                      const packings: any[] = Array.isArray(item.packing) ? item.packing.filter((p:any)=>!p.voided_at) : (item.packing&&!item.packing.voided_at?[item.packing]:[])
                      const totalPacked = packings.reduce((s:number,p:any)=>s+(Number(p.pcs_dipack??p.pcs??0)),0)

                      const STATUS_COLOR: Record<string,string> = {
                        'Cutting':'#3B82F6','Pas Berat':'#F97316','Annealing':'#EAB308',
                        'Siap Packing':'#8B5CF6','Sudah Packing':'#22C55E','Reject':'#EF4444'
                      }
                      const dot = STATUS_COLOR[item.current_status] ?? '#9CA3AF'

                      return (
                        <div key={item.id} className="rounded-2xl overflow-hidden"
                          style={{background:'rgba(255,255,255,0.85)',border:'1px solid rgba(209,213,219,0.35)',borderLeft:`3px solid ${dot}`}}>
                          {/* Row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
                              style={{background:`${dot}18`,color:dot}}>
                              {item.gramasi}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-gray-900">{item.nama_item??item.kode}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:`${dot}18`,color:dot}}>{item.current_status}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{item.kode} · {item.gramasi}gr × {item.pcs_good??item.pcs??'?'} pcs</p>
                            </div>
                            {/* Quick stats */}
                            <div className="hidden sm:flex items-center gap-3 text-xs flex-shrink-0 mr-2">
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px]">Serah</p>
                                <p className="font-bold text-gray-700">{fgr(item.serah_gram??item.berat_awal)} gr</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400 text-[9px]">Losses</p>
                                <p className={`font-bold ${totalLoss>0?'text-red-500':'text-gray-400'}`}>{totalLoss>0?fgr(totalLoss)+' gr':'—'}</p>
                              </div>
                              {totalPacked > 0 && (
                                <div className="text-center">
                                  <p className="text-gray-400 text-[9px]">Packed</p>
                                  <p className="font-bold text-green-600">{totalPacked} pcs</p>
                                </div>
                              )}
                            </div>
                            <button onClick={()=>setExpandedItem(prev=>{const n=new Set(prev);n.has(item.id)?n.delete(item.id):n.add(item.id);return n})}
                              className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 flex-shrink-0 transition-colors">
                              <ChevronDown size={13} className={`text-gray-500 transition-transform ${isExp?'rotate-180':''}`}/>
                            </button>
                          </div>

                          {/* Expanded detail */}
                          {isExp && (
                            <div className="px-4 pb-4 pt-2 border-t space-y-3" style={{borderColor:'rgba(0,0,0,0.06)',background:'rgba(248,246,255,0.4)'}}>
                              {/* Cutting */}
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

                              {/* Stage handover */}
                              {handovers.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-violet-100">
                                  <div className="px-3 py-2 text-[9px] font-bold text-violet-600 uppercase tracking-wide bg-violet-50/50">⛓ Serah-Terima Per Tahap</div>
                                  {handovers.map((h:any)=>{
                                    const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                                    return (
                                      <div key={h.id} className="px-3 py-2 border-t border-violet-50 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                        <div><p className="text-[9px] text-gray-400">Tahap</p><p className="font-bold text-gray-700">{tl[h.tahap]??h.tahap}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Serah</p><p className="font-semibold text-gray-600">{h.serah_gram?fgr(h.serah_gram)+' gr':'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Terima</p><p className="font-semibold text-gray-600">{h.terima_gram?fgr(h.terima_gram)+' gr':'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Reject</p><p className={`font-semibold ${Number(h.reject_gram??0)>0?'text-red-500':'text-gray-400'}`}>{Number(h.reject_gram??0)>0?fgr(h.reject_gram)+' gr':'—'}</p></div>
                                        <div><p className="text-[9px] text-gray-400">Losses</p><p className={`font-semibold ${Number(h.losses_gram??0)>0?'text-orange-500':'text-gray-400'}`}>{Number(h.losses_gram??0)>0?fgr(h.losses_gram)+' gr':'—'}</p></div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Packing */}
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

            {/* ── Tab: Packing ──────────────────────────────────────────── */}
            {tab==='packing'&&(
              <div className="rounded-3xl overflow-hidden"
                style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(0,0,0,0.04)'}}>
                <div className="px-5 py-3 border-b" style={{background:'rgba(34,197,94,0.05)',borderColor:'rgba(34,197,94,0.15)'}}>
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wide">📦 Packing Summary</p>
                </div>
                {(() => {
                  const allPackings = data.produksiItems.flatMap((i:any) => {
                    const pks = Array.isArray(i.packing) ? i.packing.filter((p:any)=>!p.voided_at) : (i.packing&&!i.packing.voided_at?[i.packing]:[])
                    return pks.map((p:any) => ({...p, nama_item: i.nama_item, gramasi: i.gramasi}))
                  })
                  if (allPackings.length === 0) return <p className="text-sm text-gray-400 italic text-center py-12">Belum ada packing</p>
                  const totalPcs = allPackings.reduce((s:number,p:any)=>s+(Number(p.pcs_dipack??p.pcs??0)),0)
                  const totalShieldtag = allPackings.reduce((s:number,p:any)=>s+(Number(p.shieldtag_count??0)),0)
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'rgba(0,0,0,0.02)'}}>
                          {['Kode Packing','Nama Item','Gramasi','Tanggal','PCS Dipack','Shieldtag','Catatan'].map(h=>(
                            <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {allPackings.map((p:any,i:number)=>(
                            <tr key={p.id??i} className="border-t hover:bg-green-50/30 transition-colors" style={{borderColor:'rgba(0,0,0,0.04)'}}>
                              <td className="px-4 py-3 font-bold text-green-600">{p.kode}</td>
                              <td className="px-4 py-3 font-semibold text-gray-700">{p.nama_item??'—'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.gramasi} gr</td>
                              <td className="px-4 py-3 text-gray-600">{fD(p.tanggal)}</td>
                              <td className="px-4 py-3 font-bold text-gray-700">{p.pcs_dipack??p.pcs??0} pcs</td>
                              <td className="px-4 py-3 font-semibold text-violet-600">{p.shieldtag_count??0}</td>
                              <td className="px-4 py-3 text-gray-400 italic">{p.catatan??'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-green-200 bg-green-50">
                            <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 text-xs uppercase">TOTAL</td>
                            <td className="px-4 py-3 font-extrabold text-gray-700">{totalPcs} pcs</td>
                            <td className="px-4 py-3 font-extrabold text-violet-600">{totalShieldtag}</td>
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

        {/* Empty state */}
        {!selectedKode && !loading && (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl"
            style={{background:'rgba(255,255,255,0.6)',backdropFilter:'blur(20px)',border:'1px dashed rgba(139,92,246,0.2)'}}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
              style={{background:'rgba(139,92,246,0.08)'}}>
              <FileText size={28} className="text-violet-300"/>
            </div>
            <p className="text-sm font-medium text-gray-400">Pilih batch di atas untuk melihat laporan lengkap</p>
            <p className="text-xs text-gray-300 mt-1">{batches.length} batch tersedia</p>
          </div>
        )}
      </div>
    </div>
  )
}
