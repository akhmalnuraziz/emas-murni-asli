'use client'

import { useState, useEffect, useTransition, useEffect } from 'react'
import {
  Plus, Search, ChevronDown, ChevronUp, Edit2, Trash2,
  Check, AlertTriangle, X, Package, Flame, Clock,
  CheckCircle, AlertCircle, ArrowRight, Printer
, ImageIcon } from 'lucide-react'
import { cn, formatDate, formatGram, formatRupiah } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi, inputReject,
  leburReject, deleteProduksi, createPacking, voidPacking
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'


// ─── Base64 compress ──────────────────────────────────────────────────────────
async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 10)) {
    const b64 = await new Promise<string>((resolve) => {
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

// ─── Foto Picker ──────────────────────────────────────────────────────────────
function FotoPicker({ files, onAdd, onRemove, label = 'Tambah foto', small = false }: {
  files: File[]; onAdd: (f: File[]) => void
  onRemove: (i: number) => void; label?: string; small?: boolean
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl"/>
        </div>
      )}
      {previews.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previews.map((url, i) => (
            <div key={i} className={`relative ${sz}`}>
              <img src={url} alt="" onClick={() => setLightbox(url)}
                className="w-full h-full object-cover rounded-xl border-2 border-violet-300 cursor-pointer"/>
              <button type="button" onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={10}/>
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50">
        <ImageIcon size={13} className="text-slate-400 flex-shrink-0"/>
        <span className={`text-slate-500 ${small?'text-[11px]':'text-xs'}`}>
          {files.length > 0 ? `${files.length} foto — klik untuk tambah` : label}
        </span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => { onAdd(Array.from(e.target.files??[])); e.currentTarget.value='' }}/>
      </label>
      {files.length > 0 && (
        <button type="button" onClick={() => onRemove(-1)}
          className="text-[11px] text-red-400 hover:underline">Hapus semua foto</button>
      )}
    </div>
  )
}

const GRAMASI_OPTIONS = ['0.1', '0.5', '1', '2', '5', '10', '20', '25', '50', '100', '250', '500', '1000']
const STATUS_OPTIONS = ['Cutting', 'Pas Berat', 'Annealing', 'Siap Packing']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  'Cutting':        { label: 'Cutting',        color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Package },
  'Pas Berat':      { label: 'Pas Berat',       color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Clock },
  'Annealing':      { label: 'Annealing',       color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: Flame },
  'Siap Packing':   { label: 'Siap Packing',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle },
  'Packing Sebagian': { label: 'Packing Sebagian', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: Package },
  'Sudah Packing':  { label: 'Sudah Packing',   color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200',  icon: Check },
  'Reject':         { label: 'Reject',          color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Cutting']
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider', cfg.color, cfg.bg, cfg.border)}>
      {status}
    </span>
  )
}

interface Props {
  produksiList: any[]
  batches: any[]
  userRole: UserRole
  userName: string
}

export default function ProduksiClient({ produksiList, batches, userRole, userName }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [activeModal, setActiveModal] = useState<{ type: string; item: any } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')

  // Form state
  const [formFotos, setFormFotos] = useState<File[]>([])
  const [modalFotos, setModalFotos] = useState<File[]>([])
  const [modalFotosSerbuk, setModalFotosSerbuk] = useState<File[]>([])
  const [fotosUploading, setFotosUploading] = useState(false)
  const [form, setForm] = useState({
    batch_kode: '', gramasi: '', pcs: '', berat_awal: '',
    status_awal: 'Cutting', tanggal_produksi: new Date().toISOString().split('T')[0],
    sisa_serbuk: '', memo: '', operator: '', catatan: ''
  })
  const [formFotos, setFormFotos] = useState<File[]>([])
  const [modalFotos, setModalFotos] = useState<File[]>([])
  const [modalFotosSerbuk, setModalFotosSerbuk] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const canCreate = ['owner', 'admin_pusat', 'spv', 'operator_produksi'].includes(userRole)
  const canDelete = ['owner', 'admin_pusat'].includes(userRole)
  const canLeburReject = ['owner', 'admin_pusat', 'spv'].includes(userRole)

  const activeBatches = batches.filter(b => !b.voided_at)

  const filtered = produksiList.filter(p => {
    if (filterStatus !== 'semua' && p.current_status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.kode ?? '').toLowerCase().includes(q) ||
        (p.batch_kode ?? '').toLowerCase().includes(q) ||
        (p.gramasi ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setUploading(false)
    setFotosUploading(true)
    const fotosB64 = formFotos.length > 0 ? await filesToBase64(formFotos) : []
    setFotosUploading(false)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    const fotosB64 = formFotos.length > 0 ? await filesToBase64(formFotos) : []
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    startTransition(async () => {
      const r = await createProduksi(fd)
      if (r.error) setFormError(r.error)
      else {
        setShowForm(false)
        setForm({ batch_kode: '', gramasi: '', pcs: '', berat_awal: '', status_awal: 'Cutting', tanggal_produksi: new Date().toISOString().split('T')[0], sisa_serbuk: '', memo: '', operator: '', catatan: '' })
        showToast(`Produksi ${r.kode} berhasil dibuat ✓`, 'success')
      }
    })
  }

  const handleUpdateStatus = async (fd: FormData) => {
    if (!activeModal) return
    setFormError('')
    // Upload fotos before sending to server
    const fotosB64 = modalFotos.length > 0 ? await filesToBase64(modalFotos) : []
    const fotosSerbukB64 = modalFotosSerbuk.length > 0 ? await filesToBase64(modalFotosSerbuk) : []
    fd.set('fotos_b64', JSON.stringify(fotosB64))
    fd.set('fotos_serbuk_b64', JSON.stringify(fotosSerbukB64))
    startTransition(async () => {
      const r = await updateStatusProduksi(activeModal.item.id, activeModal.item.kode, fd)
      if (r.error) setFormError(r.error)
      else {
        setActiveModal(null)
        setModalFotos([])
        setModalFotosSerbuk([])
        showToast('Status berhasil diperbarui ✓', 'success')
      }
    })
  }

  const handleInputReject = (fd: FormData) => {
    if (!activeModal) return
    setFormError('')
    startTransition(async () => {
      const r = await inputReject(activeModal.item.id, activeModal.item.kode, fd)
      if (r.error) setFormError(r.error)
      else { setActiveModal(null); showToast('Reject berhasil dicatat ✓', 'success') }
    })
  }

  const handleLeburReject = (item: any) => {
    startTransition(async () => {
      const r = await leburReject(item.id, item.kode, item.batch_kode)
      if (r.error) showToast(r.error, 'error')
      else showToast('Reject berhasil dilebur, berat kembali ke batch ✓', 'success')
    })
  }

  const handleDelete = (item: any) => {
    startTransition(async () => {
      const r = await deleteProduksi(item.id, item.kode)
      if (r.error) showToast(r.error, 'error')
      else { setActiveModal(null); showToast('Item produksi berhasil dihapus ✓', 'success') }
    })
  }

  const handleCreatePacking = (fd: FormData) => {
    if (!activeModal) return
    setFormError('')
    startTransition(async () => {
      const r = await createPacking(fd)
      if (r.error) setFormError(r.error)
      else { setActiveModal(null); showToast(`Packing log ${r.kode} berhasil dibuat ✓`, 'success') }
    })
  }

  const inputCls = "h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 focus:bg-white w-full"
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-widest"

  const ALL_STATUS = ['semua', ...STATUS_OPTIONS, 'Packing Sebagian', 'Sudah Packing']

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-sm',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
          {toast.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">{filtered.length} item</span>
        </div>
        {canCreate && (
          <button onClick={() => { setShowForm(!showForm); setFormError('') }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={15} /> Mulai Cetak / Cetakan Baru
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['semua', 'Cutting', 'Pas Berat', 'Annealing', 'Siap Packing', 'Sudah Packing'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
              filterStatus === s ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>
            {s === 'semua' ? `Semua (${produksiList.length})` : s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode produksi, batch, gramasi..."
          className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
      </div>

      {/* Form Tambah Produksi */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-violet-50 border-b border-violet-100">
            <span className="font-bold text-slate-800 text-sm">➕ Permintaan Cetak Baru</span>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Batch */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className={labelCls}>Batch Bahan Baku Asal <span className="text-red-500">*</span></label>
                <select value={form.batch_kode} onChange={e => setForm(p => ({ ...p, batch_kode: e.target.value }))}
                  className={inputCls} required>
                  <option value="">-- Pilih Batch --</option>
                  {activeBatches.map(b => (
                    <option key={b.kode} value={b.kode}>
                      {b.kode}{b.nama_batch ? ` — ${b.nama_batch}` : ''} (Sisa: {Number(b.sisa_bahan_seharusnya || 0).toFixed(2)} gr)
                    </option>
                  ))}
                </select>
              </div>

              {/* Gramasi */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Gramasi Target Cetak <span className="text-red-500">*</span></label>
                <select value={form.gramasi} onChange={e => setForm(p => ({ ...p, gramasi: e.target.value }))}
                  className={inputCls} required>
                  <option value="">-- Pilih Gramasi --</option>
                  {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
                </select>
              </div>

              {/* PCS */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Jumlah PCS <span className="text-red-500">*</span></label>
                <input type="number" min="1" required className={inputCls}
                  value={form.pcs} onChange={e => setForm(p => ({ ...p, pcs: e.target.value }))}
                  placeholder="Contoh: 50" />
              </div>

              {/* Total Berat */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Total Berat (gram) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" required className={inputCls}
                  value={form.berat_awal} onChange={e => setForm(p => ({ ...p, berat_awal: e.target.value }))}
                  placeholder="Contoh: 50.05" />
              </div>

              {/* Status Awal */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Status Awal Produksi <span className="text-red-500">*</span></label>
                <select value={form.status_awal} onChange={e => setForm(p => ({ ...p, status_awal: e.target.value }))}
                  className={inputCls}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Tanggal */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Tanggal Produksi <span className="text-red-500">*</span></label>
                <input type="date" required className={inputCls}
                  value={form.tanggal_produksi} onChange={e => setForm(p => ({ ...p, tanggal_produksi: e.target.value }))} />
              </div>

              {/* Sisa Serbuk (hanya jika Pas Berat) */}
              {form.status_awal === 'Pas Berat' && (
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Sisa Serbuk (gram) — Khusus Pas Berat</label>
                  <input type="number" step="0.001" className={inputCls}
                    value={form.sisa_serbuk} onChange={e => setForm(p => ({ ...p, sisa_serbuk: e.target.value }))}
                    placeholder="Contoh: 0.02" />
                </div>
              )}

              {/* Operator */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Operator / PIC</label>
                <input className={inputCls} value={form.operator}
                  onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                  placeholder="Nama operator" />
              </div>

              {/* Memo */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className={labelCls}>Memo Produksi</label>
                <input className={inputCls} value={form.memo}
                  onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="Keterangan mesin cetak, pengerjaan..." />
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle size={14} />{formError}
              </div>
            )}

            {/* Foto Proses */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Foto Proses (opsional, max 10)</label>
              <FotoPicker
                files={formFotos}
                onAdd={f => setFormFotos(p => [...p, ...f].slice(0, 10))}
                onRemove={i => i === -1 ? setFormFotos([]) : setFormFotos(p => p.filter((_, j) => j !== i))}
                label="Tambah foto proses produksi"
              />
            </div>

            {/* Foto */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Foto Proses (opsional, max 10)</label>
              <FotoPicker files={formFotos}
                onAdd={f => setFormFotos(p => [...p,...f].slice(0,10))}
                onRemove={i => i===-1?setFormFotos([]):setFormFotos(p=>p.filter((_,j)=>j!==i))}
                label="Foto proses awal produksi"/>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button type="submit" disabled={isPending}
                className="px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
                {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                Mulai Alur ({form.status_awal})
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List Produksi */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Package size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Belum ada data produksi</p>
          </div>
        ) : filtered.map(item => {
          const isExpanded = expandedId === item.id
          const events = (item.produksi_event ?? []).sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const totalLosses = events.reduce((s: number, e: any) => s + (e.losses ?? 0), 0)
          const totalSerbuk = events.reduce((s: number, e: any) => s + (e.sisa_serbuk ?? 0), 0)
          const hasRejectBelumDilebur = item.status_reject === 'belum_dilebur' && (item.pcs_reject ?? 0) > 0

          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xs font-bold text-violet-600 flex-shrink-0">
                  {item.gramasi}gr
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{item.kode}</span>
                    <StatusBadge status={item.current_status} />
                    {hasRejectBelumDilebur && (
                      <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        ⚠️ Reject Belum Dilebur
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.batch_kode} · {item.pcs} PCS · {formatDate(item.tanggal_produksi)}
                    {item.operator && ` · ${item.operator}`}
                  </p>
                </div>
                <div className="text-right hidden sm:block flex-shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Berat</p>
                  <p className="text-sm font-bold text-slate-700">{formatGram(item.total_gram)}</p>
                  {totalLosses > 0 && <p className="text-[10px] text-red-500">Losses: {formatGram(totalLosses)}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Update status */}
                  {!['Sudah Packing'].includes(item.current_status) && (
                    <button onClick={() => { setActiveModal({ type: 'update_status', item }); setFormError('') }}
                      className="p-2 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl" title="Update Status">
                      <ArrowRight size={14} />
                    </button>
                  )}
                  {/* Buat packing */}
                  {item.current_status === 'Siap Packing' && (
                    <button onClick={() => { setActiveModal({ type: 'create_packing', item }); setFormError('') }}
                      className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-xl" title="Buat Packing Log">
                      <Package size={14} />
                    </button>
                  )}
                  {/* Input reject */}
                  <button onClick={() => { setActiveModal({ type: 'input_reject', item }); setFormError('') }}
                    className="p-2 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl" title="Input Reject">
                    <AlertCircle size={14} />
                  </button>
                  {/* Lebur reject */}
                  {hasRejectBelumDilebur && canLeburReject && (
                    <button onClick={() => handleLeburReject(item)}
                      className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl" title="Lebur Reject">
                      <Flame size={14} />
                    </button>
                  )}
                  {/* Hapus */}
                  {canDelete && (
                    <button onClick={() => setActiveModal({ type: 'delete', item })}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                </div>
              </div>

              {/* Expanded — histori event */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PCS Awal</p>
                      <p className="font-bold text-slate-700">{item.pcs_awal ?? item.pcs} PCS</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PCS Good</p>
                      <p className="font-bold text-emerald-600">{item.pcs_good ?? item.pcs} PCS</p>
                    </div>
                    {(item.pcs_reject ?? 0) > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                          Reject {item.status_reject === 'belum_dilebur' ? '⚠️ Belum Dilebur' : '✓ Sudah Dilebur'}
                        </p>
                        <p className="font-bold text-red-600">{item.pcs_reject} PCS / {formatGram(item.berat_reject)}</p>
                      </div>
                    )}
                    {totalSerbuk > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Total Serbuk</p>
                        <p className="font-bold text-amber-600">{formatGram(totalSerbuk)}</p>
                      </div>
                    )}
                    {totalLosses > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Total Losses</p>
                        <p className="font-bold text-red-600">{formatGram(totalLosses)}</p>
                      </div>
                    )}
                  </div>

                  {/* Event timeline */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Histori Alur Produksi</p>
                    <div className="space-y-2">
                      {events.map((ev: any, i: number) => {
                        const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG['Cutting']
                        const losses = ev.losses ?? 0
                        return (
                          <div key={ev.id} className="flex items-start gap-3">
                            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                              <cfg.icon size={12} className={cfg.color} />
                            </div>
                            <div className="flex-1 min-w-0 pb-2 border-b border-slate-50 last:border-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn('text-xs font-bold', cfg.color)}>{ev.status}</span>
                                <span className="text-xs text-slate-500">{formatGram(ev.total_gram)}</span>
                                {ev.sisa_serbuk > 0 && (
                                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                    Serbuk: {formatGram(ev.sisa_serbuk)}
                                  </span>
                                )}
                                {losses > 0 && (
                                  <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                    Losses: {formatGram(losses)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatDate(ev.tanggal)} · {ev.user_name ?? '-'}
                                {ev.catatan && ` · ${ev.catatan}`}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== MODALS ===== */}

      {/* Update Status Modal */}
      {activeModal?.type === 'update_status' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Update Status Produksi</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-violet-600 font-semibold mb-4">{activeModal.item.kode} — {activeModal.item.gramasi}gr × {activeModal.item.pcs} PCS</p>
            <form onSubmit={e => { e.preventDefault(); handleUpdateStatus(new FormData(e.target as HTMLFormElement)) }} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Status Baru <span className="text-red-500">*</span></label>
                <select name="status" required className={inputCls}>
                  {STATUS_OPTIONS.filter(s => s !== activeModal.item.current_status).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Total Berat Sekarang (gram) <span className="text-red-500">*</span></label>
                <input name="total_gram" type="number" step="0.001" required className={inputCls}
                  placeholder={`Berat sebelumnya: ${activeModal.item.total_gram} gr`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Sisa Serbuk (gram) — Isi jika status Pas Berat</label>
                <input name="sisa_serbuk" type="number" step="0.001" className={inputCls}
                  placeholder="0.000" defaultValue="0" />
              </div>
              {/* Foto sisa serbuk */}
              <div className="space-y-1">
                <label className={labelCls}>Foto Sisa Serbuk (opsional)</label>
                <FotoPicker files={modalFotosSerbuk}
                  onAdd={f => setModalFotosSerbuk(p => [...p,...f].slice(0,10))}
                  onRemove={i => i===-1?setModalFotosSerbuk([]):setModalFotosSerbuk(p=>p.filter((_,j)=>j!==i))}
                  label="Foto sisa serbuk" small/>
              </div>
              {/* Foto Sisa Serbuk */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Foto Sisa Serbuk (opsional)</label>
                <FotoPicker files={modalFotosSerbuk}
                  onAdd={f => setModalFotosSerbuk(p => [...p,...f].slice(0,10))}
                  onRemove={i => i===-1?setModalFotosSerbuk([]):setModalFotosSerbuk(p=>p.filter((_,j)=>j!==i))}
                  label="Foto sisa serbuk emas" small/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Tanggal <span className="text-red-500">*</span></label>
                <input name="tanggal" type="date" required className={inputCls}
                  defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Catatan</label>
                <input name="catatan" className={inputCls} placeholder="Keterangan tambahan..." />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl disabled:opacity-60">
                  {isPending ? 'Menyimpan...' : 'Simpan Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Input Reject Modal */}
      {activeModal?.type === 'input_reject' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Input Reject</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-1">{activeModal.item.kode}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
              PCS Good saat ini: <strong>{activeModal.item.pcs_good ?? activeModal.item.pcs} PCS</strong><br />
              Setelah reject, PCS Good akan otomatis berkurang.
            </div>
            <form onSubmit={e => { e.preventDefault(); handleInputReject(new FormData(e.target as HTMLFormElement)) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>PCS Reject <span className="text-red-500">*</span></label>
                  <input name="pcs_reject" type="number" min="1" required className={inputCls} placeholder="Contoh: 1" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Berat Reject (gram) <span className="text-red-500">*</span></label>
                  <input name="berat_reject" type="number" step="0.01" required className={inputCls} placeholder="Contoh: 1.00" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Catatan</label>
                <input name="catatan" className={inputCls} placeholder="Alasan reject, kondisi fisik..." />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-60">
                  {isPending ? 'Menyimpan...' : 'Catat Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Packing Modal */}
      {activeModal?.type === 'create_packing' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Buat Packing Log</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-violet-600 font-semibold mb-1">{activeModal.item.kode}</p>
            <p className="text-xs text-slate-400 mb-4">
              {activeModal.item.gramasi}gr · {activeModal.item.pcs} PCS tersedia · Berat: {formatGram(activeModal.item.total_gram)}
            </p>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.target as HTMLFormElement)
              fd.set('produksi_item_id', String(activeModal.item.id))
              handleCreatePacking(fd)
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>PCS yang Dipack <span className="text-red-500">*</span></label>
                  <input name="pcs_dipack" type="number" min="1" max={activeModal.item.pcs} required className={inputCls}
                    placeholder={`Maks: ${activeModal.item.pcs}`} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Total Gram Aktual (timbang) <span className="text-red-500">*</span></label>
                  <input name="total_gram_aktual" type="number" step="0.001" required className={inputCls}
                    placeholder={`Ref: ${activeModal.item.total_gram} gr`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Tanggal Packing <span className="text-red-500">*</span></label>
                  <input name="tanggal" type="date" required className={inputCls}
                    defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>PIC / Operator</label>
                  <input name="pic" className={inputCls} placeholder="Nama PIC" defaultValue={userName} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Catatan</label>
                <input name="catatan" className={inputCls} placeholder="Keterangan tambahan..." />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
                  <Package size={14} />
                  {isPending ? 'Menyimpan...' : 'Buat Packing Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {activeModal?.type === 'delete' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><Trash2 size={18} className="text-red-500" /></div>
              <div>
                <h3 className="font-bold text-slate-800">Hapus Item Produksi</h3>
                <p className="text-xs text-slate-400">Berat akan dikembalikan ke batch</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Hapus <span className="font-bold text-red-500">{activeModal.item.kode}</span>?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-xs text-red-700">
              🚫 Jika sudah ada packing log, hapus packing log terlebih dahulu.
              Berat {formatGram(activeModal.item.berat_awal)} akan dikembalikan ke batch {activeModal.item.batch_kode}.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button onClick={() => handleDelete(activeModal.item)} disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60">
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
