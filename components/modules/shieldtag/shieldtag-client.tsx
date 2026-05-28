'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import {
  Plus, Search, X, Check, AlertTriangle, Tag,
  Edit2, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Shield
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { registerShieldtags, editShieldtagKode, voidShieldtag } from '@/app/(dashboard)/shieldtag/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  shieldtags: any[]
  packingsWithSlots: any[]
  userRole: UserRole
  userName: string
}


// ─── Client-side Range Algorithm (mirrors server) ────────────────────────────
const CHARSET_CLIENT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function incrementCode(code: string): string {
  const chars = code.toUpperCase().split('')
  let i = chars.length - 1
  while (i >= 0) {
    const idx = CHARSET_CLIENT.indexOf(chars[i])
    if (idx === -1) { i--; continue }
    if (idx < CHARSET_CLIENT.length - 1) { chars[i] = CHARSET_CLIENT[idx + 1]; return chars.join('') }
    else { chars[i] = CHARSET_CLIENT[0]; i-- }
  }
  return code
}

function generateRangeClient(start: string, end: string): { codes: string[]; error?: string } {
  const s = start.toUpperCase().trim()
  const e = end.toUpperCase().trim()
  if (!s || !e) return { codes: [] }
  const codes: string[] = []
  let current = s; let guard = 0
  codes.push(current)
  while (current !== e && guard < 5000) { current = incrementCode(current); codes.push(current); guard++ }
  if (guard >= 5000) return { codes: [], error: 'Range terlalu besar (max 5000 per range)' }
  return { codes }
}

const STATUS_CFG: Record<string,{bg:string;text:string;dot:string}> = {
  'Aktif':          {bg:'rgba(34,197,94,0.1)',   text:'#16A34A', dot:'#22C55E'},
  'Terdistribusi':  {bg:'rgba(59,130,246,0.1)',  text:'#2563EB', dot:'#3B82F6'},
  'Terjual':        {bg:'rgba(139,92,246,0.1)',  text:'#7C3AED', dot:'#8B5CF6'},
  'VOID':           {bg:'rgba(239,68,68,0.1)',   text:'#DC2626', dot:'#EF4444'},
}
const CAN_SEE_HPP: UserRole[] = ['admin_pusat']

const today = new Date().toISOString().split('T')[0]
const inp = "w-full px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400 bg-white/80 border border-gray-200/70"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Range Row ─────────────────────────────────────────────────────────────────
function RangeRow({ idx, start, end, onChange, onRemove, onPreview }: {
  idx: number
  start: string; end: string
  onChange: (start: string, end: string) => void
  onRemove: () => void
  onPreview: (start: string, end: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">{idx+1}.</span>
      <input value={start} onChange={e=>onChange(e.target.value.toUpperCase(),end)}
        placeholder="Kode awal (cth: 1H80AA)" className={cn(inp,'flex-1 font-mono text-xs')}/>
      <span className="text-gray-400 text-sm flex-shrink-0">→</span>
      <input value={end} onChange={e=>{onChange(start,e.target.value.toUpperCase());onPreview(start,e.target.value.toUpperCase())}}
        placeholder="Kode akhir (cth: 1H80AT)" className={cn(inp,'flex-1 font-mono text-xs')}/>
      {idx > 0 && (
        <button type="button" onClick={onRemove}
          className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 flex-shrink-0">
          <X size={13}/>
        </button>
      )}
    </div>
  )
}

// ─── Register Modal ────────────────────────────────────────────────────────────
function RegisterModal({ packings, onClose, onSubmit, isPending, error }: {
  packings: any[]; onClose: () => void
  onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [packingId, setPackingId] = useState(String(packings[0]?.id ?? ''))
  const selPacking = packings.find(p => p.id === parseInt(packingId))
  const [ranges, setRanges] = useState([{ start: '', end: '' }])
  const [preview, setPreview] = useState<string[]>([])
  const [previewCount, setPreviewCount] = useState(0)
  const [previewError, setPreviewError] = useState('')
  const [editMode, setEditMode] = useState(false) // true = edit individual codes
  const [editCodes, setEditCodes] = useState<string[]>([])
  const [tanggal, setTanggal] = useState(today)

  function updatePreview(newRanges: typeof ranges) {
    let all: string[] = []
    let err = ''
    for (const r of newRanges) {
      if (!r.start || !r.end) continue
      const result = generateRangeClient(r.start, r.end)
      if (result.error) { err = result.error; break }
      all = [...all, ...result.codes]
    }
    setPreview(all)
    setPreviewCount(all.length)
    setPreviewError(err)
    setEditCodes(all)
  }

  function setRange(i: number, start: string, end: string) {
    const newRanges = ranges.map((r, j) => j === i ? { start, end } : r)
    setRanges(newRanges)
    if (end) updatePreview(newRanges)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('packing_id', packingId)
    fd.set('tanggal', tanggal)
    if (editMode) {
      fd.set('codes_manual', JSON.stringify(editCodes.filter(Boolean)))
    } else {
      fd.set('ranges', JSON.stringify(ranges.filter(r => r.start && r.end)))
    }
    onSubmit(fd)
  }

  const overLimit = selPacking && previewCount > selPacking.pcs_tersisa

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-xl rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registrasi Shieldtag</h2>
            <p className="text-xs text-gray-400 mt-0.5">Input range kode dari stiker fisik vendor</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[78vh]">
          <F label="Packing Log" req>
            <select value={packingId} onChange={e=>setPackingId(e.target.value)} className={inp} required>
              {packings.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.kode} · {p.produksi_item?.nama_item||p.produksi_item?.kode||'—'} · {p.gramasi}gr · Sisa {p.pcs_tersisa} slot
                </option>
              ))}
            </select>
          </F>

          {selPacking && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-violet-600 font-medium"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Tag size={12}/>
              {selPacking.batch_kode} · {selPacking.gramasi}gr · {selPacking.pcs_dipack} PCS dipack ·
              <span className="font-bold">{selPacking.pcs_tersisa} slot Shieldtag tersisa</span>
            </div>
          )}

          <F label="Tanggal Registrasi" req>
            <input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className={inp} required/>
          </F>

          {/* Ranges */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">
                Range Kode Shieldtag
              </label>
              <button type="button" onClick={() => setRanges(p => [...p, { start: '', end: '' }])}
                className="text-xs text-violet-600 font-semibold hover:underline">+ Tambah range</button>
            </div>
            {ranges.map((r, i) => (
              <RangeRow key={i} idx={i} start={r.start} end={r.end}
                onChange={(s, e) => setRange(i, s, e)}
                onPreview={(s, e) => updatePreview(ranges.map((x, j) => j === i ? { start: s, end: e } : x))}
                onRemove={() => {
                  const newR = ranges.filter((_, j) => j !== i)
                  setRanges(newR)
                  updatePreview(newR)
                }}/>
            ))}
          </div>

          {/* Preview */}
          {previewCount > 0 && (
            <div className={cn('rounded-2xl p-4 space-y-2',
              overLimit ? 'border-2 border-red-200' : 'border border-violet-200/50')}
              style={{ background: overLimit ? 'rgba(239,68,68,0.04)' : 'rgba(139,92,246,0.04)' }}>
              <div className="flex items-center justify-between">
                <p className={cn('text-xs font-bold', overLimit ? 'text-red-600' : 'text-violet-700')}>
                  {previewCount} kode ter-generate
                  {overLimit && ` — melebihi sisa slot (${selPacking?.pcs_tersisa})`}
                </p>
                <button type="button" onClick={() => setEditMode(!editMode)}
                  className="text-xs text-violet-600 hover:underline font-semibold">
                  {editMode ? 'Kembali ke range' : 'Edit per kode'}
                </button>
              </div>

              {editMode ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                  {editCodes.map((code, i) => (
                    <input key={i} value={code}
                      onChange={e => setEditCodes(p => p.map((c, j) => j === i ? e.target.value.toUpperCase() : c))}
                      className="px-2 py-1.5 text-xs font-mono rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400 text-center"/>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {preview.slice(0, 50).map((code, i) => (
                    <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-white border border-violet-200 text-violet-700 font-semibold">
                      {code}
                    </span>
                  ))}
                  {preview.length > 50 && (
                    <span className="text-[11px] text-gray-400 self-center">+{preview.length - 50} lagi</span>
                  )}
                </div>
              )}
            </div>
          )}

          {previewError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
              <AlertTriangle size={14}/>{previewError}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
              <AlertTriangle size={14}/>{error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || overLimit || previewCount === 0}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
              {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isPending ? 'Menyimpan...' : `Daftarkan ${editMode ? editCodes.filter(Boolean).length : previewCount} Shieldtag`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Kode Modal ──────────────────────────────────────────────────────────
function EditKodeModal({ st, onClose, onSubmit, isPending, error }: {
  st: any; onClose: () => void; onSubmit: (newKode: string) => void; isPending: boolean; error: string
}) {
  const [kode, setKode] = useState(st.kode)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-6"
        style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Ganti Kode Shieldtag</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={15}/></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">Ganti kode jika stiker fisik rusak atau keliru input</p>
        <F label="Kode Shieldtag Baru" req>
          <input value={kode} onChange={e=>setKode(e.target.value.toUpperCase())}
            placeholder="Masukkan kode baru" className={cn(inp,'font-mono tracking-wider')} required/>
        </F>
        {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 mt-3"><AlertTriangle size={14}/>{error}</div>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={() => onSubmit(kode)} disabled={isPending || !kode}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ st, onClose, showHPP, userRole }: {
  st: any; onClose: () => void; showHPP: boolean; userRole: UserRole
}) {
  const cfg = STATUS_CFG[st.status] ?? STATUS_CFG['Aktif']
  const history: any[] = Array.isArray(st.shieldtag_history) ? st.shieldtag_history : []
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `${cfg.dot}15` }}>
              <Shield size={18} style={{ color: cfg.dot }}/>
            </div>
            <div>
              <p className="text-lg font-black font-mono tracking-wider text-gray-900">{st.kode}</p>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.text }}>{st.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15}/></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Batch', val: st.batch_kode },
              { label: 'Gramasi', val: `${st.gramasi} gr` },
              { label: 'Lokasi', val: st.lokasi || '—' },
              { label: 'Tgl Registrasi', val: formatDate(st.tgl_regis) },
              { label: 'Tgl Distribusi', val: st.tgl_dist ? formatDate(st.tgl_dist) : '—' },
              { label: 'Tgl Terjual', val: st.tgl_jual ? formatDate(st.tgl_jual) : '—' },
              { label: 'Harga Jual', val: st.harga_jual > 0 ? formatRupiah(st.harga_jual) : '—' },
              { label: 'Oleh', val: st.registered_by || '—' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl p-3"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(209,213,219,0.4)' }}>
                <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">{item.val}</p>
              </div>
            ))}
          </div>

          {/* HPP */}
          {CAN_SEE_HPP.includes(userRole) && (
            <div className="rounded-2xl p-3"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-[10px] text-gray-400 font-medium">HPP</p>
              <p className="text-sm font-bold text-violet-700 mt-0.5">
                {showHPP ? formatRupiah(st.hpp ?? 0) + '/gr' : '•••/gr'}
              </p>
            </div>
          )}

          {/* History */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">Riwayat</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Tidak ada riwayat</p>
            ) : (
              <div className="space-y-1">
                {history.map((h: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-violet-400 mt-1 flex-shrink-0"/>
                      {i < history.length-1 && <div className="w-0.5 flex-1 mt-0.5 bg-violet-200"/>}
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-semibold text-gray-700">{h.action}</p>
                      <p className="text-[11px] text-gray-400">{formatDate(h.tanggal)} · {h.oleh || '—'}</p>
                      {h.lokasi && <p className="text-[11px] text-gray-400">→ {h.lokasi}</p>}
                      {h.alasan && <p className="text-[11px] text-red-400">Alasan: {h.alasan}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ShieldtagClient({ shieldtags, packingsWithSlots, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<'register' | 'edit' | 'void' | null>(null)
  const [activeItem, setActiveItem] = useState<any | null>(null)
  const [detailItem, setDetailItem] = useState<any | null>(null)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showHPP, setShowHPP] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  const canRegister = ['owner', 'admin_pusat', 'spv', 'operator_produksi'].includes(userRole)
  const canVoid = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canEdit = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canSeeHPP = CAN_SEE_HPP.includes(userRole)

  const filtered = shieldtags.filter(st => {
    if (filterStatus !== 'Semua' && st.status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q || st.kode?.toLowerCase().includes(q) || st.batch_kode?.toLowerCase().includes(q)
  })

  const counts = shieldtags.reduce((a, st) => { a[st.status] = (a[st.status] ?? 0) + 1; return a }, {} as Record<string, number>)
  const tabs = ['Semua', 'Aktif', 'Terdistribusi', 'Terjual', 'VOID']

  function handleRegister(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const r = await registerShieldtags(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`✅ ${r?.count} Shieldtag berhasil didaftarkan`)
      setModal(null)
    })
  }

  function handleEditKode(newKode: string) {
    if (!activeItem) return
    setErr('')
    startTransition(async () => {
      const r = await editShieldtagKode(activeItem.id, newKode)
      if (r?.error) { setErr(r.error); return }
      showToast('✅ Kode Shieldtag diperbarui')
      setModal(null)
    })
  }

  function handleVoid() {
    if (!activeItem || !voidReason.trim()) return
    startTransition(async () => {
      const r = await voidShieldtag(activeItem.id, voidReason)
      if (r?.error) { showToast(r.error, false); return }
      showToast('🚫 Shieldtag di-VOID')
      setModal(null); setVoidReason('')
    })
  }

  return (
    <div className="min-h-screen pb-24"
      style={{ background: 'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)' }}>
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl',
          toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight"
              style={{ color: '#111827', fontFamily: "'SF Pro Display','Inter',sans-serif" }}>
              Shieldtag
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{shieldtags.length} shieldtag terdaftar</p>
          </div>
          <div className="flex items-center gap-2">
            {canSeeHPP && (
              <button onClick={() => setShowHPP(!showHPP)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all border"
                style={showHPP
                  ? { background: 'rgba(139,92,246,0.1)', color: '#7C3AED', borderColor: 'rgba(139,92,246,0.25)' }
                  : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', borderColor: 'rgba(209,213,219,0.5)' }}>
                {showHPP ? <Eye size={14}/> : <EyeOff size={14}/>}
                HPP
              </button>
            )}
            {canRegister && packingsWithSlots.length > 0 && (
              <button onClick={() => { setModal('register'); setErr('') }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}>
                <Plus size={15}/> Registrasi Shieldtag
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Aktif', val: counts['Aktif'] ?? 0, color: '#22C55E', bg: 'rgba(34,197,94,0.06)' },
            { label: 'Terdistribusi', val: counts['Terdistribusi'] ?? 0, color: '#3B82F6', bg: 'rgba(59,130,246,0.06)' },
            { label: 'Terjual', val: counts['Terjual'] ?? 0, color: '#8B5CF6', bg: 'rgba(139,92,246,0.06)' },
            { label: 'VOID', val: counts['VOID'] ?? 0, color: '#EF4444', bg: 'rgba(239,68,68,0.06)' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 text-center"
              style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.6)' }}>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-black mt-0.5"
                style={{ color: c.color, fontFamily: "'SF Pro Display','Inter',sans-serif" }}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode Shieldtag, batch..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
              style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(209,213,219,0.5)' }}/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => {
              const isAct = filterStatus === t
              const cfg = STATUS_CFG[t]
              const cnt = t === 'Semua' ? shieldtags.length : (counts[t] ?? 0)
              return (
                <button key={t} onClick={() => setFilterStatus(t)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={isAct
                    ? { background: cfg?.dot ?? 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: `0 4px 12px ${cfg?.dot ?? '#8B5CF6'}40` }
                    : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
                  {t} {cnt > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{ background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(107,114,128,0.12)' }}>{cnt}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl overflow-auto"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 40px rgba(139,92,246,0.08)' }}>
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b"
                style={{ borderColor: 'rgba(243,244,246,0.9)', background: 'rgba(249,250,251,0.6)' }}>
                {['KODE SHIELDTAG', 'BATCH', 'GRAMASI', 'STATUS', 'LOKASI', 'TGL REGIS', 'AKSI'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-bold text-gray-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(139,92,246,0.08)' }}>
                    <Tag size={28} className="text-violet-300"/>
                  </div>
                  <p className="text-sm font-medium text-gray-400">
                    {packingsWithSlots.length > 0 ? 'Belum ada Shieldtag terdaftar' : 'Semua Shieldtag sudah terdaftar'}
                  </p>
                  {packingsWithSlots.length > 0 && canRegister && (
                    <button onClick={() => { setModal('register'); setErr('') }}
                      className="mt-3 px-4 py-2 text-sm font-semibold text-violet-600 hover:underline">
                      Klik untuk registrasi →
                    </button>
                  )}
                </td></tr>
              ) : filtered.map((st, idx) => {
                const cfg = STATUS_CFG[st.status] ?? STATUS_CFG['Aktif']
                return (
                  <tr key={st.id}
                    className={cn('border-t transition-colors hover:bg-violet-50/20 cursor-pointer', idx === 0 ? 'border-transparent' : '')}
                    style={{ borderColor: 'rgba(243,244,246,0.7)' }}
                    onClick={() => setDetailItem(st)}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-black tracking-wider text-gray-900">{st.kode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-violet-700"
                        style={{ background: 'rgba(139,92,246,0.1)' }}>{st.batch_kode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-amber-700"
                        style={{ background: 'rgba(245,158,11,0.1)' }}>{st.gramasi} gr</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}>{st.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{st.lokasi || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(st.tgl_regis)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {canEdit && st.status === 'Aktif' && (
                          <button onClick={() => { setActiveItem(st); setErr(''); setModal('edit') }}
                            className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 hover:scale-110 transition-all"
                            title="Edit kode">
                            <Edit2 size={12}/>
                          </button>
                        )}
                        {canVoid && st.status !== 'VOID' && (
                          <button onClick={() => { setActiveItem(st); setVoidReason(''); setModal('void') }}
                            className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all"
                            title="VOID">
                            <Trash2 size={12}/>
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

      {/* Modals */}
      {modal === 'register' && packingsWithSlots.length > 0 && (
        <RegisterModal packings={packingsWithSlots} onClose={() => setModal(null)}
          onSubmit={handleRegister} isPending={isPending} error={err}/>
      )}
      {modal === 'edit' && activeItem && (
        <EditKodeModal st={activeItem} onClose={() => setModal(null)}
          onSubmit={handleEditKode} isPending={isPending} error={err}/>
      )}
      {modal === 'void' && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6"
            style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(239,68,68,0.15)' }}>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500"/>
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center">VOID Shieldtag?</h2>
            <p className="text-sm text-gray-500 text-center mt-1 mb-4">
              <span className="font-mono font-black text-gray-700">{activeItem.kode}</span> akan di-VOID dan tidak bisa digunakan.
            </p>
            <F label="Alasan VOID" req>
              <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                placeholder="Contoh: stiker rusak, hilang, dll" className={inp}/>
            </F>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
              <button onClick={handleVoid} disabled={isPending || !voidReason.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
                {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending ? 'Memproses...' : 'VOID'}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailItem && (
        <DetailDrawer st={detailItem} onClose={() => setDetailItem(null)}
          showHPP={showHPP} userRole={userRole}/>
      )}
    </div>
  )
}
