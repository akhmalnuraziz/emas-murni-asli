'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Plus, Search, Edit2, Trash2, Printer, Check, AlertTriangle,
  X, Package, ChevronDown
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createPacking, editPacking, voidPacking, markPrinted } from '@/app/(dashboard)/packing-log/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  packingList: any[]
  siapPackingItems: any[]  // produksi items siap packing dengan pcs_tersisa
  userRole: UserRole
  userName: string
}

const today = new Date().toISOString().split('T')[0]
const inp = "w-full px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400 bg-white/80 border border-gray-200/70"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Print Component ──────────────────────────────────────────────────────────
function PrintView({packing}:{packing:any}){
  const now = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})
  const selisihAbs = Math.abs(packing.selisih_gram ?? 0)
  return(
    <div id={`print-${packing.id}`} className="hidden print:block p-8 text-sm font-sans">
      <div className="border-2 border-gray-300 p-6">
        <div className="text-center mb-6 border-b-2 pb-4">
          <h1 className="text-xl font-black">PT EMAS MURNI ASLI</h1>
          <p className="text-sm text-gray-500">Surat Jalan Packing Produksi</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div className="space-y-1">
            <div className="flex gap-2"><span className="w-28 text-gray-500">No. Packing</span><span className="font-bold">{packing.kode}</span></div>
            <div className="flex gap-2"><span className="w-28 text-gray-500">Tanggal</span><span>{formatDate(packing.tanggal)}</span></div>
            <div className="flex gap-2"><span className="w-28 text-gray-500">Batch</span><span>{packing.batch_kode}</span></div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-2"><span className="w-28 text-gray-500">Gramasi</span><span className="font-bold">{packing.gramasi} gr</span></div>
            <div className="flex gap-2"><span className="w-28 text-gray-500">PCS Dipack</span><span className="font-bold">{packing.pcs_dipack} PCS</span></div>
            <div className="flex gap-2"><span className="w-28 text-gray-500">PIC</span><span>{packing.pic_packing ?? '—'}</span></div>
          </div>
        </div>
        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">Keterangan</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Nilai</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-gray-300 px-3 py-2">Total Gram Target</td><td className="border border-gray-300 px-3 py-2 text-right font-semibold">{(parseFloat(packing.gramasi||0)*packing.pcs_dipack).toFixed(3)} gr</td></tr>
            <tr><td className="border border-gray-300 px-3 py-2">Total Gram Aktual</td><td className="border border-gray-300 px-3 py-2 text-right font-semibold">{packing.total_gram_aktual} gr</td></tr>
            <tr className={selisihAbs>0.05?'bg-red-50':selisihAbs>0?'bg-amber-50':'bg-green-50'}>
              <td className="border border-gray-300 px-3 py-2 font-bold">Selisih</td>
              <td className="border border-gray-300 px-3 py-2 text-right font-bold">
                {selisihAbs===0?'Pas (0)':((packing.selisih_gram??0)>0?'+':'')+Number(packing.selisih_gram??0).toFixed(3)+' gr'}
              </td>
            </tr>
          </tbody>
        </table>
        {packing.catatan&&<p className="text-xs text-gray-500 mb-4">Catatan: {packing.catatan}</p>}
        <div className="grid grid-cols-3 gap-8 mt-8 text-center text-xs">
          {['Dibuat','Diperiksa','Disetujui'].map(l=>(
            <div key={l}><p className="font-semibold mb-12">{l}</p><div className="border-t border-gray-400"/><p className="mt-1 text-gray-400">( ............... )</p></div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Dicetak: {now}</p>
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({items,onClose,onSubmit,isPending,error}:{
  items:any[];onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const [selectedId,setSelectedId]=useState(items[0]?.id??'')
  const selected=items.find(i=>i.id===parseInt(String(selectedId)))
  const gramasi=selected?parseFloat(selected.gramasi):0
  const [pcs,setPcs]=useState('')
  const [gram,setGram]=useState('')
  const pcsNum=parseInt(pcs)||0
  const selisih=gram&&pcsNum?parseFloat(gram)-(gramasi*pcsNum):null

  function submit(e:React.FormEvent){
    e.preventDefault()
    const fd=new FormData(e.currentTarget as HTMLFormElement)
    onSubmit(fd)
  }

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18),0 8px 32px rgba(0,0,0,0.1)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Catat Packing Baru</h2>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <F label="Item Produksi (Siap Packing)" req>
            <select name="produksi_item_id" value={selectedId} onChange={e=>setSelectedId(e.target.value)} className={inp} required>
              {items.map(i=><option key={i.id} value={i.id}>{i.nama_item||i.kode} · {i.gramasi}gr · {i.pcs_tersisa} PCS tersisa</option>)}
            </select>
          </F>
          {selected&&(
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
              <span className="text-violet-600 font-medium">{selected.batch_kode} · {selected.gramasi}gr per PCS · Sisa {selected.pcs_tersisa} PCS</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS yang Dipack" req>
              <input name="pcs_dipack" type="number" min="1" max={selected?.pcs_tersisa??999} value={pcs} onChange={e=>setPcs(e.target.value)} placeholder={`Max ${selected?.pcs_tersisa??0}`} className={inp} required/>
            </F>
            <F label="Total Gram Aktual" req>
              <input name="total_gram_aktual" type="number" step="0.001" value={gram} onChange={e=>setGram(e.target.value)} placeholder={pcsNum>0?`Target: ${(gramasi*pcsNum).toFixed(3)}`:'0.000'} className={inp} required/>
            </F>
          </div>
          {selisih!==null&&(
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold',
              Math.abs(selisih)<0.001?'text-emerald-700':'text-amber-700')}
              style={{background:Math.abs(selisih)<0.001?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)'}}>
              {Math.abs(selisih)<0.001?'✓ Pas':'Selisih: '}{Math.abs(selisih)<0.001?'':((selisih>0?'+':'')+selisih.toFixed(3)+' gr')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Packing" req>
              <input name="tanggal" type="date" defaultValue={today} className={inp} required/>
            </F>
            <F label="PIC / Operator">
              <input name="pic" placeholder="Nama operator" className={inp}/>
            </F>
          </div>
          <F label="Catatan">
            <input name="catatan" placeholder="Keterangan tambahan..." className={inp}/>
          </F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button"onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending}className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 16px rgba(139,92,246,0.3)'}}>
              {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending?'Menyimpan...':'Simpan Packing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({packing,onClose,onSubmit,isPending,error}:{
  packing:any;onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const gramasi=parseFloat(packing.gramasi||0)
  const [pcs,setPcs]=useState(String(packing.pcs_dipack??''))
  const [gram,setGram]=useState(String(packing.total_gram_aktual??''))
  const pcsNum=parseInt(pcs)||0
  const selisih=gram&&pcsNum?parseFloat(gram)-(gramasi*pcsNum):null

  function submit(e:React.FormEvent){
    e.preventDefault();const fd=new FormData(e.currentTarget as HTMLFormElement);onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900">Edit Packing</h2><p className="text-xs text-violet-500 font-medium mt-0.5">{packing.kode}</p></div>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req><input name="pcs_dipack" type="number" min="1" value={pcs} onChange={e=>setPcs(e.target.value)} className={inp} required/></F>
            <F label="Total Gram Aktual" req><input name="total_gram_aktual" type="number" step="0.001" value={gram} onChange={e=>setGram(e.target.value)} placeholder={pcsNum>0?`Target: ${(gramasi*pcsNum).toFixed(3)}`:'0.000'} className={inp} required/></F>
          </div>
          {selisih!==null&&(
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold',Math.abs(selisih)<0.001?'text-emerald-700':'text-amber-700')}
              style={{background:Math.abs(selisih)<0.001?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)'}}>
              {Math.abs(selisih)<0.001?'✓ Pas':'Selisih: '}{Math.abs(selisih)<0.001?'':((selisih>0?'+':'')+selisih.toFixed(3)+' gr')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={packing.tanggal} className={inp} required/></F>
            <F label="PIC / Operator"><input name="pic" defaultValue={packing.pic_packing??''} placeholder="Nama operator" className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" defaultValue={packing.catatan??''} placeholder="Keterangan..." className={inp}/></F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button"onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending}className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
              {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending?'Menyimpan...':'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PackingLogClient({packingList,siapPackingItems,userRole,userName}:Props){
  const [isPending,startTransition]=useTransition()
  const [modal,setModal]=useState<'create'|'edit'|'delete'|null>(null)
  const [active,setActive]=useState<any|null>(null)
  const [err,setErr]=useState('')
  const [search,setSearch]=useState('')
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500)}
  const canManage=['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete=['owner','admin_pusat'].includes(userRole)

  const filtered=packingList.filter(p=>{
    const q=search.toLowerCase()
    return!q||p.kode?.toLowerCase().includes(q)||p.batch_kode?.toLowerCase().includes(q)||p.gramasi?.includes(q)||p.pic_packing?.toLowerCase().includes(q)
  })

  // Summary
  const totalPcs=filtered.reduce((s,p)=>s+(p.pcs_dipack||0),0)
  const totalGram=filtered.reduce((s,p)=>s+(parseFloat(p.total_gram_aktual||0)),0)

  function handleCreate(fd:FormData){
    setErr('')
    startTransition(async()=>{
      const r=await createPacking(fd)
      if(r?.error){setErr(r.error);return}
      showToast(`✅ ${r?.kode} berhasil dicatat`);setModal(null)
    })
  }
  function handleEdit(fd:FormData){
    if(!active)return;setErr('')
    startTransition(async()=>{
      const r=await editPacking(active.id,active.kode,fd)
      if(r?.error){setErr(r.error);return}
      showToast('✅ Packing diperbarui');setModal(null)
    })
  }
  function handleDelete(){
    if(!active)return
    startTransition(async()=>{
      const r=await voidPacking(active.id,active.kode)
      if(r?.error){showToast(r.error,false);return}
      showToast('🗑️ Packing dihapus');setModal(null)
    })
  }
  function handlePrint(packing:any){
    markPrinted(packing.id).catch(console.error)
    const content=document.getElementById(`print-${packing.id}`)
    if(!content)return
    const w=window.open('','_blank')
    if(!w)return
    w.document.write(`<!DOCTYPE html><html><head><title>Packing ${packing.kode}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px}@media print{.no-print{display:none}}</style></head><body>${content.innerHTML}<script>window.onload=()=>{window.print();window.close()}</script></body></html>`)
    w.document.close()
  }

  return(
    <div className="min-h-screen pb-24"style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"style={{color:'#111827',fontFamily:"'SF Pro Display','Inter',sans-serif"}}>Packing Log</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{packingList.length} record packing</p>
          </div>
          {canManage&&siapPackingItems.length>0&&(
            <button onClick={()=>{setModal('create');setErr('')}}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>
              <Plus size={15}/> Catat Packing
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15}className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode, batch, gramasi, PIC..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)'}}/>
        </div>

        {/* Summary cards */}
        {filtered.length>0&&(
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'Total Record',val:String(filtered.length),color:'#8B5CF6'},
              {label:'Total PCS Dipack',val:`${totalPcs} PCS`,color:'#3B82F6'},
              {label:'Total Gram Aktual',val:`${totalGram.toFixed(3)} gr`,color:'#22C55E'},
            ].map(c=>(
              <div key={c.label}className="rounded-2xl p-4 text-center"style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.6)'}}>
                <p className="text-xs text-gray-400 font-medium">{c.label}</p>
                <p className="text-lg font-bold mt-0.5"style={{color:c.color}}>{c.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.72)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 8px 40px rgba(139,92,246,0.08)'}}>
          {/* Header */}
          <div className="grid px-5 py-3.5 border-b text-[10px] font-bold text-gray-400 tracking-widest uppercase"
            style={{gridTemplateColumns:'140px 1fr 80px 60px 90px 85px 90px 90px 120px',gap:'12px',borderColor:'rgba(243,244,246,0.9)',background:'rgba(249,250,251,0.6)'}}>
            {['KODE','ITEM / BATCH','TGL','GRAMASI','PCS','TOTAL GRAM','SELISIH','STATUS','AKSI'].map((h,i)=>(
              <span key={h} className={cn(i===2||i===5?'hidden sm:block':i===6?'hidden md:block':'')}>{h}</span>
            ))}
          </div>

          {filtered.length===0?(
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"style={{background:'rgba(139,92,246,0.08)'}}>
                <Package size={28}className="text-violet-300"/>
              </div>
              <p className="text-sm font-medium text-gray-400">
                {siapPackingItems.length===0?'Belum ada item dengan status Siap Packing':'Belum ada record packing'}
              </p>
              {siapPackingItems.length>0&&<p className="text-xs text-gray-300 mt-1">Klik "Catat Packing" untuk mulai</p>}
            </div>
          ):filtered.map((p,idx)=>{
            const selisih=Number(p.selisih_gram??0)
            const selisihAbs=Math.abs(selisih)
            const isPrinted=p.status_surat==='sudah_cetak'
            return(
              <div key={p.id}>
                <div className={cn('grid px-5 py-4 items-center transition-colors hover:bg-gray-50/40',idx>0?'border-t':'')}
                  style={{gridTemplateColumns:'140px 1fr 80px 60px 90px 85px 90px 90px 120px',gap:'12px',borderColor:'rgba(243,244,246,0.7)'}}>
                  {/* KODE */}
                  <span className="text-xs font-mono font-bold text-violet-600">{p.kode}</span>
                  {/* ITEM */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.produksi_item?.nama_item||p.produksi_item?.kode||'—'}</p>
                    <p className="text-xs text-gray-400 truncate">{p.batch_kode} · {p.pic_packing||'—'}</p>
                  </div>
                  {/* TGL */}
                  <span className="hidden sm:block text-xs text-gray-500">{formatDate(p.tanggal)}</span>
                  {/* GRAMASI */}
                  <span className="text-sm font-semibold text-gray-700">{p.gramasi}gr</span>
                  {/* PCS */}
                  <span className="text-sm font-bold text-gray-800">{p.pcs_dipack}</span>
                  {/* TOTAL GRAM */}
                  <span className="hidden sm:block text-sm font-semibold text-gray-700">{Number(p.total_gram_aktual).toFixed(3)}</span>
                  {/* SELISIH */}
                  <div className="hidden md:block">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                      selisihAbs<0.001?'text-emerald-700':selisihAbs<=0.05?'text-amber-700':'text-red-700')}
                      style={{background:selisihAbs<0.001?'rgba(34,197,94,0.1)':selisihAbs<=0.05?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)'}}>
                      {selisihAbs<0.001?'Pas':(selisih>0?'+':'')+selisih.toFixed(3)+' gr'}
                    </span>
                  </div>
                  {/* STATUS */}
                  <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full',isPrinted?'text-emerald-700':'text-gray-500')}
                    style={{background:isPrinted?'rgba(34,197,94,0.1)':'rgba(107,114,128,0.1)'}}>
                    {isPrinted?'✓ Cetak':'Belum Cetak'}
                  </span>
                  {/* AKSI */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>handlePrint(p)} title="Print"
                      className="w-8 h-8 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center hover:bg-violet-100 hover:scale-110 transition-all">
                      <Printer size={13}/>
                    </button>
                    {canManage&&(
                      <button onClick={()=>{setActive(p);setErr('');setModal('edit')}} title="Edit"
                        className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 hover:scale-110 transition-all">
                        <Edit2 size={13}/>
                      </button>
                    )}
                    {canDelete&&(
                      <button onClick={()=>{setActive(p);setModal('delete')}} title="Hapus"
                        className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>
                <PrintView packing={p}/>
              </div>
            )
          })}
        </div>
      </div>

      {modal==='create'&&<CreateModal items={siapPackingItems} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='edit'&&active&&<EditModal packing={active} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='delete'&&active&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(239,68,68,0.15)'}}>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24}className="text-red-500"/></div>
            <h2 className="text-lg font-bold text-gray-900">Hapus Packing?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{active.kode}</span> akan dihapus. Status produksi akan kembali ke Siap Packing.</p>
            <div className="flex gap-3">
              <button onClick={()=>setModal(null)}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
              <button onClick={handleDelete} disabled={isPending}className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
                {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending?'Menghapus...':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
