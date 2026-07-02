'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, X, Check, AlertTriangle, Tag,
  Edit2, Trash2,
  MapPin, Package, Clock, Loader2, ImagePlus, FileSpreadsheet,
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { registerShieldtags, editShieldtagKode, voidShieldtag, bulkVoidShieldtag, searchShieldtag, uploadFotoProdukShieldtag } from '@/app/(dashboard)/shieldtag/actions'
import type { UserRole } from '@/lib/types/database'
import { useRouter } from 'next/navigation'

interface Props {
  shieldtags: any[]
  packingsWithSlots: any[]
  userRole: UserRole
  userName: string
  total?: number
  page?: number
  pageSize?: number
  currentQ?: string
  currentStatus?: string
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

const today = new Date().toISOString().split('T')[0]
const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
const F = ({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-[11px] font-medium text-slate-500">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
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
      <span className="text-[12px] text-slate-400 font-mono w-5 flex-shrink-0">{idx+1}.</span>
      <input value={start} onChange={e=>onChange(e.target.value.toUpperCase(),end)}
        placeholder="Kode awal (cth: 1H80AA)" className={cn(inp,'flex-1 font-mono text-[12px]')}/>
      <span className="text-slate-400 text-[13px] flex-shrink-0">→</span>
      <input value={end} onChange={e=>{onChange(start,e.target.value.toUpperCase());onPreview(start,e.target.value.toUpperCase())}}
        placeholder="Kode akhir (cth: 1H80AT)" className={cn(inp,'flex-1 font-mono text-[12px]')}/>
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
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf)
    const codes: string[] = []
    for (const sheetName of wb.SheetNames) {
      const rows: any[][] = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 })
      for (const row of rows) {
        for (const cell of row) {
          if (cell == null) continue
          const v = String(cell).trim().toUpperCase()
          // ponytail: filter alphanumeric 4-10 char — shieldtag code pattern
          if (/^[A-Z0-9]{4,10}$/.test(v)) codes.push(v)
        }
      }
    }
    const unique = [...new Set(codes)]
    if (unique.length === 0) { toast.error('Tidak ada kode shieldtag ditemukan di file Excel'); return }
    setEditCodes(unique)
    setPreview(unique)
    setPreviewCount(unique.length)
    setPreviewError('')
    setEditMode(true)
    toast.success(`${unique.length} kode terbaca dari Excel`)
    e.target.value = ''
  }

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Registrasi Shieldtag</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Input range kode dari stiker fisik vendor</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
        </div>
        <form id="register-form" onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
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
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
              <Tag size={12}/>
              {selPacking.batch_kode} · {selPacking.gramasi}gr · {selPacking.pcs_dipack - (selPacking.pcs_reject ?? 0)} PCS valid ·
              <span className="font-semibold">{selPacking.pcs_tersisa} slot Shieldtag tersisa</span>
            </div>
          )}

          <F label="Tanggal Registrasi" req>
            <input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className={inp} required/>
          </F>

          {/* Ranges */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium text-slate-500">
                Range kode Shieldtag
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 text-[12px] text-emerald-600 font-semibold hover:underline">
                  <FileSpreadsheet size={12}/> Upload Excel
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload}/>
                <button type="button" onClick={() => setRanges(p => [...p, { start: '', end: '' }])}
                  className="text-[12px] text-violet-600 font-semibold hover:underline">+ Tambah range</button>
              </div>
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
            <div className={cn('rounded-lg p-3 space-y-2',
              overLimit ? 'bg-red-50 border border-red-100' : 'bg-violet-50 border border-violet-100')}>
              <div className="flex items-center justify-between">
                <p className={cn('text-[12px] font-semibold', overLimit ? 'text-red-600' : 'text-violet-700')}>
                  {previewCount} kode ter-generate
                  {overLimit && ` — melebihi sisa slot (${selPacking?.pcs_tersisa})`}
                </p>
                <button type="button" onClick={() => setEditMode(!editMode)}
                  className="text-[12px] text-violet-600 hover:underline font-semibold">
                  {editMode ? 'Kembali ke range' : 'Edit per kode'}
                </button>
              </div>

              {editMode ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                  {editCodes.map((code, i) => (
                    <input key={i} value={code}
                      onChange={e => setEditCodes(p => p.map((c, j) => j === i ? e.target.value.toUpperCase() : c))}
                      className="px-2 py-1.5 text-[12px] font-mono rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400 text-center"/>
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
                    <span className="text-[11px] text-slate-400 self-center">+{preview.length - 50} lagi</span>
                  )}
                </div>
              )}
            </div>
          )}

          {previewError && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
              <AlertTriangle size={13}/>{previewError}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
              <AlertTriangle size={13}/>{error}
            </div>
          )}
        </form>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button type="submit" form="register-form" disabled={isPending || overLimit || previewCount === 0}
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending ? 'Menyimpan...' : `Daftarkan ${editMode ? editCodes.filter(Boolean).length : previewCount} Shieldtag`}
          </button>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Ganti Kode Shieldtag</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Ganti kode jika stiker fisik rusak atau keliru input</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <F label="Kode Shieldtag Baru" req>
            <input value={kode} onChange={e=>setKode(e.target.value.toUpperCase())}
              placeholder="Masukkan kode baru" className={cn(inp,'font-mono tracking-wider')} required/>
          </F>
          {error && <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600"><AlertTriangle size={13}/>{error}</div>}
        </div>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button onClick={() => onSubmit(kode)} disabled={isPending || !kode}
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Foto Produk Section ───────────────────────────────────────────────────────
function FotoProdukSection({ kode, fotoUrl, onUploaded }: {
  kode: string
  fotoUrl: string | null
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64 = (ev.target?.result as string).split(',')[1]
      const r = await uploadFotoProdukShieldtag(kode, b64, ext)
      setUploading(false)
      if (r.error) { toast.error(r.error); return }
      toast.success('Foto produk berhasil diupload')
      onUploaded(r.url!)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="px-6 pb-6 border-t border-slate-100 pt-5">
      <p className="text-[10px] font-medium text-slate-400 mb-3 flex items-center gap-1.5">
        <Package size={11}/> Foto Produk (tampil di halaman verifikasi customer)
      </p>
      <div className="flex items-start gap-4">
        {fotoUrl ? (
          <div className="relative w-24 h-28 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl} alt="Foto produk" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-24 h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0 bg-slate-50">
            <span className="text-[10px] text-slate-400 text-center px-2">Belum ada foto</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-[12px] font-semibold text-violet-700 border border-violet-200 transition-colors disabled:opacity-50 flex items-center gap-2">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
            {fotoUrl ? 'Ganti Foto' : 'Upload Foto'}
          </button>
          <p className="text-[10px] text-slate-400">JPG/PNG, maks 5MB.<br/>Foto tampil di halaman scan QR customer.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// ─── Explorer Panel ────────────────────────────────────────────────────────────
function ExplorerPanel() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function doSearch(q?: string) {
    const kode = (q ?? query).trim().toUpperCase()
    if (!kode) return
    setNotFound(false)
    setResult(null)
    startTransition(async () => {
      const r = await searchShieldtag(kode)
      if (r.error || !r.data) { setNotFound(true); setResult(null) }
      else setResult(r.data)
    })
  }

  const cfg = result ? STATUS_CFG[result.status] ?? STATUS_CFG['Aktif'] : null
  const history: any[] = result
    ? (Array.isArray(result.shieldtag_history) ? result.shieldtag_history : [])
    : []

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100/80 last:border-0">
      <span className="text-[11px] font-medium text-slate-400 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-[13px] font-semibold text-slate-800 text-right">{value ?? '—'}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="rounded-xl p-5 bg-white border border-white/60">
        <p className="text-[12px] font-medium text-slate-400 mb-3">Cari Shieldtag by kode</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value.toUpperCase()); setNotFound(false) }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Masukkan kode Shieldtag, contoh: 1H80AA"
              className="w-full pl-10 pr-4 py-3 text-[13px] font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all uppercase bg-slate-50/80 border border-slate-300/50"
            />
          </div>
          <button
            onClick={() => doSearch()}
            disabled={isPending || !query.trim()}
            className="px-6 py-3 text-[13px] font-semibold text-white rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-700">
            {isPending ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
            Cari
          </button>
        </div>

        {notFound && (
          <div className="mt-4 px-4 py-3 rounded-xl text-[13px] font-medium text-red-600 bg-red-50 border border-red-100/80">
            Shieldtag <span className="font-mono font-semibold">{query}</span> tidak ditemukan.
          </div>
        )}
      </div>

      {/* Result card */}
      {result && cfg && (
        <div className="rounded-xl overflow-hidden bg-white border border-white/60">

          {/* Card header */}
          <div className="px-6 py-5 flex items-center justify-between gap-4"
            style={{ background: `linear-gradient(135deg,${cfg.bg},rgba(255,255,255,0))`,
              borderBottom: '1px solid rgba(243,244,246,0.9)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: cfg.bg, border: `1.5px solid ${cfg.dot}30` }}>
                <Tag size={22} style={{ color: cfg.dot }}/>
              </div>
              <div>
                <p className="text-[18px] font-semibold font-mono tracking-wider text-slate-900">
                  {result.kode}
                </p>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  {result.gramasi}gr · {result.batch_kode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
              style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.dot}25` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }}/>
              {result.status}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">

            {/* Detail info */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                <Package size={11}/> Detail
              </p>
              <InfoRow label="Kode" value={<span className="font-mono">{result.kode}</span>}/>
              <InfoRow label="Gramasi" value={`${result.gramasi} gr`}/>
              <InfoRow label="Batch" value={
                <a href={`/laporan/batch/${encodeURIComponent(result.batch_kode ?? '')}`}
                  className="font-mono text-violet-600 hover:underline">{result.batch_kode}</a>
              }/>
              <InfoRow label="Status" value={
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.text }}>{result.status}</span>
              }/>
              <InfoRow label="Lokasi" value={
                <span className="flex items-center gap-1.5 justify-end">
                  <MapPin size={12} className="text-slate-400"/>{result.lokasi ?? '—'}
                </span>
              }/>
              <InfoRow label="HPP / pcs" value={result.hpp ? formatRupiah(result.hpp) : '—'}/>
              <InfoRow label="Tgl Registrasi" value={result.tgl_regis ? formatDate(result.tgl_regis) : '—'}/>
              <InfoRow label="Didaftarkan oleh" value={result.registered_by ?? '—'}/>
              {result.packing && (
                <InfoRow label="Packing" value={
                  <span className="font-mono text-[12px]">{result.packing.kode}</span>
                }/>
              )}
              {result.voided_at && (
                <InfoRow label="Void reason" value={
                  <span className="text-red-500 text-[12px]">{result.void_reason}</span>
                }/>
              )}
            </div>

            {/* Riwayat */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                <Clock size={11}/> Riwayat Pergerakan
              </p>
              {history.length === 0 ? (
                <p className="text-[13px] text-slate-400 italic">Belum ada riwayat</p>
              ) : (
                <div className="space-y-0 relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-violet-300/30 to-violet-200/10"/>
                  {history.slice().reverse().map((h: any, i: number) => (
                    <div key={i} className="flex gap-4 pb-4 last:pb-0 relative">
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 mt-0.5 ${i === 0 ? 'bg-violet-100 border border-violet-300' : 'bg-slate-100 border border-slate-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-violet-500' : 'bg-slate-300'}`}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 leading-snug">{h.action}</p>
                        {(h.status || h.lokasi) && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {[h.status, h.lokasi].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {h.alasan && (
                          <p className="text-[11px] text-red-500 mt-0.5 italic">{h.alasan}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {h.tanggal} {h.oleh && `· ${h.oleh}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Foto Produk */}
          <FotoProdukSection kode={result.kode} fotoUrl={result.foto_produk ?? null} onUploaded={url => setResult((r: any) => ({ ...r, foto_produk: url }))} />
        </div>
      )}

      {/* Empty state */}
      {!result && !notFound && !isPending && (
        <div className="rounded-xl py-16 text-center bg-white/40 border border-dashed border-violet-200/60">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-violet-50">
            <Search size={28} className="text-violet-300"/>
          </div>
          <p className="text-[13px] font-semibold text-slate-400">Masukkan kode Shieldtag untuk mulai cari</p>
          <p className="text-[12px] text-slate-300 mt-1">Cari tahu status, lokasi, dan riwayat pergerakan</p>
        </div>
      )}
    </div>
  )
}

export default function ShieldtagClient({ shieldtags, packingsWithSlots, userRole, userName, total = 0, page = 1, pageSize = 25, currentQ = '', currentStatus = 'Semua' }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'explorer'>('list')
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<'register' | 'edit' | 'void' | 'bulk_void' | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkVoidReason, setBulkVoidReason] = useState('')
  const [activeItem, setActiveItem] = useState<any | null>(null)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState(currentQ)
  const [voidReason, setVoidReason] = useState('')

  // Server-side pagination helpers
  const filterStatus = currentStatus
  const filtered = shieldtags // already filtered by server
  const totalPages = Math.ceil(total / pageSize)

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (filterStatus !== 'Semua') sp.set('status', filterStatus)
    sp.set('page', String(page))
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k) })
    router.push(`/shieldtag?${sp.toString()}`)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: search, page: '1' })
  }

  function handleStatusFilter(s: string) {
    navigate({ status: s === 'Semua' ? '' : s, page: '1' })
  }

function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(st => st.id)))
  }

  const canRegister = true /* ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv', 'operator_produksi'].includes(userRole) */
  const canVoid = true /* ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv'].includes(userRole) */
  const canEdit = true /* ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv'].includes(userRole) */
  const tabs = ['Semua', 'Aktif', 'Terdistribusi', 'Terjual', 'VOID']

  function handleRegister(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const r = await registerShieldtags(fd)
      if (r?.error) { setErr(r.error); return }
      toast.success(`${r?.count} Shieldtag berhasil didaftarkan`)
      setModal(null)
      router.refresh()
    })
  }

  function handleEditKode(newKode: string) {
    if (!activeItem) return
    setErr('')
    startTransition(async () => {
      const r = await editShieldtagKode(activeItem.id, newKode)
      if (r?.error) { setErr(r.error); return }
      toast.success('Kode Shieldtag diperbarui')
      setModal(null)
      router.refresh()
    })
  }

  function handleBulkVoid() {
    if (selected.size === 0 || !bulkVoidReason.trim()) return
    startTransition(async () => {
      const r = await bulkVoidShieldtag(Array.from(selected), bulkVoidReason)
      if (r?.error) { toast.error(r.error); return }
      toast.success(r?.count + ' Shieldtag di-VOID')
      setModal(null); setSelected(new Set()); setBulkVoidReason('')
      router.refresh()
    })
  }

  function handleVoid() {
    if (!activeItem || !voidReason.trim()) return
    startTransition(async () => {
      const r = await voidShieldtag(activeItem.id, voidReason)
      if (r?.error) { toast.error(r.error); return }
      toast.success('Shieldtag di-VOID')
      setModal(null); setVoidReason('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-slate-900 tracking-tight">Shieldtag</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">{shieldtags.length} shieldtag terdaftar</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(['list','explorer'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={cn('px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all',
                    view === v ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {v === 'list' ? 'Daftar' : 'Shieldtag Explorer'}
                </button>
              ))}
            </div>
            {selected.size > 0 && canVoid && view === 'list' && (
              <button onClick={() => { setModal('bulk_void'); setBulkVoidReason('') }}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors">
                <Trash2 size={13}/> VOID {selected.size}
              </button>
            )}
            {canRegister && (
              <a href="/shieldtag/foto-master"
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
                <ImagePlus size={13}/> Master Foto
              </a>
            )}
            {canRegister && packingsWithSlots.length > 0 && view === 'list' && (
              <button onClick={() => { setModal('register'); setErr('') }}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
                <Plus size={14}/> Registrasi Shieldtag
              </button>
            )}
          </div>
        </div>

        {view === 'explorer' && <ExplorerPanel/>}
        {view === 'list' && <>
        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap items-center">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode Shieldtag, batch… (Enter)"
              className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all bg-white/80 border border-slate-300/50"/>
          </form>
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => {
              const isAct = filterStatus === t
              const cfg = STATUS_CFG[t]
              return (
                <button key={t} onClick={() => handleStatusFilter(t)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all ${isAct ? 'text-white' : 'bg-white/80 text-slate-500 border border-slate-200'}`}
                  style={isAct ? { background: cfg?.dot ?? '#8B5CF6', boxShadow: `0 4px 12px ${cfg?.dot ?? '#8B5CF6'}40` } : undefined}>
                  {t}
                </button>
              )
            })}
          </div>
          <span className="text-[12px] text-slate-400">{total} total</span>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-auto bg-white border border-white/60">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3.5 w-10">
                <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-violet-500"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}/>
              </th>
              {['Kode Shieldtag', 'Batch', 'Gramasi', 'Status', 'Lokasi', 'Tgl regis', 'Aksi'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-violet-50">
                    <Tag size={28} className="text-violet-300"/>
                  </div>
                  <p className="text-[13px] font-medium text-slate-400">
                    {packingsWithSlots.length > 0 ? 'Belum ada Shieldtag terdaftar' : 'Semua Shieldtag sudah terdaftar'}
                  </p>
                  {packingsWithSlots.length > 0 && canRegister && (
                    <button onClick={() => { setModal('register'); setErr('') }}
                      className="mt-3 px-4 py-2 text-[13px] font-semibold text-violet-600 hover:underline">
                      Klik untuk registrasi →
                    </button>
                  )}
                </td></tr>
              ) : filtered.map((st, idx) => {
                const cfg = STATUS_CFG[st.status] ?? STATUS_CFG['Aktif']
                return (
                  <tr key={st.id}
                    className={cn('border-t border-slate-100/70 transition-colors hover:bg-violet-50/10', idx === 0 ? 'border-transparent' : '', selected.has(st.id) ? 'bg-violet-50/40' : '')}>
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(st.id) }}>
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-violet-500"
                        checked={selected.has(st.id)} onChange={() => {}}/>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] font-semibold tracking-wider text-slate-900">{st.kode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full text-violet-700 bg-violet-50/40">{st.batch_kode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full text-amber-700 bg-amber-50/40">{st.gramasi} gr</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}>{st.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-600">{st.lokasi || '—'}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(st.tgl_regis)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
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
                            title="Hapus (VOID)">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-slate-400">
              Hal {page} dari {totalPages} · {total} item
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => navigate({ page: String(page + 1) })}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        </>}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">VOID Shieldtag?</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
                <p><span className="font-mono font-semibold">{activeItem.kode}</span> akan di-VOID dan tidak bisa digunakan.</p>
              </div>
              <F label="Alasan VOID" req>
                <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                  placeholder="Contoh: stiker rusak, hilang, dll" className={inp}/>
              </F>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
              <button onClick={() => setModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={handleVoid} disabled={isPending || !voidReason.trim()}
                className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending ? 'Memproses...' : 'VOID'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'bulk_void' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">VOID {selected.size} Shieldtag?</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
                <p className="font-semibold">Semua yang dipilih akan di-VOID dan tidak bisa digunakan.</p>
              </div>
              <F label="Alasan VOID" req>
                <input value={bulkVoidReason} onChange={e => setBulkVoidReason(e.target.value)}
                  placeholder="Contoh: stiker rusak, batch recall, dll" className={inp}/>
              </F>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
              <button onClick={() => setModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={handleBulkVoid} disabled={isPending || !bulkVoidReason.trim()}
                className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {isPending ? 'Memproses...' : 'VOID Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
