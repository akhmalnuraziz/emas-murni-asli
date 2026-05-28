'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  Plus, Search, Lock, Unlock, X, Check, AlertTriangle,
  Edit2, Trash2, Scale, Camera, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import {
  createBatch, updateBatch, deleteBatch,
  lockBatch, unlockBatch, updateSisaFisik
} from '@/app/(dashboard)/bahan-baku/actions'
import type { UserRole } from '@/lib/types/database'

interface Props { batches: any[]; rejectCountMap: Record<string, number>; userRole: UserRole; userName: string }

// ─── Selisih helper ──────────────────────────────────────────────────────────
function hitungSelisih(pusat: number, gudang: number) {
  const selisih = pusat - gudang
  const abs = Math.abs(selisih)
  if (abs === 0) return {
    badge: 'Sesuai ✓',
    desc: 'Timbangan gudang dan bahan dari pusat sesuai, tidak ada selisih',
    color:'text-emerald-700', bg:'rgba(34,197,94,0.08)', dot:'#22C55E', warn: false
  }
  const direction = selisih > 0 ? 'kurang' : 'lebih'
  const withinTol = abs <= 0.05
  return {
    badge: `${direction === 'kurang' ? '-' : '+'}${abs.toFixed(3)} gr`,
    desc: withinTol
      ? `Timbangan gudang berbeda dengan timbangan pusat, ${direction} ${abs.toFixed(3)} gr dan masih dalam toleransi`
      : `Timbangan gudang berbeda dengan timbangan pusat, selisih ${abs.toFixed(3)} gr melebihi batas toleransi — catatan wajib diisi`,
    color: withinTol ? 'text-amber-700' : 'text-red-700',
    bg: withinTol ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
    dot: withinTol ? '#F59E0B' : '#EF4444',
    warn: !withinTol,
  }
}

function getBatchStatus(b: any) {
  if (b.voided_at && b.void_reason === 'DELETED_BY_USER') return 'dihapus'
  if (b.status === 'terkunci') return 'terkunci'   // use batch.status column
  return 'aktif'
}

// ─── filesToBase64 ────────────────────────────────────────────────────────────
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
    if(b64) results.push(b64)
  }
  return results
}

const today = new Date().toISOString().split('T')[0]
const CAN_SEE_HPP: UserRole[] = ['admin_pusat']

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp = "w-full px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400"
  + " bg-white/80 border border-gray-200/70"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Foto Picker ──────────────────────────────────────────────────────────────
function FotoPicker({files,onAdd,onRemove,label='Tambah foto',small=false}:{
  files:File[];onAdd:(f:File[])=>void;onRemove:(i:number)=>void;label?:string;small?:boolean
}){
  const [prev,setPrev]=useState<string[]>([])
  const [lb,setLb]=useState<string|null>(null)
  useEffect(()=>{const u=files.map(f=>URL.createObjectURL(f));setPrev(u);return()=>u.forEach(u=>URL.revokeObjectURL(u))},[files])
  const s=small?'w-12 h-12':'w-16 h-16'
  return(
    <div className="space-y-2">
      {lb&&(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4"onClick={()=>setLb(null)}>
          <img src={lb}className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setLb(null)}className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm"><X size={18}/></button>
        </div>
      )}
      {prev.length>0&&<div className="flex gap-2 flex-wrap">{prev.map((u,i)=>(
        <div key={i}className={`relative ${s}`}>
          <img src={u}onClick={()=>setLb(u)}className="w-full h-full object-cover rounded-xl border-2 border-violet-300 cursor-pointer hover:scale-105 transition-transform"/>
          <button type="button"onClick={()=>onRemove(i)}className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
        </div>
      ))}</div>}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40 transition-all">
        <Camera size={13}className="text-violet-400 flex-shrink-0"/>
        <span className={`text-gray-400 ${small?'text-[11px]':'text-xs'}`}>{files.length>0?`${files.length} foto — klik tambah`:label}</span>
        <input type="file" accept="image/*" multiple className="hidden"onChange={e=>{onAdd(Array.from(e.target.files??[]));e.currentTarget.value=''}}/>
      </label>
      {files.length>0&&<button type="button"onClick={()=>onRemove(-1)}className="text-[11px] text-red-400 hover:underline">Hapus semua</button>}
    </div>
  )
}

// ─── Batch Form Modal ─────────────────────────────────────────────────────────
function BatchFormModal({initial,onSubmit,onClose,isPending,error,isEdit=false}:{
  initial?:any;onSubmit:(fd:FormData)=>void;onClose:()=>void;isPending:boolean;error:string;isEdit?:boolean
}){
  const [pusat,setPusat]=useState(String(initial?.bahan_dari_pusat??''))
  const [gudang,setGudang]=useState(String(initial?.timbangan_akhir??''))
  const [harga,setHarga]=useState(String(initial?.harga_beli??''))
  const [biaya,setBiaya]=useState<{label:string;jumlah:number}[]>(initial?.biaya_tambahan??[])
  const [newFotos,setNewFotos]=useState<File[]>([])
  const [existingFotos,setExistingFotos]=useState<string[]>(initial?.fotos??[])
  const [uploading,setUploading]=useState(false)

  const si = pusat&&gudang ? hitungSelisih(parseFloat(pusat),parseFloat(gudang)) : null
  const hargaNum = parseFloat(harga)||0
  const totalBiaya = biaya.reduce((s,b)=>s+(b.jumlah||0),0)
  const totalHpp = hargaNum+totalBiaya
  const hppGr = parseFloat(gudang)>0 ? totalHpp/parseFloat(gudang) : 0

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    setUploading(true)
    try{
      const b64s=newFotos.length>0?await filesToBase64(newFotos):[]
      const fd=new FormData(e.currentTarget)
      fd.set('biaya_tbh',JSON.stringify(biaya))
      fd.set('existing_fotos',JSON.stringify(existingFotos))
      fd.set('new_fotos_b64',JSON.stringify(b64s))
      onSubmit(fd)
    }finally{setUploading(false)}
  }

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden"style={{background:'rgba(255,255,255,0.93)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.18),0 8px 32px rgba(0,0,0,0.1)'}}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{isEdit?'Edit Batch':'Registrasi Logam Mulia Masuk'}</h2>
          <button onClick={onClose}className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit}className="px-6 py-5 space-y-4 overflow-y-auto max-h-[78vh]">
          <div className="grid grid-cols-2 gap-3">
            <F label="Kode Batch"><input name="kode" defaultValue={initial?.kode??''} placeholder="Auto-generate" className={inp} readOnly={isEdit}/></F>
            <F label="Nama / Label Batch"><input name="nama_batch" defaultValue={initial?.nama_batch??''} placeholder="BATCH 26" className={inp}/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Kedatangan" req><input name="tanggal_datang" type="date" defaultValue={initial?.tanggal??today} className={inp} required/></F>
            <F label="Tanggal Pembelian" req><input name="tanggal_beli" type="date" defaultValue={initial?.tanggal_beli??today} className={inp} required/></F>
          </div>
          <F label="Supplier / Sumber"><input name="supplier" defaultValue={initial?.supplier??'GUDANG PUSAT'} className={inp}/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Berat Pusat / Supplier (gr)" req><input name="bahan_dari_pusat" type="number" step="0.001" value={pusat} onChange={e=>setPusat(e.target.value)} placeholder="1000.000" className={inp} required/></F>
            <F label="Berat Timbangan Gudang (gr)" req><input name="timbangan_akhir" type="number" step="0.001" value={gudang} onChange={e=>setGudang(e.target.value)} placeholder="999.890" className={inp} required/></F>
          </div>
          {si&&(
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border"style={{background:si.bg,borderColor:`${si.dot}30`}}>
              <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"style={{background:si.dot}}/>
              <p className={cn('text-xs font-medium',si.color)}>{si.desc}</p>
            </div>
          )}
          <F label="Harga Beli (IDR)" req>
            <input name="harga_beli" type="number" value={harga} onChange={e=>setHarga(e.target.value)} placeholder="100000000" className={inp} required/>
            {hargaNum>0&&<p className="text-xs text-violet-500 font-semibold px-1 mt-1">{formatRupiah(hargaNum)}</p>}
          </F>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Biaya Tambahan</label>
              <button type="button"onClick={()=>setBiaya(p=>[...p,{label:'',jumlah:0}])}className="text-xs text-violet-600 font-semibold hover:underline">+ Tambah</button>
            </div>
            {biaya.map((b,i)=>(
              <div key={i}className="flex gap-2 items-center">
                <input value={b.label}onChange={e=>setBiaya(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))} placeholder="Keterangan" className={cn(inp,'flex-1')}/>
                <input type="number" value={b.jumlah}onChange={e=>setBiaya(p=>p.map((x,j)=>j===i?{...x,jumlah:parseFloat(e.target.value)||0}:x))} placeholder="0" className={cn(inp,'w-32')}/>
                <button type="button"onClick={()=>setBiaya(p=>p.filter((_,j)=>j!==i))}className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><X size={14}/></button>
              </div>
            ))}
          </div>
          {hargaNum>0&&(
            <div className="rounded-2xl px-4 py-3 space-y-2"style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Harga Beli</span><span className="font-semibold text-gray-700">{formatRupiah(hargaNum)}</span></div>
              {totalBiaya>0&&<div className="flex justify-between text-xs"><span className="text-gray-500">Biaya Tambahan</span><span className="font-semibold text-gray-700">{formatRupiah(totalBiaya)}</span></div>}
              <div className="flex justify-between text-xs border-t pt-2"style={{borderColor:'rgba(139,92,246,0.15)'}}>
                <span className="font-semibold text-gray-500">Total HPP</span>
                <span className="font-bold text-violet-700">{formatRupiah(totalHpp)}</span>
              </div>
              {hppGr>0&&<div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-500">HPP / gram</span>
                <span className="font-bold text-violet-700 text-sm">{formatRupiah(hppGr)}/gr</span>
              </div>}
            </div>
          )}
          <F label={`Catatan${si?.warn?' *':''}`}>
            <input name="catatan" defaultValue={initial?.catatan??''} placeholder={si?.warn?'Wajib — jelaskan alasan selisih berat':'Keterangan tambahan...'} className={cn(inp,si?.warn&&'border-red-300')} required={!!si?.warn}/>
          </F>
          <F label="Foto Bukti / Sertifikat">
            {existingFotos.length>0&&(
              <div className="flex gap-2 flex-wrap mb-2">
                {existingFotos.map((url,i)=>(
                  <div key={i}className="relative w-14 h-14">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200"/>
                    <button type="button"onClick={()=>setExistingFotos(p=>p.filter((_,j)=>j!==i))}className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
                  </div>
                ))}
              </div>
            )}
            <FotoPicker files={newFotos} onAdd={f=>setNewFotos(p=>[...p,...f].slice(0,10-existingFotos.length))} onRemove={i=>i===-1?setNewFotos([]):setNewFotos(p=>p.filter((_,j)=>j!==i))}/>
          </F>
          {error&&<div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose}className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 16px rgba(139,92,246,0.35)'}}>
              {(isPending||uploading)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading?'Kompres foto...':isPending?'Menyimpan...':isEdit?'Simpan Perubahan':'Simpan & Rekonsiliasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BahanBakuClient({batches,rejectCountMap,userRole,userName}:Props){
  const [filter,setFilter]=useState<'semua'|'aktif'|'terkunci'>('semua')
  const [search,setSearch]=useState('')
  const [expanded,setExpanded]=useState<number|null>(null)
  const [showCreate,setShowCreate]=useState(false)
  const [editItem,setEditItem]=useState<any|null>(null)
  const [lockModal,setLockModal]=useState<any|null>(null)
  const [delModal,setDelModal]=useState<any|null>(null)
  const [formError,setFormError]=useState('')
  const [isPending,startTransition]=useTransition()
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [showHPP,setShowHPP]=useState(false)
  const [editingSF,setEditingSF]=useState<number|null>(null)
  const [sfInput,setSfInput]=useState<Record<number,string>>({})
  const [sfFotos,setSfFotos]=useState<Record<number,File[]>>({})
  const [sfExisting,setSfExisting]=useState<Record<number,string[]>>({})
  const [sfUploading,setSfUploading]=useState<Record<number,boolean>>({})

  const canSeeHPP = CAN_SEE_HPP.includes(userRole)

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500)}

  const filtered = batches.filter(b=>{
    if(getBatchStatus(b)==='dihapus') return false
    const st=getBatchStatus(b)
    if(filter==='aktif'&&st!=='aktif') return false
    if(filter==='terkunci'&&st!=='terkunci') return false
    const q=search.toLowerCase()
    return!q||b.kode?.toLowerCase().includes(q)||b.nama_batch?.toLowerCase().includes(q)||b.supplier?.toLowerCase().includes(q)
  })

  function handleCreate(fd:FormData){setFormError('');startTransition(async()=>{const r=await createBatch(fd);if(r?.error){setFormError(r.error);return}showToast('✅ Batch berhasil disimpan');setShowCreate(false)})}
  function handleUpdate(fd:FormData){if(!editItem)return;setFormError('');startTransition(async()=>{const r=await updateBatch(editItem.id,editItem.kode,fd);if(r?.error){setFormError(r.error);return}showToast('✅ Batch diperbarui');setEditItem(null)})}

  async function handleSisaFisik(batch:any){
    const val=parseFloat(sfInput[batch.id]??'')
    if(isNaN(val)||val<0){showToast('Nilai tidak valid',false);return}
    setSfUploading(p=>({...p,[batch.id]:true}))
    try{
      const b64s=(sfFotos[batch.id]??[]).length>0?await filesToBase64(sfFotos[batch.id]??[]):[]
      const fd=new FormData()
      fd.set('batch_id',String(batch.id));fd.set('batch_kode',batch.kode)
      fd.set('sisa_fisik',String(val))
      fd.set('existing_fotos',JSON.stringify(sfExisting[batch.id]??[]))
      fd.set('new_fotos_b64',JSON.stringify(b64s))
      const r=await updateSisaFisik(fd)
      if(r?.error){showToast(r.error,false);return}
      showToast('✅ Sisa fisik disimpan')
      setSfFotos(p=>({...p,[batch.id]:[]}));setSfExisting(p=>({...p,[batch.id]:[]}));setEditingSF(null)
    }finally{setSfUploading(p=>({...p,[batch.id]:false}))}
  }

  return(
    <div className="min-h-screen pb-24"style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>
      {/* Toast */}
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"style={{color:'#111827',fontFamily:"'SF Pro Display','Inter',sans-serif"}}>Bahan Baku</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{batches.filter(b=>getBatchStatus(b)!=='dihapus').length} batch tercatat</p>
          </div>
          <div className="flex items-center gap-2">
            {canSeeHPP&&(
              <button onClick={()=>setShowHPP(!showHPP)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all border"
                style={showHPP?{background:'rgba(139,92,246,0.1)',color:'#7C3AED',borderColor:'rgba(139,92,246,0.25)'}:{background:'rgba(255,255,255,0.8)',color:'#6B7280',borderColor:'rgba(209,213,219,0.5)'}}>
                {showHPP?<Eye size={14}/>:<EyeOff size={14}/>}
                {showHPP?'Sembunyikan HPP':'Tampilkan HPP'}
              </button>
            )}
            <button onClick={()=>{setShowCreate(true);setFormError('')}}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>
              <Plus size={15}/> Registrasi Batch
            </button>
          </div>
        </div>

        {/* Filter + Search */}
        <div className="flex gap-2 flex-wrap items-center">
          {(['semua','aktif','terkunci'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
              style={filter===f?{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:'0 4px 12px rgba(139,92,246,0.35)'}:{background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
              {f==='semua'?`Semua Batch (${batches.filter(b=>getBatchStatus(b)!=='dihapus').length})`:f==='aktif'?'Aktif':'Terkunci'}
            </button>
          ))}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13}className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode, nama, supplier..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
              style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)'}}/>
          </div>
        </div>

        {/* Batch cards */}
        <div className="space-y-3">
          {filtered.length===0?(
            <div className="text-center py-16 rounded-3xl"style={{background:'rgba(255,255,255,0.6)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.5)'}}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"style={{background:'rgba(139,92,246,0.08)'}}>
                <Scale size={28}className="text-violet-300"/>
              </div>
              <p className="text-sm font-medium text-gray-400">Tidak ada batch bahan baku</p>
            </div>
          ):filtered.map(batch=>{
            const status=getBatchStatus(batch)
            const isExp=expanded===batch.id
            const si=hitungSelisih(batch.bahan_dari_pusat??0,batch.timbangan_akhir??0)
            const sisaSeharusnya=Number(batch.sisa_bahan_seharusnya??batch.timbangan_akhir??0)
            const timbAkhir=Number(batch.timbangan_akhir??0)
            const sudahTerpakai=timbAkhir>0&&sisaSeharusnya<timbAkhir
            const pct=timbAkhir>0?Math.min(100,Math.max(0,(sisaSeharusnya/timbAkhir)*100)):100
            const sisaFisik=batch.sisa_fisik!=null?Number(batch.sisa_fisik):null
            const loses=sisaFisik!==null?sisaSeharusnya-sisaFisik:null
            const fotos=Array.isArray(batch.fotos)?batch.fotos:[]
            const fotoSF=Array.isArray(batch.foto_sisa_fisik)?batch.foto_sisa_fisik:[]
            const isEditSF=editingSF===batch.id
            const supplierLabel=`Bahan dari ${batch.supplier??'GUDANG PUSAT'}`
            const batchLabel=batch.nama_batch?` · ${batch.nama_batch}`:''

            return(
              <div key={batch.id}className="rounded-3xl overflow-hidden transition-all"
                style={{background:'rgba(255,255,255,0.75)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 4px 24px rgba(139,92,246,0.07),0 1px 8px rgba(0,0,0,0.04)'}}>
                {/* Card header */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm text-violet-700"
                    style={{background:'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(167,139,250,0.1))'}}>
                    {(batch.nama_batch??batch.kode??'BA').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-900"style={{fontFamily:"'SF Pro Display','Inter',sans-serif"}}>
                        {batch.nama_batch??batch.kode}
                      </span>
                      <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full',
                        status==='aktif'?'text-emerald-700':'text-amber-700')}
                        style={{background:status==='aktif'?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)'}}>
                        {status==='aktif'?'AKTIF':'TERKUNCI 🔒'}
                      </span>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{background:si.bg,color:si.dot,border:`1px solid ${si.dot}30`}}>
                        {si.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">{batch.kode} · {supplierLabel}{batchLabel}</p>
                    <p className="text-xs text-gray-400">Datang: {formatDate(batch.tanggal)}</p>
                  </div>
                  <div className="text-right hidden sm:block flex-shrink-0 mr-2">
                    <p className="text-xs text-gray-400">Sisa Bahan</p>
                    <p className="text-base font-bold text-gray-800">{sisaSeharusnya.toFixed(3)} gr</p>
                    <p className="text-xs text-gray-400">dari {timbAkhir.toFixed(3)} gr</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {status==='aktif'&&<>
                      <button onClick={()=>{setEditItem(batch);setFormError('')}}className="w-8 h-8 rounded-xl bg-blue-50 text-blue-400 flex items-center justify-center hover:bg-blue-100 hover:scale-110 transition-all"title="Edit"><Edit2 size={13}/></button>
                      <button onClick={()=>setLockModal(batch)}className="w-8 h-8 rounded-xl bg-amber-50 text-amber-400 flex items-center justify-center hover:bg-amber-100 hover:scale-110 transition-all"title="Kunci"><Lock size={13}/></button>
                    </>}
                    {status==='terkunci'&&['owner','admin_pusat'].includes(userRole)&&(
                      <button onClick={()=>startTransition(async()=>{await unlockBatch(batch.id,batch.kode);showToast('🔓 Batch dibuka')})}className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center hover:bg-emerald-100 hover:scale-110 transition-all"title="Buka"><Unlock size={13}/></button>
                    )}
                    {['owner','admin_pusat'].includes(userRole)&&(
                      <button onClick={()=>setDelModal(batch)}className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all"title="Hapus"><Trash2 size={13}/></button>
                    )}
                    <button onClick={()=>setExpanded(isExp?null:batch.id)}className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 hover:scale-110 transition-all">
                      {isExp?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>

                {/* HPP bar */}
                <div className="px-5 pb-3 flex items-center gap-3">
                  {canSeeHPP&&(
                    <p className="text-xs font-semibold transition-all"style={{color:'#8B5CF6'}}>
                      HPP: {showHPP?`${formatRupiah(batch.hpp_gr??0)}/gr`:'•••/gr'}
                    </p>
                  )}
                  <div className="flex-1"/>
                </div>

                {/* Progress bar — ONLY show when ada pemakaian */}
                {sudahTerpakai&&(
                  <div className="px-5 pb-4">
                    <div className="w-full h-1.5 rounded-full"style={{background:'rgba(139,92,246,0.1)'}}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{width:`${pct}%`,background:`linear-gradient(90deg,#8B5CF6,#A78BFA)`,boxShadow:'0 0 8px rgba(139,92,246,0.4)'}}/>
                    </div>
                    <p className="text-[11px] text-right mt-1 font-medium"style={{color:'#8B5CF6'}}>{pct.toFixed(1)}% tersisa · {(timbAkhir-sisaSeharusnya).toFixed(3)} gr terpakai</p>
                  </div>
                )}

                {/* Expanded detail */}
                {isExp&&(
                  <div className="px-5 pb-5 border-t space-y-4"style={{borderColor:'rgba(139,92,246,0.1)',background:'rgba(139,92,246,0.02)'}}>
                    <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {label:'Berat Pusat',val:`${(batch.bahan_dari_pusat??0).toFixed(3)} gr`},
                        {label:'Timbangan Gudang',val:`${timbAkhir.toFixed(3)} gr`},
                        {label:'HPP / gram',val:canSeeHPP&&showHPP?formatRupiah(batch.hpp_gr??0):'•••'},
                        {label:'Total HPP',val:canSeeHPP&&showHPP?formatRupiah(batch.total_hpp??0):'•••'},
                      ].map(item=>(
                        <div key={item.label}className="rounded-2xl p-3"style={{background:'rgba(255,255,255,0.8)',border:'1px solid rgba(209,213,219,0.4)'}}>
                          <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                          <p className="text-sm font-bold text-gray-700 mt-0.5">{item.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Selisih description */}
                    <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"style={{background:si.bg,border:`1px solid ${si.dot}25`}}>
                      <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"style={{background:si.dot}}/>
                      <p className={cn('text-xs font-medium',si.color)}>{si.desc}</p>
                    </div>

                    {/* Rekonsiliasi */}
                    <div className="rounded-2xl p-4 space-y-3"style={{background:'rgba(139,92,246,0.05)',border:'1px solid rgba(139,92,246,0.12)'}}>
                      <p className="text-xs font-bold text-violet-700">Rekonsiliasi Bahan Baku</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          {label:'Sisa Seharusnya',val:`${sisaSeharusnya.toFixed(3)} gr`,sub:'Otomatis'},
                          {label:'Sisa Fisik (timbang)',val:sisaFisik!=null?`${sisaFisik.toFixed(3)} gr`:null,sub:'Manual'},
                          {label:'Selisih Rekonsiliasi',val:loses!=null?(loses>0?`+${loses.toFixed(3)} gr`:`${loses.toFixed(3)} gr`):null,sub:'Seharusnya − Fisik',red:loses!=null&&loses>0},
                        ].map(item=>(
                          <div key={item.label}className="rounded-xl p-3"style={{background:'rgba(255,255,255,0.7)'}}>
                            <p className="text-[10px] text-gray-400">{item.label}</p>
                            {item.val?<p className={cn('text-sm font-bold mt-0.5',item.red?'text-red-600':'text-gray-700')}>{item.val}</p>:<p className="text-xs text-gray-400 italic mt-0.5">Belum diisi</p>}
                            <p className="text-[10px] text-violet-400 mt-0.5">{item.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Foto sisa fisik view */}
                      {fotoSF.length>0&&!isEditSF&&(
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 mb-2">Foto Sisa Fisik ({fotoSF.length})</p>
                          <div className="flex gap-2 flex-wrap">
                            {fotoSF.map((url:string,i:number)=>(
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 block hover:opacity-80">
                                <img src={url} alt="" className="w-full h-full object-cover"/>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reject belum dilebur alert */}
                      {(()=>{
                        const rCount = rejectCountMap[batch.kode] ?? 0
                        return rCount > 0 ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                            style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#DC2626'}}>
                            <span>⚠️</span>
                            <span>{rCount} item reject belum dilebur</span>
                          </div>
                        ) : null
                      })()}

                      {status==='aktif'&&(
                        !isEditSF?(
                          <button onClick={()=>{setEditingSF(batch.id);setSfInput(p=>({...p,[batch.id]:String(sisaFisik??'')}));setSfExisting(p=>({...p,[batch.id]:[...fotoSF]}))}}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-600 rounded-xl transition-all hover:scale-105"
                            style={{background:'rgba(255,255,255,0.9)',border:'1px solid rgba(139,92,246,0.2)'}}>
                            <Edit2 size={11}/>{sisaFisik!=null?'Edit Sisa Fisik':'Input Sisa Fisik'}
                          </button>
                        ):(
                          <div className="rounded-2xl p-4 space-y-3"style={{background:'rgba(255,255,255,0.9)',border:'1px solid rgba(139,92,246,0.2)'}}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-violet-700">Input Sisa Fisik</p>
                              <button onClick={()=>{setEditingSF(null);setSfFotos(p=>({...p,[batch.id]:[]}))}}className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={12}/></button>
                            </div>
                            <div className="flex gap-2">
                              <input type="number" step="0.001" value={sfInput[batch.id]??''} onChange={e=>setSfInput(p=>({...p,[batch.id]:e.target.value}))} placeholder="Berat sisa fisik (gram)" className={cn(inp,'flex-1')}/>
                              <button onClick={()=>handleSisaFisik(batch)} disabled={sfUploading[batch.id]}
                                className="px-4 py-2 text-sm font-bold text-white rounded-2xl disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
                                style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                                {sfUploading[batch.id]?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Check size={13}/>}
                                {sfUploading[batch.id]?'Simpan...':'Simpan'}
                              </button>
                            </div>
                            {(sfExisting[batch.id]??[]).length>0&&(
                              <div className="flex gap-2 flex-wrap">
                                {(sfExisting[batch.id]??[]).map((url:string,i:number)=>(
                                  <div key={i}className="relative w-12 h-12">
                                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200"/>
                                    <button type="button"onClick={()=>setSfExisting(p=>({...p,[batch.id]:(p[batch.id]??[]).filter((_,j)=>j!==i)}))}className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <FotoPicker files={sfFotos[batch.id]??[]}
                              onAdd={f=>setSfFotos(p=>({...p,[batch.id]:[...(p[batch.id]??[]),...f].slice(0,10)}))}
                              onRemove={i=>i===-1?setSfFotos(p=>({...p,[batch.id]:[]})):setSfFotos(p=>({...p,[batch.id]:(p[batch.id]??[]).filter((_,j)=>j!==i)}))}
                              label="Foto sisa fisik (opsional)" small/>
                          </div>
                        )
                      )}
                    </div>

                    {/* Foto bukti */}
                    {fotos.length>0&&(
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">Foto Bukti / Sertifikat ({fotos.length})</p>
                        <div className="flex gap-2 flex-wrap">
                          {fotos.map((url:string,i:number)=>(
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 block hover:opacity-80 hover:scale-105 transition-transform">
                              <img src={url} alt="" className="w-full h-full object-cover"/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {batch.catatan&&(
                      <div className="px-4 py-3 rounded-2xl"style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)'}}>
                        <p className="text-xs text-amber-700"><span className="font-semibold">Catatan:</span> {batch.catatan}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {showCreate&&<BatchFormModal onSubmit={handleCreate} onClose={()=>setShowCreate(false)} isPending={isPending} error={formError}/>}
      {editItem&&<BatchFormModal initial={editItem} onSubmit={handleUpdate} onClose={()=>setEditItem(null)} isPending={isPending} error={formError} isEdit/>}

      {lockModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(245,158,11,0.15)'}}>
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock size={24}className="text-amber-500"/></div>
            <h2 className="text-lg font-bold text-gray-900">Kunci Batch?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{lockModal.kode}</span> akan dikunci dan tidak bisa digunakan untuk produksi baru.</p>
            <div className="flex gap-3">
              <button onClick={()=>setLockModal(null)}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
              <button onClick={()=>startTransition(async()=>{const r=await lockBatch(lockModal.id,lockModal.kode);if(r?.error)showToast(r.error,false);else{showToast('🔒 Batch dikunci');setLockModal(null)}})} disabled={isPending}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
                {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending?'Memproses...':'Kunci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-sm rounded-3xl p-6 text-center"style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(24px)',boxShadow:'0 32px 64px rgba(239,68,68,0.15)'}}>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24}className="text-red-500"/></div>
            <h2 className="text-lg font-bold text-gray-900">Hapus Batch?</h2>
            <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{delModal.kode}</span> akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelModal(null)}className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
              <button onClick={()=>startTransition(async()=>{const r=await deleteBatch(delModal.id,delModal.kode);if(r?.error)showToast(r.error,false);else{showToast('🗑️ Batch dihapus');setDelModal(null)}})} disabled={isPending}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
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

