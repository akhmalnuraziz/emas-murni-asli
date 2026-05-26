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

// ─── Status Config ────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  shieldtags: any[]
  packings: any[]
  cabangList: any[]
  userRole: UserRole
  userName: string
}

type ModalType = 'register-range' | 'register-manual' | 'edit' | 'distribusi' | 'void' | null

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShieldtagClient({ shieldtags, packings, cabangList, userRole, userName }: Props) {
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [showHpp, setShowHpp]         = useState(false)
  const [activeModal, setActiveModal] = useState<{ type: ModalType; item?: any } | null>(null)
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

  const canSeeHpp = userRole === 'owner' || userRole === 'accounting'

  // ─── Toast Helper ─────────────────────────────────────────────────────────
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
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const statsData = {
    total:    shieldtags.length,
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

  // ─── Actions ──────────────────────────────────────────────────────────────
  function handleRegisterRange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!rangePreviewData || rangePreviewData.error) return
    setFormError('')
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await registerShieldtagRange({
        kodeAwal:   rangeStart.toUpperCase(),
        kodeAkhir:  rangeEnd.toUpperCase(),
        packingId:  Number(form.get('packing_id')),
        gramasi:    String(form.get('gramasi')),
        batchKode:  String(form.get('batch_kode')),
        createdBy:  userName,
      })
      if (res?.error) { setFormError(res.error); return }
      showToast(`✅ ${rangePreviewData.count} Shieldtag berhasil didaftarkan`)
      closeModal()
    })
  }

  function handleRegisterManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await registerShieldtagManual({
        kode:      String(form.get('kode')).toUpperCase(),
        gramasi:   String(form.get('gramasi')),
        batchKode: String(form.get('batch_kode')),
        hpp:       Number(form.get('hpp')),
        createdBy: userName,
      })
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Shieldtag manual berhasil didaftarkan')
      closeModal()
    })
  }

  function handleEditKode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editShieldtagKode({
        id:        activeModal!.item.id,
        kodeBaru:  String(form.get('kode_baru')).toUpperCase(),
        alasan:    String(form.get('alasan')),
        editedBy:  userName,
      })
      if (res?.error) { setFormError(res.error); return }
      showToast('✅ Kode Shieldtag berhasil diperbarui')
      closeModal()
    })
  }

  function handleDistribusi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedIds.length === 0) { setFormError('Pilih minimal 1 Shieldtag'); return }
    setFormError('')
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await distribusiShieldtag({
        ids:       selectedIds,
        cabangId:  Number(form.get('cabang_id')),
        catatan:   String(form.get('catatan') ?? ''),
        dikirimBy: userName,
      })
      if (res?.error) { setFormError(res.error); return }
      showToast(`✅ ${selectedIds.length} Shieldtag berhasil didistribusikan`)
      setSelectedIds([])
      closeModal()
    })
  }

  function handleVoid(id: number, alasan: string) {
    startTransition(async () => {
      const res = await voidShieldtag({ id, alasan, voidedBy: userName })
      if (res?.error) { showToast(res.error, 'error'); return }
      showToast('✅ Shieldtag berhasil di-VOID')
      closeModal()
    })
  }

  // ─── Checkbox Toggle ──────────────────────────────────────────────────────
  function toggleSelect(id: number) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // ─── Input Style ──────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white'
  const labelCls = 'text-xs font-semibold text-slate-600'
  const selectCls = inputCls

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-20">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all',
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
        <div className="flex gap-2">
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

      {/* ── Stats Cards ── BUG FIXED: hapus duplicate className, pakai cn() ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Shieldtag', value: statsData.total,     color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-100' },
          { label: 'Di Gudang',       value: statsData.aktif,     color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Terdistribusi',   value: statsData.distribusi, color: 'text-blue-700',  bg: 'bg-blue-50',    border: 'border-blue-100'   },
          { label: 'Terjual',         value: statsData.terjual,   color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-100' },
          { label: 'VOID',            value: statsData.void,      color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-100'    },
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
              {s === 'semua' ? `Semua (${statsData.total})` : s}
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

      {/* Shieldtag List */}
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
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox — hanya shieldtag Aktif */}
                {st.status === 'Aktif' && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(st.id)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                )}

                {/* Kode */}
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
                    {canSeeHpp && showHpp && st.hpp_per_gr && (
                      <span>HPP: <span className="font-semibold text-slate-600">{formatRupiah(st.hpp_per_gr)}/gr</span></span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {st.status === 'Aktif' && (
                    <button
                      onClick={() => setActiveModal({ type: 'edit', item: st })}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                      title="Edit kode"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {(st.status === 'Aktif' || st.status === 'Terdistribusi') && (userRole === 'owner' || userRole === 'admin_pusat') && (
                    <button
                      onClick={() => setActiveModal({ type: 'void', item: st })}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="VOID"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : st.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Expanded History */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 mt-1 pt-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <Clock size={11} /> Timeline Histori
                  </p>
                  <div className="space-y-2">
                    {[
                      st.created_at   && { label: 'Registrasi',   date: st.created_at,   by: st.created_by,   color: 'bg-violet-500' },
                      st.distribusi_at && { label: 'Distribusi',  date: st.distribusi_at, by: st.distribusi_by, color: 'bg-blue-500' },
                      st.terjual_at   && { label: 'Terjual',      date: st.terjual_at,   by: st.terjual_by,   color: 'bg-emerald-500' },
                      st.voided_at    && { label: 'VOID',          date: st.voided_at,    by: st.voided_by,    color: 'bg-red-500' },
                    ].filter(Boolean).map((ev: any, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', ev.color)} />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{ev.label}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(ev.date)} · oleh {ev.by ?? '—'}</p>
                        </div>
                      </div>
                    ))}
                    {st.void_reason && (
                      <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-1">
                        Alasan VOID: {st.void_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Register Range */}
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
                  className={cn(inputCls, 'font-mono tracking-widest uppercase')}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Kode Akhir</label>
                <input
                  value={rangeEnd}
                  onChange={e => { setRangeEnd(e.target.value.toUpperCase()); setRangePreviewData(null) }}
                  placeholder="1H80AT"
                  className={cn(inputCls, 'font-mono tracking-widest uppercase')}
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
                    <p className="font-mono text-slate-500">{rangePreviewData.preview.slice(0, 5).join(', ')}{rangePreviewData.count > 5 ? ` ... +${rangePreviewData.count - 5} lainnya` : ''}</p>
                  </>
                )}
              </div>
            )}

            {/* Pilih Packing & Info */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Packing / Surat Jalan</label>
              <select name="packing_id" className={selectCls} required>
                <option value="">-- Pilih Packing --</option>
                {packings.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.kode} · {p.gramasi} · {p.pcs} pcs · Batch {p.batch_kode}
                  </option>
                ))}
              </select>
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

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending || !rangePreviewData || !!rangePreviewData.error}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60 flex items-center gap-2"
              >
                <Tag size={14} />
                {isPending ? 'Mendaftarkan...' : `Daftarkan ${rangePreviewData?.count ?? 0} Shieldtag`}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* MODAL: Register Manual */}
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
              <label className={labelCls}>HPP per Gram (opsional)</label>
              <input name="hpp" type="number" step="0.01" placeholder="0" className={inputCls} />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60"
              >
                {isPending ? 'Mendaftarkan...' : 'Daftarkan'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* MODAL: Edit Kode */}
      {activeModal?.type === 'edit' && activeModal.item && (
        <ModalWrapper title="Edit Kode Shieldtag" onClose={closeModal}>
          <form onSubmit={handleEditKode} className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
              <p className="text-xs text-slate-500">Kode saat ini</p>
              <p className="font-mono font-bold text-violet-700 tracking-wider">{activeModal.item.kode}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Kode Baru</label>
              <input
                name="kode_baru"
                defaultValue={activeModal.item.kode}
                className={cn(inputCls, 'font-mono tracking-widest uppercase')}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Alasan Edit</label>
              <input name="alasan" placeholder="Stiker rusak / salah cetak..." className={inputCls} required />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60"
              >
                {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* MODAL: Distribusi */}
      {activeModal?.type === 'distribusi' && (
        <ModalWrapper title={`Distribusi ${selectedIds.length} Shieldtag`} onClose={closeModal}>
          <form onSubmit={handleDistribusi} className="space-y-4">
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold">
              {selectedIds.length} Shieldtag terpilih akan dikirim ke cabang
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Tujuan Cabang</label>
              <select name="cabang_id" className={selectCls} required>
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map(c => (
                  <option key={c.kode} value={c.kode}>{c.nama}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Catatan (opsional)</label>
              <input name="catatan" placeholder="Nomor surat jalan, nama ekspedisi..." className={inputCls} />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{formError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-2"
              >
                <Send size={14} />
                {isPending ? 'Memproses...' : `Kirim ${selectedIds.length} Shieldtag`}
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* MODAL: VOID */}
      {activeModal?.type === 'void' && activeModal.item && (
        <ModalWrapper title="VOID Shieldtag" onClose={closeModal}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-red-700 mb-1">⚠️ Konfirmasi VOID</p>
              <p className="text-xs text-red-600">
                Shieldtag <span className="font-mono font-bold">{activeModal.item.kode}</span> akan di-VOID
                dan tidak dapat digunakan lagi. Aksi ini tercatat di audit log.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Alasan VOID</label>
              <input
                id="void-alasan"
                placeholder="Stiker hilang, rusak, duplikat..."
                className={inputCls}
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl">
                Batal
              </button>
              <button
                onClick={() => {
                  const alasan = (document.getElementById('void-alasan') as HTMLInputElement)?.value ?? ''
                  if (!alasan.trim()) return
                  handleVoid(activeModal.item.id, alasan)
                }}
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

// ─── Modal Wrapper ────────────────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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