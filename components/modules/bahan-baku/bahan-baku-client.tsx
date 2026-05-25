'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Plus, Search, Lock, Unlock, ChevronDown, ChevronUp,
  Package, Calculator, X, Check, AlertTriangle, FileText,
  Edit2, Camera, Trash2, Image as ImageIcon, ExternalLink
} from 'lucide-react'
import { cn, formatRupiah, formatDate, formatGram } from '@/lib/utils'
import { createBatch, updateBatch, deleteBatch, lockBatch, unlockBatch } from '@/app/(dashboard)/bahan-baku/actions'
import type { Batch, BiayaTambahan, UserRole } from '@/lib/types/database'

interface Props { batches: Batch[]; userRole: UserRole; userName: string }
type FilterType = 'semua' | 'aktif' | 'terkunci'

function getBatchStatus(b: any) {
  if (b.voided_at && b.void_reason === 'DELETED_BY_USER') return 'dihapus'
  if (b.voided_at) return 'terkunci'
  if (b.sisa_fisik !== null && b.sisa_fisik <= 0 && (b.timbangan_akhir ?? 0) > 0) return 'habis'
  return 'aktif'
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    habis: 'bg-slate-50 text-slate-500 border-slate-200',
    terkunci: 'bg-amber-50 text-amber-700 border-amber-200',
    dihapus: 'bg-red-50 text-red-500 border-red-200',
  }
  const label: Record<string, string> = { aktif: 'Aktif', habis: 'Habis', terkunci: 'Terkunci 🔒', dihapus: 'Dihapus' }
  return <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider', map[status] ?? map.aktif)}>{label[status] ?? status}</span>
}

interface FormState {
  kode: string; nama_batch: string
  tanggal_datang: string; tanggal_beli: string
  supplier: string; bahan_dari_pusat: string
  timbangan_akhir: string; harga_beli: string; catatan: string
}

const today = new Date().toISOString().split('T')[0]
const emptyForm = (): FormState => ({
  kode: '', nama_batch: '', tanggal_datang: today, tanggal_beli: today,
  supplier: '', bahan_dari_pusat: '', timbangan_akhir: '', harga_beli: '', catatan: ''
})

function BatchForm({ initialData, existingFotos = [], onSubmit, onCancel, isPending, error }: {
  initialData: FormState; existingFotos?: string[]
  onSubmit: (fd: FormData) => void; onCancel: () => void; isPending: boolean; error: string
}) {
  const [form, setForm] = useState(initialData)
  const [biayaTbh, setBiayaTbh] = useState<BiayaTambahan[]>([])
  const [currentFotos, setCurrentFotos] = useState<string[]>(existingFotos)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const totalFotos = currentFotos.length + newPreviews.length
  const beratPusat = parseFloat(form.bahan_dari_pusat) || 0
  const beratGudang = parseFloat(form.timbangan_akhir) || 0
  const hargaBeli = parseFloat(form.harga_beli) || 0
  const totalBiaya = biayaTbh.reduce((s, b) => s + (b.jumlah || 0), 0)
  const totalHpp = hargaBeli + totalBiaya
  const hppPerGram = beratGudang > 0 ? totalHpp / beratGudang : 0
  const selisih = beratPusat - beratGudang

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = 10 - totalFotos
    const toAdd = files.slice(0, remaining)
    setNewFiles(p => [...p, ...toAdd])
    toAdd.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setNewPreviews(p => [...p, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
    e.target.value = ''
  }

  const removeExisting = (idx: number) => setCurrentFotos(p => p.filter((_, i) => i !== idx))
  const removeNew = (idx: number) => {
    setNewFiles(p => p.filter((_, i) => i !== idx))
    setNewPreviews(p => p.filter((_, i) => i !== idx))
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))
    fd.set('biaya_tbh', JSON.stringify(biayaTbh))
    fd.set('fotos_existing', JSON.stringify(currentFotos))
    newFiles.forEach(file => fd.append('fotos', file))
    onSubmit(fd)
  }

  const inputCls = "h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 focus:bg-white"
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-widest"

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Row 1: Kode + Nama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Kode Batch <span className="text-slate-400 normal-case font-normal">(kosongkan = auto PROD.GDCJ/BATCH/0001)</span></label>
          <input className={inputCls} value={form.kode} onChange={f('kode')} placeholder="Kosongkan untuk auto-generate"/>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Nama / Label Batch</label>
          <input className={inputCls} value={form.nama_batch} onChange={f('nama_batch')} placeholder="Contoh: Batch Emas Antam Mei 2026"/>
        </div>
      </div>

      {/* Row 2: 2 Tanggal WAJIB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>📅 Tanggal Kedatangan Bahan Baku <span className="text-red-500">*</span></label>
          <input type="date" required className={inputCls} value={form.tanggal_datang} onChange={f('tanggal_datang')}/>
          <p className="text-[10px] text-slate-400">Kapan bahan baku tiba di gudang</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>🛒 Tanggal Pembelian / Transaksi <span className="text-red-500">*</span></label>
          <input type="date" required className={inputCls} value={form.tanggal_beli} onChange={f('tanggal_beli')}/>
          <p className="text-[10px] text-slate-400">Kapan tanggal transaksi beli terjadi</p>
        </div>
      </div>

      {/* Row 3: Supplier + Berat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Supplier / Sumber</label>
          <input className={inputCls} value={form.supplier} onChange={f('supplier')} placeholder="Nama supplier"/>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Berat Pusat / Supplier (gram) <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" required className={inputCls} value={form.bahan_dari_pusat} onChange={f('bahan_dari_pusat')} placeholder="1000.00"/>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Berat Timbangan Gudang (gram) <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" required className={inputCls} value={form.timbangan_akhir} onChange={f('timbangan_akhir')} placeholder="999.50"/>
        </div>
      </div>

      {/* Row 4: Harga + Catatan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Harga Beli Bahan Baku (IDR) <span className="text-red-500">*</span></label>
          <input type="number" required className={inputCls} value={form.harga_beli} onChange={f('harga_beli')} placeholder="Total nilai transaksi"/>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Catatan</label>
          <input className={inputCls} value={form.catatan} onChange={f('catatan')} placeholder="Purity, kode garansi, keterangan lain..."/>
        </div>
      </div>

      {/* Biaya Tambahan */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={cn(labelCls, 'flex items-center gap-1')}><Calculator size={11}/> Biaya Tambahan (Opsional)</label>
          <button type="button" onClick={() => setBiayaTbh(p => [...p, { nama: '', jumlah: 0 }])}
            className="text-xs text-violet-600 font-semibold flex items-center gap-1 hover:text-violet-700">
            <Plus size={12}/> Tambah Biaya
          </button>
        </div>
        {biayaTbh.map((b, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={b.nama} onChange={e => setBiayaTbh(p => p.map((x, j) => j === i ? { ...x, nama: e.target.value } : x))}
              placeholder="Nama biaya (ongkir, asuransi...)" className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
            <input type="number" value={b.jumlah || ''} onChange={e => setBiayaTbh(p => p.map((x, j) => j === i ? { ...x, jumlah: parseFloat(e.target.value) || 0 } : x))}
              placeholder="IDR" className="w-36 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
            <button type="button" onClick={() => setBiayaTbh(p => p.filter((_, j) => j !== i))}
              className="h-9 w-9 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl"><X size={14}/></button>
          </div>
        ))}
      </div>

      {/* Upload Foto */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={cn(labelCls, 'flex items-center gap-1')}>
            <Camera size={11}/> Foto Bukti / Sertifikat ({totalFotos}/10)
          </label>
          {totalFotos < 10 && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-violet-600 font-semibold flex items-center gap-1"><Plus size={12}/> Upload Foto</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles}/>

        {totalFotos === 0 ? (
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
            <ImageIcon size={28} className="text-slate-300 mx-auto mb-2"/>
            <p className="text-sm text-slate-400 font-medium">Klik untuk upload foto</p>
            <p className="text-xs text-slate-300 mt-1">Maks. 10 foto · JPG, PNG, WEBP</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {currentFotos.map((src, i) => (
              <div key={`e-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                <img src={src} alt="" className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <button type="button" onClick={() => removeExisting(i)}
                    className="w-6 h-6 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">
                    <X size={10}/>
                  </button>
                </div>
              </div>
            ))}
            {newPreviews.map((src, i) => (
              <div key={`n-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group border-2 border-violet-300">
                <img src={src} alt="" className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <button type="button" onClick={() => removeNew(i)}
                    className="w-6 h-6 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">
                    <X size={10}/>
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-violet-500/80 py-0.5 text-center">
                  <span className="text-white text-[9px] font-bold">BARU</span>
                </div>
              </div>
            ))}
            {totalFotos < 10 && (
              <div onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50">
                <Plus size={18} className="text-slate-300"/>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HPP Calculator */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-violet-50 rounded-xl border border-violet-100">
        <div>
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Harga Beli + Biaya</p>
          <p className="font-bold text-violet-700">{formatRupiah(totalHpp)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">HPP / Gram</p>
          <p className="font-bold text-violet-700">{beratGudang > 0 ? formatRupiah(hppPerGram) : 'Isi berat dulu'}<span className="text-xs font-normal">/gr</span></p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Selisih Berat</p>
          <p className={cn('font-bold', Math.abs(selisih) > 0.5 ? 'text-red-600' : 'text-emerald-600')}>
            {selisih > 0 ? '+' : ''}{beratPusat > 0 ? selisih.toFixed(2) : '-'} gr
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">Status Selisih</p>
          <p className={cn('text-sm font-bold', Math.abs(selisih) > 0.5 ? 'text-red-600' : 'text-emerald-600')}>
            {beratPusat > 0 ? (Math.abs(selisih) > 0.5 ? '⚠ Perlu Cek' : '✓ Sesuai') : '-'}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 -mt-3">Formula: (Harga Beli + Total Biaya Tambahan) ÷ Berat Timbangan Gudang</p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle size={14}/>{error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
        <button type="submit" disabled={isPending}
          className="px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
          {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Check size={14}/>}
          Simpan & Rekonsiliasi
        </button>
      </div>
    </form>
  )
}

export default function BahanBakuClient({ batches, userRole }: Props) {
  const [filter, setFilter] = useState<FilterType>('semua')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editBatch, setEditBatch] = useState<any | null>(null)
  const [deleteModal, setDeleteModal] = useState<any | null>(null)
  const [lockModal, setLockModal] = useState<any | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')

  const canEdit = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canDelete = ['owner', 'admin_pusat'].includes(userRole)
  const canLock = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canUnlock = ['owner', 'admin_pusat'].includes(userRole)
  const canCreate = ['owner', 'admin_pusat', 'spv', 'operator_produksi', 'gudang'].includes(userRole)

  const visibleBatches = batches.filter(b => {
    const status = getBatchStatus(b)
    if (status === 'dihapus') return false // hide deleted
    if (filter === 'aktif' && status !== 'aktif') return false
    if (filter === 'terkunci' && status !== 'terkunci') return false
    if (search) {
      const q = search.toLowerCase()
      return b.kode.toLowerCase().includes(q) ||
        ((b as any).nama_batch ?? '').toLowerCase().includes(q) ||
        (b.supplier ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const wrap = (fn: () => Promise<{ error?: string; success?: boolean; kode?: string }>, onSuccess: (r: any) => void) => {
    setFormError('')
    startTransition(async () => {
      const result = await fn()
      if (result.error) setFormError(result.error)
      else onSuccess(result)
    })
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-sm',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
          {toast.type === 'success' ? <Check size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="foto" className="max-w-full max-h-full rounded-xl shadow-2xl"/>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">
            <X size={18}/>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(['semua', 'aktif', 'terkunci'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all',
                filter === f ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>
              {f === 'semua' ? `Semua Batch (${visibleBatches.length})` : f === 'aktif' ? 'Aktif' : '🔒 Terkunci'}
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => { setShowForm(!showForm); setFormError('') }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={15}/> Registrasi Batch Baru
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode batch, nama batch, supplier..."
          className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
      </div>

      {/* Form Tambah */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-violet-50">
            <div className="flex items-center gap-2"><Package size={16} className="text-violet-600"/>
              <span className="font-bold text-slate-800 text-sm">Formulir Registrasi Logam Mulia Masuk</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16}/></button>
          </div>
          <BatchForm
            initialData={emptyForm()}
            onSubmit={fd => wrap(() => createBatch(fd), r => { setShowForm(false); showToast(`Batch ${r.kode} berhasil didaftarkan ✓`, 'success') })}
            onCancel={() => setShowForm(false)}
            isPending={isPending} error={formError}
          />
        </div>
      )}

      {/* Edit Modal */}
      {editBatch && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-violet-50">
              <div className="flex items-center gap-2"><Edit2 size={16} className="text-violet-600"/>
                <span className="font-bold text-slate-800 text-sm">Edit Batch — {editBatch.kode}</span>
              </div>
              <button onClick={() => setEditBatch(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16}/></button>
            </div>
            <BatchForm
              initialData={{
                kode: editBatch.kode, nama_batch: editBatch.nama_batch ?? '',
                tanggal_datang: editBatch.tanggal_datang ?? editBatch.tanggal ?? today,
                tanggal_beli: editBatch.tanggal_beli ?? editBatch.tanggal ?? today,
                supplier: editBatch.supplier ?? '',
                bahan_dari_pusat: String(editBatch.bahan_dari_pusat ?? ''),
                timbangan_akhir: String(editBatch.timbangan_akhir ?? ''),
                harga_beli: String(editBatch.harga_beli ?? ''),
                catatan: editBatch.catatan ?? '',
              }}
              existingFotos={editBatch.fotos ?? []}
              onSubmit={fd => wrap(() => updateBatch(editBatch.id, fd), () => { setEditBatch(null); showToast('Batch berhasil diperbarui ✓', 'success') })}
              onCancel={() => setEditBatch(null)}
              isPending={isPending} error={formError}
            />
          </div>
        </div>
      )}

      {/* Batch List */}
      <div className="space-y-3">
        {visibleBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Package size={32} className="text-slate-300 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm">Belum ada data batch</p>
          </div>
        ) : visibleBatches.map(batch => {
          const status = getBatchStatus(batch)
          const isExpanded = expandedId === batch.id
          const fotos: string[] = (batch as any).fotos ?? []
          const sisaPercent = batch.timbangan_akhir ? Math.min(((batch.sisa_fisik ?? 0) / batch.timbangan_akhir) * 100, 100) : 0

          return (
            <div key={batch.id} className={cn('bg-white rounded-2xl border transition-all',
              status === 'terkunci' ? 'border-amber-100' : 'border-slate-100')}>
              {/* Row utama */}
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : batch.id)}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0',
                  status === 'terkunci' ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600')}>AU</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{batch.kode}</span>
                    {(batch as any).nama_batch && <span className="text-xs text-violet-500 font-medium">· {(batch as any).nama_batch}</span>}
                    <StatusBadge status={status}/>
                    {fotos.length > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Camera size={9}/>{fotos.length}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    {(batch as any).tanggal_datang && <span className="text-[10px] text-slate-400">📦 Datang: {formatDate((batch as any).tanggal_datang)}</span>}
                    {(batch as any).tanggal_beli && <span className="text-[10px] text-slate-400">🛒 Beli: {formatDate((batch as any).tanggal_beli)}</span>}
                    {batch.supplier && <span className="text-[10px] text-slate-400">· {batch.supplier}</span>}
                  </div>
                </div>
                <div className="text-right hidden sm:block flex-shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sisa Bahan Baku</p>
                  <p className="text-sm font-bold text-slate-700">
                    {formatGram(batch.sisa_fisik)} <span className="text-slate-400 font-normal text-xs">/ {formatGram(batch.timbangan_akhir)}</span>
                  </p>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {status === 'aktif' && canEdit && (
                    <button onClick={() => { setEditBatch(batch); setFormError('') }}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl" title="Edit">
                      <Edit2 size={14}/>
                    </button>
                  )}
                  {status === 'aktif' && canLock && (
                    <button onClick={() => setLockModal(batch)}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl" title="Kunci Batch">
                      <Lock size={14}/>
                    </button>
                  )}
                  {status === 'terkunci' && canUnlock && (
                    <button onClick={() => startTransition(async () => {
                      const r = await unlockBatch(batch.id, batch.kode)
                      r.error ? showToast(r.error, 'error') : showToast('Batch berhasil dibuka ✓', 'success')
                    })} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl" title="Buka Kunci">
                      <Unlock size={14}/>
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setDeleteModal(batch)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl" title="Hapus Batch">
                      <Trash2 size={14}/>
                    </button>
                  )}
                  <div className="p-2 text-slate-400">
                    {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', sisaPercent > 50 ? 'bg-violet-400' : sisaPercent > 20 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${sisaPercent}%` }}/>
                </div>
                <p className="text-[10px] text-slate-400 text-right mt-0.5">{sisaPercent.toFixed(0)}% tersisa</p>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Berat Pusat/Supplier', value: formatGram(batch.bahan_dari_pusat) },
                      { label: 'Berat Timbangan Gudang', value: formatGram(batch.timbangan_akhir) },
                      { label: 'Harga Beli', value: formatRupiah(batch.harga_beli ?? 0) },
                      { label: 'HPP / Gram', value: formatRupiah(batch.hpp_gr ?? 0), highlight: true },
                    ].map(item => (
                      <div key={item.label} className={cn('rounded-xl p-3', item.highlight ? 'bg-violet-50 border border-violet-100' : 'bg-slate-50')}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', item.highlight ? 'text-violet-400' : 'text-slate-400')}>{item.label}</p>
                        <p className={cn('font-bold text-sm', item.highlight ? 'text-violet-700' : 'text-slate-700')}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {Array.isArray((batch as any).biaya_tbh) && (batch as any).biaya_tbh.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full">Biaya Tambahan</span>
                      {((batch as any).biaya_tbh as BiayaTambahan[]).map((b, i) => (
                        <span key={i} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1 rounded-full">
                          {b.nama}: {formatRupiah(b.jumlah)}
                        </span>
                      ))}
                    </div>
                  )}

                  {fotos.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Camera size={10}/> Foto Batch ({fotos.length})
                      </p>
                      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                        {fotos.map((src, i) => (
                          <button key={i} type="button" onClick={() => setLightbox(src)}
                            className="aspect-square rounded-xl overflow-hidden bg-slate-100 hover:opacity-80 transition-opacity relative group">
                            <img src={src} alt={`foto ${i + 1}`} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                              <ExternalLink size={12} className="text-white opacity-0 group-hover:opacity-100"/>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {batch.catatan && (
                    <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                      <FileText size={13} className="mt-0.5 flex-shrink-0 text-slate-400"/>
                      {batch.catatan}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lock Modal */}
      {lockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Lock size={18} className="text-amber-600"/></div>
              <div><h3 className="font-bold text-slate-800">Kunci Batch Produksi</h3><p className="text-xs text-slate-400">Batch tidak bisa diedit setelah dikunci</p></div>
            </div>
            <p className="text-sm text-slate-600 mb-3">Kunci batch <span className="font-bold text-violet-600">{lockModal.kode}</span>?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
              ⚠️ Setelah dikunci, batch tidak bisa digunakan untuk input produksi baru. Memerlukan approval Owner/Admin untuk dibuka kembali.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLockModal(null)} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button onClick={() => startTransition(async () => {
                const r = await lockBatch(lockModal.id, lockModal.kode)
                r.error ? showToast(r.error, 'error') : showToast(`Batch ${lockModal.kode} berhasil dikunci`, 'success')
                setLockModal(null)
              })} disabled={isPending} className="px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-60">
                {isPending ? 'Memproses...' : 'Ya, Kunci Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><Trash2 size={18} className="text-red-500"/></div>
              <div><h3 className="font-bold text-slate-800">Hapus Batch</h3><p className="text-xs text-slate-400">Tindakan ini tidak bisa dibatalkan</p></div>
            </div>
            <p className="text-sm text-slate-600 mb-3">Hapus batch <span className="font-bold text-red-500">{deleteModal.kode}</span>?</p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-xs text-red-700">
              🚫 Batch tidak bisa dihapus jika sudah ada produksi yang menggunakannya. Semua aksi akan dicatat di audit log.
            </div>
            {formError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{formError}</div>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setDeleteModal(null); setFormError('') }} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button onClick={() => wrap(() => deleteBatch(deleteModal.id, deleteModal.kode), () => {
                setDeleteModal(null)
                showToast(`Batch ${deleteModal.kode} berhasil dihapus`, 'success')
              })} disabled={isPending} className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 flex items-center gap-2">
                {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Trash2 size={14}/>}
                Ya, Hapus Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
