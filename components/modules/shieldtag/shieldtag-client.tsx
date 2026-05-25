'use client'

import { useState, useTransition } from 'react'
import { Search, Plus, Tag, Check, AlertTriangle, X, ChevronDown, ChevronUp, Shield, Eye, EyeOff, Trash2, Edit2, Send } from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { registerShieldtagRange, registerShieldtagManual, editShieldtagKode, distribusiShieldtag, voidShieldtag } from '@/app/(dashboard)/shieldtag/actions'
import { previewRange } from '@/lib/shieldtag-utils'
import type { UserRole } from '@/lib/types/database'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Aktif':          { label: 'Aktif',          color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Terdistribusi':  { label: 'Terdistribusi',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  'Terjual':        { label: 'Terjual',         color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  'VOID':           { label: 'VOID',            color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Aktif']
  return (
    <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider', cfg.color, cfg.bg, cfg.border)}>
      {cfg.label}
    </span>
  )
}

interface Props {
  shieldtags: any[]
  packings: any[]
  cabangList: any[]
  userRole: UserRole
  userName: string
}

export default function ShieldtagClient({ shieldtags, packings, cabangList, userRole, userName }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showHpp, setShowHpp] = useState(false)
  const [activeModal, setActiveModal] = useState<{ type: string; item?: any } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Range preview state
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [rangePreview, setRangePreview] = useState<{ count: number; preview: string[]; error?: string } | null>(null)

  // Range form: bisa multi-range
  const [ranges, setRanges] = useState<{ start: string; end: string; preview: any }[]>([{ start: '', end: '', preview: null }])

  const canRegister = ['owner', 'admin_pusat', 'spv', 'gudang', 'operator_produksi'].includes(userRole)
  const canVoid = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canDistribusi = ['owner', 'admin_pusat', 'spv', 'gudang'].includes(userRole)
  const canSeeHpp = ['owner', 'accounting'].includes(userRole)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000)
  }

  const filtered = shieldtags.filter(st => {
    if (filterStatus !== 'semua' && st.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return st.kode.toLowerCase().includes(q) ||
        (st.batch_kode ?? '').toLowerCase().includes(q) ||
        (st.gramasi ?? '').toLowerCase().includes(q) ||
        (st.lokasi ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const handleRangePreview = (idx: number, start: string, end: string) => {
    const newRanges = [...ranges]
    newRanges[idx] = { ...newRanges[idx], start, end }
    if (start && end) {
      const p = previewRange(start.toUpperCase(), end.toUpperCase())
      newRanges[idx].preview = p
    } else {
      newRanges[idx].preview = null
    }
    setRanges(newRanges)
  }

  const totalRangeCount = ranges.reduce((s, r) => s + (r.preview?.count ?? 0), 0)

  const handleRegisterRange = (packingId: number) => {
    setFormError('')
    for (const r of ranges) {
      if (!r.start || !r.end) { setFormError('Semua range wajib diisi'); return }
      if (r.preview?.error) { setFormError(r.preview.error); return }
    }
    startTransition(async () => {
      let successCount = 0
      for (const r of ranges) {
        const fd = new FormData()
        fd.set('packing_id', String(packingId))
        fd.set('start_code', r.start)
        fd.set('end_code', r.end)
        const result = await registerShieldtagRange(fd)
        if (result.error) { setFormError(result.error); return }
        successCount += result.count ?? 0
      }
      setActiveModal(null)
      setRanges([{ start: '', end: '', preview: null }])
      showToast(`${successCount} Shieldtag berhasil didaftarkan ✓`, 'success')
    })
  }

  const handleRegisterManual = (fd: FormData) => {
    setFormError('')
    startTransition(async () => {
      const r = await registerShieldtagManual(fd)
      if (r.error) setFormError(r.error)
      else { setActiveModal(null); showToast('Shieldtag berhasil didaftarkan ✓', 'success') }
    })
  }

  const handleEditKode = (id: number, newKode: string, alasan: string) => {
    if (!newKode || !alasan) { setFormError('Kode baru dan alasan wajib diisi'); return }
    startTransition(async () => {
      const r = await editShieldtagKode(id, newKode, alasan)
      if (r.error) setFormError(r.error)
      else { setActiveModal(null); showToast('Kode Shieldtag berhasil diperbarui ✓', 'success') }
    })
  }

  const handleDistribusi = (fd: FormData) => {
    if (selectedIds.length === 0) { setFormError('Pilih minimal 1 Shieldtag'); return }
    const cabang = fd.get('cabang') as string
    if (!cabang) { setFormError('Cabang tujuan wajib dipilih'); return }
    setFormError('')
    startTransition(async () => {
      const r = await distribusiShieldtag(selectedIds, cabang)
      if (r.error) setFormError(r.error)
      else {
        setActiveModal(null)
        setSelectedIds([])
        showToast(`${selectedIds.length} Shieldtag berhasil didistribusikan ke ${cabang} ✓`, 'success')
      }
    })
  }

  const handleVoid = (id: number, alasan: string) => {
    if (!alasan) { setFormError('Alasan VOID wajib diisi'); return }
    setFormError('')
    startTransition(async () => {
      const r = await voidShieldtag(id, alasan)
      if (r.error) setFormError(r.error)
      else { setActiveModal(null); showToast('Shieldtag berhasil di-VOID ✓', 'success') }
    })
  }

  const inputCls = "h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 focus:bg-white w-full"
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-widest"

  // Stats
  const statsData = {
    total: shieldtags.filter(s => s.status !== 'VOID').length,
    aktif: shieldtags.filter(s => s.status === 'Aktif').length,
    distribusi: shieldtags.filter(s => s.status === 'Terdistribusi').length,
    terjual: shieldtags.filter(s => s.status === 'Terjual').length,
    void: shieldtags.filter(s => s.status === 'VOID').length,
  }

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Aktif', value: statsData.total, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Di Gudang', value: statsData.aktif, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Terdistribusi', value: statsData.distribusi, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Terjual', value: statsData.terjual, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'VOID', value: statsData.void, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl border p-4', s.bg, s.border)}>
            <p className="text-2xl font-bold mb-0.5" style={{ color: s.color.replace('text-', '') }}
              className={s.color}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex gap-2 flex-wrap">
          {['semua', 'Aktif', 'Terdistribusi', 'Terjual', 'VOID'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                filterStatus === s ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}>
              {s === 'semua' ? `Semua (${shieldtags.length})` : s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && canDistribusi && (
            <button onClick={() => { setActiveModal({ type: 'distribusi' }); setFormError('') }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
              <Send size={14} /> Distribusi ({selectedIds.length})
            </button>
          )}
          {canRegister && (
            <button onClick={() => { setActiveModal({ type: 'register' }); setFormError(''); setRanges([{ start: '', end: '', preview: null }]) }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
              <Plus size={14} /> Registrasi Shieldtag
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode Shieldtag, batch, gramasi, lokasi..."
          className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-400" />
      </div>

      {/* HPP Toggle — hanya owner/accounting */}
      {canSeeHpp && (
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHpp(!showHpp)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {showHpp ? <EyeOff size={13} /> : <Eye size={13} />}
            {showHpp ? 'Sembunyikan HPP' : 'Tampilkan HPP'}
          </button>
        </div>
      )}

      {/* Shieldtag List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Shield size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Belum ada data Shieldtag</p>
          </div>
        ) : filtered.map(st => {
          const cfg = STATUS_CONFIG[st.status] ?? STATUS_CONFIG['Aktif']
          const isExpanded = expandedId === st.id
          const isSelected = selectedIds.includes(st.id)
          const history: any[] = st.shieldtag_history ?? []

          return (
            <div key={st.id} className={cn('bg-white rounded-2xl border transition-all',
              isSelected ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-100',
              st.status === 'VOID' && 'opacity-60')}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                {/* Checkbox untuk distribusi bulk */}
                {st.status === 'Aktif' && canDistribusi && (
                  <input type="checkbox" checked={isSelected}
                    onChange={e => setSelectedIds(p => e.target.checked ? [...p, st.id] : p.filter(i => i !== st.id))}
                    className="w-4 h-4 accent-violet-600 flex-shrink-0 cursor-pointer" />
                )}

                {/* Kode */}
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : st.id)}>
                  <Shield size={16} className="text-violet-600" />
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : st.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm font-mono">{st.kode}</span>
                    <StatusBadge status={st.status} />
                    <span className="text-xs text-slate-400">{st.gramasi}gr</span>
                  </div>
                  <div className="flex gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">📦 {st.batch_kode}</span>
                    <span className="text-[10px] text-slate-400">📍 {st.lokasi ?? 'Gudang Pusat'}</span>
                    <span className="text-[10px] text-slate-400">📅 {formatDate(st.tgl_regis)}</span>
                    {canSeeHpp && showHpp && st.hpp > 0 && (
                      <span className="text-[10px] text-violet-500 font-semibold">HPP: {formatRupiah(st.hpp)}/gr</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {st.status !== 'VOID' && canVoid && (
                    <>
                      <button onClick={() => { setActiveModal({ type: 'edit_kode', item: st }); setFormError('') }}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl" title="Edit Kode">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => { setActiveModal({ type: 'void', item: st }); setFormError('') }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl" title="VOID">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : st.id)}
                    className="p-2 text-slate-400">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Expanded History */}
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-slate-50 pt-4 space-y-3">
                  {/* Data utama */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Batch Asal', value: st.batch_kode ?? '-' },
                      { label: 'Gramasi', value: `${st.gramasi} gr` },
                      { label: 'Packing ID', value: st.packing_id ? `#${st.packing_id}` : '-' },
                      { label: 'Lokasi', value: st.lokasi ?? 'Gudang Pusat' },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                      </div>
                    ))}
                    {canSeeHpp && showHpp && (
                      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1">HPP</p>
                        <p className="text-sm font-semibold text-violet-700">{formatRupiah(st.hpp ?? 0)}/gr</p>
                      </div>
                    )}
                    {st.harga_jual > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Harga Jual</p>
                        <p className="text-sm font-semibold text-emerald-700">{formatRupiah(st.harga_jual)}</p>
                      </div>
                    )}
                  </div>

                  {/* History Timeline */}
                  {history.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Histori Shieldtag</p>
                      <div className="space-y-2">
                        {history.map((h: any, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                            <div className="flex-1 pb-2 border-b border-slate-50 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-violet-600">{h.action}</span>
                                <span className="text-xs text-slate-500">→ {h.lokasi}</span>
                              </div>
                              {h.detail && <p className="text-[10px] text-slate-400 mt-0.5">{h.detail}</p>}
                              <p className="text-[10px] text-slate-400">{formatDate(h.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== MODALS ===== */}

      {/* Register Modal */}
      {activeModal?.type === 'register' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-violet-50">
              <h3 className="font-bold text-slate-800">Registrasi Shieldtag</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Pilih Packing */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Packing Log <span className="text-red-500">*</span></label>
                <select id="packing-select" className={inputCls}>
                  <option value="">-- Pilih Packing Log --</option>
                  {packings.map(p => {
                    const sisa = (p.pcs_dipack ?? p.pcs ?? 0) - (p.shieldtag_count ?? 0)
                    return (
                      <option key={p.id} value={p.id}>
                        {p.kode} — {p.gramasi}gr — {p.pcs_dipack ?? p.pcs} PCS (Sisa: {sisa})
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Multi-Range Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Range Kode Shieldtag</label>
                  <button type="button" onClick={() => setRanges(p => [...p, { start: '', end: '', preview: null }])}
                    className="text-xs text-violet-600 font-semibold flex items-center gap-1">
                    <Plus size={12} /> Tambah Range
                  </button>
                </div>
                {ranges.map((r, i) => (
                  <div key={i} className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-500">Range {i + 1}</span>
                      {ranges.length > 1 && (
                        <button type="button" onClick={() => setRanges(p => p.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 ml-auto"><X size={12} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kode Awal</label>
                        <input className={inputCls} placeholder="Contoh: 1H80AA"
                          value={r.start} onChange={e => handleRangePreview(i, e.target.value, r.end)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kode Akhir</label>
                        <input className={inputCls} placeholder="Contoh: 1H80AT"
                          value={r.end} onChange={e => handleRangePreview(i, r.start, e.target.value)} />
                      </div>
                    </div>
                    {r.preview && !r.preview.error && (
                      <div className="mt-2 p-2 bg-violet-50 rounded-lg">
                        <p className="text-xs font-semibold text-violet-700">{r.preview.count} kode akan dibuat</p>
                        <p className="text-[10px] text-violet-500 font-mono mt-0.5">
                          {r.preview.preview.join(' · ')}
                        </p>
                      </div>
                    )}
                    {r.preview?.error && (
                      <p className="mt-2 text-xs text-red-600">{r.preview.error}</p>
                    )}
                  </div>
                ))}

                {totalRangeCount > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700">Total: {totalRangeCount} Shieldtag akan didaftarkan</p>
                  </div>
                )}
              </div>

              {/* Atau manual single */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Atau Tambah 1 Kode Manual</p>
                <form onSubmit={e => {
                  e.preventDefault()
                  const packingId = parseInt((document.getElementById('packing-select') as HTMLSelectElement)?.value ?? '0')
                  const fd = new FormData(e.target as HTMLFormElement)
                  fd.set('packing_id', String(packingId))
                  handleRegisterManual(fd)
                }} className="flex gap-2">
                  <input name="kode" className={inputCls} placeholder="Ketik kode manual, misal: 002BYG" />
                  <button type="submit" disabled={isPending}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold flex-shrink-0">
                    {isPending ? '...' : 'Tambah'}
                  </button>
                </form>
              </div>

              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button disabled={isPending || totalRangeCount === 0}
                  onClick={() => {
                    const packingId = parseInt((document.getElementById('packing-select') as HTMLSelectElement)?.value ?? '0')
                    handleRegisterRange(packingId)
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60">
                  {isPending ? 'Mendaftarkan...' : `Daftarkan ${totalRangeCount} Shieldtag`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Kode Modal */}
      {activeModal?.type === 'edit_kode' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Edit Kode Shieldtag</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
              Kode lama: <strong className="font-mono">{activeModal.item.kode}</strong><br />
              Gunakan fitur ini jika stiker fisik rusak dan perlu diganti dengan Shieldtag baru.
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Kode Shieldtag Baru <span className="text-red-500">*</span></label>
                <input id="new-kode" className={inputCls} placeholder="Ketik kode pengganti" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Alasan Penggantian <span className="text-red-500">*</span></label>
                <input id="alasan-edit" className={inputCls} placeholder="Stiker rusak, tidak terbaca, dll" />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button disabled={isPending} onClick={() => {
                  const newKode = (document.getElementById('new-kode') as HTMLInputElement)?.value ?? ''
                  const alasan = (document.getElementById('alasan-edit') as HTMLInputElement)?.value ?? ''
                  handleEditKode(activeModal.item.id, newKode, alasan)
                }} className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 rounded-xl disabled:opacity-60">
                  {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribusi Modal */}
      {activeModal?.type === 'distribusi' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Distribusi ke Cabang</h3>
              <button onClick={() => setActiveModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">{selectedIds.length} Shieldtag dipilih untuk distribusi</p>
            <form onSubmit={e => { e.preventDefault(); handleDistribusi(new FormData(e.target as HTMLFormElement)) }} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Cabang Tujuan <span className="text-red-500">*</span></label>
                <select name="cabang" required className={inputCls}>
                  <option value="">-- Pilih Cabang --</option>
                  {cabangList.map(c => <option key={c.kode} value={c.nama}>{c.nama}</option>)}
                  <option value="Shopee">Marketplace — Shopee</option>
                  <option value="TikTok Shop">Marketplace — TikTok Shop</option>
                  <option value="Raja Emas App">Marketplace — Raja Emas App</option>
                </select>
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
                  <Send size={14} />
                  {isPending ? 'Memproses...' : 'Distribusikan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOID Modal */}
      {activeModal?.type === 'void' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><Trash2 size={18} className="text-red-500" /></div>
              <div>
                <h3 className="font-bold text-slate-800">VOID Shieldtag</h3>
                <p className="text-xs text-slate-400 font-mono">{activeModal.item.kode}</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">
              ⚠️ Shieldtag yang di-VOID tidak bisa digunakan kembali. Pastikan tindakan ini disengaja.
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Alasan VOID <span className="text-red-500">*</span></label>
                <input id="alasan-void" className={inputCls}
                  placeholder="Stiker rusak, retur customer, dll" />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{formError}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
                <button disabled={isPending} onClick={() => {
                  const alasan = (document.getElementById('alasan-void') as HTMLInputElement)?.value ?? ''
                  handleVoid(activeModal.item.id, alasan)
                }} className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60">
                  {isPending ? 'Memproses...' : 'Ya, VOID Shieldtag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
