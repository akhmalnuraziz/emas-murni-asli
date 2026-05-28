'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import {
  Plus, Search, Edit2, Trash2, Check, AlertTriangle,
  X, Camera, ChevronDown, ChevronUp, Package, ZoomIn
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi, editProduksi,
  inputReject, leburReject, deleteProduksi
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

interface Props { produksiList: any[]; batches: any[]; userRole: UserRole; userName: string }

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const STATUS_FLOW = ['Cutting','Pas Berat','Annealing','Siap Packing']
const STATUS_NEXT: Record<string,string> = {
  'Cutting':'Pas Berat','Pas Berat':'Annealing','Annealing':'Siap Packing'
}
const STATUS_CFG: Record<string,{dot:string;bg:string;text:string}> = {
  'Cutting':       {dot:'#3B82F6',bg:'rgba(59,130,246,0.1)',  text:'#2563EB'},
  'Pas Berat':     {dot:'#F97316',bg:'rgba(249,115,22,0.1)', text:'#EA580C'},
  'Annealing':     {dot:'#EAB308',bg:'rgba(234,179,8,0.1)',  text:'#CA8A04'},
  'Siap Packing':  {dot:'#22C55E',bg:'rgba(34,197,94,0.1)',  text:'#16A34A'},
  'Sudah Packing': {dot:'#8B5CF6',bg:'rgba(139,92,246,0.1)', text:'#7C3AED'},
  'Reject':        {dot:'#EF4444',bg:'rgba(239,68,68,0.1)',  text:'#DC2626'},
}
const today = new Date().toISOString().split('T')[0]

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

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({url,onClose}:{url:string;onClose:()=>void}){
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
    document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn)
  },[onClose])
  return(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85"
      onClick={onClose}>
      <img src={url} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
        onClick={e=>e.stopPropagation()}/>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
        style={{boxShadow:'0 2px 12px rgba(0,0,0,0.3)'}}>
        <X size={18}/>
      </button>
    </div>
  )
}

// ─── FotoPicker ───────────────────────────────────────────────────────────────
function FotoPicker({files,onAdd,onRemove,label='Tambah foto',small=false}:{
  files:File[];onAdd:(f:File[])=>void;onRemove:(i:number)=>void;label?:string;small?:boolean
}){
  const [prev,setPrev]=useState<string[]>([])
  const [lightbox,setLightbox]=useState<string|null>(null)
  useEffect(()=>{const u=files.map(f=>URL.createObjectURL(f));setPrev(u);return()=>u.forEach(u=>URL.revokeObjectURL(u))},[files])
  const s=small?'w-12 h-12':'w-16 h-16'
  return(
    <div className="space-y-2">
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      {prev.length>0&&<div className="flex gap-2 flex-wrap">{prev.map((u,i)=>(
        <div key={i}className={`relative ${s}`}>
          <img src={u}onClick={()=>setLightbox(u)}className="w-full h-full object-cover rounded-xl border-2 border-violet-300 cursor-pointer hover:scale-105 transition-transform"/>
          <button type="button"onClick={()=>onRemove(i)}className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
          <div className="absolute bottom-0 inset-x-0 bg-violet-500/70 text-white text-[7px] text-center py-0.5 rounded-b-xl">BARU</div>
        </div>
      ))}</div>}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40 transition-all">
        <Camera size={13}className="text-violet-400 flex-shrink-0"/>
        <span className={`text-gray-400 ${small?'text-[11px]':'text-xs'}`}>{files.length>0?`${files.length} foto — klik tambah`:label}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{onAdd(Array.from(e.target.files??[]));e.currentTarget.value=''}}/>
      </label>
      {files.length>0&&<button type="button"onClick={()=>onRemove(-1)}className="text-[11px] text-red-400 hover:underline">Hapus semua foto</button>}
    </div>
  )
}

function Sbadge({s}:{s:string}){
  const c=STATUS_CFG[s]??{bg:'rgba(148,163,184,0.12)',text:'#64748B'}
  return<span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"style={{background:c.bg,color:c.text}}>{s}</span>
}

// ─── Timeline dots ────────────────────────────────────────────────────────────
function TLine({events}:{events:any[]}){
  const [pop,setPop]=useState<{i:number;ev:any;x:number;y:number}|null>(null)
  const sorted=[...events].sort((a,b)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime())
  const dots=sorted.slice(-5)
  useEffect(()=>{
    const h=()=>setPop(null)
    window.addEventListener('scroll',h,true);return()=>window.removeEventListener('scroll',h,true)
  },[])
  return(
    <div className="flex items-center gap-1.5 relative">
      {dots.map((ev,i)=>{
        const c=STATUS_CFG[ev.status]??{dot:'#94A3B8'}
        const open=pop?.i===i
        return(
          <button key={i} type="button"
            onMouseEnter={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setPop({i,ev,x:r.left+r.width/2,y:r.top})}}
            onMouseLeave={()=>setPop(null)}
            onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setPop(open?null:{i,ev,x:r.left+r.width/2,y:r.top})}}
            className="w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-150 flex-shrink-0"
            style={{background:c.dot,boxShadow:`0 0 0 2px ${c.dot}35`}}/>
        )
      })}
      {Array.from({length:Math.max(0,5-dots.length)}).map((_,i)=>(
        <div key={`e${i}`}className="w-3 h-3 rounded-full bg-gray-200 border-2 border-white shadow-sm flex-shrink-0"/>
      ))}
      {pop&&(()=>{
        const c=STATUS_CFG[pop.ev.status]??{dot:'#94A3B8',bg:'rgba(148,163,184,0.1)',text:'#64748B'}
        return(
          <div className="fixed z-[500] w-48 pointer-events-none"
            style={{top:pop.y-8,left:pop.x,transform:'translate(-50%,-100%)'}}>
            <div className="bg-white border border-gray-200/80 rounded-2xl shadow-2xl p-3 text-left"
              style={{boxShadow:`0 8px 32px ${c.dot}30`}}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0"style={{background:c.dot}}/>
                <span className="text-xs font-bold text-gray-800">{pop.ev.status}</span>
              </div>
              <div className="space-y-1 text-[11px] text-gray-500">
                <p>{formatDate(pop.ev.tanggal)}</p>
                <p className="font-semibold text-gray-700">{pop.ev.total_gram} gr</p>
                {Number(pop.ev.sisa_serbuk)>0&&<p className="text-violet-600 font-medium">Serbuk: {pop.ev.sisa_serbuk} gr</p>}
                {Number(pop.ev.losses)>0&&<p className="text-orange-500 font-medium">Losses: {pop.ev.losses} gr</p>}
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200/80 rotate-45"/>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Event History (expanded) ─────────────────────────────────────────────────
function EventHistory({events}:{events:any[]}){
  const sorted=[...events].sort((a,b)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime())
  const [lightbox,setLightbox]=useState<string|null>(null)
  return(
    <div className="space-y-1">
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      {sorted.map((ev,i)=>{
        const c=STATUS_CFG[ev.status]??{dot:'#94A3B8',bg:'rgba(148,163,184,0.1)',text:'#64748B'}
        const fotos=Array.isArray(ev.fotos)?ev.fotos:[]
        const serbuk=Array.isArray(ev.fotos_sisa_serbuk)?ev.fotos_sisa_serbuk:[]
        return(
          <div key={ev.id??i}className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"style={{background:c.dot}}/>
              {i<sorted.length-1&&<div className="w-0.5 flex-1 mt-0.5 opacity-30"style={{background:c.dot}}/>}
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Sbadge s={ev.status}/>
                <span className="text-xs text-gray-400">{formatDate(ev.tanggal)}</span>
                <span className="text-xs font-semibold text-gray-700">{ev.total_gram} gr</span>
                {Number(ev.sisa_serbuk)>0&&<span className="text-xs text-violet-500">serbuk {ev.sisa_serbuk} gr</span>}
                {Number(ev.losses)>0&&<span className="text-xs text-orange-500">losses {ev.losses} gr</span>}
              </div>
              {ev.catatan&&<p className="text-xs text-gray-400 mt-0.5 italic truncate">{ev.catatan}</p>}
              {(fotos.length>0||serbuk.length>0)&&(
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {fotos.map((u:string,fi:number)=>(
                    <img key={fi} src={u} onClick={()=>setLightbox(u)}
                      className="w-10 h-10 rounded-xl object-cover cursor-pointer border border-gray-100 hover:scale-110 transition-transform"/>
                  ))}
                  {serbuk.map((u:string,fi:number)=>(
                    <div key={`s${fi}`}className="relative">
                      <img src={u} onClick={()=>setLightbox(u)} className="w-10 h-10 rounded-xl object-cover cursor-pointer border-2 border-violet-300 hover:scale-110 transition-transform"/>
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">S</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const inp = "w-full px-4 py-3 text-sm bg-white/80 border border-gray-200/70 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({batches,onClose,onSubmit,isPending,error}:{
  batches:any[];onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const [f,setF]=useState({batch_kode:batches[0]?.kode??'',gramasi:'1',pcs:'',berat_awal:'',nama_item:'',status_awal:'Cutting',tanggal_produksi:today,operator:''})
  const [fotos,setFotos]=useState<File[]>([])
  const [up,setUp]=useState(false)
  const s=(k:string,v:string)=>setF(p=>({...p,[k]:v}))
  async function submit(e:React.FormEvent){
    e.preventDefault();const el=e.currentTarget as HTMLFormElement
    setUp(true);const b64=fotos.length>0?await filesToBase64(fotos):[];setUp(false)
    const fd=new FormData(el);fd.set('fotos_b64',JSON.stringify(b64));onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Permintaan Cetak Baru</h2>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[72vh]">
          <F label="Nama / Label Batch"><input name="nama_item" value={f.nama_item} onChange={e=>s('nama_item',e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp}/></F>
          <F label="Batch Bahan Baku" req>
            <select name="batch_kode" value={f.batch_kode} onChange={e=>s('batch_kode',e.target.value)} className={inp} required>
              {batches.map(b=><option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} (Sisa: {(b.sisa_bahan_seharusnya??b.timbangan_akhir??0).toFixed(2)} gr)</option>)}
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Gramasi Target" req>
              <select name="gramasi" value={f.gramasi} onChange={e=>s('gramasi',e.target.value)} className={inp} required>
                {GRAMASI_OPTIONS.map(g=><option key={g} value={g}>{g} Gram</option>)}
              </select>
            </F>
            <F label="Jumlah PCS" req><input name="pcs" type="number" min="1" value={f.pcs} onChange={e=>s('pcs',e.target.value)} placeholder="50" className={inp} required/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gram)" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e=>s('berat_awal',e.target.value)} placeholder="500.15" className={inp} required/></F>
            <F label="Status Awal" req>
              <select name="status_awal" value={f.status_awal} onChange={e=>s('status_awal',e.target.value)} className={inp} required>
                {STATUS_FLOW.slice(0,3).map(st=><option key={st} value={st}>{st}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Produksi" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e=>s('tanggal_produksi',e.target.value)} className={inp} required/></F>
            <F label="Operator / PIC"><input name="operator" value={f.operator} onChange={e=>s('operator',e.target.value)} placeholder="Nama operator" className={inp}/></F>
          </div>
          <F label="Catatan"><input name="catatan" placeholder="Keterangan tambahan..." className={inp}/></F>
          <F label="Foto Proses (opsional, max 10)">
            <FotoPicker files={fotos} onAdd={ff=>setFotos(p=>[...p,...ff].slice(0,10))} onRemove={i=>i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))} label="Tambah foto proses awal"/>
          </F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending||up}className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 16px rgba(139,92,246,0.35)'}}>
              {(isPending||up)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {up?'Kompres foto...':isPending?'Menyimpan...':'Mulai Alur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({item,onClose,onSubmit,isPending,error}:{
  item:any;onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const [f,setF]=useState({
    nama_item:item.nama_item??'',gramasi:item.gramasi??'',
    pcs:String(item.pcs??''),berat_awal:String(item.berat_awal??item.total_gram??''),
    operator:item.operator??'',catatan:item.catatan??'',
    tanggal_produksi:item.tanggal_produksi??item.tanggal??today,
  })
  const s=(k:string,v:string)=>setF(p=>({...p,[k]:v}))
  function submit(e:React.FormEvent){
    e.preventDefault();const fd=new FormData()
    Object.entries(f).forEach(([k,v])=>fd.set(k,v));onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900">Edit Batch Produksi</h2><p className="text-xs text-violet-500 font-medium mt-0.5">{item.kode}</p></div>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <F label="Nama / Label Batch"><input value={f.nama_item} onChange={e=>s('nama_item',e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp}/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Gramasi" req>
              <select value={f.gramasi} onChange={e=>s('gramasi',e.target.value)} className={inp}>
                {GRAMASI_OPTIONS.map(g=><option key={g} value={g}>{g} Gram</option>)}
              </select>
            </F>
            <F label="PCS" req><input type="number" min="1" value={f.pcs} onChange={e=>s('pcs',e.target.value)} className={inp}/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gr)" req><input type="number" step="0.01" value={f.berat_awal} onChange={e=>s('berat_awal',e.target.value)} className={inp}/></F>
            <F label="Tanggal"><input type="date" value={f.tanggal_produksi} onChange={e=>s('tanggal_produksi',e.target.value)} className={inp}/></F>
          </div>
          <F label="Operator / PIC"><input value={f.operator} onChange={e=>s('operator',e.target.value)} placeholder="Nama operator" className={inp}/></F>
          <F label="Catatan"><input value={f.catatan} onChange={e=>s('catatan',e.target.value)} placeholder="Catatan tambahan..." className={inp}/></F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
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

// ─── Update Status Modal ──────────────────────────────────────────────────────
function UpdateModal({item,onClose,onSubmit,isPending,error}:{
  item:any;onClose:()=>void;onSubmit:(fd:FormData)=>void;isPending:boolean;error:string
}){
  const next=STATUS_NEXT[item.current_status]??'Siap Packing'
  const [status,setStatus]=useState(next)
  const [fotos,setFotos]=useState<File[]>([])
  const [serbuk,setSerbuk]=useState<File[]>([])
  const [up,setUp]=useState(false)
  const isPB=status==='Pas Berat'
  async function submit(e:React.FormEvent){
    e.preventDefault();const el=e.currentTarget as HTMLFormElement
    setUp(true)
    const fb64=fotos.length>0?await filesToBase64(fotos):[]
    const sb64=isPB&&serbuk.length>0?await filesToBase64(serbuk):[]
    setUp(false)
    const fd=new FormData(el)
    fd.set('fotos_b64',JSON.stringify(fb64))
    fd.set('fotos_serbuk_b64',JSON.stringify(sb64))
    fd.set('is_reject',status==='Reject'?'1':'0')
    onSubmit(fd)
  }
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Update Status Produksi</h2>
            <p className="text-xs font-semibold text-violet-500 mt-0.5">{item.kode} — {item.nama_item||`${item.gramasi}gr × ${item.pcs} PCS`}</p>
          </div>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[76vh]">
          <F label="Status Baru" req>
            <select name="status" value={status} onChange={e=>setStatus(e.target.value)} className={inp} required>
              {STATUS_FLOW.map(st=><option key={st} value={st}>{st}</option>)}
              <option value="Reject">Reject</option>
            </select>
          </F>
          {status==='Reject'?(
            <div className="grid grid-cols-2 gap-3">
              <F label="PCS Reject" req><input name="pcs_reject" type="number" min="1" max={item.pcs_good??item.pcs} className={inp} placeholder={`Max: ${item.pcs_good??item.pcs} PCS`} required/></F>
              <F label="Berat Reject (gr)" req><input name="berat_reject" type="number" step="0.001" className={inp} placeholder="Berat total reject" required/></F>
            </div>
          ):(
            <div className="grid grid-cols-2 gap-3">
              <F label="Total Berat Sekarang (gr)" req><input name="total_gram" type="number" step="0.001" className={inp} placeholder={`Sblm: ${item.total_gram} gr`} required/></F>
              {isPB&&<F label="Sisa Serbuk (gr)"><input name="sisa_serbuk" type="number" step="0.001" className={inp} placeholder="0.000" defaultValue="0"/></F>}
            </div>
          )}
          <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={today} className={inp} required/></F>
          {status!=='Reject'&&(
            <>
              <F label="Foto Proses (opsional)">
                <FotoPicker files={fotos} onAdd={ff=>setFotos(p=>[...p,...ff].slice(0,10))} onRemove={i=>i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))} label="Foto proses di status ini" small/>
              </F>
              {isPB&&<F label="Foto Sisa Serbuk (opsional)">
                <FotoPicker files={serbuk} onAdd={ff=>setSerbuk(p=>[...p,...ff].slice(0,10))} onRemove={i=>i===-1?setSerbuk([]):setSerbuk(p=>p.filter((_,j)=>j!==i))} label="Foto sisa serbuk emas" small/>
              </F>}
            </>
          )}
          <F label="Catatan"><input name="catatan" className={inp} placeholder="Keterangan..."/></F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending||up}className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 16px rgba(139,92,246,0.3)'}}>
              {(isPending||up)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {up?'Kompres...':isPending?'Menyimpan...':'Simpan Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DelModal({item,onClose,onConfirm,isPending}:{item:any;onClose:()=>void;onConfirm:()=>void;isPending:boolean}){
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-sm rounded-3xl p-6 text-center"style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(239,68,68,0.15)'}}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24}className="text-red-500"/></div>
        <h2 className="text-lg font-bold text-gray-900">Hapus Batch Produksi?</h2>
        <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{item.kode}</span> akan dihapus.</p>
        <div className="flex gap-3">
          <button onClick={onClose}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={onConfirm} disabled={isPending}className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
            {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending?'Menghapus...':'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProduksiClient({produksiList,batches,userRole,userName}:Props){
  const [isPending,startTransition]=useTransition()
  const [search,setSearch]=useState('')
  const [tab,setTab]=useState('Semua')
  const [exp,setExp]=useState<number|null>(null)
  const [modal,setModal]=useState<'create'|'edit'|'update'|'delete'|null>(null)
  const [active,setActive]=useState<any|null>(null)
  const [err,setErr]=useState('')
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500)}
  const canEdit=['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete=['owner','admin_pusat'].includes(userRole)

  const filtered=produksiList.filter(item=>{
    if(tab!=='Semua'&&item.current_status!==tab)return false
    const q=search.toLowerCase()
    return!q||item.kode?.toLowerCase().includes(q)||item.batch_kode?.toLowerCase().includes(q)||item.gramasi?.includes(q)||item.nama_item?.toLowerCase().includes(q)
  })
  const counts=produksiList.reduce((a,i)=>{a[i.current_status]=(a[i.current_status]??0)+1;return a},{} as Record<string,number>)
  const tabs=['Semua',...STATUS_FLOW,'Sudah Packing','Reject']

  function openModal(type:'create'|'edit'|'update'|'delete',item?:any){setActive(item??null);setErr('');setModal(type)}
  function handleCreate(fd:FormData){setErr('');startTransition(async()=>{const r=await createProduksi(fd);if(r?.error){setErr(r.error);return}showToast(`✅ ${r?.kode} berhasil dibuat`);setModal(null)})}
  function handleEdit(fd:FormData){if(!active)return;setErr('');startTransition(async()=>{const r=await editProduksi(active.id,active.kode,fd);if(r?.error){setErr(r.error);return}showToast('✅ Data diperbarui');setModal(null)})}
  function handleUpdate(fd:FormData){
    if(!active)return;setErr('')
    const isReject=fd.get('is_reject')==='1'
    startTransition(async()=>{
      const r=isReject?await inputReject(active.id,active.kode,fd):await updateStatusProduksi(active.id,active.kode,fd)
      if(r?.error){setErr(r.error);return}
      showToast(isReject?'✅ Reject dicatat':'✅ Status diperbarui');setModal(null)
    })
  }
  function handleDelete(){if(!active)return;startTransition(async()=>{const r=await deleteProduksi(active.id,active.kode);if(r?.error){showToast(r.error,false);return}showToast('🗑️ Batch dihapus');setModal(null)})}

  // Grid columns: BATCH | GRAMASI | PCS | TOTAL BERAT | SERBUK | LOSES | PACKING | SHIELDTAG | STATUS | TIMELINE | TGL | AKSI
  const gridCols = 'minmax(120px,2fr) 55px 45px 72px 62px 62px 100px 78px 78px 92px 88px 95px'

  return(
    <div className="min-h-screen pb-24"style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"style={{color:'#111827',fontFamily:"'SF Pro Display','Inter',sans-serif"}}>Produksi</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{produksiList.length} batch aktif</p>
          </div>
          {canEdit&&(
            <button onClick={()=>openModal('create')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>
              <Plus size={15}/> Cetak Baru
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15}className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode batch, gramasi, nama..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)'}}/>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t=>{
            const isAct=tab===t;const cfg=STATUS_CFG[t];const cnt=t==='Semua'?produksiList.length:(counts[t]??0)
            return(
              <button key={t} onClick={()=>setTab(t)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={isAct
                  ?{background:cfg?.dot??'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:`0 4px 12px ${cfg?.dot??'#8B5CF6'}40`}
                  :{background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
                {t}{cnt>0&&<span className="px-1.5 py-0.5 rounded-full text-[10px]"style={{background:isAct?'rgba(255,255,255,0.25)':'rgba(107,114,128,0.12)'}}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-3xl overflow-auto"style={{background:'rgba(255,255,255,0.72)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 8px 40px rgba(139,92,246,0.08)'}}>
          {/* Header */}
          <div className="grid px-5 py-3.5 border-b min-w-[860px]"
            style={{gridTemplateColumns:gridCols,gap:'8px',borderColor:'rgba(243,244,246,0.9)',background:'rgba(249,250,251,0.6)'}}>
            {['BATCH','GRAMASI','PCS','TOTAL BERAT','SERBUK','LOSES','STATUS','TGL UPDATE','TIMELINE','PACKING','SHIELDTAG','AKSI'].map(h=>(
              <span key={h}className="text-[10px] font-bold text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</span>
            ))}
          </div>

          {filtered.length===0?(
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"style={{background:'rgba(139,92,246,0.08)'}}>
                <Package size={28}className="text-violet-300"/>
              </div>
              <p className="text-sm font-medium text-gray-400">Tidak ada batch produksi</p>
            </div>
          ):filtered.map((item,idx)=>{
            const events=Array.isArray(item.produksi_event)?item.produksi_event:[]
            const packings=Array.isArray(item.packing)?(item.packing as any[]).filter((p:any)=>!p.voided_at):[]
            const lastEv=events.length>0?[...events].sort((a:any,b:any)=>new Date(b.tanggal).getTime()-new Date(a.tanggal).getTime())[0]:null
            const isExp=exp===item.id
            const pcsGood=item.pcs_good??item.pcs??0
            const totalPacked=packings.reduce((s:number,p:any)=>s+(p.pcs_dipack||0),0)
            const totalST=packings.reduce((s:number,p:any)=>s+(p.shieldtag_count||0),0)
            const totalSerbuk=events.reduce((s:number,ev:any)=>s+(Number(ev.sisa_serbuk)||0),0)
            const totalLoses=events.reduce((s:number,ev:any)=>s+(Number(ev.losses)||0),0)

            return(
              <div key={item.id}>
                <div className={cn('grid px-5 py-4 items-start transition-colors min-w-[860px]',idx>0?'border-t':'',isExp?'':'hover:bg-gray-50/40')}
                  style={{gridTemplateColumns:gridCols,gap:'8px',borderColor:'rgba(243,244,246,0.7)',background:isExp?'rgba(139,92,246,0.03)':''}}>
                  {/* BATCH */}
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-900 break-words leading-snug block">{item.nama_item||item.kode}</span>
                    <p className="text-[11px] text-gray-400 break-words mt-0.5">{item.kode} · {item.batch_kode}</p>
                  </div>
                  {/* GRAMASI */}
                  <span className="text-sm font-semibold text-gray-700">{item.gramasi}gr</span>
                  {/* PCS */}
                  <span className="text-sm font-bold text-gray-800">{pcsGood}</span>
                  {/* TOTAL BERAT */}
                  <span className="text-sm font-semibold text-gray-700">{item.total_gram}gr</span>
                  {/* SERBUK */}
                  <div>
                    {totalSerbuk>0
                      ?<span className="text-xs font-semibold px-2 py-0.5 rounded-full"style={{background:'rgba(139,92,246,0.1)',color:'#7C3AED'}}>{totalSerbuk.toFixed(3)}gr</span>
                      :<span className="text-xs text-gray-300">—</span>}
                  </div>
                  {/* LOSES */}
                  <div>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',totalLoses>0?'':'text-gray-300')}
                      style={totalLoses>0?{background:'rgba(249,115,22,0.1)',color:'#EA580C'}:{}}>
                      {totalLoses>0?`${totalLoses.toFixed(3)}gr`:'0 gr'}
                    </span>
                  </div>
                  {/* STATUS */}
                  <div><Sbadge s={item.current_status}/></div>
                  {/* TGL UPDATE */}
                  <span className="text-xs text-gray-400 font-medium">{lastEv?formatDate(lastEv.tanggal):formatDate(item.tanggal_produksi??item.tanggal)}</span>
                  {/* TIMELINE */}
                  <div><TLine events={events}/></div>
                  {/* PACKING */}
                  <div className="flex flex-col gap-0.5">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap self-start',totalPacked>0?totalPacked>=pcsGood?'text-violet-700':'text-blue-600':'text-gray-400')}
                      style={{background:totalPacked>0?totalPacked>=pcsGood?'rgba(139,92,246,0.1)':'rgba(59,130,246,0.1)':'rgba(107,114,128,0.08)'}}>
                      {totalPacked}/{pcsGood}
                    </span>
                    <span className="text-[10px] text-gray-400 leading-tight px-0.5">
                      {totalPacked===0?'Belum Dipacking':totalPacked>=pcsGood?'Sudah Dipacking Semua':'Sudah Dipacking Sebagian'}
                    </span>
                  </div>
                  {/* SHIELDTAG */}
                  <div className="flex flex-col gap-0.5">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap self-start',totalST>0?'text-emerald-600':'text-gray-400')}
                      style={{background:totalST>0?'rgba(34,197,94,0.1)':'rgba(107,114,128,0.08)'}}>
                      🏷 {totalST}/{totalPacked}
                    </span>
                    <span className="text-[10px] text-gray-400 leading-tight px-0.5">
                      {totalST===0?'Belum Diregistrasi':totalST>=totalPacked&&totalPacked>0?'Semua Sudah Diregistrasi':'Sebagian Sudah Diregistrasi'}
                    </span>
                  </div>
                  {/* AKSI */}
                  <div className="flex items-center gap-1">
                    {canEdit&&item.current_status!=='Sudah Packing'&&(
                      <button onClick={()=>openModal('update',item)}
                        className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                        style={{background:'rgba(139,92,246,0.1)',color:'#7C3AED'}} title="Update Status">
                        <Plus size={13}/>
                      </button>
                    )}
                    {canEdit&&(
                      <button onClick={()=>openModal('edit',item)}
                        className="w-7 h-7 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center transition-all hover:scale-110 hover:bg-blue-100" title="Edit">
                        <Edit2 size={11}/>
                      </button>
                    )}
                    {canDelete&&(
                      <button onClick={()=>openModal('delete',item)}
                        className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center transition-all hover:scale-110 hover:bg-red-100" title="Hapus">
                        <Trash2 size={11}/>
                      </button>
                    )}
                    <button onClick={()=>setExp(isExp?null:item.id)}
                      className="w-7 h-7 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center transition-all hover:scale-110 hover:bg-gray-200">
                      {isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isExp&&(
                  <div className="px-5 pb-5 border-t"style={{borderColor:'rgba(139,92,246,0.1)',background:'rgba(139,92,246,0.02)'}}>
                    <div className="pt-4">
                      {item.operator&&<p className="text-xs text-gray-400 mb-3">Operator: <span className="font-semibold text-gray-600">{item.operator}</span></p>}
                      <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">Riwayat Proses</p>
                      {events.length===0
                        ?<p className="text-xs text-gray-400 italic">Belum ada event tercatat</p>
                        :<EventHistory events={events}/>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {modal==='create'&&batches.length>0&&<CreateModal batches={batches} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='edit'&&active&&<EditModal item={active} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='update'&&active&&<UpdateModal item={active} onClose={()=>setModal(null)} onSubmit={handleUpdate} isPending={isPending} error={err}/>}
      {modal==='delete'&&active&&<DelModal item={active} onClose={()=>setModal(null)} onConfirm={handleDelete} isPending={isPending}/>}
    </div>
  )
}

