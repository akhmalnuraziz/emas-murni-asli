'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  Plus, Search, X, Check, AlertTriangle, Shield,
  ChevronDown, ChevronUp, Tag, RefreshCw, Trash2,
  Clock, MapPin, Package
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { registerShieldtags, voidShieldtag } from '@/app/(dashboard)/shieldtag/actions'
import { generateRange } from '@/lib/shieldtag-utils'
import type { UserRole } from '@/lib/types/database'

interface Props {
  shieldtags: any[]
  packingsForReg: any[]  // packings with remaining shieldtag slots
  userRole: UserRole
  userName: string
}

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'Aktif':          { bg:'rgba(34,197,94,0.1)',   text:'#16A34A', dot:'#22C55E', label:'Aktif' },
  'Terdistribusi':  { bg:'rgba(59,130,246,0.1)',  text:'#2563EB', dot:'#3B82F6', label:'Terdistribusi' },
  'Terjual':        { bg:'rgba(139,92,246,0.1)',  text:'#7C3AED', dot:'#8B5CF6', label:'Terjual' },
  'VOID':           { bg:'rgba(239,68,68,0.1)',   text:'#DC2626', dot:'#EF4444', label:'VOID' },
}
const today = new Date().toISOString().split('T')[0]
const inp = "w-full px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400 bg-white/80 border border-gray-200/70 font-mono"
const inpNormal = "w-full px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400 bg-white/80 border border-gray-200/70"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Status Badge ─────────────────────────────────────────────────────────────
function SBadge({s}:{s:string}){
  const c=STATUS_CFG[s]??{bg:'rgba(148,163,184,0.1)',text:'#64748B'}
  return<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"style={{background:c.bg,color:c.text}}>{s}</span>
}

// ─── Range Row Component ──────────────────────────────────────────────────────
function RangeRow({idx,start,end,onStartChange,onEndChange,onRemove,preview}:{
  idx:number;start:string;end:string;
  onStartChange:(v:string)=>void;onEndChange:(v:string)=>void;
  onRemove:()=>void;
  preview:{codes:string[];error?:string}
}){
  return(
    <div className="rounded-2xl p-4 space-y-3"
      style={{background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.12)'}}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-violet-600">Range {idx+1}</span>
        {idx>0&&<button onClick={onRemove}className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100"><X size={11}/></button>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase block mb-1">Kode Awal *</label>
          <input value={start} onChange={e=>onStartChange(e.target.value.toUpperCase())} placeholder="002BYG" className={inp}/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase block mb-1">Kode Akhir *</label>
          <input value={end} onChange={e=>onEndChange(e.target.value.toUpperCase())} placeholder="002BYZ" className={inp}/>
        </div>
      </div>
      {preview.error?(
        <p className="text-xs text-red-500 font-medium">{preview.error}</p>
      ):preview.codes.length>0&&(
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-violet-600">{preview.codes.length} kode akan diregistrasi</p>
          <div className="flex gap-1.5 flex-wrap max-h-16 overflow-hidden">
            {preview.codes.slice(0,20).map((c,i)=>(
              <span key={i}className="text-[11px] font-mono px-2 py-0.5 rounded-lg"
                style={{background:'rgba(255,255,255,0.9)',border:'1px solid rgba(139,92,246,0.2)',color:'#5B21B6'}}>
                {c}
              </span>
            ))}
            {preview.codes.length>20&&<span className="text-[11px] text-gray-400 self-center">+{preview.codes.length-20} lagi</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Registration Modal ───────────────────────────────────────────────────────
function RegisterModal({packings,onClose,onSubmit,isPending,error}:{
  packings:any[];onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const [packingId,setPackingId]=useState(String(packings[0]?.id??''))
  const [tanggal,setTanggal]=useState(today)
  const [ranges,setRanges]=useState<{start:string;end:string}[]>([{start:'',end:''}])
  const [previews,setPreviews]=useState<{codes:string[];error?:string}[]>([{codes:[]}])
  const [allCodes,setAllCodes]=useState<string[]>([])
  const [editMode,setEditMode]=useState(false)
  const [editCodes,setEditCodes]=useState<string[]>([])

  const selPacking=packings.find(p=>p.id===parseInt(packingId))
  const remainingSlots=selPacking?(selPacking.pcs_dipack-(selPacking.shieldtag_count??0)):0

  // Update preview whenever ranges change
  useEffect(()=>{
    const newPreviews=ranges.map(r=>{
      if(!r.start||!r.end)return{codes:[]}
      const result=generateRange(r.start,r.end)
      if('error' in result)return{codes:[],error:result.error}
      return{codes:result}
    })
    setPreviews(newPreviews)
    const merged=newPreviews.flatMap(p=>p.codes)
    const unique=[...new Set(merged)]
    setAllCodes(unique)
    if(editMode)setEditCodes(unique)
  },[ranges,editMode])

  function updateRange(idx:number,field:'start'|'end',val:string){
    setRanges(p=>p.map((r,i)=>i===idx?{...r,[field]:val}:r))
  }
  function addRange(){setRanges(p=>[...p,{start:'',end:''}])}
  function removeRange(idx:number){setRanges(p=>p.filter((_,i)=>i!==idx))}

  function submit(){
    if(!packingId||allCodes.length===0)return
    const finalCodes=editMode?editCodes:allCodes
    const fd=new FormData()
    fd.set('packing_id',packingId)
    fd.set('tanggal',tanggal)
    fd.set('kodes',JSON.stringify(finalCodes.filter(Boolean).map(c=>c.toUpperCase())))
    onSubmit(fd)
  }

  const totalValid=editMode?editCodes.filter(Boolean).length:allCodes.length
  const hasError=previews.some(p=>p.error)

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.95)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registrasi Shieldtag</h2>
            <p className="text-xs text-violet-500 font-medium mt-0.5">Input range kode dari fisik stiker</p>
          </div>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[78vh]">
          <F label="Packing (Siap Shieldtag)" req>
            <select value={packingId} onChange={e=>setPackingId(e.target.value)} className={inpNormal}>
              {packings.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.kode} · {p.gramasi}gr · {p.pcs_dipack-(p.shieldtag_count??0)} slot tersisa
                </option>
              ))}
            </select>
          </F>
          {selPacking&&(
            <div className="px-3 py-2 rounded-xl text-xs font-medium text-violet-600"style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
              {selPacking.batch_kode} · {selPacking.gramasi}gr · {selPacking.pcs_dipack} PCS · Sisa {remainingSlots} slot shieldtag
            </div>
          )}
          <F label="Tanggal Registrasi" req>
            <input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className={inpNormal}/>
          </F>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Range Kode Shieldtag</label>
              <button onClick={addRange}className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1"><Plus size={11}/>Tambah Range</button>
            </div>
            {ranges.map((r,i)=>(
              <RangeRow key={i} idx={i} start={r.start} end={r.end}
                onStartChange={v=>updateRange(i,'start',v)}
                onEndChange={v=>updateRange(i,'end',v)}
                onRemove={()=>removeRange(i)}
                preview={previews[i]??{codes:[]}}/>
            ))}
          </div>

          {/* Total summary */}
          {totalValid>0&&!hasError&&(
            <div className="px-4 py-3 rounded-2xl"style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)'}}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-700">Total: {totalValid} kode</span>
                {totalValid>remainingSlots&&<span className="text-xs text-red-500 font-semibold">⚠️ Melebihi slot ({remainingSlots})</span>}
              </div>
            </div>
          )}

          {/* Edit mode toggle */}
          {allCodes.length>0&&!hasError&&(
            <button onClick={()=>{setEditMode(!editMode);setEditCodes([...allCodes])}}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={editMode?{background:'rgba(139,92,246,0.1)',color:'#7C3AED',border:'1px solid rgba(139,92,246,0.2)'}:{background:'rgba(255,255,255,0.9)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
              <RefreshCw size={12}/>{editMode?'Mode Edit Aktif — klik untuk nonaktifkan':'Edit Kode Individual'}
            </button>
          )}

          {/* Edit individual codes */}
          {editMode&&editCodes.length>0&&(
            <div className="rounded-2xl p-4 space-y-2"style={{background:'rgba(255,255,255,0.7)',border:'1px solid rgba(209,213,219,0.4)'}}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Edit Kode Individual (contoh: ganti yang rusak)</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {editCodes.map((code,i)=>(
                  <input key={i} value={code} onChange={e=>setEditCodes(p=>p.map((c,j)=>j===i?e.target.value.toUpperCase():c))}
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-gray-200/70 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-400/40"/>
                ))}
              </div>
            </div>
          )}

          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}

          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button onClick={submit}
              disabled={isPending||totalValid===0||hasError||totalValid>remainingSlots}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 16px rgba(139,92,246,0.35)'}}>
              {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending?'Menyimpan...':`Daftar ${totalValid} Shieldtag`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── VOID Modal ───────────────────────────────────────────────────────────────
function VoidModal({st,onClose,onConfirm,isPending}:{st:any;onClose:()=>void;onConfirm:(reason:string)=>void;isPending:boolean}){
  const [reason,setReason]=useState('')
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-sm rounded-3xl p-6"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(239,68,68,0.15)'}}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24}className="text-red-500"/></div>
        <h2 className="text-lg font-bold text-gray-900 text-center">VOID Shieldtag?</h2>
        <p className="text-sm text-gray-500 text-center mt-1 mb-4"><span className="font-mono font-bold text-gray-700">{st.kode}</span> akan di-VOID</p>
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Alasan VOID (wajib)..."
          className="w-full px-4 py-3 text-sm rounded-2xl border border-gray-200/70 bg-white/80 focus:outline-none focus:ring-2 focus:ring-red-400/40 mb-4"/>
        <div className="flex gap-3">
          <button onClick={onClose}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={()=>onConfirm(reason)} disabled={isPending||!reason.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
            {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending?'Memproses...':'VOID'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel({history}:{history:any[]}){
  if(!history?.length)return<p className="text-xs text-gray-400 italic">Tidak ada histori</p>
  return(
    <div className="space-y-2">
      {history.map((h:any,i:number)=>(
        <div key={i}className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
              style={{background:STATUS_CFG[h.status]?.dot??'#94A3B8'}}/>
            {i<history.length-1&&<div className="w-0.5 flex-1 mt-0.5 bg-gray-200"/>}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SBadge s={h.status}/>
              <span className="text-[11px] text-gray-400">{formatDate(h.tanggal)}</span>
              {h.lokasi&&<span className="text-[11px] text-gray-500">{h.lokasi}</span>}
            </div>
            {h.catatan&&<p className="text-[11px] text-gray-400 italic mt-0.5">{h.catatan}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// Range generator imported from utils

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ShieldtagClient({shieldtags,packingsForReg,userRole,userName}:Props){
  const [isPending,startTransition]=useTransition()
  const [modal,setModal]=useState<'register'|'void'|null>(null)
  const [activeVoid,setActiveVoid]=useState<any|null>(null)
  const [err,setErr]=useState('')
  const [search,setSearch]=useState('')
  const [filterStatus,setFilterStatus]=useState<string>('Semua')
  const [expandedId,setExpandedId]=useState<number|null>(null)
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500)}
  const canManage=['owner','admin_pusat','spv'].includes(userRole)

  const filtered=shieldtags.filter(st=>{
    if(filterStatus!=='Semua'&&st.status!==filterStatus)return false
    const q=search.toLowerCase()
    return!q||st.kode?.toLowerCase().includes(q)||st.batch_kode?.toLowerCase().includes(q)||st.gramasi?.includes(q)||st.lokasi?.toLowerCase().includes(q)
  })

  const counts=shieldtags.reduce((a,st)=>{a[st.status]=(a[st.status]??0)+1;return a},{} as Record<string,number>)

  function handleRegister(fd:FormData){
    setErr('');startTransition(async()=>{
      const r=await registerShieldtags(fd)
      if(r?.error){setErr(r.error);return}
      showToast(`✅ ${r?.count} Shieldtag berhasil diregistrasi`);setModal(null)
    })
  }
  function handleVoid(reason:string){
    if(!activeVoid)return
    startTransition(async()=>{
      const r=await voidShieldtag(activeVoid.id,activeVoid.kode,reason)
      if(r?.error){showToast(r.error,false);return}
      showToast('✅ Shieldtag di-VOID');setModal(null);setActiveVoid(null)
    })
  }

  const statTabs=['Semua','Aktif','Terdistribusi','Terjual','VOID']

  return(
    <div className="min-h-screen pb-24"style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"style={{color:'#111827',fontFamily:"'SF Pro Display','Inter',sans-serif"}}>Shieldtag</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{shieldtags.length} Shieldtag terdaftar</p>
          </div>
          {canManage&&packingsForReg.length>0&&(
            <button onClick={()=>{setModal('register');setErr('')}}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>
              <Plus size={15}/> Registrasi Shieldtag
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {label:'Aktif',val:counts['Aktif']??0,color:'#22C55E',bg:'rgba(34,197,94,0.06)'},
            {label:'Terdistribusi',val:counts['Terdistribusi']??0,color:'#3B82F6',bg:'rgba(59,130,246,0.06)'},
            {label:'Terjual',val:counts['Terjual']??0,color:'#8B5CF6',bg:'rgba(139,92,246,0.06)'},
            {label:'VOID',val:counts['VOID']??0,color:'#EF4444',bg:'rgba(239,68,68,0.06)'},
          ].map(c=>(
            <div key={c.label}className="rounded-2xl p-4 text-center cursor-pointer"
              style={{background:c.bg,border:`1px solid ${c.color}20`}}
              onClick={()=>setFilterStatus(filterStatus===c.label?'Semua':c.label)}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-bold mt-0.5"style={{color:c.color,fontFamily:"'SF Pro Display','Inter',sans-serif"}}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15}className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode shieldtag, batch, lokasi..."
              className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
              style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)'}}/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statTabs.map(t=>(
              <button key={t} onClick={()=>setFilterStatus(t)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={filterStatus===t
                  ?{background:STATUS_CFG[t]?.dot??'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:`0 4px 12px ${STATUS_CFG[t]?.dot??'#8B5CF6'}40`}
                  :{background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
                {t}{t!=='Semua'&&(counts[t]??0)>0&&<span className="ml-1 text-[10px] opacity-75">{counts[t]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.72)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 8px 40px rgba(139,92,246,0.08)'}}>
          {/* Header */}
          <div className="grid px-5 py-3.5 border-b text-[10px] font-bold text-gray-400 tracking-widest uppercase"
            style={{gridTemplateColumns:'130px 1fr 70px 80px 100px 110px 90px 60px',gap:'12px',borderColor:'rgba(243,244,246,0.9)',background:'rgba(249,250,251,0.6)'}}>
            {['KODE','BATCH / PACKING','GRAMASI','STATUS','LOKASI','TGL REGIS','AKSI',''].map((h,i)=>(
              <span key={i}className="whitespace-nowrap">{h}</span>
            ))}
          </div>

          {filtered.length===0?(
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"style={{background:'rgba(139,92,246,0.08)'}}>
                <Tag size={28}className="text-violet-300"/>
              </div>
              <p className="text-sm font-medium text-gray-400">Belum ada Shieldtag terdaftar</p>
              {packingsForReg.length>0&&<p className="text-xs text-violet-400 mt-1">Klik "Registrasi Shieldtag" untuk mulai</p>}
            </div>
          ):filtered.map((st,idx)=>{
            const hist=Array.isArray(st.shieldtag_history)?st.shieldtag_history:[]
            const isExp=expandedId===st.id
            return(
              <div key={st.id}>
                <div className={cn('grid px-5 py-4 items-center transition-colors',idx>0?'border-t':'',isExp?'':'hover:bg-gray-50/40')}
                  style={{gridTemplateColumns:'130px 1fr 70px 80px 100px 110px 90px 60px',gap:'12px',borderColor:'rgba(243,244,246,0.7)',background:isExp?'rgba(139,92,246,0.03)':''}}>
                  {/* KODE */}
                  <span className="font-mono text-sm font-bold tracking-wide"
                    style={{color:'#5B21B6'}}>{st.kode}</span>
                  {/* BATCH/PACKING */}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate">{st.batch_kode}</p>
                    <p className="text-[11px] text-gray-400 truncate">Packing #{st.packing_id}</p>
                  </div>
                  {/* GRAMASI */}
                  <span className="text-xs font-semibold text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{background:'rgba(245,158,11,0.1)'}}>{st.gramasi}gr</span>
                  {/* STATUS */}
                  <div><SBadge s={st.status}/></div>
                  {/* LOKASI */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={10}className="text-gray-400 flex-shrink-0"/>
                    <span className="text-xs text-gray-600 truncate">{st.lokasi??'—'}</span>
                  </div>
                  {/* TGL REGIS */}
                  <span className="text-xs text-gray-400">{formatDate(st.tgl_regis)}</span>
                  {/* AKSI */}
                  <div className="flex items-center gap-1">
                    {canManage&&st.status!=='VOID'&&(
                      <button onClick={()=>{setActiveVoid(st);setModal('void')}}
                        className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all"title="VOID">
                        <Trash2 size={11}/>
                      </button>
                    )}
                  </div>
                  {/* EXPAND */}
                  <button onClick={()=>setExpandedId(isExp?null:st.id)}
                    className="w-7 h-7 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 hover:scale-110 transition-all">
                    {isExp?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                  </button>
                </div>

                {/* Expanded: History */}
                {isExp&&(
                  <div className="px-5 pb-5 border-t"style={{borderColor:'rgba(139,92,246,0.1)',background:'rgba(139,92,246,0.02)'}}>
                    <div className="pt-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          {label:'Kode',val:st.kode,mono:true},
                          {label:'Batch',val:st.batch_kode},
                          {label:'Gramasi',val:`${st.gramasi} gr`},
                          {label:'Didaftarkan Oleh',val:st.registered_by??'—'},
                        ].map(item=>(
                          <div key={item.label}className="rounded-xl p-3"style={{background:'rgba(255,255,255,0.7)'}}>
                            <p className="text-[10px] text-gray-400">{item.label}</p>
                            <p className={cn('text-sm font-bold text-gray-700 mt-0.5',item.mono?'font-mono':'')}>{item.val}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Riwayat</p>
                      <HistoryPanel history={hist}/>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {modal==='register'&&packingsForReg.length>0&&(
        <RegisterModal packings={packingsForReg} onClose={()=>setModal(null)}
          onSubmit={handleRegister} isPending={isPending} error={err}/>
      )}
      {modal==='void'&&activeVoid&&(
        <VoidModal st={activeVoid} onClose={()=>{setModal(null);setActiveVoid(null)}}
          onConfirm={handleVoid} isPending={isPending}/>
      )}
    </div>
  )
}
