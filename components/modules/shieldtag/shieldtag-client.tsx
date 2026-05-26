'use client'

import { useState, useTransition } from 'react'
import {
  Search, Plus, Tag, Check, AlertTriangle, X,
  ChevronDown, ChevronUp, Shield, Eye, EyeOff,
  Trash2, Edit2, Send, Clock
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import {
  registerShieldtagRange,
  registerShieldtagManual,
  editShieldtagKode,
  distribusiShieldtag,
  voidShieldtag,
} from '@/app/(dashboard)/shieldtag/actions'
import { previewRange } from '@/lib/shieldtag-utils'
import type { UserRole } from '@/lib/types/database'

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Aktif':         { label: 'Aktif',         color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Terdistribusi': { label: 'Terdistribusi', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  'Terjual':       { label: 'Terjual',       color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200'  },
  'VOID':          { label: 'VOID',          color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Aktif']
  return (
    <span className={cn(
      'text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider',
      cfg.color, cfg.bg, cfg.border
    )}>
      {cfg.label}
    </span>
  )
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface Props {
  shieldtags: any[]
  packings: any[]
  cabangList: any[]
  userRole: UserRole
  userName: string
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ShieldtagClient({ shieldtags, packings, cabangList, userRole, userName }: Props) {
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [showHpp, setShowHpp]         = useState(false)
  const [activeModal, setActiveModal] = useState<{ type: string; item?: any } | null>(null)
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition]  = useTransition()
  const [formError, setFormError]     = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Range preview state
  const [rangeStart, setRangeStart]   = useState('')
  const [rangeEnd, setRangeEnd]       = useState('')
  const [rangePreviewData, setRangePreviewData] = useState<{
    count: number; preview: string[]; error?: string
  } | null>(null)

  // Edit state
  const [editKodeBaru, setEditKodeBaru] = useState('')
  const [editAlasan, setEditAlasan]     = useState('')

  // Void state
  const [voidAlasan, setVoidAlasan]   = useState('')

  const canSeeHpp = userRole === 'owner' || userRole === 'accounting'

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function closeModal() {
    setActiveModal(null)
    setFormError('')
    setRangeStart('')
    setRangeEnd('')
    setRangePreviewData(null)
    setEditKodeBaru('')
    setEditAlasan('')
    setVoidAlasan('')
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const statsData = {
    total:    shieldtags.filter(s => s.status !== 'VOID').length,
    aktif:    shieldtags.filter(s => s.status === 'Aktif').length,
    distribusi: shieldtags.filter(s => s.status === 'Terdistribusi').length,
    terjual:  shieldtags.filter(s => s.status === 'Terjual').length,
    void:     shieldtags.filter(s => s.status === 'VOID').length,
  }

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = shieldtags.filter(s => {
    const matchStatus = filterStatus === 'semua' || s.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q
      || s.kode?.toLowerCase().includes(q)
      || s.batch_kode?.toLowerCase().includes(q)
      || s.lokasi?.toLowerCase().includes(q)
      || s.gramasi?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ─── Range Preview ────────────────────────────────────────────────────────
  function handleRangePreview() {
    if (!rangeStart || !rangeEnd) return
    const result = previewRange(rangeStart.toUpperCase(), rangeEnd.toUpperCase())
    setRangePreviewData(result)
  }

  // ─── Action: Register Range (FormData) ───────────────────────────────────
  function handleRegisterRange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!rangePreviewData || rangePreviewData.error) return
    setFormError('')
    const form = e.currentTarget
    const fd = new FormData(form)
    // Field names sesuai actions.ts: start_code, end_code, packing_id
    fd.set('start_code', rangeStart.toUpperCase())
    fd.set('end_code', rangeEnd.toUpperCase())
    startTransition(async () => {
      const res = await registerShieldtagRange(fd)
      if (res?.error) { setFormError(res.error); return }
      showToast(`✅ ${rangePreviewData.count} Shieldtag berhasil didaftarkan`)
      closeModal()
    })
  }

  // ─── Action: Register Manual (FormData) ──────────────────────────────────
  function handleRegisterManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await registerShieldtagManual(fd)
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Shieldtag manual berhasil didaftarkan')
      closeModal()
    })
  }

  // ─── Action: Edit Kode (id, newKode, alasan) ─────────────────────────────
  function handleEditKode() {
    if (!editKodeBaru || !editAlasan) { setFormError('Kode baru dan alasan wajib diisi'); return }
    setFormError('')
    startTransition(async () => {
      const res = await editShieldtagKode(activeModal!.item.id, editKodeBaru.toUpperCase(), editAlasan)
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Kode Shieldtag berhasil diperbarui')
      closeModal()
    })
  }

  // ─── Action: Distribusi (ids[], cabangTujuan) ─────────────────────────────
  function handleDistribusi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedIds.length === 0) { setFormError('Pilih minimal 1 Shieldtag'); return }
    const fd = new FormData(e.currentTarget)
    const cabang = fd.get('cabang') as string
    if (!cabang) { setFormError('Cabang tujuan wajib dipilih'); return }
    setFormError('')
    startTransition(async () => {
      const res = await distribusiShieldtag(selectedIds, cabang)
      if (res?.error) { setFormError(res.error); return }
      showToast(`✅ ${selectedIds.length} Shieldtag berhasil didistribusikan ke ${cabang}`)
      setSelectedIds([])
      closeModal()
    })
  }

  // ─── Action: VOID (id, alasan) ───────────────────────────────────────────
  function handleVoid() {
    if (!voidAlasan.trim()) { setFormError('Alasan VOID wajib diisi'); return }
    setFormError('')
    startTransition(async () => {
      const res = await voidShieldtag(activeModal!.item.id, voidAlasan)
      if (res?.error) { showToast(res.error, 'error'); return }
      showToast('✅ Shieldtag berhasil di-VOID')
      closeModal()
    })
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white'
  const labelCls = 'text-xs font-semibold text-slate-600'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-20">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg',
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        )}>
          {toast.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield size={20} className="text-violet-600" />
            Shieldtag
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Registrasi, tracking & distribusi ID unik per PCS emas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setActiveModal({ type: 'distribusi' })}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              <Send size={14} />
              Distribusi ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => setActiveModal({ type: 'register-range' })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl"
          >
            <Plus size={14} />
            Daftar Range
          </button>
          <button
            onClick={() => setActiveModal({ type: 'register-manual' })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl"
          >
            <Tag size={14} />
            Manual
          </button>
        </div>
      </div>

      {/* Stats Cards — FIXED: single className via cn() */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Aktif',   value: statsData.total,    color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
          { label: 'Di Gudang',     value: statsData.aktif,    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Terdistribusi', value: statsData.distribusi, color: 'text-blue-700', bg: 'bg-blue-50',    border: 'border-blue-100'    },
          { label: 'Terjual',       value: statsData.terjual,  color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
          { label: 'VOID',          value: statsData.void,     color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl border p-4', s.bg, s.border)}>
            <p className={cn('text-2xl font-bold mb-0.5', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['semua', 'Aktif', 'Terdistribusi', 'Terjual', 'VOID'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                filterStatus === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
              )}
            >
              {s === 'semua' ? `Semua (${statsData.total + statsData.void})` : s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          {canSeeHpp && (
            <button
              onClick={() => setShowHpp(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl bg-white"
            >
              {showHpp ? <EyeOff size={13} /> : <Eye size={13} />}
              HPP
            </button>
          )}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode, batch, lokasi..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Shield size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Tidak ada Shieldtag ditemukan</p>
          </div>
        ) : filtered.map(st => {
          const isExpanded = expandedId === st.id
          const isSelected = selectedIds.includes(st.id)
          return (
            <div
              key={st.id}
              className={cn(
                'bg-white border rounded-2xl transition-all',
                isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {st.status === 'Aktif' && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(st.id)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-violet-700 tracking-wider">
                      {st.kode}
                    </span>
                    <StatusBadge status={st.status} />
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {st.gramasi}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex gap-3 flex-wrap">
                    <span>Batch: <span className="font-semibold text-slate-600">{st.batch_kode ?? '—'}</span></span>
                    <span>Lokasi: <span className="font-semibold text-slate-600">{st.lokasi ?? '—'}</span></span>
                    {canSeeHpp && showHpp && st.hpp && (
                      <span>HPP: <span className="font-semibold text-slate-600">{formatRupiah(st.hpp)}/gr</span></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {st.status === 'Aktif' && (
                    <button
                      onClick={() => { setActiveModal({ type: 'edit', item: st }); setEditKodeBaru(st.kode) }}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {['Aktif', 'Terdistribusi'].includes(st.status) &&
                    ['owner', 'admin_pusat'].includes(userRole) && (
                    <button
                      onClick={() => setActiveModal({ type: 'void', item: st })}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : st.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* History */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <Clock size={11} /> Timeline Histori
                  </p>
                  <div className="space-y-2">
                    {[
                      st.tgl_regis   && { label: 'Registrasi', date: st.tgl_regis,   by: st.registered_by, color: 'bg-violet-500' },
                      st.tgl_dist    && { label: 'Distribusi',  date: st.tgl_dist,    by: null,             color: 'bg-blue-500'   },
                      st.tgl_jual    && { label: 'Terjual',     date: st.tgl_jual,    by: null,             color: 'bg-emerald-500'},
                      st.voided_at   && { label: 'VOID',        date: st.voided_at,   by: null,             color: 'bg-red-500'    },
                    ].filter(Boolean).map((ev: any, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', ev.color)} />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{ev.label}</p>
                          <p className="text-[10px] text-slate-400">
                            {ev.date ? new Date(ev.date).toLocaleString('id-ID') : '—'}
                            {ev.by ? ` · oleh ${ev.by}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                    {st.void_reason && (
                      <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                        Alasan VOID: {st.void_reason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════ MODAL: Register Range ══ */}
      {activeModal?.type === 'register-range' && (
        <ModalWrapper title="Daftarkan Range Shieldtag" onClose={closeModal}>
          <form onSubmit={handleRegisterRange} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Kode Awal</label>
                <input
                  value={rangeStart}
                  onChange={e => { setRangeStart(e.target.value.toUpperCase()); setRangePreviewData(null) }}
                  placeholder="1H80AA"
                  className={cn(inputCls, 'font-mono tracking-widest')}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Kode Akhir</label>
                <input
                  value={rangeEnd}
                  onChange={e => { setRangeEnd(e.target.value.toUpperCase()); setRangePreviewData(null) }}
                  placeholder="1H80AT"
                  className={cn(inputCls, 'font-mono tracking-widest')}
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRangePreview}
              disabled={!rangeStart || !rangeEnd}
              className="w-full py-2 text-sm font-semibold border border-violet-300 text-violet-700 rounded-xl hover:bg-violet-50 disabled:opacity-50"
            >
              Preview Range
            </button>

            {rangePreviewData && (
              <div className={cn('rounded-xl p-3 text-xs', rangePreviewData.error ? 'bg-red-50 text-red-600' : 'bg-violet-50')}>
                {rangePreviewData.error ? (
                  <p>{rangePreviewData.error}</p>
                ) : (
                  <>
                    <p className="font-bold text-violet-700 mb-1">{rangePreviewData.count} kode akan didaftarkan</p>
                    <p className="font-mono text-slate-500 break-all">
                      {rangePreviewData.preview.slice(0, 6).join(', ')}
                      {rangePreviewData.count > 6 ? ` ... +${rangePreviewData.count - 6} lainnya` : ''}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Packing / Surat Jalan</label>
              <select name="packing_id" className={inputCls} required>
                <option value="">-- Pilih Packing --</option>
                {packings.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.kode} · {p.gramasi} · {p.pcs} pcs · Batch {p.batch_kode}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending || !rangePreviewData || !!rangePreviewData?.error}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2"
              >
                <Tag size={14} />
                {isPending ? 'Mendaftarkan...' : `Daftarkan ${rangePreviewData?.count ?? 0} Shieldtag`}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ═══════════════════════════════════════ MODAL: Register Manual ══ */}
      {activeModal?.type === 'register-manual' && (
        <ModalWrapper title="Daftarkan Shieldtag Manual" onClose={closeModal}>
          <form onSubmit={handleRegisterManual} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Kode Shieldtag</label>
              <input
                name="kode"
                placeholder="Contoh: 1H80AA"
                className={cn(inputCls, 'font-mono tracking-widest uppercase')}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Gramasi</label>
                <input name="gramasi" placeholder="1GR" className={inputCls} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Batch</label>
                <input name="batch_kode" placeholder="BATCH-001" className={inputCls} required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Packing (opsional)</label>
              <select name="packing_id" className={inputCls}>
                <option value="">-- Pilih Packing --</option>
                {packings.map(p => (
                  <option key={p.id} value={p.id}>{p.kode} · {p.gramasi}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>HPP per Gram (opsional)</label>
              <input name="hpp" type="number" step="0.01" placeholder="0" className={inputCls} />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60">
                {isPending ? 'Mendaftarkan...' : 'Daftarkan'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ═══════════════════════════════════════ MODAL: Edit Kode ══════════ */}
      {activeModal?.type === 'edit' && activeModal.item && (
        <ModalWrapper title="Edit Kode Shieldtag" onClose={closeModal}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">Kode saat ini</p>
              <p className="font-mono font-bold text-violet-700 tracking-wider">{activeModal.item.kode}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Kode Baru</label>
              <input
                value={editKodeBaru}
                onChange={e => setEditKodeBaru(e.target.value.toUpperCase())}
                placeholder="Masukkan kode baru..."
                className={cn(inputCls, 'font-mono tracking-widest')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Alasan Edit</label>
              <input
                value={editAlasan}
                onChange={e => setEditAlasan(e.target.value)}
                placeholder="Stiker rusak / salah cetak..."
                className={inputCls}
              />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button
                onClick={handleEditKode}
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ═══════════════════════════════════════ MODAL: Distribusi ════════ */}
      {activeModal?.type === 'distribusi' && (
        <ModalWrapper title={`Distribusi ${selectedIds.length} Shieldtag`} onClose={closeModal}>
          <form onSubmit={handleDistribusi} className="space-y-4">
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold">
              {selectedIds.length} Shieldtag terpilih akan dikirim ke cabang
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Tujuan Cabang</label>
              <select name="cabang" className={inputCls} required>
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map(c => (
                  <option key={c.kode} value={c.kode}>{c.nama}</option>
                ))}
              </select>
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button type="submit" disabled={isPending} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-2">
                <Send size={14} />
                {isPending ? 'Memproses...' : `Kirim ${selectedIds.length} Shieldtag`}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ═══════════════════════════════════════ MODAL: VOID ══════════════ */}
      {activeModal?.type === 'void' && activeModal.item && (
        <ModalWrapper title="VOID Shieldtag" onClose={closeModal}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-red-700 mb-1">⚠️ Konfirmasi VOID</p>
              <p className="text-xs text-red-600">
                Shieldtag <span className="font-mono font-bold">{activeModal.item.kode}</span> akan di-VOID dan tidak dapat digunakan lagi.
                Aksi ini tercatat di audit log.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Alasan VOID</label>
              <input
                value={voidAlasan}
                onChange={e => setVoidAlasan(e.target.value)}
                placeholder="Stiker hilang, rusak, duplikat..."
                className={inputCls}
              />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">Batal</button>
              <button
                onClick={handleVoid}
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 flex items-center gap-2"
              >
                <Trash2 size={14} />
                {isPending ? 'Memproses...' : 'Ya, VOID Shieldtag'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}

// ─── Modal Wrapper ──────────────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 max-h-[75vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}