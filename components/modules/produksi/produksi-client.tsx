'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Plus, Search, X, Check, AlertTriangle, Edit2, Trash2, ImageIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { cn, formatDate, formatGram } from '@/lib/utils'
import { createProduksi, updateStatusProduksi, deleteProduksi, editProduksi } from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  produksiList: any[]
  batches: any[]
  userRole: UserRole
  userName: string
}

// ─── Status Config ─────────────────────────────────────────────────────────
const SC: Record<string, { label: string; dot: string; ring: string; bg: string; text: string }> = {
  'Cutting':       { label: 'Cutting',       dot: '#3B82F6', ring: 'ring-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'Pas Berat':     { label: 'Pas Berat',      dot: '#F97316', ring: 'ring-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700'  },
  'Annealing':     { label: 'Annealing',      dot: '#EAB308', ring: 'ring-yellow-400',  bg: 'bg-yellow-50',  text: 'text-yellow-700'  },
  'QC':            { label: 'QC',             dot: '#8B5CF6', ring: 'ring-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700'  },
  'Siap Packing':  { label: 'Siap Packing',   dot: '#10B981', ring: 'ring-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Sudah Packing': { label: 'Sudah Packing',  dot: '#059669', ring: 'ring-green-500',   bg: 'bg-green-50',   text: 'text-green-800'   },
  'Reject':        { label: 'Reject',         dot: '#EF4444', ring: 'ring-red-400',     bg: 'bg-red-50',     text: 'text-red-700'     },
}

const STATUS_OPTIONS = ['Cutting', 'Pas Berat', 'Annealing', 'QC', 'Siap Packing']
const GRAMASI_OPTIONS = ['0.1', '0.5', '1', '2', '5', '10', '20', '25', '50', '100', '250', '500', '1000']

// ─── Image compress to base64 ─────────────────────────────────────────────
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

// ─── FotoPicker ───────────────────────────────────────────────────────────
function FotoPicker({ files, existing = [], onAdd, onRemove, onRemoveExisting, label = 'Tambah foto' }: {
  files: File[]; existing?: string[]; onAdd: (f: File[]) => void
  onRemove: (i: number) => void; onRemoveExisting?: (i: number) => void; label?: string
}) {
  const [previews, setPreviews] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string|null>(null)
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [files])
  return (
    <div className="space-y-2">
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"/>
          <button className="absolute top-4 right-4 w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"><X size={16}/></button>
        </div>
      )}
      {(existing.length > 0 || previews.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {existing.map((url, i) => (
            <div key={`e${i}`} className="relative w-16 h-16">
              <img src={url} onClick={() => setLightbox(url)} className="w-full h-full object-cover rounded-xl border border-white/50 shadow cursor-pointer hover:opacity-80 transition"/>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"><X size={9}/></button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-0.5 rounded-b-xl">Tersimpan</div>
            </div>
          ))}
          {previews.map((url, i) => (
            <div key={`n${i}`} className="relative w-16 h-16">
              <img src={url} onClick={() => setLightbox(url)} className="w-full h-full object-cover rounded-xl border-2 border-violet-400 shadow cursor-pointer hover:opacity-80 transition"/>
              <button type="button" onClick={() => onRemove(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"><X size={9}/></button>
              <div className="absolute bottom-0 left-0 right-0 bg-violet-600/70 text-white text-[8px] text-center py-0.5 rounded-b-xl">Baru</div>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3 py-2.5 bg-white/60 backdrop-blur border border-white/60 rounded-xl cursor-pointer hover:bg-violet-50/60 hover:border-violet-300 transition-all group">
        <ImageIcon size={14} className="text-slate-400 group-hover:text-violet-500 transition flex-shrink-0"/>
        <span className="text-xs text-slate-500 group-hover:text-violet-600 transition">
          {files.length > 0 ? `${files.length} foto baru — klik tambah lagi` : label}
        </span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(Array.from(e.target.files??[])); e.currentTarget.value='' }}/>
      </label>
      {files.length > 0 && <button type="button" onClick={() => onRemove(-1)} className="text-[11px] text-red-400 hover:text-red-600 hover:underline transition">Hapus semua foto baru</button>}
    </div>
  )
}

// ─── Timeline Dot with Popup ───────────────────────────────────────────────
function TimelineDot({ event }: { event: any }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cfg = SC[event.status] ?? SC['Cutting']
  const fotos = Array.isArray(event.fotos) ? event.fotos : []
  const fotosSerbuk = Array.isArray(event.fotos_sisa_serbuk) ? event.fotos_sisa_serbuk : []

  // Close on outside click
  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-200 hover:scale-125 active:scale-110"
        style={{ backgroundColor: cfg.dot }}
      />
      {show && (
        <div
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/80 p-3 pointer-events-auto"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }}/>
            <span className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{event.tanggal ? formatDate(event.tanggal) : '—'}</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between"><span className="text-slate-400">Berat</span><span className="font-semibold">{event.total_gram ? `${event.total_gram} gr` : '—'}</span></div>
            {event.sisa_serbuk > 0 && <div className="flex justify-between"><span className="text-slate-400">Sisa Serbuk</span><span className="font-semibold text-amber-600">{event.sisa_serbuk} gr</span></div>}
            {event.losses > 0 && <div className="flex justify-between"><span className="text-slate-400">Losses</span><span className="font-semibold text-red-500">{event.losses?.toFixed(3)} gr</span></div>}
            {event.user_name && <div className="flex justify-between"><span className="text-slate-400">Operator</span><span className="font-medium">{event.user_name}</span></div>}
            {event.catatan && <div className="mt-1 text-slate-500 italic text-[10px] leading-tight">{event.catatan}</div>}
          </div>
          {fotos.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {fotos.slice(0,3).map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 block hover:opacity-80 transition">
                  <img src={url} className="w-full h-full object-cover"/>
                </a>
              ))}
              {fotos.length > 3 && <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-semibold">+{fotos.length-3}</div>}
            </div>
          )}
          {fotosSerbuk.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[10px] text-slate-400 mb-1">Sisa Serbuk</p>
              <div className="flex gap-1">
                {fotosSerbuk.slice(0,2).map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg overflow-hidden border border-amber-100 block">
                    <img src={url} className="w-full h-full object-cover"/>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 border-r border-b border-white/80 rotate-45 shadow-sm"/>
        </div>
      )}
    </div>
  )
}

function Timeline({ events }: { events: any[] }) {
  if (!events || events.length === 0) return <span className="text-[11px] text-slate-300">Belum ada proses</span>
  const sorted = [...events].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  return (
    <div className="flex items-center gap-1">
      {sorted.map((ev, i) => (
        <div key={ev.id ?? i} className="flex items-center gap-1">
          {i > 0 && <div className="w-3 h-px bg-slate-200"/>}
          <TimelineDot event={ev}/>
        </div>
      ))}
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white/80 backdrop-blur border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-300 placeholder:text-slate-300 transition-all'
const labelCls = 'text-xs font-semibold text-slate-500 tracking-wide uppercase'
const selCls = 'w-full px-3.5 py-2.5 text-sm bg-white/80 backdrop-blur border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 appearance-none transition-all'

// ─── Main Component ────────────────────────────────────────────────────────
export default function ProduksiClient({ produksiList, batches, userRole, userName }: Props) {
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [showForm, setShowForm]         = useState(false)
  const [expandedId, setExpandedId]     = useState<number|null>(null)
  const [activeModal, setActiveModal]   = useState<{type:string;item:any}|null>(null)
  const [toast, setToast]               = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [formError, setFormError]       = useState('')
  const [isPending, startTransition]    = useTransition()

  // Create form
  const [formFotos, setFormFotos]       = useState<File[]>([])
  const [fotosUploading, setFotosUploading] = useState(false)
  const [form, setForm] = useState({
    batch_kode:'', gramasi:'', pcs:'', berat_awal:'',
    status_awal:'Cutting', tanggal_produksi: new Date().toISOString().split('T')[0],
    sisa_serbuk:'', memo:'', operator:'', catatan:''
  })

  // Update status modal
  const [modalFotos, setModalFotos]             = useState<File[]>([])
  const [modalFotosSerbuk, setModalFotosSerbuk] = useState<File[]>([])

  const activeBatches = batches.filter((b: any) => !b.voided_at)
  const canCreate = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canEdit   = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete = ['owner','admin_pusat'].includes(userRole)

  const filtered = produksiList.filter(p => {
    if (filterStatus !== 'semua' && p.current_status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.kode??'').toLowerCase().includes(q) || (p.batch_kode??'').toLowerCase().includes(q) || (p.gramasi??'').toLowerCase().includes(q)
    }
    return true
  })

  const statusCounts = produksiList.reduce((acc: any, p: any) => {
    acc[p.current_status] = (acc[p.current_status]||0)+1; return acc
  }, {})

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  function closeModal() {
    setActiveModal(null); setFormError('')
    setModalFotos([]); setModalFotosSerbuk([])
  }

  // ─── Create ───────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFotosUploading(true)
    const fotosB64 = formFotos.length > 0 ? await filesToBase64(formFotos) : []
    setFotosUploading(false)
    const fd = new FormData()
    Object.entries(form).forEach(([k,v]) => fd.set(k, v))
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    setFormError('')
    startTransition(async () => {
      const r = await createProduksi(fd)
      if (r.error) { setFormError(r.error); return }
      showToast(`✅ Produksi ${r.kode} berhasil dibuat`)
      setShowForm(false)
      setFormFotos([])
      setForm({ batch_kode:'',gramasi:'',pcs:'',berat_awal:'',status_awal:'Cutting',tanggal_produksi:new Date().toISOString().split('T')[0],sisa_serbuk:'',memo:'',operator:'',catatan:'' })
    })
  }

  // ─── Update Status ────────────────────────────────────────────────────────
  const handleUpdateStatus = async (fd: FormData) => {
    if (!activeModal) return
    setFormError('')
    setFotosUploading(true)
    const fotosB64 = modalFotos.length > 0 ? await filesToBase64(modalFotos) : []
    const fotosSerbukB64 = modalFotosSerbuk.length > 0 ? await filesToBase64(modalFotosSerbuk) : []
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    fd.set('fotos_serbuk_b64', JSON.stringify(fotosSerbukB64))
    setFotosUploading(false)
    startTransition(async () => {
      const r = await updateStatusProduksi(activeModal.item.id, activeModal.item.kode, fd)
      if (r.error) { setFormError(r.error); return }
      showToast('✅ Status berhasil diperbarui')
      closeModal()
    })
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = (fd: FormData) => {
    if (!activeModal) return
    setFormError('')
    startTransition(async () => {
      const r = await editProduksi(activeModal.item.id, activeModal.item.kode, fd)
      if (r.error) { setFormError(r.error); return }
      showToast('✅ Data produksi diperbarui')
      closeModal()
    })
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = (item: any) => {
    startTransition(async () => {
      const r = await deleteProduksi(item.id, item.kode)
      if (r.error) { showToast(r.error, 'error'); return }
      showToast('🗑️ Item produksi dihapus')
      closeModal()
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F7] via-white to-[#EFEFF4] pb-20">
      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl border border-white/20 transition-all',
          toast.type==='success'?'bg-emerald-500/90':'bg-red-500/90')}>
          {toast.type==='success'?<Check size={16}/>:<AlertTriangle size={16}/>}{toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-2 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Produksi</h1>
            <p className="text-sm text-slate-400 mt-0.5">{produksiList.length} item aktif</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-semibold rounded-2xl shadow-[0_4px_16px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_24px_rgba(139,92,246,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
              <Plus size={16}/> Cetak Baru
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 flex-wrap">
          {(['semua', ...Object.keys(SC)] as string[]).map(st => {
            const cfg = SC[st]
            const count = st === 'semua' ? produksiList.length : (statusCounts[st]||0)
            return (
              <button key={st} onClick={() => setFilterStatus(st)}
                className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5',
                  filterStatus===st
                    ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]'
                    : 'bg-white/70 backdrop-blur border border-white/60 text-slate-600 hover:border-violet-200 hover:text-violet-600')}>
                {cfg && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: cfg.dot}}/>}
                {st === 'semua' ? 'Semua' : cfg?.label}
                <span className={cn('text-[10px]', filterStatus===st?'text-white/80':'text-slate-400')}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari kode, batch, gramasi..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/70 backdrop-blur border border-white/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 shadow-sm text-slate-700 placeholder:text-slate-300 transition-all"/>
        </div>

        {/* Create Form */}
        {showForm && canCreate && (
          <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Permintaan Cetak Baru</h2>
              <button onClick={() => { setShowForm(false); setFormFotos([]) }} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition"><X size={14} className="text-slate-500"/></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Batch Bahan Baku *</label>
                <select value={form.batch_kode} onChange={e => setForm(f=>({...f,batch_kode:e.target.value}))} required className={selCls}>
                  <option value="">Pilih batch...</option>
                  {activeBatches.map((b:any) => (
                    <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch||b.kode} (Sisa: {(b.sisa_bahan_seharusnya??b.timbangan_akhir??0).toFixed(2)} gr)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Gramasi Target *</label>
                  <select value={form.gramasi} onChange={e=>setForm(f=>({...f,gramasi:e.target.value}))} required className={selCls}>
                    <option value="">Pilih gramasi</option>
                    {GRAMASI_OPTIONS.map(g=><option key={g} value={g}>{g} Gram</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Jumlah PCS *</label>
                  <input type="number" value={form.pcs} onChange={e=>setForm(f=>({...f,pcs:e.target.value}))} required placeholder="50" className={inputCls}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Total Berat (gram) *</label>
                  <input type="number" step="0.01" value={form.berat_awal} onChange={e=>setForm(f=>({...f,berat_awal:e.target.value}))} required placeholder="50.15" className={inputCls}/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Status Awal *</label>
                  <select value={form.status_awal} onChange={e=>setForm(f=>({...f,status_awal:e.target.value}))} className={selCls}>
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Tanggal *</label>
                  <input type="date" value={form.tanggal_produksi} onChange={e=>setForm(f=>({...f,tanggal_produksi:e.target.value}))} required className={inputCls}/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Operator</label>
                  <input value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} placeholder={userName} className={inputCls}/>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Memo Produksi</label>
                <input value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="Keterangan mesin cetak, pengerjaan..." className={inputCls}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Foto Proses (opsional, max 10)</label>
                <FotoPicker files={formFotos} onAdd={f=>setFormFotos(p=>[...p,...f].slice(0,10))} onRemove={i=>i===-1?setFormFotos([]):setFormFotos(p=>p.filter((_,j)=>j!==i))} label="Tambah foto proses awal"/>
              </div>
              {formError && <div className="flex items-center gap-2 p-3 bg-red-50/80 border border-red-100 rounded-xl text-sm text-red-600"><AlertTriangle size={14}/>{formError}</div>}
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={()=>{setShowForm(false);setFormFotos([])}} className="px-5 py-2.5 text-sm font-semibold bg-white/70 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Batal</button>
                <button type="submit" disabled={isPending||fotosUploading} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)] disabled:opacity-60 flex items-center gap-2 transition-all">
                  {(isPending||fotosUploading)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                  {fotosUploading?'Mengompres...' : isPending?'Menyimpan...' : `Mulai Alur (${form.status_awal})`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-300">
              <div className="text-5xl mb-3">📦</div>
              <p className="text-sm font-medium text-slate-400">Tidak ada item produksi</p>
            </div>
          ) : filtered.map(item => {
            const cfg = SC[item.current_status]
            const events = Array.isArray(item.produksi_event) ? item.produksi_event : []
            const isExpanded = expandedId === item.id
            return (
              <div key={item.id} className="bg-white/75 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden">
                {/* Main Row */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" style={{backgroundColor: cfg?.dot ?? '#94A3B8'}}/>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 font-mono">{item.kode}</span>
                      {cfg && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>}
                      <span className="text-xs text-slate-400">{item.gramasi}gr × {item.pcs} PCS</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-400">{item.batch_kode}</span>
                      {item.total_gram && <span className="text-[11px] font-semibold text-violet-600">{item.total_gram} gr</span>}
                      {item.operator && <span className="text-[11px] text-slate-400">👤 {item.operator}</span>}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="hidden sm:flex items-center">
                    <Timeline events={events}/>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* + Update Status */}
                    {canEdit && !['Sudah Packing'].includes(item.current_status) && (
                      <button onClick={() => { setActiveModal({type:'update_status',item}); setFormError('') }}
                        className="w-8 h-8 bg-violet-50 hover:bg-violet-100 border border-violet-100 text-violet-600 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        title="Update Status">
                        <Plus size={14}/>
                      </button>
                    )}
                    {/* Edit */}
                    {canEdit && (
                      <button onClick={() => { setActiveModal({type:'edit',item}); setFormError('') }}
                        className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        title="Edit">
                        <Edit2 size={13}/>
                      </button>
                    )}
                    {/* Delete */}
                    {canDelete && (
                      <button onClick={() => setActiveModal({type:'delete',item})}
                        className="w-8 h-8 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        title="Hapus">
                        <Trash2 size={13}/>
                      </button>
                    )}
                    {/* Expand */}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center transition-all">
                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>

                {/* Mobile timeline */}
                <div className="sm:hidden px-4 pb-3 flex items-center gap-2">
                  <Timeline events={events}/>
                </div>

                {/* Expanded: event history */}
                {isExpanded && (
                  <div className="border-t border-slate-100/80 px-4 py-4 space-y-2 bg-slate-50/40">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Riwayat Proses</p>
                    {events.length === 0 ? (
                      <p className="text-xs text-slate-300 text-center py-4">Belum ada riwayat proses</p>
                    ) : [...events].sort((a,b)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime()).map((ev, i) => {
                      const ecfg = SC[ev.status]
                      const evFotos = Array.isArray(ev.fotos) ? ev.fotos : []
                      const evSerbuk = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
                      return (
                        <div key={ev.id??i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full border-2 border-white shadow mt-0.5 flex-shrink-0" style={{backgroundColor: ecfg?.dot ?? '#94A3B8'}}/>
                            {i < events.length-1 && <div className="w-px flex-1 bg-slate-200 mt-1"/>}
                          </div>
                          <div className="pb-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-xs font-bold', ecfg?.text)}>{ecfg?.label ?? ev.status}</span>
                              <span className="text-[11px] text-slate-400">{ev.tanggal ? formatDate(ev.tanggal) : '—'}</span>
                              {ev.user_name && <span className="text-[11px] text-slate-400">· {ev.user_name}</span>}
                            </div>
                            <div className="flex gap-4 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                              {ev.total_gram && <span>Berat: <b>{ev.total_gram} gr</b></span>}
                              {ev.sisa_serbuk > 0 && <span className="text-amber-600">Serbuk: <b>{ev.sisa_serbuk} gr</b></span>}
                              {ev.losses > 0 && <span className="text-red-500">Loses: <b>{ev.losses?.toFixed(3)} gr</b></span>}
                            </div>
                            {ev.catatan && <p className="text-[11px] text-slate-400 italic mt-0.5">{ev.catatan}</p>}
                            {evFotos.length > 0 && (
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {evFotos.map((url: string, j: number) => (
                                  <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 block hover:opacity-80 transition">
                                    <img src={url} className="w-full h-full object-cover"/>
                                  </a>
                                ))}
                              </div>
                            )}
                            {evSerbuk.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[10px] text-slate-400 mb-1">Foto Sisa Serbuk</p>
                                <div className="flex gap-1.5 flex-wrap">
                                  {evSerbuk.map((url: string, j: number) => (
                                    <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-xl overflow-hidden border border-amber-100 block hover:opacity-80 transition">
                                      <img src={url} className="w-full h-full object-cover"/>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Update Status Modal ──────────────────────────────────────────────── */}
      {activeModal?.type === 'update_status' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.15)] max-w-lg w-full p-6 border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Update Status Produksi</h3>
                <p className="text-xs text-violet-500 font-semibold mt-0.5">{activeModal.item.kode} — {activeModal.item.gramasi}gr × {activeModal.item.pcs} PCS</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition"><X size={14} className="text-slate-500"/></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault()
              const fd = new FormData(e.target as HTMLFormElement)
              await handleUpdateStatus(fd)
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Status Baru *</label>
                  <select name="status" required className={selCls} onChange={() => {}}>
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Total Berat Sekarang (gram) *</label>
                  <input name="total_gram" type="number" step="0.001" required className={inputCls} placeholder={`Ref: ${activeModal.item.total_gram} gr`}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Tanggal *</label>
                  <input name="tanggal" type="date" required className={inputCls} defaultValue={new Date().toISOString().split('T')[0]}/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Catatan</label>
                  <input name="catatan" className={inputCls} placeholder="Keterangan tambahan..."/>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Sisa Serbuk (gram) — Isi jika Pas Berat</label>
                <input name="sisa_serbuk" type="number" step="0.001" className={inputCls} placeholder="0.000" defaultValue="0"/>
              </div>
              {/* Foto Proses — semua status */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Foto Proses (opsional, max 10)</label>
                <FotoPicker files={modalFotos} onAdd={f=>setModalFotos(p=>[...p,...f].slice(0,10))} onRemove={i=>i===-1?setModalFotos([]):setModalFotos(p=>p.filter((_,j)=>j!==i))} label="Foto proses di status ini"/>
              </div>
              {/* Foto Sisa Serbuk — hanya tampil kalau status Pas Berat dipilih */}
              <StatusFotoSerbukField modalFotosSerbuk={modalFotosSerbuk} setModalFotosSerbuk={setModalFotosSerbuk}/>
              {formError && <div className="flex items-center gap-2 p-3 bg-red-50/80 border border-red-100 rounded-xl text-sm text-red-600"><AlertTriangle size={14}/>{formError}</div>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold bg-white/70 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Batal</button>
                <button type="submit" disabled={isPending||fotosUploading} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)] disabled:opacity-60 flex items-center gap-2 transition-all">
                  {(isPending||fotosUploading)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                  {fotosUploading?'Mengompres...' : isPending?'Menyimpan...' : 'Simpan Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ───────────────────────────────────────────────────────── */}
      {activeModal?.type === 'edit' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.15)] max-w-lg w-full p-6 border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Edit Data Produksi</h3>
              <button onClick={closeModal} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition"><X size={14} className="text-slate-500"/></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleEdit(new FormData(e.target as HTMLFormElement)) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Gramasi *</label>
                  <select name="gramasi" required defaultValue={activeModal.item.gramasi} className={selCls}>
                    {GRAMASI_OPTIONS.map(g=><option key={g} value={g}>{g} Gram</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>PCS *</label>
                  <input name="pcs" type="number" required defaultValue={activeModal.item.pcs} className={inputCls}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Total Berat (gram) *</label>
                  <input name="berat_awal" type="number" step="0.01" required defaultValue={activeModal.item.berat_awal} className={inputCls}/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Tanggal *</label>
                  <input name="tanggal_produksi" type="date" required defaultValue={activeModal.item.tanggal_produksi ?? activeModal.item.tanggal} className={inputCls}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Operator</label>
                  <input name="operator" defaultValue={activeModal.item.operator??''} placeholder={userName} className={inputCls}/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Memo</label>
                  <input name="memo" defaultValue={activeModal.item.memo??''} placeholder="Keterangan..." className={inputCls}/>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Catatan</label>
                <input name="catatan" defaultValue={activeModal.item.catatan??''} placeholder="Catatan tambahan..." className={inputCls}/>
              </div>
              {formError && <div className="flex items-center gap-2 p-3 bg-red-50/80 border border-red-100 rounded-xl text-sm text-red-600"><AlertTriangle size={14}/>{formError}</div>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold bg-white/70 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Batal</button>
                <button type="submit" disabled={isPending} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)] disabled:opacity-60 flex items-center gap-2 transition-all">
                  {isPending&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                  {isPending?'Menyimpan...':'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ─────────────────────────────────────────────────────── */}
      {activeModal?.type === 'delete' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.15)] max-w-sm w-full p-6 border border-white/80">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center"><Trash2 size={18} className="text-red-500"/></div>
              <div>
                <h3 className="font-bold text-slate-800">Hapus Item Produksi?</h3>
                <p className="text-xs text-slate-400">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">Hapus <span className="font-bold text-red-500">{activeModal.item.kode}</span>? Berat {formatGram(activeModal.item.berat_awal)} akan dikembalikan ke batch {activeModal.item.batch_kode}.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold bg-white/70 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Batal</button>
              <button onClick={() => handleDelete(activeModal.item)} disabled={isPending} className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 transition">
                {isPending?'Menghapus...':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper: Foto Sisa Serbuk only shows when Pas Berat selected ──────────
function StatusFotoSerbukField({ modalFotosSerbuk, setModalFotosSerbuk }: {
  modalFotosSerbuk: File[]; setModalFotosSerbuk: React.Dispatch<React.SetStateAction<File[]>>
}) {
  const [selectedStatus, setSelectedStatus] = useState('Cutting')
  // Watch the status select in the parent form
  useEffect(() => {
    const sel = document.querySelector('select[name="status"]') as HTMLSelectElement
    if (!sel) return
    const handler = () => setSelectedStatus(sel.value)
    sel.addEventListener('change', handler)
    setSelectedStatus(sel.value || 'Cutting')
    return () => sel.removeEventListener('change', handler)
  }, [])
  if (selectedStatus !== 'Pas Berat') return null
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Foto Sisa Serbuk (opsional)</label>
      <FotoPicker files={modalFotosSerbuk} onAdd={f=>setModalFotosSerbuk(p=>[...p,...f].slice(0,10))} onRemove={i=>i===-1?setModalFotosSerbuk([]):setModalFotosSerbuk(p=>p.filter((_,j)=>j!==i))} label="Foto sisa serbuk emas"/>
    </div>
  )
}
