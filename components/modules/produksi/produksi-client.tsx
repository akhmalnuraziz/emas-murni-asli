'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import {
  Plus, Search, Edit2, Trash2, Check, AlertTriangle,
  X, ImageIcon, ChevronDown, ChevronUp, Package,
  Camera, Layers, RefreshCw, Eye, Printer
} from 'lucide-react'
import { cn, formatDate, formatGram, formatRupiah } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi, editProduksi,
  inputReject, leburReject, deleteProduksi,
  createPacking, voidPacking
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  produksiList: any[]
  batches: any[]
  userRole: UserRole
  userName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const STATUS_FLOW = ['Cutting','Pas Berat','Annealing','QC','Siap Packing','Sudah Packing']
const STATUS_NEXT: Record<string,string> = {
  'Cutting':'Pas Berat','Pas Berat':'Annealing','Annealing':'QC',
  'QC':'Siap Packing','Siap Packing':'Sudah Packing'
}

const STATUS_COLOR: Record<string,{dot:string;bg:string;text:string;label:string}> = {
  'Cutting':       { dot:'#3B82F6', bg:'rgba(59,130,246,0.12)', text:'#2563EB', label:'Cutting' },
  'Pas Berat':     { dot:'#F97316', bg:'rgba(249,115,22,0.12)', text:'#EA580C', label:'Pas Berat' },
  'Annealing':     { dot:'#EAB308', bg:'rgba(234,179,8,0.12)',  text:'#CA8A04', label:'Annealing' },
  'QC':            { dot:'#06B6D4', bg:'rgba(6,182,212,0.12)',  text:'#0891B2', label:'QC' },
  'Siap Packing':  { dot:'#22C55E', bg:'rgba(34,197,94,0.12)',  text:'#16A34A', label:'Siap Packing' },
  'Sudah Packing': { dot:'#8B5CF6', bg:'rgba(139,92,246,0.12)', text:'#7C3AED', label:'Sudah Packing' },
  'Reject':        { dot:'#EF4444', bg:'rgba(239,68,68,0.12)',  text:'#DC2626', label:'Reject' },
}

// ─── filesToBase64 ────────────────────────────────────────────────────────────
async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 10)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const max = 1200
        if (width > max || height > max) {
          const r = Math.min(max/width, max/height)
          width = Math.floor(width*r); height = Math.floor(height*r)
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        let q = 0.8
        const tryQ = () => canvas.toBlob(blob => {
          if (!blob) { resolve(''); return }
          if (blob.size <= 250*1024 || q <= 0.3) {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          } else { q -= 0.1; tryQ() }
        }, 'image/jpeg', q)
        tryQ()
      }
      img.onerror = () => resolve('')
      img.src = URL.createObjectURL(file)
    })
    if (b64) results.push(b64)
  }
  return results
}

// ─── FotoPicker ──────────────────────────────────────────────────────────────
function FotoPicker({ files, existing=[], onAdd, onRemove, onRemoveExisting, label='Tambah foto', small=false }: {
  files: File[]; existing?: string[]
  onAdd: (f: File[]) => void
  onRemove: (i: number) => void
  onRemoveExisting?: (i: number) => void
  label?: string; small?: boolean
}) {
  const [previews, setPreviews] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string|null>(null)
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [files])
  const sz = small ? 'w-14 h-14' : 'w-16 h-16'
  return (
    <div className="space-y-2">
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"/>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-sm"><X size={18}/></button>
        </div>
      )}
      {(existing.length > 0 || previews.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {existing.map((url, i) => (
            <div key={`ex-${i}`} className={`relative ${sz} group`}>
              <img src={url} alt="" onClick={() => setLightbox(url)}
                className="w-full h-full object-cover rounded-xl border border-violet-200/50 cursor-pointer group-hover:scale-105 transition-transform"/>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={9}/>
                </button>
              )}
            </div>
          ))}
          {previews.map((url, i) => (
            <div key={`new-${i}`} className={`relative ${sz}`}>
              <img src={url} alt="" onClick={() => setLightbox(url)}
                className="w-full h-full object-cover rounded-xl border-2 border-violet-400/60 cursor-pointer"/>
              <button type="button" onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                <X size={9}/>
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-violet-500/70 text-white text-[8px] text-center py-0.5 rounded-b-xl">BARU</div>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all bg-white/40">
        <Camera size={13} className="text-violet-400 flex-shrink-0"/>
        <span className={`text-slate-500 ${small?'text-[11px]':'text-xs'}`}>
          {files.length > 0 ? `${files.length} foto baru — klik untuk tambah` : label}
        </span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => { onAdd(Array.from(e.target.files??[])); e.currentTarget.value='' }}/>
      </label>
      {files.length > 0 && (
        <button type="button" onClick={() => onRemove(-1)} className="text-[11px] text-red-400 hover:text-red-600 hover:underline">Hapus semua foto baru</button>
      )}
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLOR[status] ?? STATUS_COLOR['Cutting']
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

// ─── TimelineDots ─────────────────────────────────────────────────────────────
function TimelineDots({ events }: { events: any[] }) {
  const [popup, setPopup] = useState<{idx: number; event: any} | null>(null)
  const sorted = [...events].sort((a,b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  const dots = sorted.slice(-5)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopup(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <div ref={ref} className="flex items-center gap-1.5 relative">
      {dots.map((ev, i) => {
        const cfg = STATUS_COLOR[ev.status] ?? { dot: '#94A3B8' }
        const isOpen = popup?.idx === i
        return (
          <div key={i} className="relative">
            <button
              type="button"
              onClick={() => setPopup(isOpen ? null : { idx: i, event: ev })}
              onMouseEnter={() => setPopup({ idx: i, event: ev })}
              onMouseLeave={() => setPopup(null)}
              className="w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all hover:scale-150 active:scale-125"
              style={{ background: cfg.dot, boxShadow: `0 0 0 2px ${cfg.dot}30` }}
            />
            {isOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 animate-in fade-in-0 zoom-in-95"
                onMouseEnter={() => setPopup({ idx: i, event: ev })}
                onMouseLeave={() => setPopup(null)}>
                <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl p-3 text-left"
                  style={{ boxShadow: `0 8px 32px ${cfg.dot}25, 0 2px 8px rgba(0,0,0,0.1)` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }}/>
                    <span className="text-xs font-bold text-gray-800">{ev.status}</span>
                  </div>
                  <div className="space-y-0.5 text-[11px] text-gray-500">
                    <p>{formatDate(ev.tanggal)}</p>
                    <p className="font-medium text-gray-700">{ev.total_gram} gr</p>
                    {ev.losses > 0 && <p className="text-orange-500">Losses: {ev.losses} gr</p>}
                    {ev.sisa_serbuk > 0 && <p className="text-violet-500">Serbuk: {ev.sisa_serbuk} gr</p>}
                    {ev.catatan && <p className="italic text-[10px] truncate">{ev.catatan}</p>}
                    {(ev.fotos?.length > 0) && <p className="text-blue-500">{ev.fotos.length} foto proses</p>}
                  </div>
                  {/* Triangle */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 border-r border-b border-white/60 rotate-45"/>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {/* Remaining dots (gray) */}
      {Array.from({ length: Math.max(0, 5 - dots.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="w-3 h-3 rounded-full bg-gray-200 border-2 border-white shadow-sm"/>
      ))}
    </div>
  )
}

// ─── Form field component ─────────────────────────────────────────────────────
const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
)

const inputCls = "w-full px-4 py-3 text-sm bg-white/70 border border-gray-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-300 transition-all placeholder:text-gray-400 backdrop-blur-sm"
const today = new Date().toISOString().split('T')[0]

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({ batches, onClose, onSubmit, isPending, error }: {
  batches: any[]; onClose: () => void
  onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [form, setForm] = useState({
    batch_kode: batches[0]?.kode ?? '', gramasi: '1', pcs: '',
    berat_awal: '', status_awal: 'Cutting',
    tanggal_produksi: today, operator: '', memo: '', catatan: ''
  })
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formEl = e.currentTarget as HTMLFormElement
    setUploading(true)
    const fotosB64 = fotos.length > 0 ? await filesToBase64(fotos) : []
    setUploading(false)
    const fd = new FormData(formEl)
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 64px rgba(139,92,246,0.15), 0 8px 32px rgba(0,0,0,0.1)' }}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100/80">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Permintaan Cetak Baru</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><X size={15}/></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <Field label="Batch Bahan Baku" required>
            <select name="batch_kode" value={form.batch_kode} onChange={e => set('batch_kode', e.target.value)} className={inputCls} required>
              {batches.map(b => (
                <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} (Sisa: {(b.sisa_bahan_seharusnya ?? b.timbangan_akhir ?? 0).toFixed(2)} gr)</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gramasi Target" required>
              <select name="gramasi" value={form.gramasi} onChange={e => set('gramasi', e.target.value)} className={inputCls} required>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
              </select>
            </Field>
            <Field label="Jumlah PCS" required>
              <input name="pcs" type="number" min="1" value={form.pcs} onChange={e => set('pcs', e.target.value)} placeholder="50" className={inputCls} required/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Berat (gram)" required>
              <input name="berat_awal" type="number" step="0.01" value={form.berat_awal} onChange={e => set('berat_awal', e.target.value)} placeholder="50.15" className={inputCls} required/>
            </Field>
            <Field label="Status Awal" required>
              <select name="status_awal" value={form.status_awal} onChange={e => set('status_awal', e.target.value)} className={inputCls} required>
                {STATUS_FLOW.slice(0,4).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Produksi" required>
              <input name="tanggal_produksi" type="date" value={form.tanggal_produksi} onChange={e => set('tanggal_produksi', e.target.value)} className={inputCls} required/>
            </Field>
            <Field label="Operator / PIC">
              <input name="operator" value={form.operator} onChange={e => set('operator', e.target.value)} placeholder="Nama operator" className={inputCls}/>
            </Field>
          </div>
          <Field label="Memo Produksi">
            <input name="memo" value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="Keterangan mesin cetak, pengerjaan..." className={inputCls}/>
          </Field>
          <Field label="Foto Proses (opsional, max 10)">
            <FotoPicker files={fotos}
              onAdd={f => setFotos(p => [...p,...f].slice(0,10))}
              onRemove={i => i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))}
              label="Tambah foto proses awal produksi"/>
          </Field>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50/80 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
              {(isPending||uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading?'Kompres foto...':isPending?'Menyimpan...':'Mulai Alur ('+form.status_awal+')'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void
  onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [form, setForm] = useState({
    gramasi: item.gramasi ?? '',
    pcs: String(item.pcs ?? ''),
    berat_awal: String(item.berat_awal ?? item.total_gram ?? ''),
    operator: item.operator ?? '',
    catatan: item.catatan ?? '',
    memo: item.memo ?? '',
    tanggal_produksi: item.tanggal_produksi ?? item.tanggal ?? today,
  })
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k,v]) => fd.set(k, v))
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 64px rgba(139,92,246,0.15), 0 8px 32px rgba(0,0,0,0.1)' }}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit Produksi</h2>
              <p className="text-xs text-violet-500 font-medium mt-0.5">{item.kode}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><X size={15}/></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gramasi" required>
              <select value={form.gramasi} onChange={e => set('gramasi', e.target.value)} className={inputCls}>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
              </select>
            </Field>
            <Field label="PCS" required>
              <input type="number" min="1" value={form.pcs} onChange={e => set('pcs', e.target.value)} className={inputCls}/>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Berat (gr)" required>
              <input type="number" step="0.01" value={form.berat_awal} onChange={e => set('berat_awal', e.target.value)} className={inputCls}/>
            </Field>
            <Field label="Tanggal">
              <input type="date" value={form.tanggal_produksi} onChange={e => set('tanggal_produksi', e.target.value)} className={inputCls}/>
            </Field>
          </div>
          <Field label="Operator / PIC">
            <input value={form.operator} onChange={e => set('operator', e.target.value)} placeholder="Nama operator" className={inputCls}/>
          </Field>
          <Field label="Memo">
            <input value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="Keterangan..." className={inputCls}/>
          </Field>
          <Field label="Catatan">
            <input value={form.catatan} onChange={e => set('catatan', e.target.value)} placeholder="Catatan tambahan..." className={inputCls}/>
          </Field>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50/80 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
            <button type="submit" disabled={isPending}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
              {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Update Status Modal ──────────────────────────────────────────────────────
function UpdateStatusModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void
  onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const suggested = STATUS_NEXT[item.current_status] ?? 'Siap Packing'
  const [status, setStatus] = useState(suggested)
  const [fotos, setFotos] = useState<File[]>([])
  const [fotosSerbuk, setFotosSerbuk] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const isPasBerat = status === 'Pas Berat'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formEl = e.currentTarget as HTMLFormElement
    setUploading(true)
    const fotosB64 = fotos.length > 0 ? await filesToBase64(fotos) : []
    const fotosSerbukB64 = (isPasBerat && fotosSerbuk.length > 0) ? await filesToBase64(fotosSerbuk) : []
    setUploading(false)
    const fd = new FormData(formEl)
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    fd.set('fotos_serbuk_b64', JSON.stringify(fotosSerbukB64))
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 64px rgba(139,92,246,0.15), 0 8px 32px rgba(0,0,0,0.1)' }}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Update Status Produksi</h2>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#8B5CF6' }}>
                {item.kode} — {item.gramasi}gr × {item.pcs} PCS
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><X size={15}/></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <Field label="Status Baru" required>
            <select name="status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls} required>
              {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="Reject">Reject</option>
            </select>
          </Field>
          <Field label="Total Berat Sekarang (gram)" required>
            <input name="total_gram" type="number" step="0.001" className={inputCls}
              placeholder={`Berat sebelumnya: ${item.total_gram} gr`} required/>
          </Field>

          {isPasBerat && (
            <Field label="Sisa Serbuk (gram)">
              <input name="sisa_serbuk" type="number" step="0.001" className={inputCls} placeholder="0.000" defaultValue="0"/>
            </Field>
          )}

          <Field label="Tanggal" required>
            <input name="tanggal" type="date" defaultValue={today} className={inputCls} required/>
          </Field>

          {/* Foto Proses — untuk SEMUA status */}
          <Field label="Foto Proses (opsional, max 10)">
            <FotoPicker files={fotos}
              onAdd={f => setFotos(p => [...p,...f].slice(0,10))}
              onRemove={i => i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))}
              label="Foto proses di status ini" small/>
          </Field>

          {/* Foto Sisa Serbuk — HANYA untuk Pas Berat */}
          {isPasBerat && (
            <Field label="Foto Sisa Serbuk (opsional, max 10)">
              <FotoPicker files={fotosSerbuk}
                onAdd={f => setFotosSerbuk(p => [...p,...f].slice(0,10))}
                onRemove={i => i===-1?setFotosSerbuk([]):setFotosSerbuk(p=>p.filter((_,j)=>j!==i))}
                label="Foto sisa serbuk emas" small/>
            </Field>
          )}

          <Field label="Catatan">
            <input name="catatan" className={inputCls} placeholder="Keterangan tambahan..."/>
          </Field>

          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50/80 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
              {(isPending||uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading?'Kompres foto...':isPending?'Menyimpan...':'Simpan Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm, isPending }: {
  item: any; onClose: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl p-6"
        style={{ boxShadow: '0 32px 64px rgba(239,68,68,0.15)' }}>
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500"/>
        </div>
        <h2 className="text-lg font-bold text-gray-900 text-center">Hapus Item Produksi?</h2>
        <p className="text-sm text-gray-500 text-center mt-2 mb-6">
          <span className="font-semibold text-gray-700">{item.kode}</span> akan dihapus dari sistem.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">Batal</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Event History Row ────────────────────────────────────────────────────────
function EventHistory({ events }: { events: any[] }) {
  const sorted = [...events].sort((a,b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  const [lightbox, setLightbox] = useState<string|null>(null)
  return (
    <div className="space-y-2 pt-2">
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"/>
        </div>
      )}
      {sorted.map((ev, i) => {
        const cfg = STATUS_COLOR[ev.status] ?? { dot: '#94A3B8', bg: 'rgba(148,163,184,0.12)', text: '#64748B' }
        const fotos = Array.isArray(ev.fotos) ? ev.fotos : []
        const fotosSerbuk = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
        return (
          <div key={ev.id ?? i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cfg.dot }}/>
              {i < sorted.length-1 && <div className="w-0.5 flex-1 mt-1" style={{ background: `${cfg.dot}40` }}/>}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>{ev.status}</span>
                <span className="text-xs text-gray-400">{formatDate(ev.tanggal)}</span>
                <span className="text-xs font-semibold text-gray-700">{ev.total_gram} gr</span>
                {ev.losses > 0 && <span className="text-xs text-orange-500">losses {ev.losses} gr</span>}
                {ev.sisa_serbuk > 0 && <span className="text-xs text-violet-500">serbuk {ev.sisa_serbuk} gr</span>}
                {ev.user_name && <span className="text-xs text-gray-400">· {ev.user_name}</span>}
              </div>
              {ev.catatan && <p className="text-xs text-gray-400 mt-0.5 italic">{ev.catatan}</p>}
              {(fotos.length > 0 || fotosSerbuk.length > 0) && (
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {fotos.map((url: string, fi: number) => (
                    <div key={fi} className="relative group">
                      <img src={url} alt="" onClick={() => setLightbox(url)}
                        className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200/60 hover:scale-110 transition-transform"/>
                    </div>
                  ))}
                  {fotosSerbuk.map((url: string, fi: number) => (
                    <div key={`s-${fi}`} className="relative group">
                      <img src={url} alt="" onClick={() => setLightbox(url)}
                        className="w-10 h-10 rounded-lg object-cover cursor-pointer border-2 border-violet-300/60 hover:scale-110 transition-transform"/>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-400 rounded-full text-[7px] text-white flex items-center justify-center font-bold">S</div>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProduksiClient({ produksiList, batches, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Semua')
  const [expandedId, setExpandedId] = useState<number|null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any|null>(null)
  const [updateItem, setUpdateItem] = useState<any|null>(null)
  const [deleteItem, setDeleteItem] = useState<any|null>(null)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'}|null>(null)

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const canEdit = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete = ['owner','admin_pusat'].includes(userRole)

  // Filter
  const filtered = produksiList.filter(item => {
    if (filterStatus !== 'Semua' && item.current_status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q || item.kode?.toLowerCase().includes(q) || item.batch_kode?.toLowerCase().includes(q) || item.gramasi?.includes(q)
  })

  // Status counts
  const counts = produksiList.reduce((acc, item) => {
    acc[item.current_status] = (acc[item.current_status] ?? 0) + 1
    return acc
  }, {} as Record<string,number>)

  function handleCreate(fd: FormData) {
    setFormError('')
    startTransition(async () => {
      const r = await createProduksi(fd)
      if (r?.error) { setFormError(r.error); return }
      showToast(`✅ Produksi ${r?.kode} berhasil dibuat`)
      setShowCreate(false)
    })
  }

  function handleEdit(fd: FormData) {
    if (!editItem) return
    setFormError('')
    startTransition(async () => {
      const r = await editProduksi(editItem.id, editItem.kode, fd)
      if (r?.error) { setFormError(r.error); return }
      showToast('✅ Data produksi diperbarui')
      setEditItem(null)
    })
  }

  function handleUpdateStatus(fd: FormData) {
    if (!updateItem) return
    setFormError('')
    startTransition(async () => {
      const r = await updateStatusProduksi(updateItem.id, updateItem.kode, fd)
      if (r?.error) { setFormError(r.error); return }
      showToast('✅ Status diperbarui')
      setUpdateItem(null)
    })
  }

  function handleDelete() {
    if (!deleteItem) return
    startTransition(async () => {
      const r = await deleteProduksi(deleteItem.id, deleteItem.kode)
      if (r?.error) { showToast(r.error, 'error'); return }
      showToast('🗑️ Item produksi dihapus')
      setDeleteItem(null)
    })
  }

  const filterTabs = ['Semua', ...STATUS_FLOW, 'Reject']

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(160deg, #F5F5F7 0%, #EFEFF4 50%, #F5F5F7 100%)' }}>
      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',
          toast.type==='success' ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.type==='success' ? <Check size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Produksi</h1>
            <p className="text-sm text-gray-400 mt-0.5">{produksiList.length} item aktif</p>
          </div>
          {canEdit && (
            <button onClick={() => { setShowCreate(true); setFormError('') }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}>
              <Plus size={15}/> Cetak Baru
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode produksi, batch, gramasi..."
            className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300"/>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(s => {
            const isActive = filterStatus === s
            const cfg = s !== 'Semua' ? STATUS_COLOR[s] : null
            const count = s === 'Semua' ? produksiList.length : (counts[s] ?? 0)
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-white/70 text-gray-500 hover:bg-white border border-gray-200/60')}
                style={isActive ? { background: cfg?.dot ?? 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: `0 4px 12px ${cfg?.dot ?? '#8B5CF6'}40` } : {}}>
                <span>{s}</span>
                {count > 0 && <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', isActive ? 'bg-white/25' : 'bg-gray-100')}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(139,92,246,0.08), 0 2px 12px rgba(0,0,0,0.04)' }}>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3.5 bg-gray-50/60 border-b border-gray-100/80 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Item</span>
            <span className="hidden sm:block">Gramasi × PCS</span>
            <span className="hidden md:block">Status</span>
            <span className="hidden lg:block">Timeline</span>
            <span className="hidden sm:block">Tgl Update</span>
            <span>Aksi</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-violet-300"/>
              </div>
              <p className="text-sm text-gray-400 font-medium">Tidak ada item produksi</p>
              <p className="text-xs text-gray-300 mt-1">Mulai dengan klik "Cetak Baru"</p>
            </div>
          ) : filtered.map((item, idx) => {
            const events = Array.isArray(item.produksi_event) ? item.produksi_event : []
            const lastEvent = events.length > 0 ? events.sort((a: any,b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0] : null
            const isExpanded = expandedId === item.id
            const cfg = STATUS_COLOR[item.current_status] ?? STATUS_COLOR['Cutting']

            return (
              <div key={item.id}>
                <div className={cn('grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-4 items-center transition-colors cursor-default',
                  idx > 0 ? 'border-t border-gray-100/60' : '',
                  isExpanded ? 'bg-violet-50/30' : 'hover:bg-gray-50/50')}>
                  {/* Item info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{item.kode}</span>
                      <span className="md:hidden"><StatusBadge status={item.current_status}/></span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.batch_kode} · {item.operator || 'No operator'}</p>
                  </div>

                  {/* Gramasi × PCS */}
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-bold text-gray-700">{item.gramasi}gr × {item.pcs}</span>
                    <span className="text-xs text-gray-400">{item.total_gram} gr</span>
                  </div>

                  {/* Status */}
                  <div className="hidden md:block">
                    <StatusBadge status={item.current_status}/>
                  </div>

                  {/* Timeline */}
                  <div className="hidden lg:block">
                    <TimelineDots events={events}/>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block text-right">
                    <span className="text-xs text-gray-400">{lastEvent ? formatDate(lastEvent.tanggal) : formatDate(item.tanggal_produksi)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {canEdit && item.current_status !== 'Sudah Packing' && (
                      <button onClick={() => { setUpdateItem(item); setFormError('') }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}
                        title="Update Status">
                        <Plus size={14}/>
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => { setEditItem(item); setFormError('') }}
                        className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center transition-all hover:scale-110 hover:bg-blue-100"
                        title="Edit">
                        <Edit2 size={13}/>
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleteItem(item)}
                        className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center transition-all hover:scale-110 hover:bg-red-100"
                        title="Hapus">
                        <Trash2 size={13}/>
                      </button>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center transition-all hover:scale-110 hover:bg-gray-200">
                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>

                {/* Expanded: Event History */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-violet-100/60 bg-violet-50/20">
                    <div className="pt-3">
                      {/* Mobile info */}
                      <div className="flex items-center gap-3 mb-3 lg:hidden">
                        <TimelineDots events={events}/>
                        <StatusBadge status={item.current_status}/>
                        <span className="text-xs text-gray-400">{item.gramasi}gr × {item.pcs} pcs</span>
                      </div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Riwayat Proses</p>
                      {events.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Belum ada event</p>
                      ) : (
                        <EventHistory events={events}/>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {showCreate && batches.length > 0 && (
        <CreateModal batches={batches} onClose={() => setShowCreate(false)}
          onSubmit={handleCreate} isPending={isPending} error={formError}/>
      )}
      {showCreate && batches.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-sm w-full">
            <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3"/>
            <p className="text-center text-sm text-gray-700 font-medium">Tidak ada batch aktif. Registrasi batch bahan baku terlebih dahulu.</p>
            <button onClick={() => setShowCreate(false)} className="w-full mt-4 py-2.5 bg-gray-100 rounded-2xl text-sm font-semibold">Tutup</button>
          </div>
        </div>
      )}
      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)}
          onSubmit={handleEdit} isPending={isPending} error={formError}/>
      )}
      {updateItem && (
        <UpdateStatusModal item={updateItem} onClose={() => setUpdateItem(null)}
          onSubmit={handleUpdateStatus} isPending={isPending} error={formError}/>
      )}
      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)}
          onConfirm={handleDelete} isPending={isPending}/>
      )}
    </div>
  )
}
