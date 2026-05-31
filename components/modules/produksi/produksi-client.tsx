// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, Pencil, Trash2, ChevronDown, Camera,
  X, AlertTriangle, Check, RefreshCw, Package, Flame,
  ImageIcon, ChevronRight
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi,
  editProduksi, deleteProduksi,
  editEvent, deleteEvent,
  leburReject, batalLeburReject,
  updateSisaFisikBatch,
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]
const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

const S: Record<string, { color: string; bg: string; label: string }> = {
  'Cutting':       { color: '#3B82F6', bg: '#EFF6FF', label: 'Cutting' },
  'Pas Berat':     { color: '#F59E0B', bg: '#FFFBEB', label: 'Pas Berat' },
  'Annealing':     { color: '#8B5CF6', bg: '#F5F3FF', label: 'Annealing' },
  'Siap Packing':  { color: '#10B981', bg: '#ECFDF5', label: 'Siap Packing' },
  'Sudah Packing': { color: '#059669', bg: '#D1FAE5', label: 'Sudah Packing' },
  'Reject':        { color: '#EF4444', bg: '#FEF2F2', label: 'Reject' },
}

function fgr(n: number | null | undefined, d = 3) {
  if (n == null || isNaN(n)) return '0'
  return n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d })
}

async function toB64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => new Promise<string>((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image(); const MAX = 1200
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        res(c.toDataURL('image/jpeg', 0.82).split(',')[1])
      }
      img.src = reader.result as string
    }
    reader.onerror = () => rej(new Error('read failed'))
    reader.readAsDataURL(f)
  })))
}

// ─── Small atoms ──────────────────────────────────────────────────────────────
function Pill({ status }: { status: string }) {
  const cfg = S[status] ?? { color: '#6B7280', bg: '#F3F4F6' }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ color: cfg.color, background: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {status}
    </span>
  )
}

function LB({ url, onClose }: { url: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={onClose}>
      <img src={url} className="max-w-[92vw] max-h-[88vh] object-contain rounded-2xl" />
      <button className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
        <X size={18} className="text-white" />
      </button>
    </div>, document.body)
}

// Sheet overlay wrapper
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-t-[28px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {children}
      </div>
    </div>, document.body)
}

const INP = "w-full h-11 px-3.5 bg-[#F2F2F7] rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all border-0"
const INP_SM = "w-full h-9 px-3 bg-[#F2F2F7] rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all"
function FL({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{req && <span className="text-violet-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

// ─── Event History (read-only) ────────────────────────────────────────────────
function EventHistory({ events, fallbackPcs }: { events: any[]; fallbackPcs?: number }) {
  const sorted = [...events].filter(e => !e.voided_at)
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  const [lb, setLb] = useState<string | null>(null)
  return (
    <div>
      {lb && <LB url={lb} onClose={() => setLb(null)} />}
      {sorted.map((ev, i) => {
        const cfg = S[ev.status] ?? { color: '#94A3B8', bg: '#F9FAFB' }
        const fotos: string[] = Array.isArray(ev.fotos) ? ev.fotos : []
        const serbukF: string[] = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
        const raw = (ev.berat_sebelumnya ?? 0) - (ev.total_gram ?? 0) - (ev.sisa_serbuk ?? 0)
        const isLebih = ev.status !== 'Reject' && raw < -0.001
        const diff = Math.abs(raw)
        return (
          <div key={ev.id ?? i} className="flex gap-3 py-2.5">
            <div className="flex flex-col items-center pt-0.5 flex-shrink-0" style={{ width: 12 }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
              {i < sorted.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: `${cfg.color}25` }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Pill status={ev.status} />
                <span className="text-[11px] text-gray-400">{formatDate(ev.tanggal)}</span>
                <span className="text-xs font-semibold text-gray-700">
                  {ev.status === 'Reject'
                    ? `−${fgr((ev.berat_sebelumnya ?? 0) - (ev.total_gram ?? 0))} gr`
                    : `${ev.total_gram} gr`}
                </span>
                {(() => {
                  if (ev.status === 'Reject')
                    return ev.pcs_reject_snapshot != null
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full text-red-600 bg-red-50 font-semibold">−{ev.pcs_reject_snapshot} pcs</span>
                      : null
                  const p = ev.pcs_good_snapshot ?? fallbackPcs
                  return p != null
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full text-gray-500 bg-gray-100 font-medium">{p} pcs</span>
                    : null
                })()}
                {Number(ev.sisa_serbuk) > 0 && <span className="text-[10px] text-violet-500">serbuk {ev.sisa_serbuk} gr</span>}
                {ev.status !== 'Reject' && diff > 0.001 && (
                  isLebih
                    ? <span className="text-[10px] font-semibold text-emerald-600">+{fgr(diff)} gr</span>
                    : <span className="text-[10px] font-medium text-orange-500">losses {fgr(diff)} gr</span>
                )}
              </div>
              {ev.catatan && <p className="text-[11px] text-gray-400 mt-0.5 italic">{ev.catatan}</p>}
              {(fotos.length > 0 || serbukF.length > 0) && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {fotos.map((u, fi) => (
                    <img key={fi} src={u} onClick={() => setLb(u)}
                      className="w-10 h-10 rounded-xl object-cover cursor-pointer" />
                  ))}
                  {serbukF.map((u, fi) => (
                    <div key={`s${fi}`} className="relative">
                      <img src={u} onClick={() => setLb(u)}
                        className="w-10 h-10 rounded-xl object-cover cursor-pointer border-2 border-violet-300" />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">S</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
      {sorted.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Belum ada riwayat proses</p>}
    </div>
  )
}

// ─── Update Modal (bottom sheet) ─────────────────────────────────────────────
function UpdateModal({ item, onClose, showToast }: {
  item: any; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const pcsGood = item.pcs_good ?? item.pcs ?? 0
  const gramasi = parseFloat(item.gramasi) || 0
  const expected = Math.round(pcsGood * gramasi * 1000) / 1000
  const [status, setStatus] = useState('Pas Berat')
  const [fotos, setFotos] = useState<File[]>([])
  const [fSerbuk, setFSerbuk] = useState<File[]>([])
  const [pend, start] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  // 3% losses confirm
  const [lossesConfirm, setLossesConfirm] = useState<{ pct: number; total: number; fd: FormData } | null>(null)
  const [reason, setReason] = useState('')
  const isReject = status === 'Reject'
  const hasSerbuk = status === 'Pas Berat' || status === 'Annealing'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    fd.set('is_reject', isReject ? '1' : '0')
    if (!isReject && fotos.length > 0) {
      setUploading(true)
      fd.set('fotos_b64', JSON.stringify(await toB64(fotos)))
      setUploading(false)
    }
    if (hasSerbuk && fSerbuk.length > 0) {
      setUploading(true)
      fd.set('fotos_sisa_serbuk_b64', JSON.stringify(await toB64(fSerbuk)))
      setUploading(false)
    }
    start(async () => {
      const r = await updateStatusProduksi(item.id, item.kode, fd)
      if (r?.requiresConfirmation) {
        setLossesConfirm({ pct: r.lossesPercent, total: r.totalLosses, fd })
        return
      }
      if (r?.error) { setErr(r.error); return }
      showToast('Status diperbarui ✓')
      onClose()
    })
  }

  function confirmLosses() {
    if (!lossesConfirm) return
    const fd = lossesConfirm.fd
    fd.set('override_reason', reason.trim() || 'Dikonfirmasi owner')
    start(async () => {
      const r = await updateStatusProduksi(item.id, item.kode, fd)
      if (r?.error) { setErr(r.error); return }
      showToast('Status diperbarui ✓')
      onClose()
    })
  }

  if (lossesConfirm) return (
    <Sheet onClose={onClose}>
      <div className="px-5 pt-2 pb-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Konfirmasi Losses Tinggi</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total losses</span><span className="font-bold text-red-600">{lossesConfirm.total} gr</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Persentase</span><span className="font-bold text-red-600">{lossesConfirm.pct}%</span></div>
          <p className="text-xs text-red-500 pt-1">Melebihi batas normal 3%. Wajib isi alasan.</p>
        </div>
        <FL label="Alasan" req>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Jelaskan penyebab losses tinggi..." className={`${INP} h-auto py-3 resize-none`} />
        </FL>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setLossesConfirm(null)} className="flex-1 h-12 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
          <button onClick={confirmLosses} disabled={!reason.trim() || pend}
            className="flex-1 h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
            {pend ? 'Menyimpan…' : 'Konfirmasi & Simpan'}
          </button>
        </div>
      </div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Update Status</h2>
          <p className="text-xs text-violet-500 font-semibold">{item.kode} · {item.gramasi} gr × {pcsGood} pcs</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <X size={15} className="text-gray-500" />
        </button>
      </div>

      {/* Context bar */}
      <div className="mx-5 mb-4 rounded-2xl overflow-hidden flex-shrink-0"
        style={{ background: '#F5F3FF' }}>
        <div className="grid grid-cols-3 divide-x divide-violet-100">
          {[
            { label: 'PCS Good', val: `${pcsGood} pcs` },
            { label: 'Berat Sblm', val: `${item.total_gram} gr` },
            { label: 'Expected ≈', val: `${expected} gr`, accent: true },
          ].map(({ label, val, accent }) => (
            <div key={label} className="px-3 py-2.5 text-center">
              <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wide">{label}</p>
              <p className={`text-sm font-bold mt-0.5 ${accent ? 'text-violet-600' : 'text-gray-800'}`}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="px-5 pb-8 space-y-4 overflow-y-auto">
        <FL label="Status Baru" req>
          <select name="status_baru" value={status} onChange={e => setStatus(e.target.value)} className={INP}>
            {['Cutting','Pas Berat','Annealing','Siap Packing','Sudah Packing','Reject'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FL>

        {!isReject && (
          <>
            <div className={`grid gap-3 ${hasSerbuk ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <FL label="Total Berat (gr)" req>
                <input name="total_gram_baru" type="number" step="0.001" className={INP}
                  placeholder={`Sblm: ${item.total_gram} gr`} required />
              </FL>
              {hasSerbuk && (
                <FL label="Sisa Serbuk (gr)">
                  <input name="sisa_serbuk" type="number" step="0.001" defaultValue="0" className={INP} />
                </FL>
              )}
            </div>
            <FL label="Tanggal" req>
              <input name="tanggal" type="date" defaultValue={today} className={INP} required />
            </FL>
            <FL label="Foto Proses">
              <label className="flex items-center gap-3 h-11 px-4 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-violet-50 transition-colors">
                <Camera size={15} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-400">
                  {fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto proses'}
                </span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => setFotos(Array.from(e.target.files ?? []).slice(0, 10))} />
              </label>
            </FL>
            {hasSerbuk && (
              <FL label="Foto Sisa Serbuk">
                <label className="flex items-center gap-3 h-11 px-4 bg-[#F2F2F7] rounded-xl cursor-pointer hover:bg-violet-50 transition-colors">
                  <Camera size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-400">
                    {fSerbuk.length > 0 ? `${fSerbuk.length} foto dipilih` : 'Foto sisa serbuk emas'}
                  </span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => setFSerbuk(Array.from(e.target.files ?? []).slice(0, 5))} />
                </label>
              </FL>
            )}
          </>
        )}

        {isReject && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FL label="PCS Reject" req>
                <input name="pcs_reject" type="number" min="1" max={pcsGood} className={INP} required />
              </FL>
              <FL label="Berat Reject (gr)" req>
                <input name="berat_reject" type="number" step="0.001" className={INP} required />
              </FL>
            </div>
            <FL label="Tanggal" req>
              <input name="tanggal" type="date" defaultValue={today} className={INP} required />
            </FL>
          </>
        )}

        <FL label="Catatan">
          <input name="catatan" type="text" placeholder="Keterangan opsional…" className={INP} />
        </FL>

        {err && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}

        <button type="submit" disabled={pend || uploading}
          className="w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          {(pend || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {pend || uploading ? 'Menyimpan…' : 'Simpan Status'}
        </button>
      </form>
    </Sheet>
  )
}

// ─── Edit Modal (bottom sheet) ────────────────────────────────────────────────
function EditModal({ item, onClose, showToast }: {
  item: any; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const evs = (Array.isArray(item.produksi_event) ? item.produksi_event : [])
    .filter((e: any) => !e.voided_at)
    .sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  const latestId = evs.length > 0 ? evs[evs.length - 1].id : null
  const [operator, setOperator] = useState(item.operator ?? '')
  const [gramasi, setGramasi] = useState(item.gramasi ?? '')
  const [evEditId, setEvEditId] = useState<number | null>(null)
  const [evDraft, setEvDraft] = useState<Record<string, any>>({})
  const [newFotos, setNewFotos] = useState<File[]>([])
  const [delConf, setDelConf] = useState<number | null>(null)
  const [lb, setLb] = useState<string | null>(null)
  const [pend, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [err, setErr] = useState('')

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  function openEv(ev: any) {
    setEvEditId(ev.id); setNewFotos([])
    setEvDraft({
      total_gram: ev.total_gram,
      pcs_good_snapshot: ev.pcs_good_snapshot ?? item.pcs_good ?? item.pcs ?? '',
      sisa_serbuk: ev.sisa_serbuk ?? 0,
      catatan: ev.catatan ?? '',
      tanggal: ev.tanggal,
      existing_fotos: Array.isArray(ev.fotos) ? ev.fotos : [],
    })
  }

  function saveBase() {
    start(async () => {
      const fd = new FormData()
      fd.set('gramasi', gramasi); fd.set('operator', operator)
      fd.set('pcs', String(item.pcs ?? '')); fd.set('berat_awal', String(item.berat_awal ?? item.total_gram ?? ''))
      fd.set('tanggal_produksi', item.tanggal_produksi ?? item.tanggal ?? today)
      fd.set('catatan', item.catatan ?? ''); fd.set('nama_item', item.nama_item ?? '')
      const r = await editProduksi(item.id, item.kode, fd)
      if (r?.error) { setErr(r.error); return }
      flash('Data dasar diperbarui ✓')
    })
  }

  function saveEv(evId: number) {
    start(async () => {
      const b64s = newFotos.length > 0 ? await toB64(newFotos) : []
      const fd = new FormData()
      fd.set('total_gram', String(evDraft.total_gram))
      fd.set('pcs_good_snapshot', String(evDraft.pcs_good_snapshot ?? ''))
      fd.set('sisa_serbuk', String(evDraft.sisa_serbuk ?? 0))
      fd.set('catatan', evDraft.catatan ?? '')
      fd.set('tanggal', evDraft.tanggal)
      fd.set('existing_fotos', JSON.stringify(evDraft.existing_fotos ?? []))
      fd.set('new_fotos_b64', JSON.stringify(b64s))
      const r = await editEvent(evId, item.id, item.kode, fd)
      if (r?.error) { flash(r.error, false); return }
      flash('Event diperbarui ✓'); setEvEditId(null); setNewFotos([])
    })
  }

  function delEv(evId: number) {
    start(async () => {
      const r = await deleteEvent(evId, item.id, item.kode)
      if (r?.error) { flash(r.error, false); return }
      flash('Event dihapus'); setDelConf(null)
    })
  }

  return (
    <Sheet onClose={onClose}>
      {lb && <LB url={lb} onClose={() => setLb(null)} />}
      <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Edit Produksi</h2>
          <p className="text-xs text-violet-500 font-semibold">{item.kode} · {item.gramasi} gr</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <X size={15} className="text-gray-500" />
        </button>
      </div>

      {/* Gramasi + Operator */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="flex gap-2 items-end bg-[#F5F3FF] rounded-2xl px-4 py-3">
          <div className="flex-1">
            <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wide mb-1">Gramasi</p>
            <select value={gramasi} onChange={e => setGramasi(e.target.value)}
              className="w-full h-8 px-2 bg-white rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400/30 border-0">
              {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wide mb-1">Operator</p>
            <input value={operator} onChange={e => setOperator(e.target.value)}
              className="w-full h-8 px-2 bg-white rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400/30 border-0"
              placeholder="Nama operator" />
          </div>
          <button onClick={saveBase} disabled={pend}
            className="h-8 px-3 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            {pend ? '…' : 'Simpan'}
          </button>
        </div>
        {err && <p className="text-xs text-red-500 mt-1 px-1">{err}</p>}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2">
        {msg && (
          <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}
        {evs.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat proses</p>}
        {evs.map((ev: any) => {
          const cfg = S[ev.status] ?? { color: '#94A3B8', bg: '#F9FAFB' }
          const isLast = ev.id === latestId
          const isEditing = evEditId === ev.id
          const hasSerbuk = ev.status === 'Pas Berat' || ev.status === 'Annealing'
          const evFotos: string[] = Array.isArray(ev.fotos) ? ev.fotos : []
          return (
            <div key={ev.id} className="bg-white rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: isEditing ? '#F5F3FF' : 'transparent' }}>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Pill status={ev.status} />
                  <span className="text-[11px] text-gray-400">{formatDate(ev.tanggal)}</span>
                  <span className="text-xs font-bold text-gray-700">
                    {ev.status === 'Reject' ? `−${fgr((ev.berat_sebelumnya ?? 0) - (ev.total_gram ?? 0))}gr` : `${ev.total_gram}gr`}
                  </span>
                  {ev.pcs_good_snapshot != null && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                      {ev.status === 'Reject' ? `−${ev.pcs_reject_snapshot ?? '?'}pcs` : `${ev.pcs_good_snapshot}pcs`}
                    </span>
                  )}
                  {evFotos.length > 0 && <span className="text-[10px] text-gray-300">📷{evFotos.length}</span>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ev.status !== 'Reject' && !isEditing && (
                    <button onClick={() => openEv(ev)} disabled={pend}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                      <Pencil size={11} />
                    </button>
                  )}
                  {isLast && !isEditing && (
                    delConf === ev.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => delEv(ev.id)} disabled={pend}
                          className="px-2 h-7 text-[10px] font-bold rounded-xl bg-red-500 text-white">
                          {pend ? '…' : 'Hapus'}
                        </button>
                        <button onClick={() => setDelConf(null)} className="px-2 h-7 text-[10px] font-semibold rounded-xl bg-gray-100 text-gray-600">Batal</button>
                      </div>
                    ) : (
                      <button onClick={() => setDelConf(ev.id)} disabled={pend}
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    )
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="px-4 pb-4 pt-2 space-y-3 bg-[#FAFBFF]">
                  <div className={`grid gap-2 ${hasSerbuk ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {[
                      { label: 'Total Berat (gr)', key: 'total_gram', step: '0.001' },
                      { label: 'PCS Good', key: 'pcs_good_snapshot', step: '1' },
                      ...(hasSerbuk ? [{ label: 'Serbuk (gr)', key: 'sisa_serbuk', step: '0.001' }] : []),
                    ].map(({ label, key, step }) => (
                      <div key={key}>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{label}</p>
                        <input type="number" step={step} value={evDraft[key]}
                          onChange={e => setEvDraft(d => ({ ...d, [key]: e.target.value }))}
                          className={INP_SM} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tanggal', key: 'tanggal', type: 'date' },
                      { label: 'Catatan', key: 'catatan', type: 'text', placeholder: 'Opsional…' },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{label}</p>
                        <input type={type} value={evDraft[key]}
                          placeholder={placeholder}
                          onChange={e => setEvDraft(d => ({ ...d, [key]: e.target.value }))}
                          className={INP_SM} />
                      </div>
                    ))}
                  </div>

                  {/* Foto */}
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">
                      Foto ({(evDraft.existing_fotos ?? []).length + newFotos.length}/10)
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {(evDraft.existing_fotos ?? []).map((url: string, fi: number) => (
                        <div key={fi} className="relative">
                          <img src={url} onClick={() => setLb(url)}
                            className="w-12 h-12 rounded-xl object-cover cursor-pointer" />
                          <button onClick={() => setEvDraft(d => ({ ...d, existing_fotos: d.existing_fotos.filter((_: any, i: number) => i !== fi) }))}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                        </div>
                      ))}
                      {newFotos.map((f, fi) => (
                        <div key={`n${fi}`} className="relative">
                          <img src={URL.createObjectURL(f)} className="w-12 h-12 rounded-xl object-cover border-2 border-violet-300" />
                          <button onClick={() => setNewFotos(p => p.filter((_, i) => i !== fi))}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                        </div>
                      ))}
                      {(evDraft.existing_fotos ?? []).length + newFotos.length < 10 && (
                        <label className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                          <Camera size={15} className="text-gray-400" />
                          <input type="file" accept="image/*" multiple className="hidden"
                            onChange={e => {
                              const files = Array.from(e.target.files ?? [])
                              const rem = 10 - (evDraft.existing_fotos ?? []).length - newFotos.length
                              setNewFotos(p => [...p, ...files.slice(0, rem)])
                              e.target.value = ''
                            }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => saveEv(ev.id)} disabled={pend}
                      className="flex-1 h-10 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                      {pend && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {pend ? 'Menyimpan…' : 'Simpan'}
                    </button>
                    <button onClick={() => setEvEditId(null)}
                      className="px-4 h-10 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600">
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <p className="text-[10px] text-gray-300 text-center pt-1">Hanya event terakhir yang bisa dihapus • Reject tidak bisa diedit</p>
      </div>
    </Sheet>
  )
}

// ─── Add Item Modal (bottom sheet) ────────────────────────────────────────────
function AddItemModal({ batchKode, batchNama, onClose, showToast }: {
  batchKode: string; batchNama: string; onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [pend, start] = useTransition()
  const [err, setErr] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    fd.set('batch_kode', batchKode)
    start(async () => {
      const r = await createProduksi(fd)
      if (r?.error) { setErr(r.error); return }
      showToast('Item produksi ditambahkan ✓')
      onClose()
    })
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tambah Gramasi</h2>
          <p className="text-xs text-violet-500 font-semibold">{batchNama || batchKode}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <X size={15} className="text-gray-500" />
        </button>
      </div>
      <form onSubmit={submit} className="px-5 pb-8 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <FL label="Gramasi" req>
            <select name="gramasi" className={INP} required>
              {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
            </select>
          </FL>
          <FL label="PCS" req>
            <input name="pcs" type="number" min="1" className={INP} placeholder="cth: 50" required />
          </FL>
        </div>
        <FL label="Total Berat Awal (gr)" req>
          <input name="berat_awal" type="number" step="0.001" className={INP} placeholder="cth: 500.15" required />
        </FL>
        <div className="grid grid-cols-2 gap-3">
          <FL label="Tanggal" req>
            <input name="tanggal_produksi" type="date" defaultValue={today} className={INP} required />
          </FL>
          <FL label="Operator">
            <input name="operator" type="text" className={INP} placeholder="Nama operator" />
          </FL>
        </div>
        <FL label="Catatan">
          <input name="catatan" type="text" className={INP} placeholder="Keterangan opsional…" />
        </FL>
        {err && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}
        <button type="submit" disabled={pend}
          className="w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          {pend && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {pend ? 'Menyimpan…' : 'Tambah ke Batch'}
        </button>
      </form>
    </Sheet>
  )
}

// ─── Single produksi item row ─────────────────────────────────────────────────
function ItemRow({ item, canManage, onUpdate, onEdit, showToast }: {
  item: any; canManage: boolean
  onUpdate: () => void; onEdit: () => void
  showToast: (m: string, ok?: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [pend, start] = useTransition()
  const events = (Array.isArray(item.produksi_event) ? item.produksi_event : [])
    .filter((e: any) => !e.voided_at)
  const cfg = S[item.status] ?? { color: '#6B7280', bg: '#F3F4F6' }
  const hasReject = (item.pcs_reject ?? 0) > 0
  const rejectPending = item.status_reject === 'belum_dilebur' && hasReject

  function doLebur() {
    start(async () => {
      const r = await leburReject(item.id, item.kode, item.batch_kode)
      if (r?.error) { showToast(r.error, false); return }
      showToast('Reject dilebur ✓')
    })
  }
  function doBatalLebur() {
    start(async () => {
      const r = await batalLeburReject(item.id, item.kode, item.batch_kode)
      if (r?.error) { showToast(r.error, false); return }
      showToast('Lebur dibatalkan')
    })
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      {/* Row header */}
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {/* Left: info */}
          <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{item.gramasi} gr</span>
              <span className="text-xs text-gray-300">×</span>
              <span className="text-sm font-semibold text-gray-600">{item.pcs_good} pcs</span>
              <Pill status={item.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-500">{fgr(item.total_gram)} gr</span>
              {item.sisa_serbuk > 0 && <span className="text-xs text-violet-400">serbuk {item.sisa_serbuk} gr</span>}
              {rejectPending && (
                <button onClick={e => { e.stopPropagation(); doLebur() }} disabled={pend}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  <Flame size={9} className="animate-pulse" />
                  {item.pcs_reject} reject — Lebur
                </button>
              )}
              {hasReject && !rejectPending && (
                <button onClick={e => { e.stopPropagation(); doBatalLebur() }} disabled={pend}
                  className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  ✓ {item.pcs_reject} dilebur
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-300 mt-0.5">{item.kode}</p>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canManage && (
              <>
                <button onClick={onEdit}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={onUpdate}
                  className="h-8 px-3 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                  <Plus size={10} />Update
                </button>
              </>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors">
              <ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded events */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 pt-3 pb-4 bg-[#FAFAFA]">
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Riwayat Proses</p>
          <EventHistory events={events} fallbackPcs={item.pcs_good ?? item.pcs} />
        </div>
      )}
    </div>
  )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────
function BatchCard({ batch, canManage, showToast }: {
  batch: any; canManage: boolean; showToast: (m: string, ok?: boolean) => void
}) {
  const items = (Array.isArray(batch.produksi_item) ? batch.produksi_item : [])
    .filter((i: any) => !i.voided_at)
  const [collapsed, setCollapsed] = useState(false)
  const [sisaFisik, setSisaFisik] = useState<string>(batch.sisa_fisik != null ? String(batch.sisa_fisik) : '')
  const [sfPend, startSF] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [updateItem, setUpdateItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)

  const totalTerpakai = items.reduce((s: number, i: any) => s + (i.berat_awal ?? 0), 0)
  const sisaSeharusnya = (batch.timbangan_akhir ?? 0) - totalTerpakai
  const sisaFisikNum = parseFloat(sisaFisik) || null
  const losesBahan = sisaFisikNum != null ? sisaSeharusnya - sisaFisikNum : null

  function saveSisaFisik() {
    startSF(async () => {
      const r = await updateSisaFisikBatch(batch.kode, sisaFisikNum)
      if (r?.error) { showToast(r.error, false); return }
      showToast('Sisa fisik disimpan ✓')
    })
  }

  return (
    <>
      {addOpen && (
        <AddItemModal batchKode={batch.kode} batchNama={batch.nama_batch}
          onClose={() => setAddOpen(false)} showToast={showToast} />
      )}
      {updateItem && (
        <UpdateModal item={updateItem} onClose={() => setUpdateItem(null)} showToast={showToast} />
      )}
      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} showToast={showToast} />
      )}

      <div className="bg-white rounded-3xl overflow-hidden"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

        {/* Batch header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">
                  {batch.nama_batch || batch.kode}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-violet-600 bg-violet-50">
                  {items.length} gramasi
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{batch.kode} · {formatDate(batch.tanggal)}</p>
            </div>
            <button onClick={() => setCollapsed(!collapsed)}
              className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0">
              <ChevronDown size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Bahan baku stats */}
          <div className="mt-3 bg-[#F9F9FB] rounded-2xl p-3">
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              {[
                { label: 'Bahan Masuk', val: fgr(batch.timbangan_akhir) + ' gr', sub: null },
                { label: 'Terpakai', val: fgr(totalTerpakai) + ' gr', sub: null },
                { label: 'Sisa (harusnya)', val: fgr(sisaSeharusnya) + ' gr', sub: null },
              ].map(({ label, val }) => (
                <div key={label}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
            {/* Sisa fisik input */}
            <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100">
              <div className="flex-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Sisa Fisik (gr)</p>
                <input type="number" step="0.001" value={sisaFisik}
                  onChange={e => setSisaFisik(e.target.value)}
                  placeholder="Timbang sisa bahan..."
                  className="w-full h-8 px-2.5 bg-white rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400/30 border border-gray-200" />
              </div>
              <div className="flex-shrink-0 pt-4">
                <button onClick={saveSisaFisik} disabled={sfPend || !sisaFisik}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                  {sfPend ? '…' : 'Simpan'}
                </button>
              </div>
              {losesBahan != null && (
                <div className="flex-shrink-0 pt-4 text-right">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Losses Bahan</p>
                  <p className={`text-xs font-bold ${losesBahan > 0.1 ? 'text-orange-500' : losesBahan < -0.1 ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {losesBahan > 0 ? '+' : ''}{fgr(losesBahan)} gr
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        {!collapsed && (
          <div className="px-4 pb-4 space-y-2.5">
            {/* Divider */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Produksi</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {items.length === 0 && (
              <div className="text-center py-6">
                <Package size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Belum ada item produksi</p>
              </div>
            )}

            {items.map((item: any) => (
              <ItemRow key={item.id} item={item} canManage={canManage}
                onUpdate={() => setUpdateItem(item)}
                onEdit={() => setEditItem(item)}
                showToast={showToast} />
            ))}

            {canManage && (
              <button onClick={() => setAddOpen(true)}
                className="w-full h-11 rounded-2xl border-2 border-dashed border-violet-200 flex items-center justify-center gap-2 text-sm font-semibold text-violet-400 hover:bg-violet-50 hover:border-violet-300 transition-all active:scale-[0.98]">
                <Plus size={15} />
                Tambah Gramasi
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg ${msg.ok ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}>
        {msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
        {msg.text}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProduksiClient({
  produksiList, batches: batchList, userRole, userName
}: {
  produksiList: any[]; batches: any[]; userRole: UserRole; userName: string
}) {
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
  const canManage = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)

  function showToast(text: string, ok = true) {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Group produksi items by batch_kode
  const batchMap = new Map<string, any>()
  batchList.forEach(b => batchMap.set(b.kode, { ...b, produksi_item: [] }))
  produksiList.forEach(item => {
    if (!item.batch_kode) return
    if (!batchMap.has(item.batch_kode)) {
      batchMap.set(item.batch_kode, {
        kode: item.batch_kode, nama_batch: item.batch_kode,
        timbangan_akhir: item.batch?.timbangan_akhir ?? 0,
        sisa_bahan_seharusnya: item.batch?.sisa_bahan_seharusnya ?? 0,
        sisa_fisik: item.batch?.sisa_fisik ?? null,
        tanggal: item.tanggal,
        produksi_item: [],
      })
    }
    batchMap.get(item.batch_kode)!.produksi_item.push(item)
  })

  const allBatches = Array.from(batchMap.values())
    .filter(b => b.produksi_item.length > 0)
    .sort((a, b) => {
      const da = new Date(a.tanggal ?? a.created_at ?? 0).getTime()
      const db = new Date(b.tanggal ?? b.created_at ?? 0).getTime()
      return db - da
    })

  const filtered = search.trim()
    ? allBatches.filter(b => {
        const q = search.toLowerCase()
        const matchBatch = (b.nama_batch || b.kode || '').toLowerCase().includes(q)
        const matchItem = b.produksi_item.some((i: any) =>
          (i.kode || '').toLowerCase().includes(q) ||
          String(i.gramasi).includes(q)
        )
        return matchBatch || matchItem
      })
    : allBatches

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Toast msg={toast} />

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Produksi</h1>
              <p className="text-xs text-gray-400">{allBatches.length} batch aktif</p>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari batch, gramasi, kode…"
              className="w-full h-10 pl-9 pr-4 bg-[#F2F2F7] rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all" />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Belum ada data produksi</p>
            <p className="text-sm text-gray-300 mt-1">Tambah batch dari halaman Bahan Baku</p>
          </div>
        )}
        {filtered.map(batch => (
          <BatchCard key={batch.kode} batch={batch} canManage={canManage} showToast={showToast} />
        ))}
      </div>
    </div>
  )
}
