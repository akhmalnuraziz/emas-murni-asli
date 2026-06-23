'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Lock, Unlock, X, Check, AlertTriangle,
  Edit2, Trash2, Scale, Camera, Eye, EyeOff, ChevronDown, ChevronUp, Clock, Archive
} from 'lucide-react'
import { cn, formatRupiah, formatDate, formatGram } from '@/lib/utils'
import {
  createBatch, updateBatch, deleteBatch,
  lockBatch, unlockBatch, updateSisaFisik, hapusSisaFisik,
  createPeleburan, voidPeleburan, editPeleburan, editPeleburanSerah, editPeleburanTerima,
  createBatchRingkas,
} from '@/app/(dashboard)/bahan-baku/actions'
import type { UserRole } from '@/lib/types/database'
import LossApprovalPanel from '@/components/modules/produksi/loss-approval-panel'
import { TimPickerStd, AdminPickerStd } from '@/components/modules/produksi/serah-terima-modal'

interface Props { batches: any[]; peleburanList?: any[]; rejectItems?: any[]; produksiItems?: any[]; rejectCountMap: Record<string, number>; toleransiPeleburan?: number; tims?: any[]; adminList?: any[]; userRole: UserRole; userName: string }

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
    badge: `${direction === 'kurang' ? '-' : '+'}${formatGram(abs)}`,
    desc: withinTol
      ? `Timbangan gudang berbeda dengan timbangan pusat, ${direction} ${formatGram(abs)} dan masih dalam toleransi`
      : `Timbangan gudang berbeda dengan timbangan pusat, selisih ${formatGram(abs)} melebihi batas toleransi — catatan wajib diisi`,
    color: withinTol ? 'text-amber-700' : 'text-red-700',
    bg: withinTol ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
    dot: withinTol ? '#F59E0B' : '#EF4444',
    warn: !withinTol,
  }
}

function getBatchStatus(b: any) {
  if (b.voided_at && b.void_reason === 'DELETED_BY_USER') return 'dihapus'
  if (b.status === 'terkunci') return 'terkunci'
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
const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
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
          <img src={lb}className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"onClick={e=>e.stopPropagation()}/>
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
        <span className={`text-gray-400 ${small?'text-[11px]':'text-[12px]'}`}>{files.length>0?`${files.length} foto — klik tambah`:label}</span>
        <input type="file" accept="image/*" multiple className="hidden"onChange={e=>{onAdd(Array.from(e.target.files??[]));e.currentTarget.value=''}}/>
      </label>
      {files.length>0&&<button type="button"onClick={()=>onRemove(-1)}className="text-[11px] text-red-400 hover:underline">Hapus semua</button>}
    </div>
  )
}

// ─── Batch Ringkas Modal ──────────────────────────────────────────────────────
function BatchRingkasModal({onSubmit,onClose,isPending,error}:{onSubmit:(fd:FormData)=>void;onClose:()=>void;isPending:boolean;error:string}){
  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Impor Batch Lama</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Untuk batch 1-29 yang belum diinput — minimal data</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-lg px-3 py-2 text-[12px] bg-amber-50 border border-amber-100 text-amber-700">
            <b>Catatan:</b> Batch ini akan langsung dikunci (tidak bisa ditambahkan proses produksi baru).
            Hanya bisa dipakai sebagai referensi buyback / peleburan.
          </div>
          <form id="ringkas-form" onSubmit={e=>{e.preventDefault();onSubmit(new FormData(e.currentTarget))}} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kode Batch *</label>
              <input name="kode" required placeholder="mis. B-001 atau BATCH-001" className={`${inp} font-mono font-bold`} autoFocus/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Masuk *</label>
              <input name="tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Berat (gr) *</label>
              <input name="berat" type="number" step="0.001" min="0.001" required placeholder="0.000" className={inp}/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan</label>
              <input name="catatan" placeholder="opsional — mis. Emas 24K batch awal" className={inp}/>
            </div>
            {error&&<p className="text-[12px] text-red-500 font-semibold">{error}</p>}
          </form>
        </div>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button type="submit" form="ringkas-form" disabled={isPending}
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
            {isPending?'Menyimpan...':'Impor Batch'}
          </button>
        </div>
      </div>
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
  const [catatan,setCatatan]=useState(initial?.catatan??'')
  const [newFotos,setNewFotos]=useState<File[]>([])
  const [existingFotos,setExistingFotos]=useState<string[]>(initial?.fotos??[])
  const [uploading,setUploading]=useState(false)
  // Poin 3: TTD untuk selisih timbangan
  const [ttdOpSelisih,setTtdOpSelisih]=useState<string|null>(null)
  const [ttdAdminSelisih,setTtdAdminSelisih]=useState<string|null>(null)
  const [opNamaSelisih,setOpNamaSelisih]=useState('')
  const [adminNamaSelisih,setAdminNamaSelisih]=useState('')

  const si = pusat&&gudang ? hitungSelisih(parseFloat(pusat),parseFloat(gudang)) : null
  const hargaNum = parseFloat(harga)||0
  const totalBiaya = biaya.reduce((s,b)=>s+(b.jumlah||0),0)
  const totalHpp = hargaNum+totalBiaya
  const hppGr = parseFloat(gudang)>0 ? totalHpp/parseFloat(gudang) : 0

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    const formEl=e.currentTarget
    // Validasi TTD jika selisih warn
    if(si?.warn){
      if(!ttdOpSelisih||!ttdAdminSelisih){
        // error ditangani di parent lewat error prop, set via alert sederhana
        alert('Selisih timbangan melebihi toleransi — TTD Operator dan Admin wajib diisi')
        return
      }
    }
    setUploading(true)
    try{
      const b64s=newFotos.length>0?await filesToBase64(newFotos):[]
      const fd=new FormData(formEl)
      fd.set('biaya_tbh',JSON.stringify(biaya))
      fd.set('existing_fotos',JSON.stringify(existingFotos))
      fd.set('new_fotos_b64',JSON.stringify(b64s))
      fd.set('catatan', catatan)
      if(si?.warn&&ttdOpSelisih)    fd.set('selisih_ttd_operator',ttdOpSelisih)
      if(si?.warn&&ttdAdminSelisih) fd.set('selisih_ttd_admin',ttdAdminSelisih)
      if(si?.warn&&opNamaSelisih)   fd.set('selisih_op_nama',opNamaSelisih)
      if(si?.warn&&adminNamaSelisih)fd.set('selisih_admin_nama',adminNamaSelisih)
      onSubmit(fd)
    }finally{setUploading(false)}
  }

  return(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{isEdit?'Edit Batch':'Registrasi Logam Mulia Masuk'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form id="batch-form" onSubmit={submit}className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <F label="Kode Batch"><input name="kode" defaultValue={initial?.kode??''} placeholder="Auto-generate" className={inp} readOnly={isEdit}/></F>
            <F label="Nama / Label Batch"><input name="nama_batch" defaultValue={initial?.nama_batch??''} placeholder="BATCH 26" className={inp}/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Kedatangan" req><input name="tanggal_datang" type="date" defaultValue={initial?.tanggal??today} className={inp} required/></F>
            <F label="Tanggal Pembelian" req><input name="tanggal_beli" type="date" defaultValue={initial?.tanggal_beli??today} className={inp} required/></F>
          </div>
          <F label="Supplier / Sumber"><input name="supplier" defaultValue={initial?.supplier??'GUDANG PUSAT'} className={inp}/></F>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Berat Pusat / Supplier (gr)" req><input name="bahan_dari_pusat" type="number" step="0.001" value={pusat} onChange={e=>setPusat(e.target.value)} placeholder="1000.000" className={inp} required/></F>
            <F label="Berat Timbangan Gudang (gr)" req><input name="timbangan_akhir" type="number" step="0.001" value={gudang} onChange={e=>setGudang(e.target.value)} placeholder="999.890" className={inp} required/></F>
          </div>
          {si&&(
            <div className={cn('flex items-start gap-3 px-4 py-3 rounded-lg border',si.warn?'bg-red-50 border-red-100':'bg-amber-50 border-amber-100')}>
              <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"style={{background:si.dot}}/>
              <p className={cn('text-[12px] font-medium',si.color)}>{si.desc}</p>
            </div>
          )}
          <F label="Harga Beli (IDR)">
            <input name="harga_beli" type="number" value={harga} onChange={e=>setHarga(e.target.value)} placeholder="Opsional — kosongkan jika belum ada" className={inp}/>
            {hargaNum>0&&<p className="text-[12px] text-violet-500 font-semibold px-1 mt-1">{formatRupiah(hargaNum)}</p>}
          </F>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Biaya Tambahan</label>
              <button type="button"onClick={()=>setBiaya(p=>[...p,{label:'',jumlah:0}])}className="text-[12px] text-violet-600 font-semibold hover:underline">+ Tambah</button>
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-[12px]"><span className="text-slate-500">Harga Beli</span><span className="font-semibold text-slate-700">{formatRupiah(hargaNum)}</span></div>
                {totalBiaya>0&&<div className="flex justify-between text-[12px]"><span className="text-slate-500">Biaya Tambahan</span><span className="font-semibold text-slate-700">{formatRupiah(totalBiaya)}</span></div>}
                <div className="flex justify-between text-[12px] border-t border-slate-200 pt-1.5">
                  <span className="font-semibold text-slate-500">Total HPP</span>
                  <span className="font-bold text-violet-700">{formatRupiah(totalHpp)}</span>
                </div>
                {hppGr>0&&<div className="flex justify-between text-[12px]">
                  <span className="font-semibold text-slate-500">HPP / gram</span>
                  <span className="font-bold text-violet-700">{formatRupiah(hppGr)}/gr</span>
                </div>}
              </div>
            </div>
          )}
          <F label={`Catatan${si?.warn?' *':''}`}>
            <input name="catatan" value={catatan} onChange={e=>setCatatan(e.target.value)}
              placeholder={si?.warn?'Wajib — jelaskan alasan selisih berat':'Keterangan tambahan...'}
              className={cn(inp,si?.warn&&'border-red-300')} required={!!si?.warn}/>
          </F>
          {/* Poin 3: TTD wajib jika selisih melebihi toleransi */}
          {si?.warn&&(
            <LossApprovalPanel
              lossGram={Math.abs(parseFloat(pusat)-parseFloat(gudang))}
              toleransiGram={0.05}
              proses="Selisih Timbangan Batch"
              alasan={catatan} setAlasan={setCatatan}
              operatorNama={opNamaSelisih} setOperatorNama={setOpNamaSelisih}
              adminNama={adminNamaSelisih} setAdminNama={setAdminNamaSelisih}
              setTtdOperator={setTtdOpSelisih} setTtdAdmin={setTtdAdminSelisih}
            />
          )}
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
          {error&&<div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/>{error}</div>}
        </form>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={onClose}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button type="submit" form="batch-form" disabled={isPending||uploading}
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {(isPending||uploading)&&<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {uploading?'Kompres foto...':isPending?'Menyimpan...':isEdit?'Simpan Perubahan':'Simpan & Rekonsiliasi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BahanBakuClient({batches,peleburanList=[],rejectItems=[],produksiItems=[],rejectCountMap,toleransiPeleburan=0.05,tims=[],adminList=[],userRole,userName}:Props){
  const [filter,setFilter]=useState<'semua'|'aktif'|'terkunci'>('semua')
  const router = useRouter()
  const [peleburanModalBatch,setPeleburanModalBatch]=useState<string|null>(null)
  const [selesaiLeburItem,setSelesaiLeburItem]=useState<any>(null)
  const [hapusPlbId,setHapusPlbId]=useState<number|null>(null)
  const [editPlbItem,setEditPlbItem]=useState<any>(null)
  const [editPlbMode,setEditPlbMode]=useState<'serah'|'terima'>('serah')
  const [search,setSearch]=useState('')
  const [expanded,setExpanded]=useState<number|null>(null)
  const [showCreate,setShowCreate]=useState(false)
  const [showRingkas,setShowRingkas]=useState(false)
  const [editItem,setEditItem]=useState<any|null>(null)
  const [lockModal,setLockModal]=useState<any|null>(null)
  const [delModal,setDelModal]=useState<any|null>(null)
  const [formError,setFormError]=useState('')
  const [isPending,startTransition]=useTransition()
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [showHPP,setShowHPP]=useState(false)
  const [editingSF,setEditingSF]=useState<number|null>(null)
  const [sfInput,setSfInput]=useState<Record<number,string>>({})
  const [sfCatatan,setSfCatatan]=useState<Record<number,string>>({})
  const [sfFotos,setSfFotos]=useState<Record<number,File[]>>({})
  const [sfExisting,setSfExisting]=useState<Record<number,string[]>>({})
  const [sfUploading,setSfUploading]=useState<Record<number,boolean>>({})
  // Poin 11: TTD untuk selisih sisa fisik
  const [sfTtdOp,setSfTtdOp]=useState<Record<number,string|null>>({})
  const [sfTtdAdmin,setSfTtdAdmin]=useState<Record<number,string|null>>({})
  const [sfOpNama,setSfOpNama]=useState<Record<number,string>>({})
  const [sfAdminNama,setSfAdminNama]=useState<Record<number,string>>({})

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
  function handleRingkas(fd:FormData){setFormError('');startTransition(async()=>{const r=await createBatchRingkas(fd);if(r?.error){setFormError(r.error);return}showToast(`✅ Batch ringkas ${(r as any).kode} diimpor`);setShowRingkas(false)})}
  function handleUpdate(fd:FormData){if(!editItem)return;setFormError('');startTransition(async()=>{const r=await updateBatch(editItem.id,editItem.kode,fd);if(r?.error){setFormError(r.error);return}showToast('✅ Batch diperbarui');setEditItem(null)})}

  async function handleSisaFisik(batch:any, sisaSeharusnya:number, toleransi:number){
    const val=parseFloat(sfInput[batch.id]??'')
    if(isNaN(val)||val<0){showToast('Nilai tidak valid',false);return}
    const selisih=Math.abs(val-sisaSeharusnya)
    const overTol=selisih>toleransi+0.0001
    if(overTol){
      if(!sfTtdOp[batch.id]||!sfTtdAdmin[batch.id]){showToast('TTD Operator dan Admin wajib (selisih > toleransi)',false);return}
    }
    setSfUploading(p=>({...p,[batch.id]:true}))
    try{
      const b64s=(sfFotos[batch.id]??[]).length>0?await filesToBase64(sfFotos[batch.id]??[]):[]
      const fd=new FormData()
      fd.set('batch_id',String(batch.id));fd.set('batch_kode',batch.kode)
      fd.set('sisa_fisik',String(val))
      fd.set('sisa_seharusnya',String(sisaSeharusnya))
      fd.set('existing_fotos',JSON.stringify(sfExisting[batch.id]??[]))
      fd.set('new_fotos_b64',JSON.stringify(b64s))
      fd.set('catatan_sisa_fisik', sfCatatan[batch.id]??'')
      if(overTol&&sfTtdOp[batch.id])    fd.set('selisih_ttd_operator',sfTtdOp[batch.id]!)
      if(overTol&&sfTtdAdmin[batch.id]) fd.set('selisih_ttd_admin',sfTtdAdmin[batch.id]!)
      if(sfOpNama[batch.id])            fd.set('selisih_op_nama',sfOpNama[batch.id])
      if(sfAdminNama[batch.id])         fd.set('selisih_admin_nama',sfAdminNama[batch.id])
      const r=await updateSisaFisik(fd)
      if(r?.error){showToast(r.error,false);return}
      showToast('✅ Sisa fisik disimpan')
      setSfFotos(p=>({...p,[batch.id]:[]}));setSfExisting(p=>({...p,[batch.id]:[]}))
      setSfCatatan(p=>({...p,[batch.id]:''}))
      setSfTtdOp(p=>({...p,[batch.id]:null}));setSfTtdAdmin(p=>({...p,[batch.id]:null}))
      setEditingSF(null)
    }finally{setSfUploading(p=>({...p,[batch.id]:false}))}
  }

  async function handleHapusSisaFisik(batch:any){
    if(!confirm('Hapus data sisa fisik batch ini?'))return
    const r=await hapusSisaFisik(batch.id,batch.kode)
    if(r?.error){showToast(r.error,false);return}
    showToast('✅ Sisa fisik dihapus')
  }

  // ─── Duration helper ──────────────────────────────────────────────────────
  function durasiText(mulai: string|null|undefined, selesai: string|null|undefined): string|null {
    if (!mulai || !selesai) return null
    const [hm, hs] = [mulai.slice(0,5).split(':'), selesai.slice(0,5).split(':')]
    const mnt = (parseInt(hs[0])*60+parseInt(hs[1])) - (parseInt(hm[0])*60+parseInt(hm[1]))
    if (isNaN(mnt) || mnt < 0) return null
    if (mnt < 60) return `${mnt} mnt`
    return `${Math.floor(mnt/60)} j ${mnt%60} mnt`
  }

  return(
    <div className="space-y-5 pb-8">
      {/* Toast */}
      {toast&&<div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold text-white shadow-2xl',toast.ok?'bg-emerald-600':'bg-red-600')}>{toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}</div>}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Bahan Baku</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">{batches.filter(b=>getBatchStatus(b)!=='dihapus').length} batch tercatat</p>
          </div>
          <div className="flex items-center gap-2">
            {canSeeHPP&&(
              <button onClick={()=>setShowHPP(!showHPP)}
                className={cn('flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border transition-colors',
                  showHPP?'bg-violet-50 text-violet-700 border-violet-200':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')}>
                {showHPP?<Eye size={13}/>:<EyeOff size={13}/>}
                {showHPP?'Sembunyikan HPP':'Tampilkan HPP'}
              </button>
            )}
            {canSeeHPP&&(
              <button onClick={()=>{setShowRingkas(true);setFormError('')}}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 transition-colors">
                <Archive size={13}/> Impor Batch Lama
              </button>
            )}
            <button onClick={()=>{setShowCreate(true);setFormError('')}}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
              <Plus size={14}/> Registrasi Batch
            </button>
          </div>
        </div>

        {/* Filter + Search */}
        <div className="flex gap-2 flex-wrap items-center">
          {(['semua','aktif','terkunci'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={cn('h-7 px-3 rounded-full text-[11px] font-semibold capitalize transition-colors',
                filter===f?'bg-violet-600 text-white':'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50')}>
              {f==='semua'?`Semua (${batches.filter(b=>getBatchStatus(b)!=='dihapus').length})`:f==='aktif'?'Aktif':'Terkunci'}
            </button>
          ))}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode, nama, supplier..."
              className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
          </div>
        </div>

        {/* Batch cards */}
        <div className="space-y-3">
          {filtered.length===0?(
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                <Scale size={24} className="text-violet-400"/>
              </div>
              <p className="text-[13px] font-medium text-slate-400">Tidak ada batch bahan baku</p>
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
            const batchPusat = Number(batch.bahan_dari_pusat??0)

            // Losses computation
            const plbBatchAll = (peleburanList as any[]).filter((p:any)=>p.batch_kode===batch.kode)
            const lossesLebur = plbBatchAll.filter((p:any)=>p.status==='selesai').reduce((s:number,p:any)=>s+Number(p.losses_gram??0),0)
            const batchProdItems = (produksiItems as any[]).filter((i:any)=>i.batch_kode===batch.kode&&!i.voided_at)
            const lossesCutting = batchProdItems.reduce((s:number,i:any)=>s+Number(i.losses_cutting??0)+Number(i.reject_cutting_gram??0),0)
            const totalLosses = lossesLebur + lossesCutting

            return(
              <div key={batch.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 font-bold text-[13px] text-violet-600">
                    {(batch.nama_batch??batch.kode??'BA').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {batch.nama_batch??batch.kode}
                      </span>
                      {/* FIX poin 2: hapus si.badge dari sini */}
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                        status==='aktif'?'text-emerald-700 bg-emerald-50':'text-amber-700 bg-amber-50')}>
                        {status==='aktif'?'AKTIF':'TERKUNCI 🔒'}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-400 mt-0.5 font-medium truncate">{batch.kode} · {supplierLabel}</p>
                    <p className="text-[11px] text-gray-400">Datang: {formatDate(batch.tanggal)}</p>
                  </div>
                  {/* FIX poin 3: tampilkan pusat + gudang + sisa langsung di card */}
                  <div className="hidden sm:flex items-center gap-3 flex-shrink-0 mr-1">
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Pusat</p>
                      <p className="text-[12px] font-bold text-gray-600">{formatGram(batchPusat)}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200"/>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Gudang</p>
                      <p className="text-[12px] font-bold text-gray-600">{formatGram(timbAkhir)}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200"/>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Sisa</p>
                      <p className="text-[12px] font-bold text-gray-600">{formatGram(sisaSeharusnya)}</p>
                    </div>
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
                {canSeeHPP&&(
                  <div className="px-5 pb-2">
                    <p className="text-[12px] font-semibold text-violet-600">
                      HPP: {showHPP?`${formatRupiah(batch.hpp_gr??0)}/gr`:'•••/gr'}
                    </p>
                  </div>
                )}

                {/* Progress bar */}
                {sudahTerpakai&&(
                  <div className="px-5 pb-4">
                    <div className="w-full h-1.5 bg-violet-100 rounded-full">
                      <div className="h-1.5 rounded-full bg-violet-500 transition-all"
                        style={{width:`${pct}%`}}/>
                    </div>
                    <p className="text-[11px] text-right mt-1 font-medium text-violet-600">{pct.toFixed(1)}% tersisa</p>
                  </div>
                )}

                {/* Expanded detail */}
                {isExp&&(
                  <div className="px-5 pb-5 border-t border-slate-200 space-y-4 bg-violet-50/20">

                    {/* FIX poin 4: Foto Bukti di ATAS selisih description */}
                    {fotos.length>0&&(
                      <div className="pt-4">
                        <p className="text-[12px] font-semibold text-gray-400 mb-2">📷 Foto Bukti / Sertifikat ({fotos.length})</p>
                        <div className="flex gap-2 flex-wrap">
                          {fotos.map((url:string,i:number)=>(
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 block hover:opacity-80 hover:scale-105 transition-transform">
                              <img src={url} alt="" className="w-full h-full object-cover"/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grid info: berat pusat, gudang, losses, catatan */}
                    <div className={fotos.length>0 ? 'grid grid-cols-2 sm:grid-cols-4 gap-3' : 'pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3'}>
                      {[
                        {label:'Berat Pusat',val:formatGram(batchPusat)},
                        {label:'Timbangan Gudang',val:formatGram(timbAkhir)},
                        {label:'Selisih Timbangan',val:batchPusat!==timbAkhir?formatGram(Math.abs(batchPusat-timbAkhir)):'✓ Sesuai'},
                        {label:'Catatan',val:batch.catatan||'—'},
                      ].map(item=>(
                        <div key={item.label}className="rounded-lg p-3 bg-slate-50 border border-slate-200">
                          <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                          <p className="text-[13px] font-bold text-gray-700 mt-0.5 break-words">{item.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Selisih description */}
                    {(si.warn || Math.abs((batchPusat)-(timbAkhir)) > 0) && (
                      <div className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border',si.warn?'bg-red-50 border-red-200':'bg-amber-50 border-amber-200')}>
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"style={{background:si.dot}}/>
                        <p className={cn('text-[12px] font-medium',si.color)}>{si.desc}</p>
                      </div>
                    )}

                    {/* Reject alert */}
                    {(()=>{
                      const rCount = rejectCountMap[batch.kode] ?? 0
                      return rCount > 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold bg-red-50 border border-red-200 text-red-600">
                          <span>⚠️</span>
                          <span>{rCount} item reject belum dilebur</span>
                        </div>
                      ) : null
                    })()}

                    {/* ─── Rekonsiliasi (iOS card style) ─────────────── */}
                    {(()=>{
                      const plbList = (peleburanList as any[]).filter((p:any)=>p.batch_kode===batch.kode)
                      const sudahDilebur = plbList.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0)
                      const losses      = plbList.filter((p:any)=>p.status==='selesai').reduce((s:number,p:any)=>s+Number(p.losses_gram??0),0)
                      const terpakai    = batchProdItems.reduce((s:number,i:any)=>s+Number(i.total_gram??0),0)
                      const bahanMasuk  = timbAkhir
                      const siapCetak   = Number((batch as any).bahan_siap_cetak ?? 0)
                      const selisihSisaFisik = sisaFisik!=null ? sisaFisik-sisaSeharusnya : null
                      const sfVal = sfInput[batch.id]!=null ? parseFloat(sfInput[batch.id]??'') : null
                      const sfSelisihLive = sfVal!=null&&!isNaN(sfVal) ? sfVal-sisaSeharusnya : null
                      const sfOverTol = sfSelisihLive!=null&&Math.abs(sfSelisihLive)>toleransiPeleburan+0.0001
                      const cols = [
                        {label:'Bahan Masuk',     val:formatGram(bahanMasuk),  accent:'#64748B', sub:'total raw'},
                        {label:'Sudah Dilebur',   val:formatGram(sudahDilebur),accent:'#3B82F6', sub:'diproses'},
                        {label:'Siap Cetak',      val:formatGram(siapCetak),   accent:'#8B5CF6', sub:'bisa dipakai', highlight:true},
                        {label:'Terpakai Cetak',  val:formatGram(terpakai),    accent:'#A855F7', sub:'sudah dicetak'},
                        {label:'Sisa Seharusnya', val:formatGram(sisaSeharusnya), accent:sisaSeharusnya<0?'#EF4444':'#64748B', sub:'belum dilebur'},
                        {label:'Total Losses',    val:formatGram(losses),      accent:losses>0?'#F87171':'#94A3B8', sub:`${bahanMasuk>0?(losses/bahanMasuk*100).toFixed(2):'0.00'}% dari bahan masuk`},
                      ]
                      return (
                        <div>
                          <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wide mb-2.5 px-1">Rekonsiliasi Detail</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {cols.map(col=>(
                              <div key={col.label} className={`rounded-lg px-3.5 py-3 ${col.highlight?'bg-violet-50 border border-violet-200':'bg-white border border-slate-200'}`}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{background:col.accent}}/>
                                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">{col.label}</p>
                                </div>
                                <p className="text-[14px] font-extrabold" style={{color:col.accent}}>{col.val}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">{col.sub}</p>
                              </div>
                            ))}
                            {/* Poin 5+11: Kolom Sisa Fisik inline-edit */}
                            <div className="rounded-xl px-3.5 py-3 col-span-2 sm:col-span-3 bg-emerald-50 border border-emerald-200">
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                                  <p className="text-[10px] font-semibold text-slate-500">Sisa Fisik</p>
                                  {selisihSisaFisik!=null&&(
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selisihSisaFisik>0?'bg-blue-50 text-blue-600':selisihSisaFisik<0?'bg-red-50 text-red-500':'bg-green-50 text-green-600'}`}>
                                      {selisihSisaFisik>0?`+${formatGram(selisihSisaFisik)}`:selisihSisaFisik<0?`-${formatGram(Math.abs(selisihSisaFisik))}`:'✓ Sesuai'}
                                    </span>
                                  )}
                                </div>
                                {status==='aktif'&&!isEditSF&&(
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={()=>{setEditingSF(batch.id);setSfInput(p=>({...p,[batch.id]:String(sisaFisik??'')}));setSfExisting(p=>({...p,[batch.id]:[...fotoSF]}))}}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-violet-600 rounded-xl bg-white border border-violet-200">
                                      <Edit2 size={10}/>{sisaFisik!=null?'Edit':'Input'}
                                    </button>
                                    {sisaFisik!=null&&(
                                      <button onClick={()=>handleHapusSisaFisik(batch)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-red-500 rounded-xl bg-white border border-red-200">
                                        <Trash2 size={10}/>Hapus
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {!isEditSF&&(
                                <p className="text-[14px] font-extrabold text-green-600">{sisaFisik!=null?formatGram(sisaFisik):'—'}</p>
                              )}
                              {isEditSF&&(
                                <div className="space-y-2 mt-1">
                                  <div className="flex gap-2">
                                    <input type="number" step="0.001" value={sfInput[batch.id]??''} onChange={e=>setSfInput(p=>({...p,[batch.id]:e.target.value}))}
                                      placeholder="Berat sisa fisik (gram)"
                                      className="flex-1 px-3 py-2 text-[13px] rounded-xl border border-green-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-400/30"/>
                                    <button onClick={()=>handleSisaFisik(batch,sisaSeharusnya,toleransiPeleburan)} disabled={sfUploading[batch.id]}
                                      className="px-3 h-8 text-[12px] font-bold text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 flex-shrink-0 transition-colors">
                                      {sfUploading[batch.id]?<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Check size={13}/>}
                                      {sfUploading[batch.id]?'Simpan...':'Simpan'}
                                    </button>
                                    <button onClick={()=>{setEditingSF(null);setSfFotos(p=>({...p,[batch.id]:[]}))} }
                                      className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><X size={12}/></button>
                                  </div>
                                  {/* Live selisih indicator */}
                                  {sfSelisihLive!=null&&sfInput[batch.id]!==''&&(
                                    <div className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-between ${sfOverTol?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>
                                      <span>{sfSelisihLive>0?`Gain: +${formatGram(sfSelisihLive)}`:`Loss: ${formatGram(Math.abs(sfSelisihLive))}`}</span>
                                      <span>{sfOverTol?`⚠️ melebihi toleransi ${toleransiPeleburan}gr`:`✓ dalam toleransi`}</span>
                                    </div>
                                  )}
                                  {/* TTD panel jika selisih > toleransi */}
                                  {sfOverTol&&(
                                    <LossApprovalPanel
                                      lossGram={Math.abs(sfSelisihLive??0)} toleransiGram={toleransiPeleburan}
                                      proses="Selisih Sisa Fisik"
                                      alasan={sfCatatan[batch.id]??''} setAlasan={v=>setSfCatatan(p=>({...p,[batch.id]:v}))}
                                      operatorNama={sfOpNama[batch.id]??''} setOperatorNama={v=>setSfOpNama(p=>({...p,[batch.id]:v}))}
                                      adminNama={sfAdminNama[batch.id]??''} setAdminNama={v=>setSfAdminNama(p=>({...p,[batch.id]:v}))}
                                      setTtdOperator={v=>setSfTtdOp(p=>({...p,[batch.id]:v}))}
                                      setTtdAdmin={v=>setSfTtdAdmin(p=>({...p,[batch.id]:v}))}
                                    />
                                  )}
                                  <input type="text" value={sfCatatan[batch.id]??''} onChange={e=>setSfCatatan(p=>({...p,[batch.id]:e.target.value}))}
                                    placeholder="Catatan sisa fisik (opsional)"
                                    className="w-full px-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none"/>
                                  <FotoPicker files={sfFotos[batch.id]??[]}
                                    onAdd={f=>setSfFotos(p=>({...p,[batch.id]:[...(p[batch.id]??[]),...f].slice(0,10)}))}
                                    onRemove={i=>i===-1?setSfFotos(p=>({...p,[batch.id]:[]})):setSfFotos(p=>({...p,[batch.id]:(p[batch.id]??[]).filter((_,j)=>j!==i)}))}
                                    label="Foto sisa fisik" small/>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ─── Peleburan section ─────────────── */}
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">🔥 Riwayat Peleburan</p>
                        {status==='aktif'&&(
                          <button type="button" onClick={()=>setPeleburanModalBatch(batch.kode)}
                            className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors">
                            + Buat Peleburan
                          </button>
                        )}
                      </div>
                      {(()=>{
                        const plbList=(peleburanList as any[]).filter((p:any)=>p.batch_kode===batch.kode)
                        if(plbList.length===0) return (
                          <p className="text-[12px] text-gray-400 text-center py-4">Belum ada peleburan.</p>
                        )
                        return plbList.map((plb:any)=>{
                          // FIX poin 7: hitung durasi
                          const durasi = durasiText(plb.jam_mulai, plb.jam_selesai)
                          return (
                          <div key={plb.id} className="px-4 py-3 border-t border-slate-200">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[12px] font-bold text-gray-800">{plb.kode}</p>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${plb.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                    {plb.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                  </span>
                                </div>
                                {/* FIX poin 7: jam mulai & selesai */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(plb.tanggal).toLocaleDateString('id-ID')}
                                  </p>
                                  {plb.jam_mulai&&(
                                    <span className="flex items-center gap-0.5 text-[10px] text-violet-500 font-semibold">
                                      <Clock size={9}/>{String(plb.jam_mulai).slice(0,5)}
                                    </span>
                                  )}
                                  {plb.jam_selesai&&(
                                    <span className="text-[10px] text-gray-400">→ <span className="text-green-600 font-semibold">{String(plb.jam_selesai).slice(0,5)}</span></span>
                                  )}
                                  {durasi&&<span className="text-[10px] text-gray-400 italic">({durasi})</span>}
                                  {(plb.tim_nama||plb.operator)&&<span className="text-[10px] text-gray-400">· 👥 {plb.tim_nama||plb.operator}</span>}
                                  {plb.admin_input&&<span className="text-[10px] text-gray-400">· ✍️ {plb.admin_input}</span>}
                                </div>
                              </div>
                              {/* FIX poin 12: Tombol hapus dengan konfirmasi yang lebih jelas */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {plb.status!=='selesai'&&batch.status==='aktif'&&(
                                  <button type="button" onClick={()=>setSelesaiLeburItem(plb)}
                                    className="flex-shrink-0 px-2.5 h-7 rounded-lg text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 transition-colors">
                                    Selesai Lebur
                                  </button>
                                )}
                                {batch.status==='aktif'&&(
                                  hapusPlbId===plb.id ? (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-50 border border-red-200">
                                      <span className="text-[10px] text-red-600 font-semibold">Hapus {plb.kode}?</span>
                                      <button type="button" onClick={async()=>{
                                        await voidPeleburan(plb.id,'Dihapus manual')
                                        setHapusPlbId(null); router.refresh()
                                      }} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500 text-white">Ya</button>
                                      <button type="button" onClick={()=>setHapusPlbId(null)}
                                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-200 text-gray-600">Batal</button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button type="button" onClick={()=>{setEditPlbItem(plb);setEditPlbMode('serah')}}
                                        className="flex items-center gap-0.5 h-7 px-2 rounded-xl bg-blue-50 text-[10px] font-semibold text-blue-500"
                                        title="Edit Diserahkan">
                                        <Edit2 size={10}/> Serah
                                      </button>
                                      {plb.status==='selesai'&&(
                                        <button type="button" onClick={()=>{setEditPlbItem(plb);setEditPlbMode('terima')}}
                                          className="flex items-center gap-0.5 h-7 px-2 rounded-xl bg-green-50 text-[10px] font-semibold text-green-600"
                                          title="Edit Diterima">
                                          <Edit2 size={10}/> Terima
                                        </button>
                                      )}
                                      <button type="button" onClick={()=>setHapusPlbId(plb.id)}
                                        className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center"
                                        title="Hapus peleburan">
                                        <Trash2 size={12} className="text-red-400"/>
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                            {/* Gram info */}
                            <div className="flex gap-4 text-[12px]">
                              <div><p className="text-[10px] text-gray-400">Dikasih</p><p className="font-semibold text-gray-700">{formatGram(plb.dikasih_gram)}</p></div>
                              <div><p className="text-[10px] text-gray-400">Diterima</p><p className="font-semibold text-gray-700">{plb.diterima_gram!=null?formatGram(plb.diterima_gram):'—'}</p></div>
                              <div><p className="text-[10px] text-gray-400">Losses</p><p className={`font-semibold ${plb.losses_gram>0?'text-red-500':'text-gray-500'}`}>{plb.losses_gram!=null?formatGram(plb.losses_gram):'—'}</p></div>
                            </div>
                            {/* Foto diserahkan + diterima */}
                            {(()=>{
                              const fotoSerah = Array.isArray(plb.foto_serahkan) ? (plb.foto_serahkan as string[]).filter(Boolean) : []
                              const fotoDtrm  = Array.isArray(plb.foto_diterima)  ? (plb.foto_diterima  as string[]).filter(Boolean) : []
                              if (fotoSerah.length===0 && fotoDtrm.length===0) return null
                              return (
                                <div className="mt-2 flex gap-4 flex-wrap items-start">
                                  {fotoSerah.length>0&&(
                                    <div className="flex-1 min-w-[120px]">
                                      <p className="text-[10px] font-semibold text-violet-500 mb-1.5">
                                        📷 Diserahkan ({fotoSerah.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {fotoSerah.map((url:string,i:number)=>(
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                            className="block">
                                            <img src={url} alt={`Foto serah ${i+1}`}
                                              className="w-20 h-20 rounded-xl object-cover border-2 border-violet-200 hover:border-violet-400 hover:opacity-90 transition-all"
                                              onError={(e)=>{
                                                const t=e.currentTarget
                                                t.style.display='none'
                                                const p=t.parentElement
                                                if(p){p.innerHTML='<span style="display:flex;align-items:center;justify-content:center;width:80px;height:80px;background:#F3F0FA;border-radius:12px;font-size:11px;color:#9CA3AF;border:1px solid #E5E7EB;text-decoration:underline;">Lihat foto</span>'}
                                              }}
                                            />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {fotoDtrm.length>0&&(
                                    <div className="flex-1 min-w-[120px]">
                                      <p className="text-[10px] font-semibold text-green-600 mb-1.5">
                                        📷 Diterima ({fotoDtrm.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {fotoDtrm.map((url:string,i:number)=>(
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                            className="block">
                                            <img src={url} alt={`Foto terima ${i+1}`}
                                              className="w-20 h-20 rounded-xl object-cover border-2 border-green-200 hover:border-green-400 hover:opacity-90 transition-all"
                                              onError={(e)=>{
                                                const t=e.currentTarget
                                                t.style.display='none'
                                                const p=t.parentElement
                                                if(p){p.innerHTML='<span style="display:flex;align-items:center;justify-content:center;width:80px;height:80px;background:#ECFDF5;border-radius:12px;font-size:11px;color:#9CA3AF;border:1px solid #D1FAE5;text-decoration:underline;">Lihat foto</span>'}
                                              }}
                                            />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            {/* FIX poin 6: tampilkan keterangan_serahkan DAN keterangan_diterima */}
                            {plb.keterangan_serahkan&&(
                              <div className="mt-2 px-3 py-1.5 rounded-lg text-[12px] text-slate-500 italic bg-violet-50 border border-violet-100">
                                📤 Diserahkan: {plb.keterangan_serahkan}
                              </div>
                            )}
                            {plb.keterangan_diterima&&(
                              <div className="mt-1 px-3 py-1.5 rounded-lg text-[12px] text-emerald-700 italic bg-emerald-50 border border-emerald-100">
                                📥 Diterima: {plb.keterangan_diterima}
                              </div>
                            )}
                            {/* TTD Loss — tampil kalau ada loss_approval */}
                            {plb.loss_approval&&(
                              <div className="mt-2 rounded-xl overflow-hidden border border-red-100">
                                <div className="px-3 py-2 flex items-center gap-2 bg-red-50">
                                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">⚠ TTD Loss Peleburan</span>
                                  <span className="text-[10px] text-red-400 ml-auto">Loss disetujui</span>
                                </div>
                                <div className="px-3 py-2.5 space-y-1.5">
                                  {plb.loss_approval.alasan&&(
                                    <p className="text-[12px] text-gray-600"><span className="font-semibold text-gray-700">Alasan:</span> {plb.loss_approval.alasan}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-[12px] text-gray-500">
                                    {plb.loss_approval.operator_nama&&<span>👷 Operator: <b>{plb.loss_approval.operator_nama}</b></span>}
                                    {plb.loss_approval.admin_nama&&<span>✍️ Admin: <b>{plb.loss_approval.admin_nama}</b></span>}
                                  </div>
                                  {(plb.loss_approval.ttd_operator_url||plb.loss_approval.ttd_admin_url)&&(
                                    <div className="flex gap-3 pt-1">
                                      {plb.loss_approval.ttd_operator_url&&(
                                        <div>
                                          <p className="text-[10px] text-gray-400 mb-1">TTD Operator</p>
                                          <a href={plb.loss_approval.ttd_operator_url} target="_blank" rel="noopener noreferrer">
                                            <img src={plb.loss_approval.ttd_operator_url} alt="TTD Operator"
                                              className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/>
                                          </a>
                                        </div>
                                      )}
                                      {plb.loss_approval.ttd_admin_url&&(
                                        <div>
                                          <p className="text-[10px] text-gray-400 mb-1">TTD Admin</p>
                                          <a href={plb.loss_approval.ttd_admin_url} target="_blank" rel="noopener noreferrer">
                                            <img src={plb.loss_approval.ttd_admin_url} alt="TTD Admin"
                                              className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/>
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )})
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      {/* Modals */}
      {showCreate&&<BatchFormModal onSubmit={handleCreate} onClose={()=>setShowCreate(false)} isPending={isPending} error={formError}/>}
      {showRingkas&&<BatchRingkasModal onSubmit={handleRingkas} onClose={()=>setShowRingkas(false)} isPending={isPending} error={formError}/>}
      {peleburanModalBatch&&(()=>{
        const pb = batches.find((b:any)=>b.kode===peleburanModalBatch)
        const plbBatch = (peleburanList as any[]).filter((p:any)=>p.batch_kode===peleburanModalBatch)
        const totalDilebur = plbBatch.reduce((s:number,p:any)=>s+Number(p.dikasih_gram??0),0)
        const mentahBelumLebur = Math.max(0, Number(pb?.timbangan_akhir??0) - totalDilebur)
        const hasilLeburBelumCetak = Number(pb?.bahan_siap_cetak??0)
        return <CreatePeleburanModal
          batchKode={peleburanModalBatch}
          batchNama={pb?.nama_batch??''}
          sisaMentahBelumLebur={mentahBelumLebur}
          hasilLeburBelumCetak={hasilLeburBelumCetak}
          rejectOptions={(rejectItems as any[]).filter((r:any)=>r.batch_kode===peleburanModalBatch)}
          tims={tims} adminList={adminList}
          onClose={()=>{
            // Auto-expand batch card agar riwayat peleburan langsung terlihat
            const targetBatch = batches.find((b:any)=>b.kode===peleburanModalBatch)
            if (targetBatch) setExpanded(targetBatch.id)
            setPeleburanModalBatch(null)
          }}
          showToast={showToast}/>
      })()}
      {selesaiLeburItem&&<SelesaiLeburModal peleburan={selesaiLeburItem} toleransi={toleransiPeleburan} tims={tims} adminList={adminList} onClose={()=>{
            const targetBatch = batches.find((b:any)=>b.kode===selesaiLeburItem?.batch_kode)
            if (targetBatch) setExpanded(targetBatch.id)
            setSelesaiLeburItem(null)
          }} showToast={showToast}/>}
      {editPlbItem&&editPlbMode==='serah'&&<EditPeleburanSerahModal peleburan={editPlbItem} tims={tims} adminList={adminList} onClose={()=>setEditPlbItem(null)} showToast={showToast}/>}
      {editPlbItem&&editPlbMode==='terima'&&<EditPeleburanTerimaModal peleburan={editPlbItem} tims={tims} adminList={adminList} toleransi={toleransiPeleburan} onClose={()=>setEditPlbItem(null)} showToast={showToast}/>}
      {editItem&&<BatchFormModal initial={editItem} onSubmit={handleUpdate} onClose={()=>setEditItem(null)} isPending={isPending} error={formError} isEdit/>}

      {lockModal&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Kunci Batch?</h2>
                <p className="text-[11px] text-slate-400 mt-0.5"><span className="font-semibold text-slate-600">{lockModal.kode}</span> akan dikunci dan tidak bisa digunakan untuk produksi baru.</p>
              </div>
              <button onClick={()=>setLockModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0"><Lock size={18}className="text-amber-500"/></div>
              <p className="text-[13px] text-slate-500">Batch yang sudah dikunci tidak bisa digunakan untuk proses produksi baru.</p>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
              <button onClick={()=>setLockModal(null)}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={()=>startTransition(async()=>{const r=await lockBatch(lockModal.id,lockModal.kode);if(r?.error)showToast(r.error,false);else{showToast('🔒 Batch dikunci');setLockModal(null)}})} disabled={isPending}
                className="flex-1 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-[13px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending&&<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending?'Memproses...':'Kunci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delModal&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Hapus Batch?</h2>
                <p className="text-[11px] text-slate-400 mt-0.5"><span className="font-semibold text-slate-600">{delModal.kode}</span> akan dihapus permanen.</p>
              </div>
              <button onClick={()=>setDelModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0"><Trash2 size={18}className="text-red-500"/></div>
              <div>
                <p className="text-[13px] text-slate-500">Tindakan ini tidak bisa dibatalkan.</p>
                <p className="text-[12px] text-red-500 font-semibold mt-0.5">⚠ Data akan dihapus permanen</p>
              </div>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
              <button onClick={()=>setDelModal(null)}className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={()=>startTransition(async()=>{const r=await deleteBatch(delModal.id,delModal.kode);if(r?.error)showToast(r.error,false);else{showToast('🗑️ Batch dihapus');setDelModal(null)}})} disabled={isPending}
                className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending&&<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending?'Menghapus...':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Create Peleburan Modal (3 sumber: mentah / hasil lebur belum cetak / reject) ───
function CreatePeleburanModal({ batchKode, batchNama, sisaMentahBelumLebur, hasilLeburBelumCetak, rejectOptions, tims = [], adminList = [], onClose, showToast }: {
  batchKode: string; batchNama: string
  sisaMentahBelumLebur: number; hasilLeburBelumCetak: number
  rejectOptions: any[]; tims?: any[]; adminList?: any[]
  onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [pend, start]     = useTransition()
  const [err, setErr]     = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [mentahChecked, setMentahChecked] = useState(false)
  const [mentahGram, setMentahGram]       = useState('')
  const [leburChecked, setLeburChecked]   = useState(false)
  const [leburGram, setLeburGram]         = useState('')
  const [rejGram, setRejGram]   = useState<Record<number,string>>({})
  const router = useRouter()

  function toggleRej(id: number, berat: number) {
    setRejGram(prev => { const n={...prev}; if(n[id]!==undefined){delete n[id]}else{n[id]=Number(berat).toFixed(3)}; return n })
  }

  const totalDikasih =
    (mentahChecked ? (Number(mentahGram)||0) : 0) +
    (leburChecked ? (Number(leburGram)||0) : 0) +
    Object.values(rejGram).reduce((s,v)=>s+(Number(v)||0),0)

  const mentahNaik = mentahChecked && (Number(mentahGram)||0) > sisaMentahBelumLebur && sisaMentahBelumLebur >= 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd   = new FormData(form)
    fd.set('batch_kode', batchKode)

    type SI = { tipe:string; ref_id:string|null; ref_label:string; gram_otomatis:number; gram_aktual:number }
    const sumber: SI[] = []
    if (mentahChecked && (Number(mentahGram)||0) > 0)
      sumber.push({ tipe:'batch_mentah', ref_id:null, ref_label:'Sisa Bahan Mentah Belum Di Lebur', gram_otomatis:sisaMentahBelumLebur, gram_aktual:Number(mentahGram) })
    if (leburChecked && (Number(leburGram)||0) > 0)
      sumber.push({ tipe:'sisa_peleburan', ref_id:null, ref_label:'Hasil Lebur Belum Dicetak', gram_otomatis:hasilLeburBelumCetak, gram_aktual:Number(leburGram) })
    for (const [id,gram] of Object.entries(rejGram)) {
      const rej = rejectOptions.find((r:any)=>r.id===Number(id))
      if (rej && (Number(gram)||0) > 0)
        sumber.push({ tipe:'reject_cutting', ref_id:id, ref_label:rej.kode??rej.nama_item, gram_otomatis:Number(rej.berat_reject), gram_aktual:Number(gram) })
    }
    if (sumber.length === 0) { setErr('Pilih minimal satu sumber bahan'); return }
    fd.set('sumber_json', JSON.stringify(sumber))
    if (fotos.length > 0) {
      const b64s = await filesToBase64(fotos)
      fd.set('foto_serahkan_b64', JSON.stringify(b64s))
    }
    setErr('')
    start(async () => {
      const r = await createPeleburan(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`Peleburan ${r.kode} dibuat`)
      onClose(); router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Buat Peleburan</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{batchNama||batchKode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

          {/* SUMBER BAHAN — 3 pilihan */}
          <div className="rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">🧱 Sumber Bahan</span>
            </div>
            <div className="p-4 space-y-4">

              {/* 1. Sisa Bahan Mentah Belum Di Lebur */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={mentahChecked} onChange={e=>setMentahChecked(e.target.checked)} className="w-4 h-4 rounded accent-violet-600"/>
                  <span className="text-[12px] font-semibold text-gray-700">Sisa Bahan Mentah Belum Di Lebur</span>
                  <span className="ml-auto text-[10px] text-gray-400">{formatGram(sisaMentahBelumLebur)}</span>
                </label>
                {mentahChecked&&(
                  <div className="mt-2 pl-6">
                    <input type="number" step="0.001" placeholder={`cth: ${sisaMentahBelumLebur.toFixed(3)}`}
                      value={mentahGram} onChange={e=>setMentahGram(e.target.value)} className={inp}/>
                    {mentahNaik&&<p className="text-[11px] text-amber-600 font-semibold mt-1">⚠ Timbangan naik {((Number(mentahGram)||0)-sisaMentahBelumLebur).toFixed(3)} gr — wajib isi Keterangan</p>}
                  </div>
                )}
              </div>

              {/* 2. Hasil Lebur Belum Dicetak */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={leburChecked} onChange={e=>setLeburChecked(e.target.checked)} className="w-4 h-4 rounded accent-violet-600"/>
                  <span className="text-[12px] font-semibold text-gray-700">Hasil Lebur Belum Dicetak</span>
                  <span className="ml-auto text-[10px] text-violet-400 font-semibold">{formatGram(hasilLeburBelumCetak)}</span>
                </label>
                {leburChecked&&(
                  <div className="mt-2 pl-6">
                    <input type="number" step="0.001" max={hasilLeburBelumCetak} placeholder={`Max ${hasilLeburBelumCetak.toFixed(3)}`}
                      value={leburGram} onChange={e=>setLeburGram(e.target.value)} className={inp}/>
                  </div>
                )}
              </div>

              {/* 3. Reject Cutting / Reject PCS */}
              {rejectOptions.length>0&&(
                <div>
                  <p className="text-[12px] font-semibold text-gray-700 mb-2">Reject (Cutting / Pas Berat / Annealing)</p>
                  <div className="space-y-2">
                    {rejectOptions.map((rej:any)=>{
                      // Tentukan asal reject berdasarkan data
                      const rc = Number(rej.reject_cutting_gram ?? 0)
                      const br = Number(rej.berat_reject ?? 0)
                      const prosesLabel = rc > 0 && Math.abs(rc - br) < 0.001
                        ? 'Reject Cutting'
                        : rc > 0
                          ? 'Reject Cutting + Reject Pas Berat'
                          : `Reject ${rej.current_status ?? 'Proses'}`
                      return (
                      <div key={rej.id}>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={rejGram[rej.id]!==undefined} onChange={()=>toggleRej(rej.id,rej.berat_reject)} className="w-4 h-4 rounded accent-violet-600"/>
                          <span className="text-[12px] font-medium text-gray-700">{rej.kode??rej.nama_item}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">{prosesLabel}</span>
                          <span className="text-[10px] text-gray-400">({rej.gramasi}gr)</span>
                          <span className="ml-auto text-[10px] text-red-400 font-semibold">{formatGram(rej.berat_reject)}{rej.pcs_reject?` · ${rej.pcs_reject} pcs`:''}</span>
                        </label>
                        {rejGram[rej.id]!==undefined&&(
                          <div className="mt-1 pl-6">
                            <input type="number" step="0.001" max={rej.berat_reject} placeholder={`Max ${formatGram(rej.berat_reject)}`}
                              value={rejGram[rej.id]} onChange={e=>setRejGram(p=>({...p,[rej.id]:e.target.value}))} className={inp}/>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {rejectOptions.length===0&&!mentahChecked&&!leburChecked&&(
                <p className="text-[12px] text-gray-400 italic text-center py-2">Centang sumber bahan di atas</p>
              )}

              {/* Total */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-violet-50 border border-violet-100">
                <span className="text-[12px] text-slate-500 font-semibold">Total Dikasih</span>
                <span className={`text-[13px] font-bold ${totalDikasih>0?'text-violet-700':'text-slate-400'}`}>{(Math.round(totalDikasih*100)/100).toFixed(2).replace('.',',')} gr</span>
              </div>
            </div>
          </div>

          {/* DISERAHKAN */}
          <div className="rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">📤 Diserahkan</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Mulai *</label>
                  <input name="tanggal" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inp} required/>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jam Mulai *</label>
                  <input name="jam_mulai" type="time" className={inp} required/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto</label>
                <label className="flex items-center gap-2 h-10 px-3 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-violet-50">
                  <Camera size={14} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-[12px] text-gray-400">{fotos.length>0?`${fotos.length} foto dipilih`:'Tambah foto'}</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e=>setFotos(p=>[...p,...Array.from(e.target.files??[])].slice(0,10))}/>
                </label>
                {fotos.length>0&&(
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fotos.map((f,i)=>(
                      <div key={i} className="relative">
                        <img src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-xl object-cover border border-violet-200"/>
                        <button type="button" onClick={()=>setFotos(p=>p.filter((_,j)=>j!==i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <TimPickerStd tims={tims} prefix="" />
              <AdminPickerStd adminList={adminList} prefix="" />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Keterangan {mentahNaik&&<span className="text-red-500">* (wajib — timbangan naik)</span>}
                </label>
                <input name="keterangan_serahkan" type="text"
                  placeholder={mentahNaik?'Jelaskan alasan timbangan naik...':'Opsional'}
                  className={inp} required={mentahNaik}/>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl border border-dashed border-gray-200 text-center">
            <p className="text-[12px] text-gray-400">Bagian <span className="font-semibold text-gray-500">Diterima</span> diisi setelah proses lebur selesai</p>
          </div>

          {err&&<div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13} className="flex-shrink-0"/><span>{err}</span></div>}

          <div className="flex gap-2.5 pb-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={pend||totalDikasih<=0}
              className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
              {pend?'Menyimpan…':`Mulai Peleburan (${formatGram(totalDikasih)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Selesai Lebur Modal ──────────────────────────────────────────────────────
function SelesaiLeburModal({ peleburan, toleransi = 0.05, tims = [], adminList = [], onClose, showToast }: {
  peleburan: any; toleransi?: number; tims?: any[]; adminList?: any[]; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [pend, start]   = useTransition()
  const [err, setErr]   = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const router = useRouter()

  // Loss realtime
  const [diterimaVal, setDiterimaVal] = useState('')
  const lossNow = Math.max(0, Number(peleburan.dikasih_gram ?? 0) - (parseFloat(diterimaVal) || 0))
  const overTol = diterimaVal !== '' && lossNow > toleransi + 0.0001
  const [lossAlasan, setLossAlasan] = useState('')
  const [lossOpNama, setLossOpNama] = useState('')
  const [lossAdminNama, setLossAdminNama] = useState('')
  const [ttdOp, setTtdOp] = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (overTol) {
      if (!lossAlasan.trim()) { setErr('Alasan loss wajib diisi (loss melebihi toleransi)'); return }
      if (!ttdOp) { setErr('Tanda tangan operator wajib'); return }
      if (!ttdAdmin) { setErr('Tanda tangan admin wajib'); return }
    }
    const fd = new FormData(form)
    if (fotos.length > 0) {
      const b64s = await filesToBase64(fotos)
      fd.set('foto_diterima_b64', JSON.stringify(b64s))
    }
    if (overTol) {
      fd.set('loss_alasan', lossAlasan)
      fd.set('loss_operator_nama', lossOpNama)
      fd.set('loss_admin_nama', lossAdminNama)
      if (ttdOp) fd.set('loss_ttd_operator', ttdOp)
      if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
    }
    setErr('')
    start(async () => {
      const { selesaiLebur } = await import('@/app/(dashboard)/bahan-baku/actions')
      const r = await selesaiLebur(peleburan.id, fd)
      if (r?.error) { setErr(r.error); return }
      showToast('Peleburan selesai — losses tercatat')
      onClose(); router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Selesai Lebur</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{peleburan.kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 flex items-center gap-2">
            <span>Dikasih:</span>
            <span className="font-bold">{formatGram(peleburan.dikasih_gram)}</span>
          </div>

          <div className="rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">📥 Diterima</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Berat Diterima (gr) *</label>
                <input name="diterima_gram" type="number" step="0.001"
                  value={diterimaVal} onChange={e=>setDiterimaVal(e.target.value)}
                  placeholder="cth: 499.980" className={inp} required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Selesai *</label>
                  <input name="tanggal_diterima" type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className={inp} required/>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jam Selesai *</label>
                  <input name="jam_selesai" type="time" className={inp} required/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto Bukti</label>
                <label className="flex items-center gap-2 h-10 px-3 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-green-50 transition-colors">
                  <Camera size={14} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-[12px] text-gray-400">{fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto'}</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setFotos(p => [...p, ...Array.from(e.target.files??[])].slice(0,10))}/>
                </label>
                {fotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fotos.map((f,i) => (
                      <div key={i} className="relative">
                        <img src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-xl object-cover border border-green-200"/>
                        <button type="button" onClick={() => setFotos(p => p.filter((_,j) => j!==i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <TimPickerStd tims={tims} prefix="terima_" />
              <AdminPickerStd adminList={adminList} prefix="terima_" />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan Selesai Lebur</label>
                <input name="keterangan_diterima" type="text" placeholder="Opsional" className={inp}/>
              </div>
            </div>
          </div>

          {/* Loss indicator realtime */}
          {diterimaVal !== '' && (
            <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold flex items-center justify-between ${overTol?'bg-red-50 border border-red-100 text-red-600':'bg-green-50 border border-green-100 text-green-700'}`}>
              <span>Loss: {lossNow.toFixed(3)} gr</span>
              <span className="text-[10px]">{overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
            </div>
          )}

          {overTol && (
            <LossApprovalPanel
              lossGram={lossNow} toleransiGram={toleransi} proses="Peleburan"
              alasan={lossAlasan} setAlasan={setLossAlasan}
              operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
              adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
              setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
            />
          )}

          {err && (
            <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2">
              <AlertTriangle size={13} className="flex-shrink-0"/><span>{err}</span>
            </div>
          )}
          <div className="flex gap-2.5 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={pend}
              className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
              {pend ? 'Menyimpan…' : 'Konfirmasi Selesai'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Peleburan Diserahkan Modal ─────────────────────────────────────────
function EditPeleburanSerahModal({ peleburan, tims = [], adminList = [], onClose, showToast }: {
  peleburan: any; tims?: any[]; adminList?: any[]; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [pend, start] = useTransition()
  const [err, setErr] = useState('')
  const [editDikasih, setEditDikasih] = useState('')
  const [newFotos, setNewFotos] = useState<File[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>(
    Array.isArray(peleburan.foto_serahkan) ? peleburan.foto_serahkan : []
  )
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('existing_fotos', JSON.stringify(existingFotos))
    if (newFotos.length > 0) {
      const b64s = await filesToBase64(newFotos)
      fd.set('foto_serahkan_b64', JSON.stringify(b64s))
    }
    setErr('')
    start(async () => {
      const r = await editPeleburanSerah(peleburan.id, fd)
      if (r?.error) { setErr(r.error); return }
      showToast('✅ Data penyerahan diperbarui')
      onClose(); router.refresh()
    })
  }

  const toTime = (t: any) => t ? String(t).slice(0,5) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Edit Diserahkan</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{peleburan.kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">📤 Diserahkan</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Berat Diserahkan (gr) *</label>
                <input name="dikasih_gram" type="number" step="0.001"
                  defaultValue={peleburan.dikasih_gram} className={inp}
                  onChange={e => setEditDikasih(e.target.value)} required/>
                {(() => {
                  const val = Number(editDikasih||peleburan.dikasih_gram)
                  const sisa = Number(peleburan.sisa_tersedia ?? 0)
                  if (sisa > 0 && val > sisa) return (
                    <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-xl text-[12px] bg-amber-50 border border-amber-200">
                      <span className="text-amber-600 font-bold">⚠</span>
                      <span className="text-amber-700 font-semibold">Timbangan naik {(val - sisa).toFixed(3)} gr dari sisa ({sisa.toFixed(3)} gr)</span>
                    </div>
                  )
                  return null
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Mulai *</label>
                  <input name="tanggal" type="date" defaultValue={peleburan.tanggal} className={inp} required/>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jam Mulai *</label>
                  <input name="jam_mulai" type="time" defaultValue={toTime(peleburan.jam_mulai)} className={inp} required/>
                </div>
              </div>
              {existingFotos.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto saat ini</label>
                  <div className="flex flex-wrap gap-2">
                    {existingFotos.map((url,i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-violet-200"/>
                        <button type="button" onClick={() => setExistingFotos(p => p.filter((_,j) => j!==i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tambah Foto</label>
                <label className="flex items-center gap-2 h-10 px-3 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-violet-50">
                  <Camera size={14} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-[12px] text-gray-400">{newFotos.length > 0 ? `${newFotos.length} foto baru` : 'Tambah foto'}</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setNewFotos(p => [...p, ...Array.from(e.target.files??[])].slice(0,5))}/>
                </label>
              </div>
              <TimPickerStd tims={tims} prefix="" initialTimId={peleburan.tim_id!=null?String(peleburan.tim_id):''} initialAnggota={peleburan.tim_anggota_aktif?String(peleburan.tim_anggota_aktif).split(',').map((x:string)=>x.trim()).filter(Boolean):undefined} />
              <AdminPickerStd adminList={adminList} prefix="" initialValue={peleburan.admin_input??''} />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan</label>
                <input name="keterangan_serahkan" type="text" defaultValue={peleburan.keterangan_serahkan??''} placeholder="Opsional" className={inp}/>
              </div>
            </div>
          </div>
          {err && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13} className="flex-shrink-0"/><span>{err}</span></div>}
          <div className="flex gap-2.5 pb-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={pend} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
              {pend ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Peleburan Diterima Modal ──────────────────────────────────────────
function EditPeleburanTerimaModal({ peleburan, tims = [], adminList = [], toleransi = 0.05, onClose, showToast }: {
  peleburan: any; tims?: any[]; adminList?: any[]; toleransi?: number; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [pend, start] = useTransition()
  const [err, setErr] = useState('')
  const [diterimaVal, setDiterimaVal] = useState(peleburan.diterima_gram != null ? String(peleburan.diterima_gram) : '')
  const [newFotosDiterima, setNewFotosDiterima] = useState<File[]>([])
  const [existingFotosDiterima, setExistingFotosDiterima] = useState<string[]>(
    Array.isArray(peleburan.foto_diterima) ? peleburan.foto_diterima : []
  )
  const router = useRouter()

  // Loss realtime
  const lossNow = Math.max(0, Number(peleburan.dikasih_gram ?? 0) - (parseFloat(diterimaVal) || 0))
  const overTol = diterimaVal !== '' && lossNow > toleransi + 0.0001

  // Loss approval panel state
  const [lossAlasan, setLossAlasan] = useState(peleburan.loss_approval?.alasan ?? '')
  const [lossOpNama, setLossOpNama] = useState(peleburan.loss_approval?.operator_nama ?? '')
  const [lossAdminNama, setLossAdminNama] = useState(peleburan.loss_approval?.admin_nama ?? '')
  const [ttdOp, setTtdOp] = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)

  // TTD lama masih valid — tidak perlu re-sign kalau sudah ada (poin 7)
  const existingLossEarly = peleburan.loss_approval
  const hasExistingTtd = !!(existingLossEarly?.ttd_operator_url && existingLossEarly?.ttd_admin_url)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (overTol) {
      if (!lossAlasan.trim()) { setErr('Alasan loss wajib diisi (loss melebihi toleransi)'); return }
      if (!hasExistingTtd) {
        if (!ttdOp)    { setErr('Tanda tangan operator wajib (loss melebihi toleransi)'); return }
        if (!ttdAdmin) { setErr('Tanda tangan admin/manager wajib'); return }
      }
    }
    const fd = new FormData(form)
    fd.set('existing_fotos_diterima', JSON.stringify(existingFotosDiterima))
    if (newFotosDiterima.length > 0) {
      const b64s = await filesToBase64(newFotosDiterima)
      fd.set('foto_diterima_b64', JSON.stringify(b64s))
    }
    if (overTol) {
      fd.set('loss_alasan', lossAlasan)
      fd.set('loss_operator_nama', lossOpNama)
      fd.set('loss_admin_nama', lossAdminNama)
      if (ttdOp)    fd.set('loss_ttd_operator', ttdOp)
      if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
      // Kirim flag bahwa TTD lama masih bisa dipakai
      if (hasExistingTtd) fd.set('keep_existing_ttd', '1')
    }
    setErr('')
    start(async () => {
      const r = await editPeleburanTerima(peleburan.id, fd)
      if (r?.error) { setErr(r.error); return }
      showToast('✅ Data penerimaan diperbarui')
      onClose(); router.refresh()
    })
  }

  const toTime = (t: any) => t ? String(t).slice(0,5) : ''
  const existingLoss = peleburan.loss_approval

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Edit Diterima</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{peleburan.kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Info serah */}
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 flex items-center gap-2">
            <span>Diserahkan:</span>
            <span className="font-bold">{formatGram(peleburan.dikasih_gram)}</span>
          </div>

          {/* Existing TTD notice */}
          {existingLoss && (
            <div className="rounded-lg px-3 py-2 text-[12px] bg-amber-50 border border-amber-100 text-amber-700">
              <p className="font-semibold text-amber-700 mb-1">
                {hasExistingTtd ? '✅ TTD Loss Tersimpan — tidak perlu tanda tangan ulang' : '⚠ TTD Loss Belum Lengkap'}
              </p>
              <p className="text-amber-600">Alasan: {existingLoss.alasan || '—'}</p>
              <p className="text-amber-600">Operator: {existingLoss.operator_nama || '—'} · Admin: {existingLoss.admin_nama || '—'}</p>
            </div>
          )}

          <div className="rounded-lg overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-slate-50 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">📥 Diterima</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Berat Diterima (gr) *</label>
                <input name="diterima_gram" type="number" step="0.001"
                  value={diterimaVal} onChange={e => setDiterimaVal(e.target.value)}
                  className={inp} required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Selesai</label>
                  <input name="tanggal_diterima" type="date" defaultValue={peleburan.tanggal_diterima ?? ''} className={inp}/>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jam Selesai</label>
                  <input name="jam_selesai" type="time" defaultValue={toTime(peleburan.jam_selesai)} className={inp}/>
                </div>
              </div>
              {existingFotosDiterima.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foto diterima saat ini</label>
                  <div className="flex flex-wrap gap-2">
                    {existingFotosDiterima.map((url,i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-green-200"/>
                        <button type="button" onClick={() => setExistingFotosDiterima(p => p.filter((_,j) => j!==i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tambah Foto Diterima</label>
                <label className="flex items-center gap-2 h-10 px-3 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-green-50">
                  <Camera size={14} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-[12px] text-gray-400">{newFotosDiterima.length > 0 ? `${newFotosDiterima.length} foto baru` : 'Tambah foto'}</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setNewFotosDiterima(p => [...p, ...Array.from(e.target.files??[])].slice(0,5))}/>
                </label>
              </div>
              {/* Tim picker: pre-fill anggota dari tim saat ini jika tim_anggota_aktif belum terisi */}
          {(()=>{
            const savedAnggota = peleburan.tim_anggota_aktif
              ? String(peleburan.tim_anggota_aktif).split(',').map((x:string)=>x.trim()).filter(Boolean)
              : undefined
            const timAnggotaFallback = !savedAnggota && peleburan.tim_id
              ? (tims.find((t:any)=>t.id===peleburan.tim_id)?.anggota??[]).filter((a:any)=>a.aktif).map((a:any)=>a.nama)
              : undefined
            return <TimPickerStd tims={tims} prefix="terima_"
              initialTimId={peleburan.tim_id!=null?String(peleburan.tim_id):''}
              initialAnggota={savedAnggota??timAnggotaFallback} />
          })()}
              <AdminPickerStd adminList={adminList} prefix="terima_" initialValue={peleburan.admin_input??''} />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan Selesai Lebur</label>
                <input name="keterangan_diterima" type="text" defaultValue={peleburan.keterangan_diterima??''} placeholder="Opsional" className={inp}/>
              </div>
            </div>
          </div>

          {/* Loss realtime indicator */}
          {diterimaVal !== '' && (
            <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold flex items-center justify-between ${overTol?'bg-red-50 border border-red-100 text-red-600':'bg-green-50 border border-green-100 text-green-700'}`}>
              <span>Loss: {lossNow.toFixed(3)} gr</span>
              <span className="text-[10px]">{overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
            </div>
          )}

          {/* Loss approval panel */}
          {overTol && (
            <LossApprovalPanel
              lossGram={lossNow} toleransiGram={toleransi} proses="Peleburan"
              alasan={lossAlasan} setAlasan={setLossAlasan}
              operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
              adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
              setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
            />
          )}

          {err && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13} className="flex-shrink-0"/><span>{err}</span></div>}
          <div className="flex gap-2.5 pb-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={pend} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
              {pend ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


