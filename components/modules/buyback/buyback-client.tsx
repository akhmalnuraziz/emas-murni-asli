'use client'

import { useState, useTransition, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  RotateCcw, Plus, X, Check, RefreshCw, ChevronDown, ChevronUp,
  Camera, AlertTriangle, CheckCircle2, Wrench, Flame, Archive, Pencil, Trash2,
  Upload, Hash
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { createBuyback, prossesBuyback, getBuybackList, editBuyback, deleteBuyback } from '@/app/(dashboard)/buyback/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  initialList: any[]
  userRole: UserRole
  userName: string
}

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

const HASIL_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pending:       { label: 'Pending Inspeksi', bg: 'rgba(100,116,139,0.1)', text: '#475569', icon: AlertTriangle },
  ready_resell:  { label: 'Siap Jual Lagi',   bg: 'rgba(34,197,94,0.1)',  text: '#16A34A', icon: CheckCircle2  },
  repair:        { label: 'Perlu Repair',      bg: 'rgba(59,130,246,0.1)', text: '#2563EB', icon: Wrench        },
  holding_reject:{ label: 'Holding Reject',    bg: 'rgba(239,68,68,0.1)',  text: '#DC2626', icon: Archive       },
  akan_dilebur:  { label: 'Akan Dilebur',      bg: 'rgba(245,158,11,0.1)', text: '#D97706', icon: Flame         },
}

const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
const F = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-[11px] font-medium text-slate-500">
      {label}{req && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
)

const CAN_PROSES: UserRole[] = ['owner', 'manager', 'spv']
const CAN_DELETE: UserRole[] = ['owner', 'manager']

async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 5)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        let { width: w, height: h } = img
        const max = 1200
        if (w > max || h > max) { const r = Math.min(max/w, max/h); w = Math.floor(w*r); h = Math.floor(h*r) }
        c.width = w; c.height = h; c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        c.toBlob(blob => {
          if (!blob) { resolve(''); return }
          const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob)
        }, 'image/jpeg', 0.8)
      }
      img.src = URL.createObjectURL(file)
    })
    if (b64) results.push(b64)
  }
  return results
}

// Base-26 range expansion for shieldtag codes (last 2 chars = AA–ZZ)
function expandRange(start: string, end: string): string[] {
  if (start.length !== end.length) return [start, end]
  const prefix = start.slice(0, -2)
  if (end.slice(0, -2) !== prefix) return [start, end]
  const toN = (s: string) => (s.charCodeAt(0) - 65) * 26 + (s.charCodeAt(1) - 65)
  const toS = (n: number) => String.fromCharCode(Math.floor(n / 26) + 65, (n % 26) + 65)
  const a = toN(start.slice(-2)), b = toN(end.slice(-2))
  if (b < a || b - a > 500) return [start, end]
  return Array.from({ length: b - a + 1 }, (_, i) => prefix + toS(a + i))
}

async function parseExcelKodes(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  return rows.flatMap(r => r[0] ? [String(r[0]).trim().toUpperCase()] : []).filter(Boolean)
}

// ─── Multi shieldtag input ─────────────────────────────────────────────────────
function ShieldtagInput({ kodes, onChange }: { kodes: string[]; onChange: (k: string[]) => void }) {
  const [text, setText] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [mode, setMode] = useState<'manual' | 'range'>('manual')
  const fileRef = useRef<HTMLInputElement>(null)

  function addKode(raw: string) {
    const codes = raw.toUpperCase().split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
    const next = [...new Set([...kodes, ...codes])]
    onChange(next)
    setText('')
  }

  function applyRange() {
    if (!rangeStart || !rangeEnd) return
    const expanded = expandRange(rangeStart.toUpperCase(), rangeEnd.toUpperCase())
    onChange([...new Set([...kodes, ...expanded])])
    setRangeStart(''); setRangeEnd('')
  }

  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const parsed = await parseExcelKodes(file)
    onChange([...new Set([...kodes, ...parsed])])
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1">
        {(['manual', 'range'] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn('px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors',
              mode === m ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
            {m === 'manual' ? 'Manual' : 'Range'}
          </button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex items-center gap-1">
          <Upload size={11} /> Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcel} />
      </div>

      {mode === 'manual' && (
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKode(text) } }}
            className={cn(inp, 'font-mono flex-1')}
            placeholder="Ketik kode lalu Enter (bisa lebih dari satu, pisah koma)" />
          <button type="button" onClick={() => addKode(text)}
            className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors">
            +
          </button>
        </div>
      )}

      {mode === 'range' && (
        <div className="flex gap-2 items-center">
          <input value={rangeStart} onChange={e => setRangeStart(e.target.value.toUpperCase())}
            className={cn(inp, 'font-mono')} placeholder="Dari (mis: 1H80AA)" />
          <span className="text-slate-400 text-[12px] shrink-0">s/d</span>
          <input value={rangeEnd} onChange={e => setRangeEnd(e.target.value.toUpperCase())}
            className={cn(inp, 'font-mono')} placeholder="Sampai (mis: 1H80AZ)" />
          <button type="button" onClick={applyRange}
            className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shrink-0">
            Buat
          </button>
        </div>
      )}

      {/* Tag list */}
      {kodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
          {kodes.map(k => (
            <span key={k} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-mono text-slate-700">
              {k}
              <button type="button" onClick={() => onChange(kodes.filter(x => x !== k))}
                className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {kodes.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">
          Kosongkan jika tidak ada shieldtag (barang tanpa shieldtag tidak masuk inventory).
        </p>
      )}
      {kodes.length > 0 && (
        <p className="text-[11px] text-violet-600 font-semibold">{kodes.length} shieldtag — akan membuat {kodes.length} record</p>
      )}
    </div>
  )
}

export default function BuybackClient({ initialList, userRole, userName }: Props) {
  const [list, setList] = useState<any[]>(initialList)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  async function reloadList() {
    const res = await getBuybackList()
    setList(res.data)
  }

  const pendingCount = list.filter(b => b.status === 'pending').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-violet-600">
            <RotateCcw size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">Buyback / Barang Masuk</h1>
            <p className="text-[12px] text-slate-400">Terima buyback atau input barang masuk, lalu tentukan tindakan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              {pendingCount} pending inspeksi
            </span>
          )}
          <button onClick={reloadList}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
            <RefreshCw size={13} /> Muat Ulang
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
            <Plus size={14} /> Tambah Barang Masuk
          </button>
        </div>
      </div>

      {/* Panduan flow */}
      <div className="bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
        <p className="text-[12px] font-semibold text-slate-500 mb-2">Alur Buyback / Barang Masuk</p>
        <div className="flex items-center gap-2 flex-wrap text-[12px] text-slate-400">
          {['Input Barang', '→', 'Pending Inspeksi', '→', ['Siap Jual','Repair','Holding Reject','Lebur']].map((step, i) =>
            Array.isArray(step) ? (
              <span key={i} className="flex gap-1 flex-wrap">
                {step.map(s => <span key={s} className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[10px] font-semibold">{s}</span>)}
              </span>
            ) : <span key={i} className={step === '→' ? 'text-slate-300' : 'font-semibold text-slate-600'}>{step}</span>
          )}
        </div>
      </div>

      {showForm && (
        <BuybackForm
          userName={userName}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reloadList() }}
        />
      )}

      {editTarget && (
        <BuybackForm
          userName={userName}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); reloadList() }}
        />
      )}

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-300 text-[13px]">
            Belum ada data
          </div>
        ) : list.map(b => (
          <BuybackCard
            key={b.id}
            buyback={b}
            expanded={expandedId === b.id}
            onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
            canProses={CAN_PROSES.includes(userRole)}
            canDelete={CAN_DELETE.includes(userRole)}
            userName={userName}
            onUpdated={reloadList}
            onEdit={() => setEditTarget(b)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Form tambah / edit ────────────────────────────────────────────────────────
function BuybackForm({ userName, initial, onClose, onSaved }: {
  userName: string; initial?: any; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    tanggal: initial?.tanggal ?? new Date().toISOString().split('T')[0],
    namaCustomer: initial?.nama_customer ?? '',
    hpCustomer: initial?.hp_customer ?? '',
    gramasi: initial?.gramasi ?? '1',
    kondisiEmas: initial?.kondisi_emas ?? 'bagus',
    kondisiTag: initial?.kondisi_tag ?? 'bagus',
    hargaBeli: initial?.harga_beli ? String(initial.harga_beli) : '',
    catatan: initial?.catatan ?? '',
    // edit mode: single shieldtag field
    shieldtagKode: initial?.shieldtag_kode ?? '',
  })
  const [kodes, setKodes] = useState<string[]>(
    !isEdit && initial?.shieldtag_kode ? [initial.shieldtag_kode] : []
  )
  const [fotos, setFotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [doneCount, setDoneCount] = useState(0)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const b64s = await filesToBase64(files)
    setFotos(prev => [...prev, ...b64s].slice(0, 5))
    e.target.value = ''
  }

  async function handleSave() {
    setSaving(true); setErr('')
    if (isEdit) {
      const res = await editBuyback(initial.id, {
        ...form,
        hargaBeli: parseInt(form.hargaBeli) || 0,
      })
      setSaving(false)
      if (!res.success) { setErr(res.error ?? 'Gagal'); return }
      onSaved()
    } else {
      const res = await createBuyback({
        tanggal: form.tanggal,
        namaCustomer: form.namaCustomer || undefined,
        hpCustomer: form.hpCustomer || undefined,
        shieldtagKodes: kodes,
        gramasi: form.gramasi,
        kondisiEmas: form.kondisiEmas,
        kondisiTag: form.kondisiTag,
        hargaBeli: parseInt(form.hargaBeli) || 0,
        fotosB64: fotos,
        catatan: form.catatan,
      })
      setSaving(false)
      if (!res.success) { setErr(res.error ?? 'Gagal'); return }
      setDoneCount(res.count ?? 1)
    }
  }

  if (doneCount > 0) return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
      <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
      <p className="font-semibold text-slate-800">
        {doneCount > 1 ? `${doneCount} item berhasil ditambahkan` : 'Barang Masuk Diterima'}
      </p>
      <p className="text-[12px] text-slate-400">Status: Pending Inspeksi</p>
      <button onClick={onSaved} className="px-6 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors">
        Selesai
      </button>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-800">{isEdit ? 'Edit Buyback' : 'Tambah Buyback / Barang Masuk'}</h2>
          {!isEdit && <p className="text-[12px] text-slate-400 mt-0.5">Tindakan inspeksi ditentukan setelah penyimpanan</p>}
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F label="Tanggal" req>
          <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} className={inp} />
        </F>
        <div />
        <F label="Nama Customer">
          <input value={form.namaCustomer} onChange={e => set('namaCustomer', e.target.value)}
            className={inp} placeholder="Opsional" />
        </F>
        <F label="No. HP">
          <input value={form.hpCustomer} onChange={e => set('hpCustomer', e.target.value)}
            className={inp} placeholder="Opsional" />
        </F>
        <F label="Gramasi" req>
          <select value={form.gramasi} onChange={e => set('gramasi', e.target.value)} className={inp}>
            {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}
          </select>
        </F>
        <F label="Harga Beli Kembali (Rp)">
          <input type="number" value={form.hargaBeli} onChange={e => set('hargaBeli', e.target.value)}
            className={inp} placeholder="0" min={0} />
        </F>
        <F label="Kondisi Emas" req>
          <select value={form.kondisiEmas} onChange={e => set('kondisiEmas', e.target.value)} className={inp}>
            <option value="bagus">Bagus</option>
            <option value="perlu_diperbaiki">Perlu Diperbaiki</option>
            <option value="reject">Reject</option>
          </select>
        </F>
        <F label="Kondisi Shieldtag">
          <select value={form.kondisiTag} onChange={e => set('kondisiTag', e.target.value)} className={inp}>
            <option value="bagus">Bagus</option>
            <option value="rusak">Rusak</option>
            <option value="hilang">Hilang</option>
          </select>
        </F>
      </div>

      {/* Shieldtag input — single for edit, multi for create */}
      {isEdit ? (
        <F label="Kode Shieldtag">
          <input value={form.shieldtagKode} onChange={e => set('shieldtagKode', e.target.value.toUpperCase())}
            className={cn(inp, 'font-mono')} placeholder="Opsional" />
        </F>
      ) : (
        <F label="Kode Shieldtag">
          <ShieldtagInput kodes={kodes} onChange={setKodes} />
        </F>
      )}

      {!isEdit && (
        <F label="Foto Kondisi Barang">
          <div className="flex gap-2 flex-wrap">
            {fotos.map((f, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                <img src={f} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center">
                  <X size={10} />
                </button>
              </div>
            ))}
            {fotos.length < 5 && (
              <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-violet-300 transition-colors">
                <Camera size={18} className="text-slate-300" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
              </label>
            )}
          </div>
        </F>
      )}

      <F label="Catatan">
        <textarea value={form.catatan} onChange={e => set('catatan', e.target.value)}
          className={cn(inp, 'resize-none h-auto')} rows={2} placeholder="Keterangan tambahan" />
      </F>

      {err && <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      <div className="flex gap-2.5">
        <button type="button" onClick={onClose}
          className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
          Batal
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
          {saving
            ? 'Menyimpan…'
            : isEdit
            ? 'Simpan Perubahan'
            : kodes.length > 1
            ? `Simpan ${kodes.length} Item`
            : 'Simpan'}
        </button>
      </div>
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function BuybackCard({ buyback: b, expanded, onToggle, canProses, canDelete, userName, onUpdated, onEdit }: {
  buyback: any; expanded: boolean; onToggle: () => void
  canProses: boolean; canDelete: boolean; userName: string
  onUpdated: () => void; onEdit: () => void
}) {
  const [aksi, setAksi] = useState<string>('')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cfg = HASIL_CFG[b.status] ?? HASIL_CFG.pending
  const StatusIcon = cfg.icon
  const isPending = b.status === 'pending'
  const isRepair = b.status === 'repair'
  const canAct = isPending || isRepair

  async function doProses() {
    if (!aksi) return
    setSaving(true)
    await prossesBuyback({ id: b.id, kode: b.kode, aksi: aksi as any, catatan, userName })
    setSaving(false)
    onUpdated()
  }

  async function doDelete() {
    setSaving(true)
    await deleteBuyback(b.id)
    setSaving(false)
    onUpdated()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50"
        onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: cfg.bg }}>
            <StatusIcon size={16} style={{ color: cfg.text }} />
          </div>
          <div>
            <p className="font-mono text-[13px] font-semibold text-slate-800">{b.kode}</p>
            <p className="text-[12px] text-slate-400">
              {b.nama_customer ? `${b.nama_customer} · ` : ''}{formatDate(b.tanggal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {b.shieldtag_kode && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{b.shieldtag_kode}</span>
          )}
          {b.gramasi && (
            <span className="text-[12px] font-semibold text-slate-600">{b.gramasi} gr</span>
          )}
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
          {isPending && (
            <>
              <button onClick={e => { e.stopPropagation(); onEdit() }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                title="Edit">
                <Pencil size={14} />
              </button>
              {canDelete && (
                <button onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Hapus">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Hapus Buyback?</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{b.kode}{b.nama_customer ? ` · ${b.nama_customer}` : ''}</p>
                  {b.shieldtag_kode && (
                    <p className="text-[12px] text-red-500 mt-1">Shieldtag akan dikembalikan ke status Terjual.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
                  Batal
                </button>
                <button onClick={doDelete} disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                  {saving ? 'Menghapus…' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            <div><p className="text-slate-400 mb-0.5">HP Customer</p><p className="font-semibold text-slate-700">{b.hp_customer || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Kondisi Emas</p><p className="font-semibold text-slate-700 capitalize">{b.kondisi_emas?.replace(/_/g,' ') || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Kondisi Tag</p><p className="font-semibold text-slate-700 capitalize">{b.kondisi_tag?.replace(/_/g,' ') || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Harga Beli</p><p className="font-semibold text-slate-700">{formatRupiah(b.harga_beli)}</p></div>
          </div>

          {(b.foto ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(b.foto as string[]).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
              ))}
            </div>
          )}

          {b.catatan && (
            <p className="text-[12px] text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
              <span className="font-semibold">Catatan:</span> {b.catatan}
            </p>
          )}

          {b.approved_by && (
            <p className="text-[12px] text-slate-400">Diproses oleh <span className="font-semibold">{b.approved_by}</span></p>
          )}

          {canAct && canProses && (
            <div className="rounded-lg px-3 py-3 bg-violet-50 border border-violet-100 space-y-3">
              <p className="text-[12px] font-semibold text-violet-700">
                {isRepair ? 'Selesai Repair — Tentukan Status Akhir' : 'Tentukan Tindakan'}
              </p>
              <select value={aksi} onChange={e => setAksi(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all">
                <option value="">-- Pilih tindakan --</option>
                <option value="ready_resell">✅ Siap Jual Lagi — Stok Gudang bertambah</option>
                {!isRepair && <option value="repair">🔧 Repair — Masuk Karantina (Repair)</option>}
                <option value="reject">⛔ Holding Reject — Masuk Karantina</option>
                <option value="lebur">🔥 Lebur — Masuk Karantina (Akan Dilebur)</option>
              </select>
              {aksi === 'ready_resell' && !b.shieldtag_kode && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  Barang ini tidak punya shieldtag — tidak akan masuk inventory. Pastikan ini disengaja.
                </p>
              )}
              {aksi === 'ready_resell' && b.shieldtag_kode && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5">
                  Shieldtag <span className="font-mono font-semibold">{b.shieldtag_kode}</span> akan kembali ke <strong>Aktif di Gudang Pusat</strong> — Inventory otomatis bertambah.
                </p>
              )}
              {aksi && aksi !== 'ready_resell' && b.shieldtag_kode && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  Shieldtag <span className="font-mono font-semibold">{b.shieldtag_kode}</span> akan masuk <strong>Karantina</strong> — tidak masuk stok.
                </p>
              )}
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all resize-none"
                rows={2} placeholder="Keterangan (opsional)" />
              <button onClick={doProses} disabled={saving || !aksi}
                className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {saving ? 'Memproses…' : 'Konfirmasi Tindakan'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
