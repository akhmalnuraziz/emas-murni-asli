'use client'

import { useState, useTransition } from 'react'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import { cn, formatRupiah, formatDate } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, X, Calendar, Wallet, TrendingDown,
  Tag, ChevronDown, ChevronUp, AlertTriangle, Search,
} from 'lucide-react'
import {
  createPengeluaran, updatePengeluaran, voidPengeluaran,
  createKategori, updateKategori, toggleKategoriAktif,
} from '@/app/(dashboard)/pengeluaran/actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kategori {
  id: number
  nama: string
  warna: string | null
  aktif: boolean | null
}

interface Pengeluaran {
  id: number
  tanggal: string
  nama: string
  nominal: number
  lokasi: string
  keterangan: string | null
  foto: string | null
  kategori_id: number | null
  kategori: Kategori | null
}

interface Props {
  pengeluaranList: Pengeluaran[]
  kategoriList: Kategori[]
  canManage: boolean
  userRole: string
  period: string
  dateFrom: string
  dateTo: string
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week',  label: '7 Hari' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Kustom' },
]

const DEFAULT_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4',
]

// ── Period Selector ───────────────────────────────────────────────────────────

function PeriodSelector({ period, dateFrom, dateTo }: { period: string; dateFrom: string; dateTo: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(period === 'custom')
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo,   setCustomTo]   = useState(dateTo)

  function navigate(p: string, from?: string, to?: string) {
    const params = new URLSearchParams()
    params.set('period', p)
    if (p === 'custom' && from && to) { params.set('from', from); params.set('to', to) }
    startTransition(() => router.push(`/pengeluaran?${params.toString()}`))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={13} className="text-slate-400" />
        {PERIOD_OPTIONS.map(opt => (
          <button key={opt.value}
            onClick={() => { if (opt.value === 'custom') { setShowCustom(true); return } setShowCustom(false); navigate(opt.value) }}
            className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              (period === opt.value && opt.value !== 'custom') || (showCustom && opt.value === 'custom')
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200 hover:text-violet-600'
            )}>
            {opt.label}
          </button>
        ))}
        {isPending && <span className="text-[10px] text-slate-400 ml-1">Memuat...</span>}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-2xl px-3 py-2 border border-slate-200">
          <span className="text-xs text-slate-400 font-medium">Dari</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <span className="text-xs text-slate-400 font-medium">s/d</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-violet-400" />
          <button onClick={() => navigate('custom', customFrom, customTo)}
            className="px-3 py-1 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">
            Terapkan
          </button>
        </div>
      )}
    </div>
  )
}

// ── Modal: Add/Edit Pengeluaran ───────────────────────────────────────────────

function PengeluaranModal({
  onClose, item, kategoriList,
}: { onClose: () => void; item?: Pengeluaran; kategoriList: Kategori[] }) {
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [fotoPreview, setFotoPreview] = useState<string>(item?.foto ?? '')
  const [fotoBase64,  setFotoBase64]  = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const compressed = await compressImage(f)
    setFotoPreview(compressed)
    setFotoBase64(compressed)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    const fd = new FormData(e.currentTarget)
    if (fotoBase64) fd.set('foto', fotoBase64)
    startTransition(async () => {
      const res = item
        ? await updatePengeluaran(item.id, fd)
        : await createPengeluaran(fd)
      if (res?.error) { setErr(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{item ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal *</label>
              <input name="tanggal" type="date" defaultValue={item?.tanggal ?? today} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
              <input name="nominal" type="number" step="1000" min="1" defaultValue={item?.nominal ?? ''}
                placeholder="0" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Pengeluaran *</label>
            <input name="nama" type="text" defaultValue={item?.nama ?? ''} placeholder="Contoh: Bayar listrik" required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasi *</label>
              <input name="lokasi" type="text" defaultValue={item?.lokasi ?? ''} placeholder="Pusat / Cabang CJ" required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
              <select name="kategori_id" defaultValue={item?.kategori_id ?? ''}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400">
                <option value="">— Pilih —</option>
                {kategoriList.filter(k => k.aktif).map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan</label>
            <textarea name="keterangan" rows={2} defaultValue={item?.keterangan ?? ''} placeholder="Opsional"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Foto Bukti</label>
            <input type="file" accept="image/*" onChange={handleFile}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
            {fotoPreview && (
              <img src={fotoPreview} alt="preview" className="mt-2 w-24 h-24 object-cover rounded-xl border border-slate-200"/>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: Kategori ───────────────────────────────────────────────────────────

function KategoriModal({ onClose, item }: { onClose: () => void; item?: Kategori }) {
  const [isPending, startTransition] = useTransition()
  const [err, setErr] = useState('')
  const [warna, setWarna] = useState(item?.warna ?? '#6366F1')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('')
    const fd = new FormData(e.currentTarget)
    fd.set('warna', warna)
    startTransition(async () => {
      const res = item ? await updateKategori(item.id, fd) : await createKategori(fd)
      if (res?.error) { setErr(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{item ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kategori *</label>
            <input name="nama" type="text" defaultValue={item?.nama ?? ''} required placeholder="Contoh: Listrik & Air"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Warna</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setWarna(c)}
                  className={cn('w-7 h-7 rounded-full transition-all', warna === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : '')}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Client ───────────────────────────────────────────────────────────────

export default function PengeluaranClient({
  pengeluaranList, kategoriList, canManage, period, dateFrom, dateTo,
}: Props) {
  const [tab, setTab] = useState<'pengeluaran' | 'kategori'>('pengeluaran')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Pengeluaran | undefined>()
  const [voidId,   setVoidId]  = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidErr,  setVoidErr]  = useState('')
  const [voidPending, startVoid] = useTransition()
  const [showAddKat, setShowAddKat] = useState(false)
  const [editKat,    setEditKat]    = useState<Kategori | undefined>()
  const [search, setSearch] = useState('')
  const [togglePending, startToggle] = useTransition()

  const periodLabel = period === 'today' ? 'Hari Ini'
    : period === 'week'   ? '7 Hari Terakhir'
    : period === 'custom' ? `${dateFrom} – ${dateTo}`
    : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const totalPengeluaran = pengeluaranList.reduce((s, p) => s + Number(p.nominal), 0)

  // Per-kategori breakdown
  const byKategori: Record<string, number> = {}
  for (const p of pengeluaranList) {
    const k = p.kategori?.nama ?? 'Tanpa Kategori'
    byKategori[k] = (byKategori[k] ?? 0) + Number(p.nominal)
  }
  const sorted = Object.entries(byKategori).sort((a, b) => b[1] - a[1])

  const filtered = pengeluaranList.filter(p =>
    !search || p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.lokasi.toLowerCase().includes(search.toLowerCase()) ||
    (p.kategori?.nama ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 pb-8">

      {/* ── Header KPI ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-3xl p-5 col-span-1 sm:col-span-1"
          style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: 'white' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="opacity-80"/>
            <p className="text-xs font-semibold opacity-80">Total Pengeluaran</p>
          </div>
          <p className="text-2xl font-black">{formatRupiah(totalPengeluaran)}</p>
          <p className="text-xs opacity-70 mt-1">{periodLabel}</p>
        </div>
        <div className="rounded-3xl p-5 sm:col-span-2"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Per Kategori</p>
          {sorted.length > 0 ? (
            <div className="space-y-2">
              {sorted.slice(0, 5).map(([nama, total]) => {
                const kat = kategoriList.find(k => k.nama === nama)
                const pct = totalPengeluaran > 0 ? (total / totalPengeluaran * 100) : 0
                return (
                  <div key={nama} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: kat?.warna ?? '#94A3B8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-slate-700 truncate">{nama}</p>
                        <p className="text-xs text-slate-500 ml-2 flex-shrink-0">{formatRupiah(total)}</p>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: kat?.warna ?? '#94A3B8' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-300 text-center py-4">Belum ada data pengeluaran</p>
          )}
        </div>
      </div>

      {/* ── Period + Tabs ─────────────────────────────────────────────────── */}
      <PeriodSelector period={period} dateFrom={dateFrom} dateTo={dateTo} />

      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-fit">
        {(['pengeluaran', 'kategori'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize',
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}>
            {t === 'pengeluaran' ? 'Pengeluaran' : 'Kategori'}
          </button>
        ))}
      </div>

      {/* ── Tab: Pengeluaran ─────────────────────────────────────────────── */}
      {tab === 'pengeluaran' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama, lokasi, kategori..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 bg-white"/>
            </div>
            {canManage && (
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">
                <Plus size={14}/> Tambah
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl p-12 text-center bg-white border border-slate-100">
              <Wallet size={32} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-sm text-slate-400">Belum ada pengeluaran di periode ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => (
                <div key={p.id} className="bg-white rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: p.kategori?.warna ?? '#94A3B8' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.nama}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-[10px] text-slate-400">{formatDate(p.tanggal)}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-400">{p.lokasi}</span>
                          {p.kategori && (
                            <>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: `${p.kategori.warna}22`, color: p.kategori.warna ?? '#64748B' }}>
                                {p.kategori.nama}
                              </span>
                            </>
                          )}
                        </div>
                        {p.keterangan && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{p.keterangan}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-red-600">{formatRupiah(p.nominal)}</p>
                      </div>
                    </div>
                  </div>
                  {p.foto && (
                    <a href={p.foto} target="_blank" rel="noopener noreferrer">
                      <img src={p.foto} alt="bukti" className="w-10 h-10 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                    </a>
                  )}
                  {canManage && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setEditItem(p)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <Pencil size={13}/>
                      </button>
                      <button onClick={() => { setVoidId(p.id); setVoidReason(''); setVoidErr('') }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Kategori ────────────────────────────────────────────────── */}
      {tab === 'kategori' && (
        <div className="space-y-3">
          {canManage && (
            <button onClick={() => setShowAddKat(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">
              <Plus size={14}/> Tambah Kategori
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kategoriList.map(k => (
              <div key={k.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${k.warna}22` }}>
                  <Tag size={16} style={{ color: k.warna ?? '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold truncate', k.aktif ? 'text-slate-800' : 'text-slate-400 line-through')}>{k.nama}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {byKategori[k.nama] != null ? formatRupiah(byKategori[k.nama]) : 'Rp 0'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditKat(k)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button disabled={togglePending}
                      onClick={() => startToggle(async () => { await toggleKategoriAktif(k.id, !k.aktif) })}
                      className={cn('p-1.5 rounded-xl transition-colors',
                        k.aktif ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'
                      )}>
                      {k.aktif ? <X size={13}/> : <Plus size={13}/>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {(showAdd || editItem) && (
        <PengeluaranModal
          kategoriList={kategoriList}
          item={editItem}
          onClose={() => { setShowAdd(false); setEditItem(undefined) }}
        />
      )}

      {(showAddKat || editKat) && (
        <KategoriModal
          item={editKat}
          onClose={() => { setShowAddKat(false); setEditKat(undefined) }}
        />
      )}

      {/* ── Void Confirm ─────────────────────────────────────────────────── */}
      {voidId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500"/>
              </div>
              <div>
                <p className="font-bold text-slate-800">Hapus Pengeluaran?</p>
                <p className="text-xs text-slate-400">Data tidak bisa dikembalikan</p>
              </div>
            </div>
            {voidErr && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{voidErr}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alasan *</label>
              <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                placeholder="Masukkan alasan penghapusan"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-300"/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setVoidId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button disabled={voidPending}
                onClick={() => startVoid(async () => {
                  const res = await voidPengeluaran(voidId!, voidReason)
                  if (res?.error) { setVoidErr(res.error); return }
                  setVoidId(null)
                })}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {voidPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
