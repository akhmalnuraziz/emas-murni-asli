'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Plus, Search, Edit2, Trash2, Printer, Check,
  AlertTriangle, X, Package, Camera, ShieldX
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createPacking, editPacking, voidPacking, markPrinted, reportPackingReject } from '@/app/(dashboard)/packing-log/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  packingList: any[]
  siapPackingItems: any[]
  shieldtagByPacking?: Record<number, { kode: string; status: string; lokasi: string | null }[]>
  userRole: UserRole
  userName: string
}

const today = new Date().toISOString().split('T')[0]
const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({url,onClose}:{url:string;onClose:()=>void}){
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
    document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn)
  },[onClose])
  return(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85" onClick={onClose}>
      <img src={url} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e=>e.stopPropagation()}/>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all">
        <X size={18}/>
      </button>
    </div>
  )
}

// ─── filesToBase64 ─────────────────────────────────────────────────────────────
async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0,10)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        let {width:w,height:h} = img
        const max = 1200
        if(w>max||h>max){const r=Math.min(max/w,max/h);w=Math.floor(w*r);h=Math.floor(h*r)}
        c.width=w;c.height=h;c.getContext('2d')!.drawImage(img,0,0,w,h)
        let q=0.8
        const tryQ=()=>c.toBlob(blob=>{
          if(!blob){resolve('');return}
          if(blob.size<=250*1024||q<=0.3){const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(blob)}
          else{q-=0.1;tryQ()}
        },'image/jpeg',q)
        tryQ()
      }
      img.onerror=()=>resolve('')
      img.src=URL.createObjectURL(file)
    })
    if(b64)results.push(b64)
  }
  return results
}

// ─── FotoPicker ───────────────────────────────────────────────────────────────
function FotoPicker({files,existing=[],onAdd,onRemove,onRemoveExisting,label='Tambah foto',small=false}:{
  files:File[];existing?:string[];onAdd:(f:File[])=>void;onRemove:(i:number)=>void;onRemoveExisting?:(i:number)=>void;label?:string;small?:boolean
}){
  const [prev,setPrev]=useState<string[]>([])
  const [lightbox,setLightbox]=useState<string|null>(null)
  useEffect(()=>{const u=files.map(f=>URL.createObjectURL(f));setPrev(u);return()=>u.forEach(u=>URL.revokeObjectURL(u))},[files])
  const s=small?'w-12 h-12':'w-16 h-16'
  return(
    <div className="space-y-2">
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      {(existing.length>0||prev.length>0)&&(
        <div className="flex gap-2 flex-wrap">
          {existing.map((u,i)=>(
            <div key={`ex${i}`}className={`relative ${s} group`}>
              <img src={u} onClick={()=>setLightbox(u)} className="w-full h-full object-cover rounded-xl border border-violet-200/50 cursor-pointer hover:scale-105 transition-transform"/>
              {onRemoveExisting&&<button type="button" onClick={()=>onRemoveExisting(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={9}/></button>}
            </div>
          ))}
          {prev.map((u,i)=>(
            <div key={`new${i}`}className={`relative ${s}`}>
              <img src={u} onClick={()=>setLightbox(u)} className="w-full h-full object-cover rounded-xl border-2 border-violet-300 cursor-pointer hover:scale-105 transition-transform"/>
              <button type="button" onClick={()=>onRemove(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
              <div className="absolute bottom-0 inset-x-0 bg-violet-500/70 text-white text-[7px] text-center py-0.5 rounded-b-xl">BARU</div>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40 transition-all">
        <Camera size={13}className="text-violet-400 flex-shrink-0"/>
        <span className={`text-slate-400 ${small?'text-[11px]':'text-[12px]'}`}>{files.length>0?`${files.length} foto baru — klik tambah`:label}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{onAdd(Array.from(e.target.files??[]));e.currentTarget.value=''}}/>
      </label>
      {files.length>0&&<button type="button"onClick={()=>onRemove(-1)}className="text-[11px] text-red-400 hover:underline">Hapus semua foto baru</button>}
    </div>
  )
}

// ─── Print View ───────────────────────────────────────────────────────────────
function PrintView({p}:{p:any}){
  return(
    <div id={`print-${p.id}`}className="hidden">
      <div style={{fontFamily:'Arial,sans-serif',padding:'32px',maxWidth:'600px',margin:'0 auto',border:'2px solid #333'}}>
        <div style={{textAlign:'center',borderBottom:'2px solid #333',paddingBottom:'16px',marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" style={{width:'48px',height:'48px',objectFit:'contain'}}/>
          <div style={{textAlign:'left'}}>
            <h1 style={{fontSize:'20px',fontWeight:'900',margin:'0'}}>PT EMAS MURNI ASLI</h1>
            <p style={{fontSize:'13px',color:'#666',margin:'4px 0 0'}}>Surat Packing Produksi</p>
          </div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',marginBottom:'20px'}}>
          <tbody>
            {[
              ['No. Packing', p.kode],
              ['Tanggal', formatDate(p.tanggal)],
              ['Item / Batch', `${p.produksi_item?.nama_item||p.produksi_item?.kode||'—'} · ${p.batch_kode}`],
              ['Gramasi', `${p.gramasi} gr`],
              ['PCS Dipack', `${p.pcs_dipack} PCS`],
              ['Total Gram Aktual', `${Number(p.total_gram_aktual).toFixed(3)} gr`],
              ['Admin Yang Menyerahkan', p.admin_input||'—'],
              ['Operator Packing', p.pic_packing||p.pic||'—'],
              ['Catatan', p.catatan||'—'],
            ].map(([k,v])=>(
              <tr key={k}>
                <td style={{padding:'6px 12px',border:'1px solid #ddd',fontWeight:'600',background:'#f9f9f9',width:'40%'}}>{k}</td>
                <td style={{padding:'6px 12px',border:'1px solid #ddd'}}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'40px',marginTop:'40px',textAlign:'center',fontSize:'12px'}}>
          {['Dibuat','Diperiksa','Disetujui'].map(l=>(
            <div key={l}><p style={{fontWeight:'600',marginBottom:'50px'}}>{l}</p><div style={{borderTop:'1px solid #333'}}/><p style={{color:'#999',marginTop:'4px'}}>(................)</p></div>
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
  const [fotos,setFotos]=useState<File[]>([])
  const [up,setUp]=useState(false)
  const sel=items.find(i=>i.id===parseInt(selId))

  async function submit(e:React.FormEvent){
    e.preventDefault()
    const formEl=e.currentTarget as HTMLFormElement
    setUp(true);const b64=fotos.length>0?await filesToBase64(fotos):[];setUp(false)
    const fd=new FormData(formEl)
    fd.set('fotos_b64',JSON.stringify(b64))
    onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Catat Packing Baru</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <F label="Item Produksi (Siap Packing)" req>
            <select name="produksi_item_id" value={selId} onChange={e=>setSelId(e.target.value)} className={inp} required>
              {items.map(i=><option key={i.id} value={i.id}>{i.nama_item||i.kode} · {i.gramasi}gr · {i.pcs_tersisa} PCS tersisa</option>)}
            </select>
          </F>
          {sel&&<div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
            {sel.batch_kode} · {sel.gramasi} gr/pcs · Sisa {sel.pcs_tersisa} PCS
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req>
              <input name="pcs_dipack" type="number" min="1" max={sel?.pcs_tersisa??999} placeholder={`Max ${sel?.pcs_tersisa??0}`} className={inp} required/>
            </F>
            <F label="Total Gram Aktual" req>
              <input name="total_gram_aktual" type="number" step="0.001" placeholder="0.000" className={inp} required/>
            </F>
          </div>
          <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={today} className={inp} required/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Admin Yang Menyerahkan"><input name="admin_input" placeholder="Nama admin" className={inp}/></F>
            <F label="Operator Packing"><input name="operator_packing" placeholder="Nama operator" className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" placeholder="Keterangan tambahan..." className={inp}/></F>
          <F label="Foto Packing (max 10)">
            <FotoPicker files={fotos} onAdd={ff=>setFotos(p=>[...p,...ff].slice(0,10))} onRemove={i=>i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))} label="Tambah foto packing"/>
          </F>
          {error&&<div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600"><AlertTriangle size={14}/>{error}</div>}
          </div>
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
            <button type="button"onClick={onClose}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending||up}className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {(isPending||up)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {up?'Kompres foto...':isPending?'Menyimpan...':'Simpan Packing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({p,onClose,onSubmit,isPending,error}:{p:any;onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string}){
  const [fotos,setFotos]=useState<File[]>([])
  const [existFotos,setExistFotos]=useState<string[]>(Array.isArray(p.fotos)?p.fotos:[])
  const [up,setUp]=useState(false)

  async function submit(e:React.FormEvent){
    e.preventDefault()
    const formEl=e.currentTarget as HTMLFormElement
    setUp(true);const b64=fotos.length>0?await filesToBase64(fotos):[];setUp(false)
    const fd=new FormData(formEl)
    fd.set('fotos_b64',JSON.stringify(b64))
    fd.set('existing_fotos',JSON.stringify(existFotos))
    onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Edit Packing</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{p.kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req><input name="pcs_dipack" type="number" min="1" defaultValue={p.pcs_dipack} className={inp} required/></F>
            <F label="Total Gram Aktual" req><input name="total_gram_aktual" type="number" step="0.001" defaultValue={p.total_gram_aktual} className={inp} required/></F>
          </div>
          <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={p.tanggal} className={inp} required/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Admin Yang Menyerahkan"><input name="admin_input" defaultValue={p.admin_input??''} className={inp}/></F>
            <F label="Operator Packing"><input name="operator_packing" defaultValue={p.pic_packing??p.pic??''} className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" defaultValue={p.catatan??''} className={inp}/></F>
          <F label="Foto Packing (max 10)">
            <FotoPicker files={fotos} existing={existFotos}
              onAdd={ff=>setFotos(prev=>[...prev,...ff].slice(0,10))}
              onRemove={i=>i===-1?setFotos([]):setFotos(prev=>prev.filter((_,j)=>j!==i))}
              onRemoveExisting={i=>setExistFotos(prev=>prev.filter((_,j)=>j!==i))}
              label="Tambah foto packing" small/>
          </F>
          {error&&<div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600"><AlertTriangle size={14}/>{error}</div>}
          </div>
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
            <button type="button"onClick={onClose}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit"disabled={isPending||up}className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {(isPending||up)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {up?'Kompres...':isPending?'Menyimpan...':'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({p,onClose,onSubmit,isPending,error}:{p:any;onClose:()=>void;onSubmit:(pcs:number,gram:number)=>void;isPending:boolean;error:string}){
  const [pcs,setPcs]=useState('')
  const [gram,setGram]=useState('')
  const stCount=p.shieldtag_count??0
  const maxPcs=p.pcs_dipack-stCount
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Laporkan Reject Packing</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{p.kode} · {stCount}/{p.pcs_dipack} shieldtag berhasil</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg px-3 py-2 bg-amber-50 border border-amber-100 text-[12px] text-amber-700">
            <span className="font-semibold">Maks {maxPcs} PCS reject</span> (dari {p.pcs_dipack} dipack − {stCount} shieldtag). Emas reject ini akan bisa dimasukkan ke Peleburan.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Reject" req>
              <input type="number" min="1" max={maxPcs} value={pcs} onChange={e=>setPcs(e.target.value)} placeholder={`Max ${maxPcs}`} className={inp}/>
            </F>
            <F label="Gram Reject (aktual)" req>
              <input type="number" step="0.001" min="0.001" value={gram} onChange={e=>setGram(e.target.value)} placeholder="0.000" className={inp}/>
            </F>
          </div>
          {error&&<div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600"><AlertTriangle size={14}/>{error}</div>}
        </div>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button disabled={isPending||!pcs||!gram} onClick={()=>onSubmit(parseInt(pcs),parseFloat(gram))}
            className="flex-1 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending?'Menyimpan...':'Simpan Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Packing Card (mobile) ────────────────────────────────────────────────────
function PackingCard({p,canManage,canDelete,onEdit,onDelete,onPrint,onShieldtagClick,onReject}:{
  p:any;canManage:boolean;canDelete:boolean;onEdit:()=>void;onDelete:()=>void;onPrint:()=>void;onShieldtagClick?:()=>void;onReject?:()=>void
}){
  const [lightbox,setLightbox]=useState<string|null>(null)
  const fotos=Array.isArray(p.fotos)?p.fotos:[]
  const stCount=p.shieldtag_count??0
  const isPrinted=p.status_surat==='sudah_cetak'
  return(
    <div className="rounded-xl p-4 space-y-3 bg-white border border-slate-200">
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-violet-600">{p.kode}</span>
        <div className="flex items-center gap-1.5">
          {isPrinted&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50">✓ Cetak</span>}
          {(p.pcs_reject??0)>0&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-orange-600 bg-orange-50">Reject {p.pcs_reject}pcs</span>}
          <button onClick={onPrint}className="w-7 h-7 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center hover:bg-violet-100"title="Print"><Printer size={12}/></button>
          {canManage&&!(p.pcs_reject>0)&&stCount<p.pcs_dipack&&<button onClick={onReject}className="w-7 h-7 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-100"title="Laporkan Reject"><ShieldX size={11}/></button>}
          {canManage&&<button onClick={onEdit}className="w-7 h-7 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100"title="Edit"><Edit2 size={11}/></button>}
          {canDelete&&<button onClick={onDelete}className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100"title="Hapus"><Trash2 size={11}/></button>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><p className="text-[10px] text-slate-400">Batch</p><p className="text-[12px] font-semibold text-slate-700">{p.batch_kode}</p></div>
        <div><p className="text-[10px] text-slate-400">Tanggal</p><p className="text-[12px] font-semibold text-slate-700">{formatDate(p.tanggal)}</p></div>
        <div><p className="text-[10px] text-slate-400">Gramasi</p><p className="text-[12px] font-semibold text-slate-700">{p.gramasi} gr</p></div>
        <div><p className="text-[10px] text-slate-400">Dipack</p><p className="text-[13px] font-semibold text-slate-800">{p.pcs_dipack} pcs</p></div>
        <div><p className="text-[10px] text-slate-400">Total gram</p><p className="text-[12px] font-semibold text-slate-700">{Number(p.total_gram_aktual).toFixed(3)} gr</p></div>
        <div>
          <p className="text-[10px] text-slate-400">Shieldtag</p>
          <button type="button" onClick={()=>{ if(stCount>0&&onShieldtagClick) onShieldtagClick() }} disabled={stCount===0}
            className={cn('text-[12px] font-semibold',stCount>0?'text-emerald-600 underline decoration-dotted cursor-pointer':'text-slate-400 cursor-default')}>🏷 {stCount}/{p.pcs_dipack}</button>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-slate-100 flex-wrap">
        <span className="text-[12px] text-slate-500"><span className="font-semibold">Operator:</span> {p.pic_packing||p.pic||'—'}{p.admin_input?` · Admin: ${p.admin_input}`:''}</span>
        {fotos.length>0&&(
          <div className="flex gap-1.5">
            {fotos.slice(0,4).map((u:string,i:number)=>(
              <img key={i} src={u} onClick={()=>setLightbox(u)} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 hover:scale-110 transition-transform"/>
            ))}
            {fotos.length>4&&<span className="text-[12px] text-slate-400 self-center">+{fotos.length-4}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PackingLogClient({packingList,siapPackingItems,shieldtagByPacking={},userRole,userName}:Props){
  const [isPending,startTransition]=useTransition()
  const [modal,setModal]=useState<'create'|'edit'|'delete'|'reject'|null>(null)
  const [active,setActive]=useState<any|null>(null)
  const [err,setErr]=useState('')
  const [search,setSearch]=useState('')
  const [lightbox,setLightbox]=useState<string|null>(null)
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [selectedIds,setSelectedIds]=useState<Set<number>>(new Set())
  const [stModal,setStModal]=useState<{kode:string;list:{kode:string;status:string;lokasi:string|null}[]}|null>(null)

  function toggleSelect(id:number){setSelectedIds(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s})}
  function toggleSelectAll(records:any[]){
    const ids=records.map((p:any)=>p.id)
    const allSel=ids.every((id:number)=>selectedIds.has(id))
    setSelectedIds(allSel?new Set():new Set(ids))
  }

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500)}
  const canManage=['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete=['owner','admin_pusat'].includes(userRole)

  const filtered=packingList.filter(p=>{
    const q=search.toLowerCase()
    return!q||p.kode?.toLowerCase().includes(q)||p.batch_kode?.toLowerCase().includes(q)||p.gramasi?.includes(q)||p.pic_packing?.toLowerCase().includes(q)||p.admin_input?.toLowerCase().includes(q)
  })

  // Date filter
  const [dateFilter,setDateFilter]=useState<'all'|'week'|'month'|'custom'>('all')
  const [dateFrom,setDateFrom]=useState('')
  const [dateTo,setDateTo]=useState('')
  const now=new Date()
  const filteredByDate=(records:any[])=>{
    if(dateFilter==='all')return records
    if(dateFilter==='custom'){
      return records.filter(p=>{
        const t=String(p.tanggal).slice(0,10)
        if(dateFrom&&t<dateFrom)return false
        if(dateTo&&t>dateTo)return false
        return true
      })
    }
    const cutoff=new Date()
    if(dateFilter==='week')cutoff.setDate(now.getDate()-7)
    else cutoff.setDate(now.getDate()-30)
    return records.filter(p=>new Date(p.tanggal)>=cutoff)
  }

  // Summary - PCS based
  const totalRecord=packingList.length
  const totalSiapPackingPcs=siapPackingItems.reduce((s:number,i:any)=>s+(i.pcs_tersisa||0),0)
  const totalSudahPackingPcs=packingList.reduce((s:number,p:any)=>s+(p.pcs_dipack||0),0)

  function handleCreate(fd:FormData){setErr('');startTransition(async()=>{const r=await createPacking(fd);if(r?.error){setErr(r.error);return}showToast(`✅ ${r?.kode} berhasil dicatat`);setModal(null)})}
  function handleEdit(fd:FormData){if(!active)return;setErr('');startTransition(async()=>{const r=await editPacking(active.id,active.kode,fd);if(r?.error){setErr(r.error);return}showToast('✅ Packing diperbarui');setModal(null)})}
  function handleDelete(){if(!active)return;startTransition(async()=>{const r=await voidPacking(active.id,active.kode);if(r?.error){showToast(r.error,false);return}showToast('🗑️ Packing dihapus');setModal(null)})}
  function handleReject(pcs:number,gram:number){if(!active)return;setErr('');startTransition(async()=>{const r=await reportPackingReject(active.id,pcs,gram);if(r?.error){setErr(r.error);return}showToast(`✅ Reject ${pcs} pcs (${gram.toFixed(3)}gr) dicatat`);setModal(null)})}

  function handlePrint(p:any){
    markPrinted(p.id).catch(console.error)
    const el=document.getElementById(`print-${p.id}`)
    if(!el)return
    const w=window.open('','_blank')
    if(!w)return
    w.document.write(`<!DOCTYPE html><html><head><title>${p.kode}</title><style>@media print{.pagebreak{page-break-after:always}}</style></head><body>${el.innerHTML}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
    w.document.close()
  }

  function handlePrintMulti(records:any[]){
    const selected=records.filter(p=>selectedIds.has(p.id))
    if(selected.length===0){showToast('Pilih minimal 1 item untuk diprint',false);return}
    selected.forEach(p=>markPrinted(p.id).catch(console.error))
    const parts=selected.map((p,i)=>{
      const el=document.getElementById(`print-${p.id}`)
      const html=el?el.innerHTML:''
      return i<selected.length-1?`${html}<div class="pagebreak"></div>`:html
    }).join('')
    const w=window.open('','_blank')
    if(!w)return
    w.document.write(`<!DOCTYPE html><html><head><title>Print Packing — ${selected.length} item</title><style>@media print{.pagebreak{page-break-after:always}body{margin:0;padding:0}}</style></head><body>${parts}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
    w.document.close()
    setSelectedIds(new Set())
    showToast(`✅ ${selected.length} surat dicetak`)
  }

  return(
    <div className="space-y-5 pb-8">
      {filtered.map(p=><PrintView key={p.id} p={p}/>)}
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold text-white shadow-2xl',toast.ok?'bg-emerald-600':'bg-red-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-slate-900 tracking-tight">Packing Log</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Kelola packing & registrasi Shieldtag</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {selectedIds.size>0&&(
              <button onClick={()=>handlePrintMulti(filteredByDate(filtered))}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-sky-600 hover:bg-sky-700 transition-colors">
                <Printer size={13}/> Print {selectedIds.size} Item
              </button>
            )}
            {canManage&&siapPackingItems.length>0&&(
              <button onClick={()=>{setModal('create');setErr('')}}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
                <Plus size={14}/> Catat Packing
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode PKG, batch, operator, admin..."
            className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
        </div>

        {/* Date filter */}
        <div className="flex gap-2 flex-wrap items-center">
          {([['all','Semua'],['week','7 Hari'],['month','30 Hari'],['custom','Pilih Tanggal']] as const).map(([val,label])=>(
            <button key={val} onClick={()=>setDateFilter(val)}
              className={cn('h-7 px-3 rounded-full text-[11px] font-semibold transition-colors',
                dateFilter===val?'bg-violet-600 text-white':'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50')}>
              {label}
            </button>
          ))}
          {dateFilter==='custom'&&(
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="text-[12px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400"/>
              <span className="text-[12px] text-slate-400 font-medium">s/d</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                className="text-[12px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400"/>
              {(dateFrom||dateTo)&&(
                <button onClick={()=>{setDateFrom('');setDateTo('')}}
                  className="text-[12px] text-red-400 hover:text-red-600 font-semibold ml-1">✕</button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {label:'Total Record',val:String(filteredByDate(filtered).length)+' record',dot:'#8B5CF6'},
            {label:'Sisa Siap Packing',val:totalSiapPackingPcs+' PCS',dot:'#10B981'},
            {label:'Total Sudah Dipack',val:filteredByDate(packingList).reduce((s:number,p:any)=>s+(p.pcs_dipack||0),0)+' PCS',dot:'#3B82F6'},
          ].map(c=>(
            <div key={c.label}className="rounded-xl p-4 bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{background:c.dot}}/>
                <p className="text-[10px] text-slate-500 font-medium">{c.label}</p>
              </div>
              <p className="text-[18px] font-semibold text-slate-800 tabular-nums">{c.val}</p>
            </div>
          ))}
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {filteredByDate(filtered).length===0?(
            <div className="text-center py-12 rounded-xl bg-white border border-slate-200">
              <Package size={32}className="mx-auto text-violet-200 mb-3"/>
              <p className="text-[13px] font-medium text-slate-400">Belum ada record packing</p>
            </div>
          ):filteredByDate(filtered).map(p=>(
            <PackingCard key={p.id} p={p} canManage={canManage} canDelete={canDelete}
              onEdit={()=>{setActive(p);setErr('');setModal('edit')}}
              onDelete={()=>{setActive(p);setModal('delete')}}
              onPrint={()=>handlePrint(p)}
              onShieldtagClick={()=>{ const list=shieldtagByPacking[p.id]??[]; if(list.length>0) setStModal({kode:p.kode,list}) }}
              onReject={()=>{setActive(p);setErr('');setModal('reject')}}/>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block rounded-xl overflow-auto bg-white border border-slate-200">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="px-4 py-3 w-10">
                  {filteredByDate(filtered).length>0&&(
                    <input type="checkbox" className="rounded accent-violet-600 cursor-pointer"
                      checked={filteredByDate(filtered).length>0&&filteredByDate(filtered).every(p=>selectedIds.has(p.id))}
                      onChange={()=>toggleSelectAll(filteredByDate(filtered))}/>
                  )}
                </th>
                {([['Kode','left'],['Tanggal','left'],['Batch','center'],['Gramasi','center'],['PCS total','left'],['Dipack','left'],['Total gram','left'],['Admin','left'],['Operator','left'],['Foto','left'],['Shieldtag','center'],['Status','center'],['Aksi','left']] as const).map(([h,al])=>(
                  <th key={h}className={cn('px-4 py-3 text-[10px] font-medium text-slate-400 whitespace-nowrap align-middle',al==='center'?'text-center':'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={13}className="text-center py-16">
                  <Package size={28}className="mx-auto text-violet-200 mb-3"/>
                  <p className="text-[13px] font-medium text-slate-400">Belum ada record packing</p>
                </td></tr>
              ):filteredByDate(filtered).map((p,idx)=>{
                const fotos=Array.isArray(p.fotos)?p.fotos:[]
                const stCount=p.shieldtag_count??0
                const isPrinted=p.status_surat==='sudah_cetak'
                const pcsGood=p.produksi_item?.pcs_good??p.produksi_item?.pcs??'—'
                return(
                  <tr key={p.id}className={cn('border-t border-slate-200 transition-colors hover:bg-violet-50/20 align-middle',idx===0?'border-transparent':'',selectedIds.has(p.id)?'bg-violet-50/40':'')}>
                    <td className="px-4 py-3 w-10 align-middle">
                      <input type="checkbox" className="rounded accent-violet-600 cursor-pointer"
                        checked={selectedIds.has(p.id)}
                        onChange={()=>toggleSelect(p.id)}/>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-violet-600 whitespace-nowrap align-middle">{p.kode}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap align-middle">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-3 align-middle text-center"><span className="inline-block text-[12px] font-semibold px-2 py-0.5 rounded-full text-violet-700 whitespace-nowrap bg-violet-50">{p.batch_kode}</span></td>
                    <td className="px-4 py-3 align-middle text-center"><span className="inline-block text-[12px] font-semibold px-2 py-0.5 rounded-full text-amber-700 whitespace-nowrap bg-amber-50">{p.gramasi} gr</span></td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-600 whitespace-nowrap align-middle">{pcsGood}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-800 whitespace-nowrap align-middle">{p.pcs_dipack} pcs</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-700 whitespace-nowrap align-middle">{Number(p.total_gram_aktual).toFixed(3)} gr</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap align-middle">{p.admin_input||'—'}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap align-middle">{p.pic_packing||p.pic||'—'}</td>
                    <td className="px-4 py-3 align-middle">
                      {fotos.length>0?(
                        <div className="flex gap-1">
                          {fotos.slice(0,3).map((u:string,i:number)=>(
                            <img key={i} src={u} onClick={()=>setLightbox(u)} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 hover:scale-110 transition-transform"/>
                          ))}
                          {fotos.length>3&&<span className="text-[12px] text-slate-400 self-center">+{fotos.length-3}</span>}
                        </div>
                      ):<span className="text-[12px] text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button type="button"
                          onClick={()=>{ const list=shieldtagByPacking[p.id]??[]; if(list.length>0) setStModal({kode:p.kode,list}) }}
                          disabled={stCount===0}
                          className={cn('inline-block text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-all',stCount>0?'text-emerald-700 bg-emerald-50 hover:ring-2 hover:ring-emerald-300 cursor-pointer':'text-slate-400 bg-slate-100 cursor-default')}>
                          🏷 {stCount}/{p.pcs_dipack}
                        </button>
                        {(p.pcs_reject??0)>0&&(
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 whitespace-nowrap">
                            Reject {p.pcs_reject}pcs
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={cn('inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap',isPrinted?'text-emerald-700 bg-emerald-50':'text-slate-500 bg-slate-100')}>
                        {isPrinted?'✓ Cetak':'Belum Cetak'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-1.5">
                        <button onClick={()=>handlePrint(p)} className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110',isPrinted?'bg-emerald-50 text-emerald-500':'bg-violet-50 text-violet-500')} title="Print"><Printer size={13}/></button>
                        {canManage&&!(p.pcs_reject>0)&&stCount<p.pcs_dipack&&(
                          <button onClick={()=>{setActive(p);setErr('');setModal('reject')}}className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center hover:scale-110 transition-all"title="Laporkan Reject"><ShieldX size={13}/></button>
                        )}
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

      {modal==='create'&&<CreateModal items={siapPackingItems} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='edit'&&active&&<EditModal p={active} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='delete'&&active&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Hapus Packing?</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{active.kode}</p>
              </div>
              <button onClick={()=>setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-red-50 border border-red-100 text-red-600 text-[12px]">
                <AlertTriangle size={16} className="flex-shrink-0"/>
                <span><span className="font-semibold">{active.kode}</span> akan dihapus. Status produksi kembali ke Siap Packing.</span>
              </div>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
              <button onClick={()=>setModal(null)}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={handleDelete}disabled={isPending}className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending?'Menghapus...':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stModal && <ShieldtagListModal kode={stModal.kode} list={stModal.list} onClose={()=>setStModal(null)}/>}
      {modal==='reject'&&active&&<RejectModal p={active} onClose={()=>{setModal(null);setErr('')}} onSubmit={handleReject} isPending={isPending} error={err}/>}
    </div>
  )
}

// ─── Modal daftar Shieldtag dari satu Packing ────────────────────────────────
function ShieldtagListModal({kode,list,onClose}:{kode:string;list:{kode:string;status:string;lokasi:string|null}[];onClose:()=>void}){
  const statusColor:Record<string,{bg:string;text:string}>={
    'Aktif':{bg:'rgba(34,197,94,0.1)',text:'#16A34A'},
    'Terdistribusi':{bg:'rgba(59,130,246,0.1)',text:'#2563EB'},
    'Transit':{bg:'rgba(249,115,22,0.1)',text:'#EA580C'},
    'Terjual':{bg:'rgba(139,92,246,0.1)',text:'#7C3AED'},
    'VOID':{bg:'rgba(239,68,68,0.1)',text:'#DC2626'},
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Daftar Shieldtag</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{kode} · {list.length} tag</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-1.5">
          {list.length===0 && <p className="text-[13px] text-slate-400 text-center py-8">Belum ada shieldtag.</p>}
          {list.map((st,i)=>{
            const sc=statusColor[st.status]??{bg:'rgba(107,114,128,0.08)',text:'#6B7280'}
            return (
              <div key={st.kode} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-medium text-slate-300 w-5 flex-shrink-0">{i+1}</span>
                  <span className="text-[13px] font-mono font-semibold text-slate-800 truncate">{st.kode}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {st.lokasi && <span className="text-[10px] text-slate-400">{st.lokasi}</span>}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:sc.bg,color:sc.text}}>{st.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



