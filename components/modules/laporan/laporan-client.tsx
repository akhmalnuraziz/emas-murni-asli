// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getLaporanBatch, getLaporanLabaRugi } from '@/app/(dashboard)/laporan/actions'
import { TrendingUp, TrendingDown, Printer } from 'lucide-react'

// ── iOS Design Tokens ─────────────────────────────────────────────────────────
const iOS = {
  bg:'#F2F2F7', card:'#FFFFFF', fill3:'rgba(118,118,128,0.12)',
  sep:'rgba(60,60,67,0.29)', sepO:'#C6C6C8',
  label:'#000000', label2:'#3C3C43', label3:'rgba(60,60,67,0.6)', label4:'rgba(60,60,67,0.18)',
  blue:'#007AFF', green:'#34C759', indigo:'#5856D6', orange:'#FF9500',
  red:'#FF3B30', purple:'#AF52DE', gray:'#8E8E93', gray3:'#C7C7CC', gray5:'#E5E5EA',
  accent:'#7C3AED', accentL:'#F5F0FF',
}

const STATUS_STYLE = {
  'Cutting':       { color:'#007AFF', bg:'#EBF4FF' },
  'Pas Berat':     { color:'#FF9500', bg:'#FFF8ED' },
  'Siap Packing':  { color:'#34C759', bg:'#EDFAF1' },
  'Sudah Packing': { color:'#AF52DE', bg:'#F9EEFF' },
  'Annealing':     { color:'#5AC8FA', bg:'#EAF8FF' },
  'Reject':        { color:'#FF3B30', bg:'#FFF0EF' },
}

const GRAMASI_STD = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const CH_LABEL = { toko:'Toko Fisik', shopee:'Shopee', tiktok:'TikTok', raja_emas:'Raja Emas', lainnya:'Lainnya' }

const fmt  = (n:number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtg = (n:number) => Number(n).toFixed(3) + ' gr'

// ── Reusable iOS Components ───────────────────────────────────────────────────
function IOSSectionHeader({ title }) {
  return (
    <p style={{ fontSize:13, fontWeight:400, color:iOS.label3, textTransform:'uppercase', letterSpacing:0.4, padding:'0 20px', marginBottom:8, marginTop:28 }}>
      {title}
    </p>
  )
}

function IOSCard({ children, style={}}) {
  return <div style={{ background:iOS.card, borderRadius:16, overflow:'hidden', ...style }}>{children}</div>
}

function IOSSep({ left=16 }) {
  return <div style={{ height:'0.5px', background:iOS.sepO, opacity:0.6, marginLeft:left }} />
}

function IOSListRow({ left, right, subleft, accentColor, last }) {
  return (
    <div>
      <div style={{ padding:'11px 16px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div>
          <p style={{ fontSize:17, color:accentColor||iOS.label, fontWeight:accentColor?500:400 }}>{left}</p>
          {subleft && <p style={{ fontSize:13, color:iOS.label3, marginTop:1 }}>{subleft}</p>}
        </div>
        <p style={{ fontSize:17, fontWeight:600, color:accentColor||iOS.label, flexShrink:0 }}>{right}</p>
      </div>
      {!last && <IOSSep />}
    </div>
  )
}

function IOSBadge({ label, color }) {
  return <span style={{ fontSize:11, fontWeight:600, color, background:color+'18', borderRadius:99, padding:'3px 8px' }}>{label}</span>
}

function IOSProgressBar({ label, pct, color, sublabel }) {
  return (
    <div style={{ padding:'10px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <p style={{ fontSize:15, color:iOS.label }}>{label}</p>
        <p style={{ fontSize:13, color:iOS.label3 }}>{sublabel}</p>
      </div>
      <div style={{ height:6, background:iOS.gray5, borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:color, borderRadius:99 }} />
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:iOS.card, borderRadius:16, padding:16, flex:1, minWidth:0 }}>
      <div style={{ width:32, height:32, background:color+'18', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginBottom:10 }}>
        {icon}
      </div>
      <p style={{ fontSize:26, fontWeight:700, color, lineHeight:1, letterSpacing:-0.5 }}>{value}</p>
      <p style={{ fontSize:11, fontWeight:500, color:iOS.label3, marginTop:4, textTransform:'uppercase', letterSpacing:0.3 }}>{label}</p>
      {sub && <p style={{ fontSize:11, color:iOS.label3, marginTop:2 }}>{sub}</p>}
    </div>
  )
}

// ── TAB BATCH ─────────────────────────────────────────────────────────────────
function TabBatch({ batchList }) {
  const [selBatch, setSelBatch]   = useState('')
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [expandedItem, setExpandedItem] = useState<string|null>(null)

  async function load(kode: string) {
    setSelBatch(kode); setLoading(true); setData(null)
    const r = await getLaporanBatch(kode)
    setData(r); setLoading(false)
  }

  const b = data?.batch
  const s = data?.summary

  const statusCounts = data ? (() => {
    const m: Record<string,number> = {}
    ;(data.items||[]).forEach((item:any) => {
      m[item.current_status] = (m[item.current_status]||0) + (item.pcs_good||0)
    })
    return m
  })() : {}

  const totalPcs = Object.values(statusCounts).reduce((a:any,b:any)=>a+b,0)

  const pieData = Object.entries(statusCounts)
    .filter(([,v]:any) => v > 0)
    .map(([k,v]:any) => ({ name:k, pcs:v, color:(STATUS_STYLE[k]||{color:iOS.gray}).color }))

  const gramasiMap: Record<string,any> = {}
  ;(data?.items||[]).forEach((item:any) => {
    const g = item.gramasi
    if (!gramasiMap[g]) gramasiMap[g] = { pcs:0, gram:0 }
    gramasiMap[g].pcs  += item.pcs_good || 0
    gramasiMap[g].gram += parseFloat(item.total_gram||0)
  })

  const barData = Object.entries(gramasiMap)
    .sort(([a],[b]) => parseFloat(a)-parseFloat(b))
    .map(([g,d]:any) => ({ gr:g+'gr', pcs:d.pcs }))

  const eff = b && s ? Math.round(s.totalBeratAkhir / parseFloat(b.timbangan_akhir||1) * 1000)/10 : 0

  return (
    <div style={{ fontFamily:'"Plus Jakarta Sans","DM Sans",system-ui,sans-serif', background:iOS.bg, minHeight:'100vh', WebkitFontSmoothing:'antialiased' }}>

      {/* Batch selector */}
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:iOS.card, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
          <select value={selBatch} onChange={e => load(e.target.value)}
            style={{ width:'100%', padding:'14px 16px', background:'transparent', border:'none', fontSize:15, color:selBatch?iOS.label:iOS.label3, fontFamily:'inherit', outline:'none', display:'block' }}>
            <option value="">— Pilih Batch —</option>
            {batchList.map((b:any) => (
              <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} ({b.tanggal})</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign:'center', padding:'48px 0', color:iOS.label3, fontSize:15 }}>Memuat data…</div>}

      {!data && !loading && !selBatch && (
        <div style={{ textAlign:'center', padding:'60px 32px', color:iOS.label3 }}>
          <p style={{ fontSize:48, marginBottom:12 }}>📊</p>
          <p style={{ fontSize:17, fontWeight:600, color:iOS.label, marginBottom:6 }}>Pilih Batch</p>
          <p style={{ fontSize:15, lineHeight:1.5 }}>Pilih batch dari dropdown di atas untuk melihat laporan lengkap</p>
        </div>
      )}

      {data && b && s && (
        <div style={{ paddingBottom:80 }}>

          {/* Batch banner */}
          <div style={{ padding:'12px 16px 0' }}>
            <div style={{ background:'linear-gradient(145deg,#7C3AED,#6D28D9)', borderRadius:16, padding:'14px 16px', boxShadow:'0 4px 20px rgba(124,58,237,.4)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,.65)', letterSpacing:0.5, textTransform:'uppercase', fontWeight:500 }}>Batch</p>
                  <p style={{ fontSize:20, fontWeight:700, color:'white', marginTop:2 }}>{b.kode}</p>
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    {[b.tanggal, b.supplier||'—', `${Number(b.timbangan_akhir||0).toFixed(2)} gr`].map((t,i) => (
                      <span key={i} style={{ fontSize:11, color:'rgba(255,255,255,.8)', background:'rgba(255,255,255,.15)', borderRadius:99, padding:'3px 9px', fontWeight:500 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <button onClick={()=>window.print()}
                  style={{ background:'rgba(255,255,255,.18)', border:'none', borderRadius:10, padding:'6px 12px', fontSize:12, color:'white', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  🖨 Print
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════ SECTION: METRIK UTAMA ═══════════ */}
          <IOSSectionHeader title="Metrik Utama" />
          <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {[
              [{ label:'Bahan Baku', value:fmtg(b.timbangan_akhir||0), sub:'timbangan akhir gudang', color:iOS.accent, icon:'⚖️' },
               { label:'Gram Jadi',  value:fmtg(s.totalBeratAkhir),    sub:`dari ${s.totalPcsGood} pcs`, color:iOS.blue, icon:'💎' }],
              [{ label:'Efisiensi', value:`${eff}%`, sub:'Gram Jadi ÷ Bahan Baku', color:iOS.green, icon:'📊' },
               { label:'Sisa Serbuk', value:fmtg(s.totalSerbuk), sub:'total semua event', color:iOS.orange, icon:'✨' }],
              [{ label:'Loses', value:fmtg(s.totalLosses), sub:'Seharusnya − Fisik', color:s.totalLosses>0?iOS.red:iOS.gray, icon:'⚠️' },
               { label:'Total PCS', value:String(s.totalPcsGood), sub:`${s.totalPcsReject} reject`, color:iOS.indigo, icon:'📦' }],
            ].map((row,ri) => (
              <div key={ri} style={{ display:'flex', gap:10 }}>
                {row.map((k,ki) => <KPICard key={ki} {...k}/>)}
              </div>
            ))}
          </div>

          {/* ═══════════ SECTION: RINGKASAN ═══════════ */}
          <IOSSectionHeader title="Ringkasan Batch" />
          <IOSCard style={{ margin:'0 16px' }}>
            {[
              { left:'Bahan Baku', right:fmtg(b.timbangan_akhir||0) },
              { left:'Gramasi Jadi', right:fmtg(s.totalBeratAkhir) },
              { left:'Sisa Serbuk', right:fmtg(s.totalSerbuk) },
              { left:'Sisa Seharusnya', subleft:'Auto: Bahan − Jadi − Serbuk', right:fmtg(s.sisaBahan), accentColor:iOS.blue },
              { left:'Sisa Fisik (input manual)', right: s.sisaFisik!=null ? fmtg(s.sisaFisik) : '— belum diisi' },
              { left:'Loses Produksi', subleft: s.totalLosses===0?'✓ Tidak ada loses':null, right:fmtg(s.totalLosses), accentColor: s.totalLosses>0?iOS.red:iOS.green },
              { left:'HPP / gram', right:`Rp ${Math.round(s.hpp_gr||0).toLocaleString('id-ID')}`, last:true },
            ].map((r,i) => <IOSListRow key={i} {...r}/>)}
          </IOSCard>

          {/* ═══════════ SECTION: STATUS PRODUKSI ═══════════ */}
          <IOSSectionHeader title="Status Produksi" />
          <IOSCard style={{ margin:'0 16px' }}>
            {Object.keys(STATUS_STYLE).map((status, i, arr) => {
              const cnt = statusCounts[status]||0
              const st = STATUS_STYLE[status]
              return (
                <div key={status}>
                  <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:32, height:32, background:st.bg, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ width:10, height:10, borderRadius:99, background:st.color }}/>
                    </div>
                    <p style={{ flex:1, fontSize:17, color:iOS.label }}>{status}</p>
                    <p style={{ fontSize:17, fontWeight:600, color:cnt>0?st.color:iOS.label4 }}>{cnt}</p>
                  </div>
                  {i < arr.length-1 && <IOSSep left={60}/>}
                </div>
              )
            })}
          </IOSCard>
          <div style={{ margin:'8px 16px 0' }}>
            <IOSCard>
              <div style={{ padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:17, fontWeight:600, color:iOS.label }}>Total</p>
                <p style={{ fontSize:20, fontWeight:700, color:iOS.accent }}>{totalPcs} pcs</p>
              </div>
            </IOSCard>
          </div>

          {/* Donut chart */}
          {pieData.length > 0 && (
            <div style={{ margin:'12px 16px 0' }}>
              <IOSCard style={{ padding:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ position:'relative', width:110, height:110, flexShrink:0 }}>
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={pieData} dataKey="pcs" cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2}>
                          {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                      <p style={{ fontSize:18, fontWeight:700, color:iOS.label, lineHeight:1 }}>{totalPcs}</p>
                      <p style={{ fontSize:9, color:iOS.label3 }}>pcs</p>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:8, height:8, borderRadius:99, background:d.color, flexShrink:0 }}/>
                        <p style={{ flex:1, fontSize:13, color:iOS.label }}>{d.name}</p>
                        <p style={{ fontSize:14, fontWeight:600, color:d.color }}>{d.pcs}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {/* Progress */}
          <div style={{ margin:'12px 16px 0' }}>
            <IOSCard style={{ padding:'4px 16px 8px' }}>
              <IOSProgressBar label="Efisiensi Produksi" pct={eff} color={iOS.green} sublabel={`${eff}% — ${fmtg(s.totalBeratAkhir)}/${fmtg(b.timbangan_akhir||0)}`}/>
              <IOSSep/>
              <IOSProgressBar label="Siap Packing" pct={totalPcs>0?(statusCounts['Siap Packing']||0)/totalPcs*100:0} color={iOS.green} sublabel={`${statusCounts['Siap Packing']||0} / ${totalPcs} pcs`}/>
              <IOSSep/>
              <IOSProgressBar label="Sudah Packing" pct={totalPcs>0?(statusCounts['Sudah Packing']||0)/totalPcs*100:0} color={iOS.purple} sublabel={`${statusCounts['Sudah Packing']||0} / ${totalPcs} pcs`}/>
            </IOSCard>
          </div>

          {/* ═══════════ SECTION: GRAMASI ═══════════ */}
          <IOSSectionHeader title="Breakdown per Gramasi" />
          {barData.length > 0 && (
            <div style={{ margin:'0 16px 12px' }}>
              <IOSCard style={{ padding:'16px 12px 8px' }}>
                <p style={{ fontSize:12, color:iOS.label3, marginBottom:10, paddingLeft:4 }}>Distribusi pcs per gramasi</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={barData} margin={{ top:8, right:4, left:-24, bottom:0 }}>
                    <XAxis dataKey="gr" tick={{ fontSize:10, fill:iOS.label3 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:iOS.label3 }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius:12, border:`0.5px solid ${iOS.sepO}`, fontSize:12 }}/>
                    <Bar dataKey="pcs" radius={[5,5,2,2]} fill={iOS.accent}/>
                  </BarChart>
                </ResponsiveContainer>
              </IOSCard>
            </div>
          )}
          <IOSCard style={{ margin:'0 16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr 1fr 0.6fr', padding:'8px 16px', background:iOS.fill3, borderBottom:`0.5px solid ${iOS.sepO}` }}>
              {['Gramasi','Pcs','Total Gr','%'].map(h => <p key={h} style={{ fontSize:11, fontWeight:600, color:iOS.label3, letterSpacing:0.2 }}>{h}</p>)}
            </div>
            {GRAMASI_STD.map((g, i) => {
              const d = gramasiMap[g]
              const pct = d && s.totalBeratAkhir > 0 ? (d.gram/s.totalBeratAkhir*100).toFixed(1) : null
              return (
                <div key={g} style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr 1fr 0.6fr', padding:'11px 16px', borderBottom:i<GRAMASI_STD.length-1?`0.5px solid rgba(0,0,0,.05)`:undefined }}>
                  <p style={{ fontSize:16, fontWeight:d?500:400, color:d?iOS.label:iOS.label4 }}>{g} gr</p>
                  <p style={{ fontSize:16, color:d?iOS.label:iOS.label4 }}>{d?d.pcs:'—'}</p>
                  <p style={{ fontSize:16, color:d?iOS.label:iOS.label4 }}>{d?Number(d.gram).toFixed(2):'—'}</p>
                  <p style={{ fontSize:14, fontWeight:600, color:d?iOS.orange:iOS.label4 }}>{d?pct+'%':'—'}</p>
                </div>
              )
            })}
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr 1fr 0.6fr', padding:'12px 16px', background:'rgba(124,58,237,.06)', borderTop:`0.5px solid ${iOS.sepO}` }}>
              {['TOTAL',String(totalPcs),Number(s.totalBeratAkhir).toFixed(2),'100%'].map((v,i) => (
                <p key={i} style={{ fontSize:14, fontWeight:700, color:iOS.accent }}>{v}</p>
              ))}
            </div>
          </IOSCard>

          {/* ═══════════ SECTION: PACKING LOG ═══════════ */}
          {data.packings.length > 0 && (
            <>
              <IOSSectionHeader title="Visualisasi Packing Log" />
              <div style={{ padding:'0 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                {[
                  { label:'Total Records', value:String(data.packings.length), sub:'dari batch ini', color:iOS.accent },
                  { label:'Total PCS', value:String(data.packings.reduce((s:any,p:any)=>s+(p.pcs_dipack||0),0)), sub:'pcs dipack', color:iOS.green },
                  { label:'Total Gram', value:Number(data.packings.reduce((s:any,p:any)=>s+parseFloat(p.total_gram_aktual||p.total_gram||0),0)).toFixed(2)+' gr', sub:'hasil timbang', color:iOS.blue },
                  { label:'Avg per Packing', value:data.packings.length>0?Math.round(data.packings.reduce((s:any,p:any)=>s+(p.pcs_dipack||0),0)/data.packings.length)+' pcs':'—', sub:'rata-rata', color:iOS.orange },
                ].map((d,i) => (
                  <IOSCard key={i} style={{ padding:14 }}>
                    <p style={{ fontSize:10, fontWeight:500, color:iOS.label3, textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>{d.label}</p>
                    <p style={{ fontSize:22, fontWeight:700, color:d.color, letterSpacing:-0.5 }}>{d.value}</p>
                    <p style={{ fontSize:10, color:iOS.label3, marginTop:4 }}>{d.sub}</p>
                  </IOSCard>
                ))}
              </div>
              <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
                {data.packings.map((pk:any) => {
                  const de = parseFloat(pk.total_gram||0)
                  const pa = parseFloat(pk.total_gram_aktual||pk.total_gram||0)
                  const sel = Math.round((pa-de)*1000)/1000
                  const ok = Math.abs(sel) < 0.1
                  return (
                    <IOSCard key={pk.kode} style={{ padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:iOS.accent, background:iOS.accentL, borderRadius:99, padding:'4px 10px' }}>{pk.kode}</span>
                        <IOSBadge label={`${pk.gramasi} gr`} color={iOS.orange}/>
                        <IOSBadge label={`${pk.pcs_dipack} pcs`} color={iOS.gray}/>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', background:iOS.fill3, borderRadius:10, padding:'10px 12px', gap:4 }}>
                        {[
                          { label:'Data Entry', value:`${de.toFixed(3)} gr`, color:iOS.label },
                          { label:'Packing', value:`${pa.toFixed(3)} gr`, color:iOS.blue },
                          { label:'Selisih', value:ok?'✓ Pas':`${sel} gr`, color:ok?iOS.green:iOS.red },
                        ].map((col,ci) => (
                          <div key={ci} style={{ textAlign:'center' }}>
                            <p style={{ fontSize:9, color:iOS.label3, marginBottom:3 }}>{col.label}</p>
                            <p style={{ fontSize:13, fontWeight:700, color:col.color }}>{col.value}</p>
                          </div>
                        ))}
                      </div>
                    </IOSCard>
                  )
                })}
              </div>
            </>
          )}

          {/* ═══════════ SECTION: RINCIAN ITEM ═══════════ */}
          <IOSSectionHeader title={`Rincian Item Produksi (${data.items.length})`} />
          <IOSCard style={{ margin:'0 16px' }}>
            {data.items.length===0 ? (
              <div style={{ padding:'24px 16px', textAlign:'center' }}>
                <p style={{ color:iOS.label3, fontSize:15 }}>Belum ada item produksi</p>
              </div>
            ) : data.items.map((item:any, i:number) => {
              const st = STATUS_STYLE[item.current_status] || { color:iOS.gray, bg:'#F3F4F6' }
              const isExp = expandedItem === item.kode
              const itemEvents = data.events?.filter((e:any)=>e.produksi_item_id===item.id)||[]
              return (
                <div key={item.kode}>
                  <button onClick={()=>setExpandedItem(isExp?null:item.kode)}
                    style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left', fontFamily:'inherit' }}>
                    <div style={{ width:40, height:40, background:st.bg, borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:st.color, lineHeight:1 }}>{item.gramasi}</p>
                      <p style={{ fontSize:8, color:st.color, opacity:0.7 }}>gr</p>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:15, fontWeight:600, color:iOS.label }}>{item.kode}</p>
                      <div style={{ display:'flex', gap:5, marginTop:3, flexWrap:'wrap' }}>
                        <p style={{ fontSize:12, color:iOS.label3 }}>{item.pcs_good} pcs</p>
                        <p style={{ fontSize:12, color:iOS.label3 }}>·</p>
                        <p style={{ fontSize:12, color:iOS.label3 }}>{Number(item.total_gram||0).toFixed(2)} gr</p>
                        <p style={{ fontSize:12, color:iOS.label3 }}>·</p>
                        <p style={{ fontSize:12, color:iOS.label3 }}>{item.tanggal_produksi||item.tanggal}</p>
                      </div>
                    </div>
                    <IOSBadge label={item.current_status} color={st.color}/>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
                      style={{ transform:isExp?'rotate(90deg)':'rotate(0deg)', transition:'transform .2s', flexShrink:0, opacity:0.4 }}>
                      <path d="M1 1L6 6L1 11" stroke={iOS.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {isExp && (
                    <div style={{ background:iOS.fill3, margin:'0 12px 12px', borderRadius:12, padding:'12px 14px' }}>
                      <p style={{ fontSize:11, fontWeight:600, color:iOS.label3, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Histori Event</p>
                      {itemEvents.length===0 ? (
                        <p style={{ fontSize:13, color:iOS.label3 }}>Belum ada event</p>
                      ) : itemEvents.map((e:any,ei:number) => (
                        <div key={ei} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:ei<itemEvents.length-1?`0.5px solid ${iOS.sepO}`:'none' }}>
                          <p style={{ fontSize:12, color:iOS.label3 }}>{e.tanggal}</p>
                          <p style={{ fontSize:12, fontWeight:600, color:st.color }}>{e.status}</p>
                          <p style={{ fontSize:12, color:iOS.label }}>{Number(e.total_gram||0).toFixed(3)} gr</p>
                          <p style={{ fontSize:12, color:iOS.orange }}>-{Number(e.losses||0).toFixed(4)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isExp && i < data.items.length-1 && <IOSSep left={68}/>}
                </div>
              )
            })}
          </IOSCard>

        </div>
      )}
    </div>
  )
}


// ── TAB LABA RUGI ─────────────────────────────────────────────────────────────
function TabLabaRugi({ cabangList, namaGudang }) {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0,7)+'-01'
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo,   setDateTo]   = useState(today)
  const [lokasi,   setLokasi]   = useState('')
  const [data,     setData]     = useState<any>(null)
  const [loading,  setLoading]  = useState(false)

  async function load() {
    setLoading(true)
    const r = await getLaporanLabaRugi(dateFrom, dateTo, lokasi||undefined)
    setData(r); setLoading(false)
  }

  return (
    <div style={{ fontFamily:'"Plus Jakarta Sans","DM Sans",system-ui,sans-serif', background:iOS.bg, minHeight:'100vh', WebkitFontSmoothing:'antialiased', paddingBottom:80 }}>

      {/* Filter */}
      <IOSSectionHeader title="Filter Periode" />
      <IOSCard style={{ margin:'0 16px' }}>
        <div style={{ padding:'12px 16px' }}>
          <p style={{ fontSize:13, color:iOS.label3, marginBottom:6 }}>Dari</p>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ width:'100%', padding:'8px 0', background:'none', border:'none', fontSize:17, color:iOS.label, fontFamily:'inherit', outline:'none' }}/>
        </div>
        <IOSSep/>
        <div style={{ padding:'12px 16px' }}>
          <p style={{ fontSize:13, color:iOS.label3, marginBottom:6 }}>Sampai</p>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ width:'100%', padding:'8px 0', background:'none', border:'none', fontSize:17, color:iOS.label, fontFamily:'inherit', outline:'none' }}/>
        </div>
        <IOSSep/>
        <div style={{ padding:'12px 16px' }}>
          <p style={{ fontSize:13, color:iOS.label3, marginBottom:6 }}>Lokasi</p>
          <select value={lokasi} onChange={e=>setLokasi(e.target.value)}
            style={{ width:'100%', background:'none', border:'none', fontSize:17, color:iOS.label, fontFamily:'inherit', outline:'none', padding:'4px 0' }}>
            <option value="">Semua Lokasi</option>
            <option value={namaGudang}>{namaGudang}</option>
            {cabangList.map((c:any)=><option key={c.kode} value={c.nama}>{c.nama}</option>)}
          </select>
        </div>
      </IOSCard>

      <div style={{ padding:'12px 16px 0' }}>
        <button onClick={load} disabled={loading}
          style={{ width:'100%', padding:'14px', background:iOS.accent, border:'none', borderRadius:14, fontSize:17, fontWeight:600, color:'white', cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 16px ${iOS.accent}40`, opacity:loading?0.6:1 }}>
          {loading ? 'Memuat…' : 'Tampilkan Laporan'}
        </button>
      </div>

      {data && (
        <>
          <IOSSectionHeader title="Laporan Laba Rugi" />
          <IOSCard style={{ margin:'0 16px' }}>
            <IOSListRow left="Total Penjualan" right={fmt(data.pendapatan.totalHJ)}/>
            <IOSListRow left="HPP Terjual" right={`(${fmt(data.pendapatan.totalHPP)})`} accentColor={iOS.red}/>
            <IOSListRow left="Fee Marketplace" right={`(${fmt(data.pendapatan.totalFee)})`} accentColor={iOS.orange}/>
            <IOSListRow left="Gross Profit" right={fmt(data.pendapatan.grossProfit)} accentColor={data.pendapatan.grossProfit>=0?iOS.green:iOS.red}/>
            <IOSListRow left="Pengeluaran Operasional" right={`(${fmt(data.pengeluaran.total)})`} accentColor={iOS.red}/>
            <div style={{ padding:'14px 16px', background:data.netProfit>=0?'#EDFAF1':'#FFF0EF', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {data.netProfit>=0?<TrendingUp size={18} color={iOS.green}/>:<TrendingDown size={18} color={iOS.red}/>}
                <div>
                  <p style={{ fontSize:17, fontWeight:600, color:iOS.label }}>Net Profit</p>
                  <p style={{ fontSize:12, color:data.netProfit>=0?iOS.green:iOS.red }}>Margin {data.marginPct}%</p>
                </div>
              </div>
              <p style={{ fontSize:20, fontWeight:700, color:data.netProfit>=0?iOS.green:iOS.red }}>{fmt(data.netProfit)}</p>
            </div>
          </IOSCard>

          {/* Per channel */}
          {Object.keys(data.pendapatan.perChannel).length > 0 && (
            <>
              <IOSSectionHeader title="Penjualan per Channel" />
              <IOSCard style={{ margin:'0 16px', padding:'12px 16px' }}>
                {Object.entries(data.pendapatan.perChannel).map(([ch,d]:any)=>{
                  const pct = data.pendapatan.totalHJ>0?Math.round(d.hj/data.pendapatan.totalHJ*100):0
                  return (
                    <div key={ch} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <p style={{ fontSize:15, color:iOS.label }}>{CH_LABEL[ch]||ch}</p>
                        <p style={{ fontSize:13, color:iOS.label3 }}>{fmt(d.hj)} · {d.pcs} pcs</p>
                      </div>
                      <div style={{ height:5, background:iOS.gray5, borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:iOS.accent, borderRadius:99 }}/>
                      </div>
                    </div>
                  )
                })}
              </IOSCard>
            </>
          )}

          <div style={{ padding:'12px 16px 0' }}>
            <button onClick={()=>window.print()}
              style={{ width:'100%', padding:'13px', background:iOS.card, border:`0.5px solid ${iOS.sepO}`, borderRadius:14, fontSize:16, fontWeight:500, color:iOS.accent, cursor:'pointer', fontFamily:'inherit' }}>
              🖨 Print Laporan
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [['batch','Per Batch'],['labarugi','Laba Rugi']]

export default function LaporanClient({ batchList, cabangList, namaGudang }) {
  const [tab, setTab] = useState('batch')

  return (
    <div style={{ fontFamily:'"Plus Jakarta Sans","DM Sans",system-ui,sans-serif', background:iOS.bg, minHeight:'100vh', WebkitFontSmoothing:'antialiased' }}>
      {/* Sticky tab bar */}
      <div style={{ background:'rgba(242,242,247,.85)', backdropFilter:'saturate(180%) blur(20px)', WebkitBackdropFilter:'saturate(180%) blur(20px)', position:'sticky', top:0, zIndex:50, borderBottom:`0.5px solid ${iOS.sepO}`, padding:'14px 16px 0' }}>
        <p style={{ fontSize:34, fontWeight:700, color:iOS.label, letterSpacing:-0.5, lineHeight:1.1, marginBottom:12 }}>Laporan</p>
        <div style={{ display:'flex', gap:0, background:iOS.fill3, borderRadius:9, padding:2, marginBottom:10 }}>
          {TABS.map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)}
              style={{ flex:1, padding:'7px 4px', background:tab===k?'white':'transparent', border:'none', borderRadius:7, fontSize:13, fontWeight:tab===k?600:400, color:tab===k?iOS.label:iOS.label3, cursor:'pointer', fontFamily:'inherit', boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.12)':'none', transition:'all .2s' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab==='batch'    && <TabBatch batchList={batchList}/>}
      {tab==='labarugi' && <TabLabaRugi cabangList={cabangList} namaGudang={namaGudang}/>}
    </div>
  )
}

