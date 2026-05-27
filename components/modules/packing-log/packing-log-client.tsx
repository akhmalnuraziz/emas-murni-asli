'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Plus, Search, Edit2, Trash2, Check, AlertTriangle,
  X, Camera, Printer, Package, ChevronDown, ChevronUp,
  CheckCircle
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createPacking, editPacking, deletePacking } from '@/app/(dashboard)/packing-log/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  packingList: any[]
  siapPackingItems: any[]
  userRole: UserRole
  userName: string
}

const today = new Date().toISOString().split('T')[0]
const inp = "w-full px-4 py-3 text-sm bg-white/80 border border-gray-200/70 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400"
const F = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 10)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        let { width: w, height: h } = img
        const max = 1200
        if (w > max || h > max) { const r = Math.min(max/w, max/h); w = Math.floor(w*r); h = Math.floor(h*r) }
        c.width = w; c.height = h; c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        let q = 0.8
        const tryQ = () => c.toBlob(blob => {
          if (!blob) { resolve(''); return }
          if (blob.size <= 250*1024 || q <= 0.3) { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(blob) }
          else { q -= 0.1; tryQ() }
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

function FotoPicker({ files, onAdd, onRemove }: { files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void }) {
  const [prev, setPrev] = useState<string[]>([])
  useEffect(() => {
    const u = files.map(f => URL.createObjectURL(f)); setPrev(u)
    return () => u.forEach(u => URL.revokeObjectURL(u))
  }, [files])
  return (
    <div className="space-y-2">
      {prev.length > 0 && <div className="flex gap-2 flex-wrap">{prev.map((u, i) => (
        <div key={i} className="relative w-14 h-14">
          <img src={u} className="w-full h-full object-cover rounded-xl border-2 border-violet-300"/>
          <button type="button" onClick={() => onRemove(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9}/></button>
        </div>
      ))}</div>}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40">
        <Camera size={13} className="text-violet-400"/>
        <span className="text-xs text-gray-400">{files.length > 0 ? `${files.length} foto — klik tambah` : 'Tambah foto packing'}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.currentTarget.value = '' }}/>
      </label>
      {files.length > 0 && <button type="button" onClick={() => onRemove(-1)} className="text-[11px] text-red-400 hover:underline">Hapus semua</button>}
    </div>
  )
}

// ─── Print Modal ──────────────────────────────────────────────────────────────
function PrintModal({ packing, onClose }: { packing: any; onClose: () => void }) {
  const produksi = packing.produksi_item
  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(0,0,0,0.15)' }}>
        {/* Print preview */}
        <div id="print-area" className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Packing Report</h1>
              <p className="text-sm text-gray-500">PT Emas Murni Asli</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-violet-600">{packing.kode}</p>
              <p className="text-xs text-gray-400">{formatDate(packing.tanggal)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-400 text-xs">Produksi</p><p className="font-semibold">{produksi?.kode ?? '-'}</p></div>
            <div><p className="text-gray-400 text-xs">Batch</p><p className="font-semibold">{packing.batch_kode}</p></div>
            <div><p className="text-gray-400 text-xs">Gramasi</p><p className="font-semibold">{packing.gramasi} gr</p></div>
            <div><p className="text-gray-400 text-xs">PCS Dipack</p><p className="font-semibold text-violet-600">{packing.pcs_dipack ?? packing.pcs} PCS</p></div>
            <div><p className="text-gray-400 text-xs">Total Gram</p><p className="font-semibold">{packing.total_gram_aktual ?? packing.total_gram} gr</p></div>
            <div><p className="text-gray-400 text-xs">Selisih</p>
              <p className={cn('font-semibold', (packing.selisih_gram ?? 0) === 0 ? 'text-green-600' : Math.abs(packing.selisih_gram ?? 0) <= 0.05 ? 'text-amber-500' : 'text-red-600')}>
                {(packing.selisih_gram ?? 0) === 0 ? 'Pas' : `${(packing.selisih_gram ?? 0) > 0 ? '+' : ''}${(packing.selisih_gram ?? 0).toFixed(3)} gr`}
              </p>
            </div>
            <div><p className="text-gray-400 text-xs">PIC</p><p className="font-semibold">{packing.pic_packing ?? packing.pic ?? '-'}</p></div>
            <div><p className="text-gray-400 text-xs">Shieldtag</p><p className="font-semibold">{packing.shieldtag_count ?? 0} terdaftar</p></div>
          </div>
          {packing.catatan && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Catatan: {packing.catatan}</p></div>}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            {['Dibuat oleh', 'Diperiksa oleh', 'Disetujui oleh'].map(label => (
              <div key={label} className="text-center">
                <div className="h-12 border-b border-gray-300 mb-1"/>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Tutup</button>
          <button onClick={handlePrint}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            <Printer size={15}/> Cetak
          </button>
        </div>
      </div>
      <style>{`@media print { body > *:not(#print-area) { display: none !important; } #print-area { display: block !important; } }`}</style>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({ items, onClose, onSubmit, isPending, error }: {
  items: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id?.toString() ?? '')
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const selectedItem = items.find(i => i.id.toString() === selectedId)
  const pcsGood = selectedItem?.pcs_good ?? selectedItem?.pcs ?? 0
  const pcsPacked = selectedItem?.pcs_packed ?? 0
  const pcsRemaining = pcsGood - pcsPacked

  async function submit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    setUploading(true); const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []; setUploading(false)
    const fd = new FormData(el); fd.set('fotos_b64', JSON.stringify(b64)); onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Catat Packing Baru</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <F label="Item Produksi (Siap Packing)" req>
            <select name="produksi_item_id" value={selectedId}
              onChange={e => setSelectedId(e.target.value)} className={inp} required>
              {items.map(item => {
                const remaining = (item.pcs_good ?? item.pcs ?? 0) - (item.pcs_packed ?? 0)
                return (
                  <option key={item.id} value={item.id.toString()}>
                    {item.nama_item || item.kode} — {item.gramasi}gr — {remaining} PCS sisa
                  </option>
                )
              })}
            </select>
          </F>
          {selectedItem && (
            <div className="bg-violet-50/60 rounded-2xl p-3 text-xs space-y-1">
              <p className="font-semibold text-violet-700">{selectedItem.nama_item || selectedItem.kode}</p>
              <p className="text-gray-500">Batch: {selectedItem.batch_kode} · {selectedItem.gramasi}gr</p>
              <p className="text-violet-600 font-semibold">Sisa belum dipack: <span className="text-lg font-bold">{pcsRemaining}</span> PCS</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label={`PCS Dipack (max ${pcsRemaining})`} req>
              <input name="pcs_dipack" type="number" min="1" max={pcsRemaining}
                className={inp} placeholder={`Max ${pcsRemaining}`} required/>
            </F>
            <F label="Total Gram Aktual" req>
              <input name="total_gram_aktual" type="number" step="0.001"
                className={inp} placeholder="gram aktual" required/>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal" req>
              <input name="tanggal" type="date" defaultValue={today} className={inp} required/>
            </F>
            <F label="PIC / Operator">
              <input name="pic" className={inp} placeholder="Nama PIC"/>
            </F>
          </div>
          <F label="Catatan">
            <input name="catatan" className={inp} placeholder="Keterangan..."/>
          </F>
          <F label="Foto (opsional)">
            <FotoPicker files={fotos}
              onAdd={f => setFotos(p => [...p, ...f].slice(0, 10))}
              onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))}/>
          </F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || uploading}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
              {(isPending || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading ? 'Upload...' : isPending ? 'Menyimpan...' : 'Simpan Packing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ packing, onClose, onSubmit, isPending, error }: {
  packing: any; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [f, setF] = useState({
    pcs_dipack: String(packing.pcs_dipack ?? packing.pcs ?? ''),
    total_gram_aktual: String(packing.total_gram_aktual ?? packing.total_gram ?? ''),
    pic: packing.pic_packing ?? packing.pic ?? '',
    catatan: packing.catatan ?? '',
  })
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true); const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []; setUploading(false)
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.set(k, v))
    fd.set('fotos_b64', JSON.stringify(b64))
    fd.set('existing_fotos', JSON.stringify(packing.fotos ?? []))
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Packing</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">{packing.kode}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="PCS Dipack" req>
              <input type="number" min="1" value={f.pcs_dipack} onChange={e => s('pcs_dipack', e.target.value)} className={inp}/>
            </F>
            <F label="Total Gram Aktual" req>
              <input type="number" step="0.001" value={f.total_gram_aktual} onChange={e => s('total_gram_aktual', e.target.value)} className={inp}/>
            </F>
          </div>
          <F label="PIC / Operator">
            <input value={f.pic} onChange={e => s('pic', e.target.value)} className={inp}/>
          </F>
          <F label="Catatan">
            <input value={f.catatan} onChange={e => s('catatan', e.target.value)} className={inp}/>
          </F>
          <F label="Tambah Foto">
            <FotoPicker files={fotos}
              onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))}
              onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))}/>
          </F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14}/>{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || uploading}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl disabled:opacity-60 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {(isPending || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading ? 'Upload...' : isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DelModal({ packing, onClose, onConfirm, isPending }: { packing: any; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-6 text-center"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px)', boxShadow: '0 32px 64px rgba(239,68,68,0.15)' }}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500"/></div>
        <h2 className="text-lg font-bold text-gray-900">Hapus Packing?</h2>
        <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{packing.kode}</span> akan dihapus.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PackingLogClient({ packingList, siapPackingItems, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | 'print' | null>(null)
  const [active, setActive] = useState<any | null>(null)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }
  const canEdit = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canDelete = ['owner', 'admin_pusat'].includes(userRole)

  const filtered = packingList.filter(p => {
    const q = search.toLowerCase()
    return !q || p.kode?.toLowerCase().includes(q) || p.batch_kode?.toLowerCase().includes(q) ||
      p.produksi_item?.kode?.toLowerCase().includes(q) || p.pic_packing?.toLowerCase().includes(q)
  })

  const totalPcs = filtered.reduce((s, p) => s + (p.pcs_dipack ?? p.pcs ?? 0), 0)
  const totalGram = filtered.reduce((s, p) => s + parseFloat(p.total_gram_aktual ?? p.total_gram ?? 0), 0)

  function handleCreate(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const r = await createPacking(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`✅ ${r?.kode} berhasil dicatat`); setModal(null)
    })
  }
  function handleEdit(fd: FormData) {
    if (!active) return; setErr('')
    startTransition(async () => {
      const r = await editPacking(active.id, active.kode, fd)
      if (r?.error) { setErr(r.error); return }
      showToast('✅ Packing diperbarui'); setModal(null)
    })
  }
  function handleDelete() {
    if (!active) return
    startTransition(async () => {
      const r = await deletePacking(active.id, active.kode)
      if (r?.error) { showToast(r.error, false); return }
      showToast('🗑️ Packing dihapus'); setModal(null)
    })
  }

  const getSelisihLabel = (selisih: number | null | undefined) => {
    const s = selisih ?? 0
    if (Math.abs(s) < 0.001) return { text: 'Pas', color: 'text-green-600', bg: 'rgba(34,197,94,0.1)' }
    if (Math.abs(s) <= 0.05) return { text: `${s > 0 ? '+' : ''}${s.toFixed(3)} gr`, color: 'text-amber-500', bg: 'rgba(234,179,8,0.1)' }
    return { text: `${s > 0 ? '+' : ''}${s.toFixed(3)} gr`, color: 'text-red-500', bg: 'rgba(239,68,68,0.1)' }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)' }}>
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',
          toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827', fontFamily: "'SF Pro Display','Inter',sans-serif" }}>Packing Log</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">Catat barang yang sudah di-packing. Status produksi otomatis terupdate.</p>
          </div>
          {canEdit && (
            <button onClick={() => { setActive(null); setErr(''); setModal('create') }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}>
              <Plus size={15}/> Catat Packing
            </button>
          )}
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode, batch, PIC..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(209,213,219,0.6)' }}/>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Records', value: String(filtered.length), color: '#7C3AED' },
            { label: 'Total Dipack', value: `${totalPcs} PCS`, color: '#16A34A' },
            { label: 'Total Gram', value: `${totalGram.toFixed(2)} gr`, color: '#2563EB' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">{item.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-3xl overflow-x-auto"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 40px rgba(139,92,246,0.08)' }}>
          <table className="w-full min-w-[900px]">
            <thead>
              <tr style={{ background: 'rgba(249,250,251,0.6)', borderBottom: '1px solid rgba(243,244,246,0.9)' }}>
                {['KODE','ITEM','TANGGAL','BATCH','GRAMASI','DIPACK','TOTAL GRAM','SELISIH','PIC','SHIELDTAG','AKSI'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-bold text-gray-400 tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16">
                  <Package size={28} className="text-violet-200 mx-auto mb-3"/>
                  <p className="text-sm text-gray-400">Belum ada data packing</p>
                </td></tr>
              ) : filtered.map((p, idx) => {
                const selisih = getSelisihLabel(p.selisih_gram)
                const shieldtag = p.shieldtag_count ?? 0
                const pcsExpected = p.pcs_dipack ?? p.pcs ?? 0
                const stColor = shieldtag >= pcsExpected ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)'
                const stTextColor = shieldtag >= pcsExpected ? '#16A34A' : '#EA580C'
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50/40 transition-colors"
                    style={{ borderColor: 'rgba(243,244,246,0.7)' }}>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-violet-600">{p.kode}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-blue-500">{p.produksi_item?.kode ?? p.produksi_item_id}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>{p.batch_kode}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', color: '#CA8A04' }}>{p.gramasi} gr</span>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-green-600">{pcsExpected} pcs</td>
                    <td className="px-4 py-4 text-sm font-semibold text-blue-600">{parseFloat(p.total_gram_aktual ?? p.total_gram ?? 0).toFixed(2)} gr</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: selisih.bg, color: selisih.color }}>{selisih.text}</span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-700">{p.pic_packing ?? p.pic ?? '—'}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: stColor, color: stTextColor }}>
                        {shieldtag}/{pcsExpected} terdaftar
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setActive(p); setModal('print') }}
                          className="w-8 h-8 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center hover:scale-110 hover:bg-violet-100 transition-all" title="Print">
                          <Printer size={13}/>
                        </button>
                        {canEdit && (
                          <button onClick={() => { setActive(p); setErr(''); setModal('edit') }}
                            className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:scale-110 hover:bg-blue-100 transition-all" title="Edit">
                            <Edit2 size={13}/>
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => { setActive(p); setModal('delete') }}
                            className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:scale-110 hover:bg-red-100 transition-all" title="Hapus">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && (
        <CreateModal items={siapPackingItems} onClose={() => setModal(null)}
          onSubmit={handleCreate} isPending={isPending} error={err}/>
      )}
      {modal === 'edit' && active && (
        <EditModal packing={active} onClose={() => setModal(null)}
          onSubmit={handleEdit} isPending={isPending} error={err}/>
      )}
      {modal === 'delete' && active && (
        <DelModal packing={active} onClose={() => setModal(null)}
          onConfirm={handleDelete} isPending={isPending}/>
      )}
      {modal === 'print' && active && (
        <PrintModal packing={active} onClose={() => setModal(null)}/>
      )}
    </div>
  )
}
