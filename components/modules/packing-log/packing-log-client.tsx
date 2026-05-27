'use client'

import { useState, useTransition } from 'react'
import {
  Plus, Search, Edit2, Trash2, Printer, Check,
  AlertTriangle, X, Package, Camera
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createPacking, editPacking, voidPacking, markPrinted } from '@/app/(dashboard)/packing-log/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  packingList: any[]
  siapPackingItems: any[]
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

// ─── Print View (hidden, used by print logic) ─────────────────────────────────
function PrintView({p}:{p:any}){
  const selisihAbs = Math.abs(Number(p.selisih_gram ?? 0))
  const selisih = Number(p.selisih_gram ?? 0)
  const target = parseFloat(p.gramasi||0) * (p.pcs_dipack||0)
  return (
    <div id={`print-${p.id}`} className="hidden">
      <div style={{fontFamily:'Arial,sans-serif',padding:'32px',maxWidth:'600px',margin:'0 auto',border:'2px solid #333'}}>
        <div style={{textAlign:'center',borderBottom:'2px solid #333',paddingBottom:'16px',marginBottom:'20px'}}>
          <h1 style={{fontSize:'20px',fontWeight:'900',margin:'0'}}>PT EMAS MURNI ASLI</h1>
          <p style={{fontSize:'13px',color:'#666',margin:'4px 0 0'}}>Surat Packing Produksi</p>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',marginBottom:'20px'}}>
          <tbody>
            {[
              ['No. Packing', p.kode],
              ['Tanggal', formatDate(p.tanggal)],
              ['Batch', p.batch_kode],
              ['Gramasi', `${p.gramasi} gr`],
              ['PCS Dipack', `${p.pcs_dipack} PCS`],
              ['Total Gram Target', `${target.toFixed(3)} gr`],
              ['Total Gram Aktual', `${Number(p.total_gram_aktual).toFixed(3)} gr`],
              ['Selisih', selisihAbs < 0.001 ? 'Pas (0)' : `${selisih > 0 ? '+' : ''}${selisih.toFixed(3)} gr`],
              ['PIC / Operator', p.pic_packing || '—'],
              ['Catatan', p.catatan || '—'],
            ].map(([k,v])=>(
              <tr key={k}>
                <td style={{padding:'6px 12px',border:'1px solid #ddd',fontWeight:'600',background:'#f9f9f9',width:'45%'}}>{k}</td>
                <td style={{padding:'6px 12px',border:'1px solid #ddd'}}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'40px',marginTop:'40px',textAlign:'center',fontSize:'12px'}}>
          {['Dibuat','Diperiksa','Disetujui'].map(l=>(
            <div key={l}>
              <p style={{fontWeight:'600',marginBottom:'50px'}}>{l}</p>
              <div style={{borderTop:'1px solid #333'}}/>
              <p style={{color:'#999',marginTop:'4px'}}>(................)</p>
            </div>
          ))}
        </div>
        <p style={{textAlign:'center',fontSize:'11px',color:'#999',marginTop:'20px'}}>Dicetak: {new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</p>
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({items,onClose,onSubmit,isPending,error}:{
  items:any[];onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const [selId,setSelId]=useState(String(items[0]?.id??''))
  const sel=items.find(i=>i.id===parseInt(selId))
  const gr=sel?parseFloat(sel.gramasi):0
  const [pcs,setPcs]=useState('')
  const [gram,setGram]=useState('')
  const pcsN=parseInt(pcs)||0
  const selisih=gram&&pcsN?parseFloat(gram)-(gr*pcsN):null
  function submit(e:React.FormEvent){e.preventDefault();onSubmit(new FormData(e.currentTarget as HTMLFormElement))}
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Catat Packing Baru</h2>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <F label="Item Produksi (Siap Packing)" req>
            <select name="produksi_item_id" value={selId} onChange={e=>setSelId(e.target.value)} className={inp} required>
              {items.map(i=><option key={i.id} value={i.id}>{i.nama_item||i.kode} · {i.gramasi}gr · {i.pcs_tersisa} PCS tersisa</option>)}
            </select>
          </F>
          {sel&&<div className="px-3 py-2 rounded-xl text-xs text-violet-600 font-medium"style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
            {sel.batch_kode} · {sel.gramasi} gr/pcs · Sisa {sel.pcs_tersisa} PCS
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req>
              <input name="pcs_dipack" type="number" min="1" max={sel?.pcs_tersisa??999} value={pcs} onChange={e=>setPcs(e.target.value)} placeholder={`Max ${sel?.pcs_tersisa??0}`} className={inp} required/>
            </F>
            <F label="Total Gram Aktual" req>
              <input name="total_gram_aktual" type="number" step="0.001" value={gram} onChange={e=>setGram(e.target.value)} placeholder={pcsN>0?`Target: ${(gr*pcsN).toFixed(3)}`:'0.000'} className={inp} required/>
            </F>
          </div>
          {selisih!==null&&(
            <div className={cn('px-3 py-2 rounded-xl text-xs font-semibold',Math.abs(selisih)<0.001?'text-emerald-700':'text-amber-700')}
              style={{background:Math.abs(selisih)<0.001?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)'}}>
              {Math.abs(selisih)<0.001?'✓ Pas — berat sesuai target':`Selisih: ${selisih>0?'+':''}${selisih.toFixed(3)} gr dari target ${(gr*pcsN).toFixed(3)} gr`}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={today} className={inp} required/></F>
            <F label="PIC / Operator"><input name="pic" placeholder="Nama operator" className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" placeholder="Keterangan tambahan..." className={inp}/></F>
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
function EditModal({p,onClose,onSubmit,isPending,error}:{p:any;onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string}){
  const gr=parseFloat(p.gramasi||0)
  const [pcs,setPcs]=useState(String(p.pcs_dipack??''))
  const [gram,setGram]=useState(String(p.total_gram_aktual??''))
  const pcsN=parseInt(pcs)||0
  const selisih=gram&&pcsN?parseFloat(gram)-(gr*pcsN):null
  function submit(e:React.FormEvent){e.preventDefault();onSubmit(new FormData(e.currentTarget as HTMLFormElement))}
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900">Edit Packing</h2><p className="text-xs text-violet-500 font-medium mt-0.5">{p.kode}</p></div>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req><input name="pcs_dipack" type="number" min="1" value={pcs} onChange={e=>setPcs(e.target.value)} className={inp} required/></F>
            <F label="Total Gram Aktual" req><input name="total_gram_aktual" type="number" step="0.001" value={gram} onChange={e=>setGram(e.target.value)} placeholder={pcsN>0?`Target: ${(gr*pcsN).toFixed(3)}`:'0.000'} className={inp} required/></F>
          </div>
          {selisih!==null&&(
            <div className={cn('px-3 py-2 rounded-xl text-xs font-semibold',Math.abs(selisih)<0.001?'text-emerald-700':'text-amber-700')}
              style={{background:Math.abs(selisih)<0.001?'rgba(34,197,94,0.08)':'rgba(245,158,11,0.08)'}}>
              {Math.abs(selisih)<0.001?'✓ Pas':(`Selisih: ${selisih>0?'+':''}${selisih.toFixed(3)} gr`)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={p.tanggal} className={inp} required/></F>
            <F label="PIC / Operator"><input name="pic" defaultValue={p.pic_packing??''} className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" defaultValue={p.catatan??''} className={inp}/></F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button"onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit"disabled={isPending}className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
              {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending?'Menyimpan...':'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Packing Card (mobile) ────────────────────────────────────────────────────
function PackingCard({p,canManage,canDelete,onEdit,onDelete,onPrint}:{
  p:any;canManage:boolean;canDelete:boolean;onEdit:()=>void;onDelete:()=>void;onPrint:()=>void
}){
  const selisih=Number(p.selisih_gram??0)
  const selisihAbs=Math.abs(selisih)
  const fotoCount=Array.isArray(p.fotos)?p.fotos.length:0
  const stCount=p.shieldtag_count??0
  const isPrinted=p.status_surat==='sudah_cetak'
  return(
    <div className="rounded-2xl p-4 space-y-3"style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.5)',boxShadow:'0 2px 12px rgba(139,92,246,0.06)'}}>
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-violet-600">{p.kode}</span>
        <div className="flex items-center gap-1.5">
          {isPrinted&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-700"style={{background:'rgba(34,197,94,0.1)'}}>✓ Cetak</span>}
          <button onClick={onPrint}className="w-7 h-7 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center hover:bg-violet-100"title="Print"><Printer size={12}/></button>
          {canManage&&<button onClick={onEdit}className="w-7 h-7 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100"title="Edit"><Edit2 size={11}/></button>}
          {canDelete&&<button onClick={onDelete}className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100"title="Hapus"><Trash2 size={11}/></button>}
        </div>
      </div>
      {/* Info grid */}
      <div className="grid grid-cols-3 gap-2">
        <div><p className="text-[10px] text-gray-400 font-medium">BATCH</p><p className="text-xs font-bold text-gray-700">{p.batch_kode}</p></div>
        <div><p className="text-[10px] text-gray-400 font-medium">TANGGAL</p><p className="text-xs font-semibold text-gray-700">{formatDate(p.tanggal)}</p></div>
        <div><p className="text-[10px] text-gray-400 font-medium">GRAMASI</p><p className="text-xs font-bold text-gray-700">{p.gramasi} gr</p></div>
        <div><p className="text-[10px] text-gray-400 font-medium">DIPACK</p><p className="text-sm font-bold text-gray-800">{p.pcs_dipack} pcs</p></div>
        <div><p className="text-[10px] text-gray-400 font-medium">TOTAL BERAT</p><p className="text-xs font-semibold text-gray-700">{Number(p.total_gram_aktual).toFixed(3)} gr</p></div>
        <div>
          <p className="text-[10px] text-gray-400 font-medium">SELISIH</p>
          <span className={cn('text-xs font-bold',selisihAbs<0.001?'text-emerald-600':selisihAbs<=0.05?'text-amber-600':'text-red-600')}>
            {selisihAbs<0.001?'Pas':(selisih>0?'+':'')+selisih.toFixed(3)+' gr'}
          </span>
        </div>
      </div>
      {/* Bottom row */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-500"><span className="font-semibold">PIC:</span> {p.pic_packing||'—'}</span>
        <span className="text-xs text-gray-400">
          <Camera size={10} className="inline mr-1"/>{fotoCount>0?`${fotoCount} foto`:'—'}
        </span>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',stCount>0?'text-violet-700':'text-gray-400')}
          style={{background:stCount>0?'rgba(139,92,246,0.1)':'rgba(107,114,128,0.08)'}}>
          🏷 {stCount}/{p.pcs_dipack} terdaftar
        </span>
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

  const totalPcs=filtered.reduce((s,p)=>s+(p.pcs_dipack||0),0)
  const totalGram=filtered.reduce((s,p)=>s+(parseFloat(p.total_gram_aktual||0)),0)

  function handleCreate(fd:FormData){setErr('');startTransition(async()=>{const r=await createPacking(fd);if(r?.error){setErr(r.error);return}showToast(`✅ ${r?.kode} berhasil dicatat`);setModal(null)})}
  function handleEdit(fd:FormData){if(!active)return;setErr('');startTransition(async()=>{const r=await editPacking(active.id,active.kode,fd);if(r?.error){setErr(r.error);return}showToast('✅ Packing diperbarui');setModal(null)})}
  function handleDelete(){if(!active)return;startTransition(async()=>{const r=await voidPacking(active.id,active.kode);if(r?.error){showToast(r.error,false);return}showToast('🗑️ Packing dihapus');setModal(null)})}

  function handlePrint(p:any){
    markPrinted(p.id).catch(console.error)
    const el=document.getElementById(`print-${p.id}`)
    if(!el)return
    const w=window.open('','_blank')
    if(!w)return
    w.document.write(`<!DOCTYPE html><html><head><title>${p.kode}</title></head><body>${el.innerHTML}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
    w.document.close()
  }

  return(
    <div className="min-h-screen pb-24"style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      {/* Print views - hidden */}
      {filtered.map(p=><PrintView key={p.id} p={p}/>)}

      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"style={{color:'#111827',fontFamily:"'SF Pro Display','Inter',sans-serif"}}>Packing Log</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Otomatis update status produksi & buka jalur registrasi Shieldtag</p>
          </div>
          {canManage&&siapPackingItems.length>0&&(
            <button onClick={()=>{setModal('create');setErr('')}}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)',fontFamily:"'SF Pro Text','Inter',sans-serif"}}>
              <Plus size={15}/> Catat Packing
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15}className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode PKG, item, batch, PIC..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)',fontFamily:"'SF Pro Text','Inter',sans-serif"}}/>
        </div>

        {/* Summary */}
        {filtered.length>0&&(
          <div className="grid grid-cols-3 gap-3">
            {[
              {label:'Total Record',val:String(filtered.length),color:'#8B5CF6'},
              {label:'Total PCS Dipack',val:`${totalPcs} PCS`,color:'#3B82F6'},
              {label:'Total Gram',val:`${totalGram.toFixed(3)} gr`,color:'#22C55E'},
            ].map(c=>(
              <div key={c.label}className="rounded-2xl p-3 text-center"style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.6)'}}>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
                <p className="text-base font-bold mt-0.5"style={{color:c.color,fontFamily:"'SF Pro Display','Inter',sans-serif"}}>{c.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {filtered.length===0?(
            <div className="text-center py-12 rounded-3xl"style={{background:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.5)'}}>
              <Package size={32}className="mx-auto text-violet-200 mb-3"/>
              <p className="text-sm font-medium text-gray-400">Belum ada record packing</p>
              {siapPackingItems.length>0&&<p className="text-xs text-violet-400 mt-1">Klik "Catat Packing" untuk mulai</p>}
            </div>
          ):filtered.map(p=>(
            <PackingCard key={p.id} p={p} canManage={canManage} canDelete={canDelete}
              onEdit={()=>{setActive(p);setErr('');setModal('edit')}}
              onDelete={()=>{setActive(p);setModal('delete')}}
              onPrint={()=>handlePrint(p)}/>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block rounded-3xl overflow-auto"style={{background:'rgba(255,255,255,0.72)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 8px 40px rgba(139,92,246,0.08)'}}>
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b"style={{borderColor:'rgba(243,244,246,0.9)',background:'rgba(249,250,251,0.6)'}}>
                {['KODE','TANGGAL','BATCH','GRAMASI','PCS TOTAL','DIPACK','TOTAL BERAT','SELISIH','PIC','FOTO','SHIELDTAG','AKSI'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={12}className="text-center py-16">
                  <Package size={28}className="mx-auto text-violet-200 mb-3"/>
                  <p className="text-sm font-medium text-gray-400">Belum ada record packing</p>
                </td></tr>
              ):filtered.map((p,idx)=>{
                const selisih=Number(p.selisih_gram??0)
                const selisihAbs=Math.abs(selisih)
                const fotoCount=Array.isArray(p.fotos)?p.fotos.length:0
                const stCount=p.shieldtag_count??0
                const isPrinted=p.status_surat==='sudah_cetak'
                const pcsGood=p.produksi_item?.pcs_good??p.produksi_item?.pcs??'—'
                return(
                  <tr key={p.id} className={cn('border-t transition-colors hover:bg-violet-50/20',idx===0?'border-transparent':'')}
                    style={{borderColor:'rgba(243,244,246,0.7)'}}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-violet-600 whitespace-nowrap">{p.kode}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full text-violet-700"style={{background:'rgba(139,92,246,0.1)'}}>{p.batch_kode}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full text-amber-700"style={{background:'rgba(245,158,11,0.1)'}}>{p.gramasi} gr</span></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-600">{pcsGood}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{p.pcs_dipack} pcs</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{Number(p.total_gram_aktual).toFixed(3)} gr</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap',
                        selisihAbs<0.001?'text-emerald-700':selisihAbs<=0.05?'text-amber-700':'text-red-700')}
                        style={{background:selisihAbs<0.001?'rgba(34,197,94,0.1)':selisihAbs<=0.05?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)'}}>
                        {selisihAbs<0.001?'Pas':(selisih>0?'+':'')+selisih.toFixed(3)+' gr'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 whitespace-nowrap">{p.pic_packing||'—'}</td>
                    <td className="px-4 py-3">
                      {fotoCount>0
                        ?<span className="text-xs font-semibold px-2 py-0.5 rounded-full text-blue-600"style={{background:'rgba(59,130,246,0.1)'}}><Camera size={10} className="inline mr-1"/>{fotoCount}</span>
                        :<span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap',stCount>0?'text-violet-700':'text-gray-400')}
                        style={{background:stCount>0?'rgba(139,92,246,0.1)':'rgba(107,114,128,0.08)'}}>
                        🏷 {stCount}/{p.pcs_dipack}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>handlePrint(p)}
                          className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110',isPrinted?'bg-emerald-50 text-emerald-500':'bg-violet-50 text-violet-500')}
                          title="Print">
                          <Printer size={13}/>
                        </button>
                        {canManage&&<button onClick={()=>{setActive(p);setErr('');setModal('edit')}}className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:scale-110 transition-all"title="Edit"><Edit2 size={13}/></button>}
                        {canDelete&&<button onClick={()=>{setActive(p);setModal('delete')}}className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:scale-110 transition-all"title="Hapus"><Trash2 size={13}/></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal==='create'&&<CreateModal items={siapPackingItems} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='edit'&&active&&<EditModal p={active} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='delete'&&active&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(239,68,68,0.15)'}}>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24}className="text-red-500"/></div>
            <h2 className="text-lg font-bold text-gray-900">Hapus Packing?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold">{active.kode}</span> akan dihapus. Status produksi kembali ke Siap Packing.</p>
            <div className="flex gap-3">
              <button onClick={()=>setModal(null)}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
              <button onClick={handleDelete}disabled={isPending}className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
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
