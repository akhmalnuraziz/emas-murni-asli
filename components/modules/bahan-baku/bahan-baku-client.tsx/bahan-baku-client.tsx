'use client'

import { useState, useTransition } from 'react'
import { Plus, Search, Lock, Unlock, ChevronDown, ChevronUp, Package, Calculator, X, Check, AlertTriangle, FileText } from 'lucide-react'
import { cn, formatRupiah, formatDate, formatGram } from '@/lib/utils'
import { createBatch, lockBatch, unlockBatch } from '@/app/(dashboard)/bahan-baku/actions'
import type { Batch, BiayaTambahan, UserRole } from '@/lib/types/database'

interface Props {
  batches: Batch[]
  userRole: UserRole
  userName: string
}

type FilterType = 'semua' | 'aktif' | 'terkunci'

function getBatchStatus(b: Batch) {
  if (b.voided_at) return 'terkunci'
  if (b.sisa_fisik !== null && b.sisa_fisik <= 0 && (b.timbangan_akhir ?? 0) > 0) return 'habis'
  return 'aktif'
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    habis: 'bg-slate-50 text-slate-500 border-slate-200',
    terkunci: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label: Record<string, string> = { aktif: 'Aktif', habis: 'Habis', terkunci: 'Terkunci' }
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider', map[status] ?? map.aktif)}>
      {label[status] ?? status}
    </span>
  )
}

export default function BahanBakuClient({ batches, userRole, userName }: Props) {
  const [filter, setFilter] = useState<FilterType>('semua')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [lockModal, setLockModal] = useState<Batch | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState({ tanggal: new Date().toISOString().split('T')[0], supplier: '', bahan_dari_pusat: '', timbangan_akhir: '', harga_beli: '', catatan: '' })
  const [biayaTbh, setBiayaTbh] = useState<BiayaTambahan[]>([])
  const [formError, setFormError] = useState('')

  const canLock = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canUnlock = ['owner', 'admin_pusat'].includes(userRole)
  const canCreate = ['owner', 'admin_pusat', 'spv', 'operator_produksi', 'gudang'].includes(userRole)

  const beratGudang = parseFloat(formData.timbangan_akhir) || 0
  const hargaBeli = parseFloat(formData.harga_beli) || 0
  const totalBiaya = biayaTbh.reduce((s, b) => s + (b.jumlah || 0), 0)
  const totalHpp = hargaBeli + totalBiaya
  const hppPerGram = beratGudang > 0 ? totalHpp / beratGudang : 0
  const selisih = (parseFloat(formData.bahan_dari_pusat) || 0) - beratGudang

  const filtered = batches.filter(b => {
    const status = getBatchStatus(b)
    if (filter === 'aktif' && status !== 'aktif') return false
    if (filter === 'terkunci' && status !== 'terkunci') return false
    if (search) {
      const q = search.toLowerCase()
      return b.kode.toLowerCase().includes(q) || (b.supplier ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formData.timbangan_akhir || !formData.harga_beli) { setFormError('Berat gudang dan harga beli wajib diisi'); return }
    const fd = new FormData()
    Object.entries(formData).forEach(([k, v]) => fd.set(k, v))
    fd.set('biaya_tbh', JSON.stringify(biayaTbh))
    startTransition(async () => {
      const result = await createBatch(fd)
      if (result.error) { setFormError(result.error) }
      else {
        setShowForm(false)
        setFormData({ tanggal: new Date().toISOString().split('T')[0], supplier: '', bahan_dari_pusat: '', timbangan_akhir: '', harga_beli: '', catatan: '' })
        setBiayaTbh([])
        showToast(`Batch ${result.kode} berhasil didaftarkan`, 'success')
      }
    })
  }

  const handleLock = (batch: Batch) => {
    startTransition(async () => {
      const result = await lockBatch(batch.id, batch.kode)
      if (result.error) showToast(result.error, 'error')
      else showToast(`Batch ${batch.kode} berhasil dikunci`, 'success')
      setLockModal(null)
    })
  }

  const handleUnlock = (batch: Batch) => {
    startTransition(async () => {
      const result = await unlockBatch(batch.id, batch.kode)
      if (result.error) showToast(result.error, 'error')
      else showToast(`Batch ${batch.kode} berhasil dibuka`, 'success')
    })
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')}>
          {toast.type === 'success' ? <Check size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {(['semua','aktif','terkunci'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all',
                filter === f ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>
              {f === 'semua' ? 'Semua Batch' : f === 'aktif' ? 'Aktif' : '🔒 Terkunci'}
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={15}/> Registrasi Batch Baru
          </button>
        )}
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nomor batch, supplier, catatan..."
          className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
      </div>
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-violet-50">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-violet-600"/>
              <span className="font-bold text-slate-800 text-sm">Formulir Registrasi Logam Mulia Masuk</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'tanggal', label: 'Tanggal', type: 'date' },
                { key: 'supplier', label: 'Supplier / Sumber', type: 'text', placeholder: 'Nama supplier' },
                { key: 'bahan_dari_pusat', label: 'Berat Pusat / Surat (gram)', type: 'number', placeholder: '1000.00' },
                { key: 'timbangan_akhir', label: 'Berat Gudang (gram) *', type: 'number', placeholder: '999.50' },
                { key: 'harga_beli', label: 'Harga Beli (IDR) *', type: 'number', placeholder: 'Total transaksi' },
                { key: 'catatan', label: 'Catatan', type: 'text', placeholder: 'Purity, kode garansi...' },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{f.label}</label>
                  <input type={f.type} step={f.type === 'number' ? '0.01' : undefined}
                    value={(formData as any)[f.key]} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={(f as any).placeholder}
                    className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Calculator size={12}/> Biaya Tambahan</label>
                <button type="button" onClick={() => setBiayaTbh(p => [...p, { nama: '', jumlah: 0 }])}
                  className="text-xs text-violet-600 font-semibold flex items-center gap-1"><Plus size={12}/> Tambah</button>
              </div>
              {biayaTbh.map((b, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={b.nama} onChange={e => setBiayaTbh(p => p.map((x,j) => j===i ? {...x,nama:e.target.value} : x))}
                    placeholder="Nama biaya" className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
                  <input type="number" value={b.jumlah||''} onChange={e => setBiayaTbh(p => p.map((x,j) => j===i ? {...x,jumlah:parseFloat(e.target.value)||0} : x))}
                    placeholder="IDR" className="w-36 h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400"/>
                  <button type="button" onClick={() => setBiayaTbh(p => p.filter((_,j) => j!==i))}
                    className="h-9 w-9 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl"><X size={14}/></button>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-violet-50 rounded-xl border border-violet-100">
              <div><p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Total HPP</p><p className="font-bold text-violet-700">{formatRupiah(totalHpp)}</p></div>
              <div><p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">HPP/Gram</p><p className="font-bold text-violet-700">{formatRupiah(hppPerGram)}/gr</p></div>
              <div><p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Selisih</p><p className={cn('font-bold', selisih > 0.5 ? 'text-red-600' : 'text-emerald-600')}>{selisih > 0 ? '+' : ''}{selisih.toFixed(2)} gr</p></div>
              <div><p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Status</p><p className={cn('text-sm font-bold', selisih > 0.5 ? 'text-red-600' : 'text-emerald-600')}>{selisih > 0.5 ? '⚠ Perlu Cek' : '✓ Sesuai'}</p></div>
            </div>
            {formError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2"><AlertTriangle size={14}/>{formError}</div>}
            <div className="flex gap-3 mt-4 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button type="submit" disabled={isPending} className="px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
                {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Check size={14}/>}
                Simpan & Rekonsiliasi
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Package size={32} className="text-slate-300 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm">Belum ada data batch</p>
          </div>
        ) : filtered.map(batch => {
          const status = getBatchStatus(batch)
          const isExpanded = expandedId === batch.id
          const sisaPercent = batch.timbangan_akhir ? Math.min(((batch.sisa_fisik ?? 0) / batch.timbangan_akhir) * 100, 100) : 0
          return (
            <div key={batch.id} className={cn('bg-white rounded-2xl border transition-all', status === 'terkunci' ? 'border-amber-100' : 'border-slate-100')}>
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : batch.id)}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0',
                  status === 'terkunci' ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600')}>AU</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{batch.kode}</span>
                    <StatusBadge status={status}/>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(batch.tanggal)}{batch.supplier && ` · ${batch.supplier}`}</p>
                </div>
                <div className="text-right hidden sm:block flex-shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sisa Bahan Baku</p>
                  <p className="text-sm font-bold text-slate-700">{formatGram(batch.sisa_fisik)} <span className="text-slate-400 font-normal text-xs">/ {formatGram(batch.timbangan_akhir)}</span></p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {status === 'aktif' && canLock && (
                    <button onClick={e => { e.stopPropagation(); setLockModal(batch) }}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl"><Lock size={14}/></button>
                  )}
                  {status === 'terkunci' && canUnlock && (
                    <button onClick={e => { e.stopPropagation(); handleUnlock(batch) }}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"><Unlock size={14}/></button>
                  )}
                  {isExpanded ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
                </div>
              </div>
              <div className="px-5 pb-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', sisaPercent > 50 ? 'bg-violet-400' : sisaPercent > 20 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${sisaPercent}%` }}/>
                </div>
              </div>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Berat Pusat', value: formatGram(batch.bahan_dari_pusat) },
                      { label: 'Berat Gudang', value: formatGram(batch.timbangan_akhir) },
                      { label: 'Harga Beli', value: formatRupiah(batch.harga_beli ?? 0) },
                      { label: 'HPP / Gram', value: formatRupiah(batch.hpp_gr ?? 0), highlight: true },
                    ].map(item => (
                      <div key={item.label} className={cn('rounded-xl p-3', item.highlight ? 'bg-violet-50 border border-violet-100' : 'bg-slate-50')}>
                        <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', item.highlight ? 'text-violet-400' : 'text-slate-400')}>{item.label}</p>
                        <p className={cn('font-bold', item.highlight ? 'text-violet-700' : 'text-slate-700')}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {batch.catatan && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                      <FileText size={13} className="mt-0.5 flex-shrink-0"/>{batch.catatan}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {lockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Lock size={18} className="text-amber-600"/></div>
              <div><h3 className="font-bold text-slate-800">Kunci & Tutup Batch Produksi</h3></div>
            </div>
            <p className="text-sm text-slate-600 mb-4">Apakah Anda yakin ingin mengunci batch <span className="font-bold text-violet-600">{lockModal.kode}</span>?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
              ⚠️ Setelah dikunci, batch ini tidak akan bisa digunakan untuk input produksi baru. Memerlukan approval Owner untuk dibuka kembali.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setLockModal(null)} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button onClick={() => handleLock(lockModal)} disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60">
                {isPending ? 'Memproses...' : 'Ya, Kunci Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}