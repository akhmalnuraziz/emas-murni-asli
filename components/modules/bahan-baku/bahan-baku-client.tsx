'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  Plus, Search, Lock, Unlock, ChevronDown, ChevronUp,
  Package, X, Check, AlertTriangle, Edit2, Trash2,
  Scale, ImageIcon
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import {
  createBatch, updateBatch, deleteBatch,
  lockBatch, unlockBatch, updateSisaFisik
} from '@/app/(dashboard)/bahan-baku/actions'
import type { UserRole } from '@/lib/types/database'

interface Props { batches: any[]; userRole: UserRole; userName: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hitungSelisih(pusat: number, gudang: number) {
  const selisih = pusat - gudang
  const abs = Math.abs(selisih)
  if (abs === 0)   return { label: 'Sesuai ✓', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', warnCatatan: false }
  if (abs <= 0.05) return { label: `Toleransi ${selisih > 0 ? '+' : ''}${selisih.toFixed(2)} gr`, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', warnCatatan: false }
  return             { label: `Melewati toleransi ${selisih > 0 ? '+' : ''}${selisih.toFixed(2)} gr`, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', warnCatatan: true }
}

function getBatchStatus(b: any) {
  if (b.voided_at && b.void_reason === 'DELETED_BY_USER') return 'dihapus'
  if (b.voided_at) return 'terkunci'
  return 'aktif'
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    aktif:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    terkunci: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const labels: Record<string, string> = { aktif: 'Aktif', terkunci: 'Terkunci 🔒' }
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider', styles[status] ?? styles.aktif)}>
      {labels[status] ?? status}
    </span>
  )
}

// Compress foto di browser sebelum kirim ke server (max 350KB per foto)
async function compressImage(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 1600
      if (width > maxDim || height > maxDim) {
        const r = Math.min(maxDim/width, maxDim/height)
        width = Math.floor(width * r)
        height = Math.floor(height * r)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      let q = 0.8
      const tryQ = () => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          if (blob.size <= 350 * 1024 || q <= 0.3) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else { q -= 0.1; tryQ() }
        }, 'image/jpeg', q)
      }
      tryQ()
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white'
const labelCls = 'text-xs font-semibold text-slate-600'
const today = new Date().toISOString().split('T')[0]

// ─── Batch Form ───────────────────────────────────────────────────────────────
function BatchForm({ initial, onSubmit, onCancel, isPending, error, isEdit = false }: {
  initial?: any; onSubmit: (fd: FormData, urls: string[]) => void
  onCancel: () => void; isPending: boolean; error: string; isEdit?: boolean
}) {
  const [pusat, setPusat]       = useState(String(initial?.bahan_dari_pusat ?? ''))
  const [gudang, setGudang]     = useState(String(initial?.timbangan_akhir ?? ''))
  const [harga, setHarga]       = useState(String(initial?.harga_beli ?? ''))
  const [biayaTbh, setBiayaTbh] = useState<{label:string;jumlah:number}[]>(initial?.biaya_tambahan ?? [])
  const [newFotos, setNewFotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>(initial?.fotos ?? [])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const urls = newFotos.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [newFotos])

  const selisihInfo   = pusat && gudang ? hitungSelisih(parseFloat(pusat), parseFloat(gudang)) : null
  const hargaNum      = parseFloat(harga) || 0
  const totalBiayaTbh = biayaTbh.reduce((s, b) => s + (b.jumlah || 0), 0)
  const totalHpp      = hargaNum + totalBiayaTbh
  const hppGr         = parseFloat(gudang) > 0 ? totalHpp / parseFloat(gudang) : 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget // capture BEFORE any await
    const fd = new FormData(formEl)
    fd.set('biaya_tbh', JSON.stringify(biayaTbh))
    fd.set('existing_fotos', JSON.stringify(existingFotos))
    if (newFotos.length === 0) {
      onSubmit(fd, existingFotos)
      return
    }
    setUploading(true)
    try {
      // Compress semua foto dulu baru kirim ke server
      const compressed: File[] = []
      for (const f of newFotos.slice(0, 10)) {
        compressed.push(await compressImage(f))
      }
      compressed.forEach((f, i) => fd.append(`foto_file_${i}`, f))
      fd.set('foto_count', String(compressed.length))
      onSubmit(fd, existingFotos) // server akan upload via Supabase server client
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Kode Batch (kosong = auto)</label>
          <input name="kode" defaultValue={initial?.kode ?? ''} placeholder="Auto-generate" className={inputCls} readOnly={isEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Nama / Label Batch</label>
          <input name="nama_batch" defaultValue={initial?.nama_batch ?? ''} placeholder="BATCH 26" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Tanggal Kedatangan *</label>
          <input name="tanggal_datang" type="date" defaultValue={initial?.tanggal ?? today} className={inputCls} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Tanggal Pembelian *</label>
          <input name="tanggal_beli" type="date" defaultValue={initial?.tanggal_beli ?? today} className={inputCls} required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Supplier / Sumber</label>
        <input name="supplier" defaultValue={initial?.supplier ?? 'GUDANG PUSAT'} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Berat Pusat / Supplier (gram) *</label>
          <input name="bahan_dari_pusat" type="number" step="0.01" value={pusat}
            onChange={e => setPusat(e.target.value)} placeholder="1000.00" className={inputCls} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Berat Timbangan Gudang (gram) *</label>
          <input name="timbangan_akhir" type="number" step="0.01" value={gudang}
            onChange={e => setGudang(e.target.value)} placeholder="999.89" className={inputCls} required />
        </div>
      </div>
      {selisihInfo && (
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold', selisihInfo.bg, selisihInfo.border, selisihInfo.color)}>
          <Scale size={13} />
          Status Selisih: {selisihInfo.label}
          {selisihInfo.warnCatatan && <span className="text-red-500 ml-1">— Catatan WAJIB</span>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Harga Beli Bahan Baku (IDR) *</label>
        <input name="harga_beli" type="number" value={harga} onChange={e => setHarga(e.target.value)} placeholder="100000000" className={inputCls} required />
        {hargaNum > 0 && <p className="text-xs text-violet-600 font-semibold px-1">{formatRupiah(hargaNum)}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className={labelCls}>Biaya Tambahan (Opsional)</label>
          <button type="button" onClick={() => setBiayaTbh(p => [...p, { label: '', jumlah: 0 }])}
            className="text-xs text-violet-600 font-semibold hover:underline">+ Tambah Biaya</button>
        </div>
        {biayaTbh.map((b, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={b.label} onChange={e => setBiayaTbh(p => p.map((x,j) => j===i?{...x,label:e.target.value}:x))} placeholder="Keterangan" className={cn(inputCls,'flex-1')} />
            <input type="number" value={b.jumlah} onChange={e => setBiayaTbh(p => p.map((x,j) => j===i?{...x,jumlah:parseFloat(e.target.value)||0}:x))} placeholder="0" className={cn(inputCls,'w-32')} />
            <button type="button" onClick={() => setBiayaTbh(p => p.filter((_,j)=>j!==i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><X size={14}/></button>
          </div>
        ))}
      </div>
      {hargaNum > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-slate-500">Harga Beli</span><span className="font-semibold">{formatRupiah(hargaNum)}</span></div>
          {totalBiayaTbh > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500">Total Biaya Tambahan</span><span className="font-semibold">{formatRupiah(totalBiayaTbh)}</span></div>}
          <div className="flex justify-between text-xs border-t border-violet-200 pt-1.5"><span className="font-semibold text-slate-500">Total HPP</span><span className="font-bold text-violet-700">{formatRupiah(totalHpp)}</span></div>
          {hppGr > 0 && <div className="flex justify-between text-xs"><span className="font-semibold text-slate-500">HPP / gram</span><span className="font-bold text-violet-700 text-sm">{formatRupiah(hppGr)}/gr</span></div>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Catatan {selisihInfo?.warnCatatan && <span className="text-red-500">*</span>}</label>
        <input name="catatan" defaultValue={initial?.catatan ?? ''} placeholder={selisihInfo?.warnCatatan ? 'Wajib — jelaskan alasan selisih berat' : 'Keterangan tambahan...'}
          className={cn(inputCls, selisihInfo?.warnCatatan && 'border-red-300')} required={!!selisihInfo?.warnCatatan} />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelCls}>Foto Bukti / Sertifikat (max 10)</label>
        {existingFotos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {existingFotos.map((url, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                <button type="button" onClick={() => setExistingFotos(p => p.filter((_,j)=>j!==i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"><X size={11}/></button>
              </div>
            ))}
          </div>
        )}
        {previews.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {previews.map((url, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl border-2 border-violet-300" />
                <button type="button" onClick={() => setNewFotos(p => p.filter((_,j)=>j!==i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={11}/></button>
                <div className="absolute bottom-0 left-0 right-0 bg-violet-600/70 text-white text-[8px] text-center py-0.5 rounded-b-xl">BARU</div>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
          <ImageIcon size={16} className="text-slate-400" />
          <span className="text-sm text-slate-500">
            {newFotos.length > 0 ? `${newFotos.length} foto dipilih — klik lagi untuk tambah` : 'Pilih foto (boleh 1-1 atau sekaligus)'}
          </span>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              setNewFotos(p => [...p, ...picked].slice(0, 10))
              e.currentTarget.value = '' // reset agar bisa pilih 1-1 lagi
            }} />
        </label>
        {newFotos.length > 0 && (
          <button type="button" onClick={() => setNewFotos([])}
            className="text-xs text-red-500 hover:underline">Hapus semua foto baru</button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
        <button type="submit" disabled={isPending || uploading}
          className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
          {(isPending || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {uploading ? 'Mengupload foto...' : isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan & Rekonsiliasi'}
        </button>
      </div>
    </form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BahanBakuClient({ batches, userRole, userName }: Props) {
  // ─ State semua di atas ─
  const [filter, setFilter]               = useState<'semua'|'aktif'|'terkunci'>('semua')
  const [search, setSearch]               = useState('')
  const [expandedId, setExpandedId]       = useState<number|null>(null)
  const [showForm, setShowForm]           = useState(false)
  const [editItem, setEditItem]           = useState<any|null>(null)
  const [lockModal, setLockModal]         = useState<any|null>(null)
  const [deleteModal, setDeleteModal]     = useState<any|null>(null)
  const [toast, setToast]                 = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [formError, setFormError]         = useState('')
  const [isPending, startTransition]      = useTransition()
  const [sisaFisikInput, setSisaFisikInput]       = useState<Record<number,string>>({})
  const [sisaFisikFotos, setSisaFisikFotos]       = useState<Record<number,File[]>>({})
  const [sisaFisikPreviews, setSisaFisikPreviews] = useState<Record<number,string[]>>({})
  const [uploadingSF, setUploadingSF]             = useState<Record<number,boolean>>({})
  const [editingSisaFisik, setEditingSisaFisik]   = useState<number|null>(null)

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = batches.filter(b => {
    if (getBatchStatus(b) === 'dihapus') return false
    const st = getBatchStatus(b)
    if (filter === 'aktif'    && st !== 'aktif')    return false
    if (filter === 'terkunci' && st !== 'terkunci') return false
    const q = search.toLowerCase()
    return !q || b.kode?.toLowerCase().includes(q) || b.nama_batch?.toLowerCase().includes(q) || b.supplier?.toLowerCase().includes(q)
  })

  function handleCreate(fd: FormData, urls: string[]) {
    fd.set('foto_urls', JSON.stringify(urls))
    setFormError('')
    startTransition(async () => {
      const res = await createBatch(fd)
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Batch berhasil disimpan')
      setShowForm(false)
    })
  }

  function handleUpdate(fd: FormData, urls: string[]) {
    if (!editItem) return
    fd.set('foto_urls', JSON.stringify(urls))
    setFormError('')
    startTransition(async () => {
      const res = await updateBatch(editItem.id, editItem.kode, fd)
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Batch diperbarui')
      setEditItem(null)
    })
  }

  function handleLock(batch: any) {
    startTransition(async () => {
      const res = await lockBatch(batch.id, batch.kode)
      if (res?.error) { showToast(res.error, 'error'); return }
      showToast('🔒 Batch dikunci')
      setLockModal(null)
    })
  }

  function handleDelete(batch: any) {
    startTransition(async () => {
      const res = await deleteBatch(batch.id, batch.kode)
      if (res?.error) { showToast(res.error, 'error'); return }
      showToast('🗑️ Batch dihapus')
      setDeleteModal(null)
    })
  }

  async function handleSisaFisik(batch: any) {
    const val = parseFloat(sisaFisikInput[batch.id] ?? '')
    if (isNaN(val) || val < 0) { showToast('Nilai tidak valid', 'error'); return }
    setUploadingSF(p => ({...p, [batch.id]: true}))
    try {
      const files = sisaFisikFotos[batch.id] ?? []
      const compressed: File[] = []
      for (const f of files.slice(0, 10)) compressed.push(await compressImage(f))
      const res = await updateSisaFisik(batch.id, batch.kode, val, compressed,
        Array.isArray(batch.foto_sisa_fisik) ? batch.foto_sisa_fisik : [])
      if (res?.error) { showToast(res.error, 'error'); return }
      showToast('✅ Sisa fisik disimpan')
      setSisaFisikFotos(p => ({...p, [batch.id]: []}))
      setSisaFisikPreviews(p => ({...p, [batch.id]: []}))
      setEditingSisaFisik(null)
    } finally {
      setUploadingSF(p => ({...p, [batch.id]: false}))
    }
  }

  return (
    <div className="space-y-5 pb-20">
      {toast && (
        <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg',
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600')}>
          {toast.type === 'success' ? <Check size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package size={20} className="text-violet-600"/>Bahan Baku</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manajemen batch dan HPP bahan baku emas</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl">
          <Plus size={14}/> Registrasi Batch Baru
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(['semua','aktif','terkunci'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all',
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600')}>
            {f === 'semua' ? `Semua Batch (${batches.filter(b => getBatchStatus(b) !== 'dihapus').length})` : f}
          </button>
        ))}
        <div className="relative flex-1 sm:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode, nama, supplier..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"/>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">Formulir Registrasi Logam Mulia Masuk</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
          </div>
          <BatchForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} isPending={isPending} error={formError}/>
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Tidak ada batch ditemukan</p>
          </div>
        ) : filtered.map(batch => {
          const status         = getBatchStatus(batch)
          const isExpanded     = expandedId === batch.id
          const selisihInfo    = hitungSelisih(batch.bahan_dari_pusat ?? 0, batch.timbangan_akhir ?? 0)
          const sisaSeharusnya = Number(batch.sisa_bahan_seharusnya ?? batch.timbangan_akhir ?? 0)
          const sisaFisik      = batch.sisa_fisik != null ? Number(batch.sisa_fisik) : null
          const loses          = sisaFisik !== null ? sisaSeharusnya - sisaFisik : null
          const pct            = (batch.timbangan_akhir ?? 0) > 0 ? Math.min(100, Math.max(0, (sisaSeharusnya / batch.timbangan_akhir) * 100)) : 100
          const fotoSisaFisik  = Array.isArray(batch.foto_sisa_fisik) ? batch.foto_sisa_fisik : []
          const isEditingSF    = editingSisaFisik === batch.id

          return (
            <div key={batch.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-violet-700">{(batch.nama_batch ?? batch.kode ?? '?').slice(0,2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{batch.kode}</span>
                    <StatusBadge status={status}/>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', selisihInfo.bg, selisihInfo.border, selisihInfo.color)}>
                      {selisihInfo.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex gap-3 flex-wrap">
                    <span>{batch.supplier ?? '—'}</span>
                    <span>Datang: {batch.tanggal ? formatDate(batch.tanggal) : '—'}</span>
                    <span className="font-semibold text-violet-600">HPP: {formatRupiah(batch.hpp_gr ?? 0)}/gr</span>
                  </div>
                </div>
                <div className="text-right hidden sm:block flex-shrink-0">
                  <p className="text-xs text-slate-400">Sisa Bahan</p>
                  <p className="text-sm font-bold text-slate-700">{sisaSeharusnya.toFixed(2)} gr</p>
                  <p className="text-[10px] text-slate-400">dari {(batch.timbangan_akhir ?? 0).toFixed(2)} gr</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {status === 'aktif' && (
                    <>
                      <button onClick={() => { setEditItem(batch); setFormError('') }} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"><Edit2 size={14}/></button>
                      <button onClick={() => setLockModal(batch)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Lock size={14}/></button>
                    </>
                  )}
                  {status === 'terkunci' && ['owner','admin_pusat'].includes(userRole) && (
                    <button onClick={() => startTransition(async () => { await unlockBatch(batch.id, batch.kode); showToast('🔓 Batch dibuka') })}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Unlock size={14}/></button>
                  )}
                  {['owner','admin_pusat'].includes(userRole) && (
                    <button onClick={() => setDeleteModal(batch)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : batch.id)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                    {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </button>
                </div>
              </div>

              <div className="px-4 pb-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                </div>
                <p className="text-[10px] text-slate-400 text-right mt-0.5">{Math.round(pct)}% tersisa</p>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Berat Pusat',      value: `${(batch.bahan_dari_pusat??0).toFixed(2)} gr` },
                      { label: 'Timbangan Gudang', value: `${(batch.timbangan_akhir??0).toFixed(2)} gr` },
                      { label: 'HPP / gram',        value: formatRupiah(batch.hpp_gr??0) },
                      { label: 'Total HPP',         value: formatRupiah(batch.total_hpp??0) },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400">{item.label}</p>
                        <p className="text-sm font-bold text-slate-700 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-violet-700">Rekonsiliasi Bahan Baku</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-slate-400">Sisa Seharusnya</p>
                        <p className="font-bold text-slate-700">{sisaSeharusnya.toFixed(2)} gr</p>
                        <p className="text-[10px] text-violet-500">Otomatis</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Sisa Fisik (timbang)</p>
                        {sisaFisik !== null ? <p className="font-bold text-slate-700">{sisaFisik.toFixed(2)} gr</p> : <p className="text-xs text-slate-400 italic">Belum diisi</p>}
                        <p className="text-[10px] text-blue-500">Manual</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Loses</p>
                        {loses !== null
                          ? <p className={cn('font-bold', loses > 0 ? 'text-red-600' : 'text-emerald-600')}>{loses > 0 ? '+' : ''}{loses.toFixed(2)} gr</p>
                          : <p className="text-xs text-slate-400 italic">—</p>}
                        <p className="text-[10px] text-slate-400">Seharusnya − Fisik</p>
                      </div>
                    </div>

                    {status === 'aktif' && (
                      <>
                        {!isEditingSF ? (
                          <div className="space-y-2 pt-1">
                            {fotoSisaFisik.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Foto Sisa Fisik ({fotoSisaFisik.length})</p>
                                <div className="flex gap-2 flex-wrap">
                                  {fotoSisaFisik.map((url: string, i: number) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 block hover:opacity-80">
                                      <img src={url} alt="" className="w-full h-full object-cover"/>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            <button onClick={() => { setEditingSisaFisik(batch.id); setSisaFisikInput(p => ({...p, [batch.id]: String(sisaFisik ?? '')})) }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl">
                              <Edit2 size={11}/>{sisaFisik !== null ? 'Edit Sisa Fisik' : 'Input Sisa Fisik'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 border border-violet-200 rounded-xl p-3 bg-white">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-violet-700">Input Sisa Fisik</p>
                              <button onClick={() => { setEditingSisaFisik(null); setSisaFisikFotos(p => ({...p,[batch.id]:[]})); setSisaFisikPreviews(p => ({...p,[batch.id]:[]})) }}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X size={13}/></button>
                            </div>
                            <div className="flex gap-2">
                              <input type="number" step="0.01"
                                value={sisaFisikInput[batch.id] ?? ''}
                                onChange={e => setSisaFisikInput(p => ({...p,[batch.id]:e.target.value}))}
                                placeholder="Berat sisa fisik (gram)..."
                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400"/>
                              <button onClick={() => handleSisaFisik(batch)} disabled={uploadingSF[batch.id]}
                                className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0">
                                {uploadingSF[batch.id] ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Check size={13}/>}
                                {uploadingSF[batch.id] ? 'Menyimpan...' : 'Simpan'}
                              </button>
                            </div>
                            {(sisaFisikPreviews[batch.id] ?? []).length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {(sisaFisikPreviews[batch.id] ?? []).map((url, i) => (
                                  <div key={i} className="relative w-14 h-14">
                                    <img src={url} alt="" className="w-full h-full object-cover rounded-lg border-2 border-violet-300"/>
                                    <button type="button" onClick={() => { setSisaFisikFotos(p => ({...p,[batch.id]:(p[batch.id]??[]).filter((_,j)=>j!==i)})); setSisaFisikPreviews(p => ({...p,[batch.id]:(p[batch.id]??[]).filter((_,j)=>j!==i)})) }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
                              <ImageIcon size={12} className="text-slate-400"/>
                              <span className="text-xs text-slate-500">Tambah foto sisa fisik (boleh 1-1 atau sekaligus)</span>
                              <input type="file" accept="image/*" multiple className="hidden"
                                onChange={e => {
                                  const picked = Array.from(e.target.files ?? [])
                                  setSisaFisikFotos(p => ({...p,[batch.id]: [...(p[batch.id]??[]), ...picked].slice(0,10)}))
                                  setSisaFisikPreviews(prev => {
                                    const existing = prev[batch.id] ?? []
                                    const newUrls = picked.map(f => URL.createObjectURL(f))
                                    return {...prev, [batch.id]: [...existing, ...newUrls].slice(0,10)}
                                  })
                                  e.currentTarget.value = '' // reset agar bisa pilih 1-1
                                }}/>
                            </label>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {Array.isArray(batch.fotos) && batch.fotos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Foto Bukti ({batch.fotos.length})</p>
                      <div className="flex gap-2 flex-wrap">
                        {batch.fotos.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 block hover:opacity-90">
                            <img src={url} alt="" className="w-full h-full object-cover"/>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {batch.catatan && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      <p className="text-xs text-amber-700"><span className="font-semibold">Catatan:</span> {batch.catatan}</p>
                    </div>
                  )}
                </div>
              )}

              {editItem?.id === batch.id && (
                <div className="px-4 pb-4 border-t border-violet-100 pt-4">
                  <BatchForm initial={editItem} onSubmit={handleUpdate} onCancel={() => setEditItem(null)} isPending={isPending} error={formError} isEdit/>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lockModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-800">🔒 Kunci Batch?</h2>
            <p className="text-xs text-slate-500">Batch <span className="font-bold">{lockModal.kode}</span> akan dikunci.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLockModal(null)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button onClick={() => handleLock(lockModal)} disabled={isPending} className="px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-60">
                {isPending ? 'Memproses...' : 'Ya, Kunci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-red-600">⚠️ Hapus Batch?</h2>
            <p className="text-xs text-slate-500">Batch <span className="font-bold">{deleteModal.kode}</span> akan dihapus permanen dari tampilan.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button onClick={() => handleDelete(deleteModal)} disabled={isPending} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60">
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}