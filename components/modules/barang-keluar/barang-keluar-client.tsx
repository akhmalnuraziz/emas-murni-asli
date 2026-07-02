'use client'

import { useState, useTransition, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X, Search, PackageOpen, Trash2, ChevronDown, ChevronUp, Check, Pencil } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createBarangKeluar, voidBarangKeluar, editBarangKeluar } from '@/app/(dashboard)/barang-keluar/actions'

const TUJUAN_PRESETS = ['Shopee', 'TikTok', 'Aplikasi Raja Emas', 'Lain-lain']
const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'
const today = new Date().toISOString().split('T')[0]

interface ShieldtagOption { kode: string; gramasi: string; batch_kode: string | null }
interface BKItem { shieldtag_kode: string; gramasi: string }
interface BK {
  id: number; kode: string; tanggal: string; tujuan: string
  admin_input: string | null; catatan: string | null; created_at: string
  items: BKItem[]
}

interface Props {
  initialList: BK[]
  shieldtagAktif: ShieldtagOption[]
  userRole: string
  userName: string
}

export default function BarangKeluarClient({ initialList, shieldtagAktif, userRole, userName }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [voidConfirm, setVoidConfirm] = useState<BK | null>(null)
  const [editTarget, setEditTarget] = useState<BK | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const canVoid = ['owner', 'manager'].includes(userRole)
  const canEdit = ['owner', 'manager', 'admin_gudang'].includes(userRole)

  const filtered = search.trim()
    ? initialList.filter(b =>
        b.kode.toLowerCase().includes(search.toLowerCase()) ||
        b.tujuan.toLowerCase().includes(search.toLowerCase())
      )
    : initialList

  function handleVoid(bk: BK) {
    start(async () => {
      const r = await voidBarangKeluar(bk.id)
      if (r?.error) { toast.error(r.error); return }
      toast.success(`${bk.kode} berhasil di-void. Shieldtag dikembalikan ke Gudang.`)
      setVoidConfirm(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-600">
            <PackageOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">Barang Keluar</h1>
            <p className="text-[12px] text-slate-400">Distribusi & penjualan dari gudang — berbasis Shieldtag</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-[13px] font-semibold rounded-xl hover:bg-rose-700 transition-colors">
          <Plus size={14} /> Catat Barang Keluar
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode atau tujuan..."
          className="w-full h-9 pl-8 pr-3 text-[12px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300/40" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={12} />
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center border border-slate-200 bg-white/70">
          <PackageOpen size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[13px] text-slate-400">{search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada transaksi Barang Keluar'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bk => {
            const byGramasi: Record<string, number> = {}
            for (const it of bk.items) {
              byGramasi[it.gramasi] = (byGramasi[it.gramasi] ?? 0) + 1
            }
            const expanded = expandedId === bk.id
            return (
              <div key={bk.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold text-slate-800 font-mono">{bk.kode}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(bk.tanggal)} · {bk.admin_input ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                      {bk.tujuan}
                    </span>
                    {canEdit && (
                      <button onClick={() => setEditTarget(bk)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-violet-50 hover:text-violet-600 flex items-center justify-center text-slate-400 transition-colors">
                        <Pencil size={12} />
                      </button>
                    )}
                    {canVoid && (
                      <button onClick={() => setVoidConfirm(bk)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Items per gramasi */}
                <button type="button" onClick={() => setExpandedId(expanded ? null : bk.id)}
                  className="flex flex-wrap items-center gap-2 pt-1 w-full text-left">
                  {Object.entries(byGramasi).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([g, count]) => (
                    <span key={g} className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                      {g}gr × {count} pcs
                    </span>
                  ))}
                  <span className="text-[11px] text-slate-400">· Total {bk.items.length} pcs</span>
                  {expanded ? <ChevronUp size={12} className="text-slate-400 ml-auto"/> : <ChevronDown size={12} className="text-slate-400 ml-auto"/>}
                </button>

                {expanded && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    {bk.items.map(it => (
                      <span key={it.shieldtag_kode} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                        {it.shieldtag_kode} <span className="text-slate-400">· {it.gramasi}gr</span>
                      </span>
                    ))}
                  </div>
                )}

                {bk.catatan && (
                  <p className="text-[11px] text-slate-400 italic">{bk.catatan}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          shieldtagAktif={shieldtagAktif}
          userName={userName}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); router.refresh() }}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditModal
          bk={editTarget}
          shieldtagAktif={shieldtagAktif}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); router.refresh() }}
        />
      )}

      {/* Void Confirm */}
      {voidConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <p className="text-[14px] font-bold text-slate-900">Void Barang Keluar?</p>
            <p className="text-[12px] text-slate-500">
              <span className="font-mono font-semibold">{voidConfirm.kode}</span> akan di-void.
              {' '}{voidConfirm.items.length} Shieldtag akan dikembalikan ke status <span className="font-semibold text-emerald-600">Aktif di Gudang Pusat</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setVoidConfirm(null)}
                className="flex-1 h-9 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={() => handleVoid(voidConfirm)} disabled={isPending}
                className="flex-1 h-9 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Memproses...' : 'Ya, Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ shieldtagAktif, userName, onClose, onSuccess }: {
  shieldtagAktif: ShieldtagOption[]
  userName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, start] = useTransition()
  const [error, setError] = useState('')
  const [tanggal, setTanggal] = useState(today)
  const [tujuan, setTujuan] = useState('')
  const [tujuanCustom, setTujuanCustom] = useState(false)
  const [adminInput, setAdminInput] = useState(userName)
  const [catatan, setCatatan] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [stSearch, setStSearch] = useState('')

  // Group shieldtag by gramasi for display
  const byGramasi = useMemo(() => {
    const groups: Record<string, ShieldtagOption[]> = {}
    for (const st of shieldtagAktif) {
      const g = st.gramasi
      if (!groups[g]) groups[g] = []
      groups[g].push(st)
    }
    return groups
  }, [shieldtagAktif])

  const filteredST = stSearch.trim()
    ? shieldtagAktif.filter(st =>
        st.kode.toLowerCase().includes(stSearch.toLowerCase()) ||
        st.gramasi.includes(stSearch)
      )
    : shieldtagAktif

  const selectedSet = new Set(selected)

  function toggleST(kode: string) {
    setSelected(prev =>
      prev.includes(kode) ? prev.filter(k => k !== kode) : [...prev, kode]
    )
  }

  function selectAllGramasi(gramasi: string) {
    const kodes = (byGramasi[gramasi] ?? []).map(st => st.kode)
    const allSelected = kodes.every(k => selectedSet.has(k))
    if (allSelected) {
      setSelected(prev => prev.filter(k => !kodes.includes(k)))
    } else {
      setSelected(prev => [...new Set([...prev, ...kodes])])
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tujuan) { setError('Tujuan wajib diisi'); return }
    if (!selected.length) { setError('Pilih minimal satu Shieldtag'); return }
    setError('')
    const fd = new FormData()
    fd.set('tanggal', tanggal)
    fd.set('tujuan', tujuan)
    fd.set('admin_input', adminInput)
    fd.set('catatan', catatan)
    fd.set('shieldtag_kodes', JSON.stringify(selected))
    start(async () => {
      const r = await createBarangKeluar(fd)
      if (r?.error) { setError(r.error); return }
      toast.success(`${r.kode} berhasil disimpan — ${selected.length} pcs keluar dari gudang`)
      onSuccess()
    })
  }

  const selectedByGramasi: Record<string, number> = {}
  for (const k of selected) {
    const st = shieldtagAktif.find(s => s.kode === k)
    if (st) selectedByGramasi[st.gramasi] = (selectedByGramasi[st.gramasi] ?? 0) + 1
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Catat Barang Keluar</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Pilih Shieldtag yang keluar dari Gudang Pusat</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-600">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal <span className="text-red-400">*</span></label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Admin Input</label>
                <input value={adminInput} onChange={e => setAdminInput(e.target.value)} className={inp} />
              </div>
            </div>

            {/* Tujuan */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Tujuan <span className="text-red-400">*</span></label>
              {tujuanCustom ? (
                <div className="flex gap-2">
                  <input value={tujuan} onChange={e => setTujuan(e.target.value)}
                    placeholder="Ketik tujuan..."
                    className={inp} autoFocus />
                  <button type="button" onClick={() => { setTujuanCustom(false); setTujuan('') }}
                    className="px-3 h-9 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 whitespace-nowrap">
                    Pilih preset
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {TUJUAN_PRESETS.map(t => (
                    <button key={t} type="button"
                      onClick={() => setTujuan(t)}
                      className={cn(
                        'h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors',
                        tujuan === t
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600'
                      )}>
                      {t}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setTujuanCustom(true); setTujuan('') }}
                    className="h-8 px-3 rounded-lg border border-dashed border-slate-300 text-[12px] text-slate-400 hover:text-slate-600 hover:border-slate-400">
                    + Lainnya
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Catatan</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)}
                placeholder="Opsional" className={inp} />
            </div>

            {/* Shieldtag picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-medium text-slate-500">
                  Pilih Shieldtag <span className="text-red-400">*</span>
                  <span className="ml-2 text-violet-600 font-semibold">{selected.length} dipilih</span>
                </label>
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])}
                    className="text-[11px] text-red-400 hover:text-red-600">Hapus semua</button>
                )}
              </div>

              {/* Selected summary */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-100">
                  {Object.entries(selectedByGramasi).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([g, cnt]) => (
                    <span key={g} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-rose-600 text-white">
                      {g}gr × {cnt}
                    </span>
                  ))}
                </div>
              )}

              {/* Search shieldtag */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input value={stSearch} onChange={e => setStSearch(e.target.value)}
                  placeholder="Cari kode atau gramasi..."
                  className="w-full h-8 pl-8 pr-3 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-400/40" />
                {stSearch && (
                  <button type="button" onClick={() => setStSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={11} />
                  </button>
                )}
              </div>

              {shieldtagAktif.length === 0 ? (
                <p className="text-center py-6 text-[12px] text-slate-400">Tidak ada Shieldtag aktif di Gudang Pusat</p>
              ) : stSearch.trim() ? (
                // Search mode: flat list
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredST.length === 0 ? (
                    <p className="text-center py-4 text-[11px] text-slate-400">Tidak ditemukan</p>
                  ) : filteredST.map(st => (
                    <STRow key={st.kode} st={st} selected={selectedSet.has(st.kode)} onToggle={() => toggleST(st.kode)} />
                  ))}
                </div>
              ) : (
                // Grouped by gramasi
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(byGramasi).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([g, sts]) => {
                    const allSel = sts.every(s => selectedSet.has(s.kode))
                    const someSel = sts.some(s => selectedSet.has(s.kode))
                    return (
                      <div key={g} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => selectAllGramasi(g)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold transition-colors',
                            allSel ? 'bg-rose-50 text-rose-700' : someSel ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          )}>
                          <span>{g} gr — {sts.length} stok tersedia</span>
                          <span className={cn('text-[10px] font-medium', allSel ? 'text-rose-500' : 'text-slate-400')}>
                            {allSel ? 'Semua dipilih' : someSel ? `${sts.filter(s => selectedSet.has(s.kode)).length} dipilih` : 'Pilih semua'}
                          </span>
                        </button>
                        <div className="divide-y divide-slate-50">
                          {sts.map(st => (
                            <STRow key={st.kode} st={st} selected={selectedSet.has(st.kode)} onToggle={() => toggleST(st.kode)} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0 bg-white">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={isPending || !selected.length || !tujuan}
              className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-[13px] font-semibold hover:bg-rose-700 disabled:opacity-40 transition-colors">
              {isPending ? 'Menyimpan...' : `Simpan — ${selected.length} pcs keluar`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ bk, shieldtagAktif, onClose, onSuccess }: {
  bk: BK; shieldtagAktif: ShieldtagOption[]; onClose: () => void; onSuccess: () => void
}) {
  const [isPending, start] = useTransition()
  const [error, setError] = useState('')
  const [tanggal, setTanggal] = useState(bk.tanggal.split('T')[0])
  const [tujuan, setTujuan] = useState(bk.tujuan)
  const [tujuanCustom, setTujuanCustom] = useState(!TUJUAN_PRESETS.includes(bk.tujuan))
  const [adminInput, setAdminInput] = useState(bk.admin_input ?? '')
  const [catatan, setCatatan] = useState(bk.catatan ?? '')
  const [keepKodes, setKeepKodes] = useState<string[]>(bk.items.map(it => it.shieldtag_kode))
  const [addKodes, setAddKodes] = useState<string[]>([])
  const [stSearch, setStSearch] = useState('')

  function removeKept(kode: string) { setKeepKodes(prev => prev.filter(k => k !== kode)) }
  function toggleAdd(kode: string) {
    setAddKodes(prev => prev.includes(kode) ? prev.filter(k => k !== kode) : [...prev, kode])
  }

  const filteredST = stSearch.trim()
    ? shieldtagAktif.filter(st => st.kode.toLowerCase().includes(stSearch.toLowerCase()) || st.gramasi.includes(stSearch))
    : shieldtagAktif

  const totalPcs = keepKodes.length + addKodes.length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tujuan) { setError('Tujuan wajib diisi'); return }
    if (totalPcs === 0) { setError('Minimal satu Shieldtag wajib ada'); return }
    setError('')
    const fd = new FormData()
    fd.set('tanggal', tanggal)
    fd.set('tujuan', tujuan)
    fd.set('admin_input', adminInput)
    fd.set('catatan', catatan)
    fd.set('keep_kodes', JSON.stringify(keepKodes))
    fd.set('add_kodes', JSON.stringify(addKodes))
    start(async () => {
      const r = await editBarangKeluar(bk.id, fd)
      if (r?.error) { setError(r.error); return }
      toast.success(`${bk.kode} berhasil diperbarui`)
      onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Edit {bk.kode}</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Hapus shieldtag yang salah, atau tambah yang baru</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-600">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal <span className="text-red-400">*</span></label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Admin Input</label>
                <input value={adminInput} onChange={e => setAdminInput(e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Tujuan <span className="text-red-400">*</span></label>
              {tujuanCustom ? (
                <div className="flex gap-2">
                  <input value={tujuan} onChange={e => setTujuan(e.target.value)} className={inp} autoFocus />
                  <button type="button" onClick={() => setTujuanCustom(false)}
                    className="px-3 h-9 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 whitespace-nowrap">Pilih preset</button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {TUJUAN_PRESETS.map(t => (
                    <button key={t} type="button" onClick={() => setTujuan(t)}
                      className={cn('h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors',
                        tujuan === t ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600')}>
                      {t}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setTujuanCustom(true); setTujuan('') }}
                    className="h-8 px-3 rounded-lg border border-dashed border-slate-300 text-[12px] text-slate-400 hover:text-slate-600 hover:border-slate-400">+ Lainnya</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Catatan</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional" className={inp} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Shieldtag Saat Ini ({keepKodes.length})</label>
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 max-h-32 overflow-y-auto">
                {keepKodes.length === 0 && <span className="text-[11px] text-slate-400 italic">Tidak ada</span>}
                {keepKodes.map(k => {
                  const st = bk.items.find(it => it.shieldtag_kode === k)
                  return (
                    <span key={k} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-mono text-slate-700">
                      {k} <span className="text-slate-400">·{st?.gramasi}gr</span>
                      <button type="button" onClick={() => removeKept(k)} className="text-slate-400 hover:text-red-500"><X size={10} /></button>
                    </span>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tambah Shieldtag Baru ({addKodes.length})</label>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input value={stSearch} onChange={e => setStSearch(e.target.value)} placeholder="Cari kode atau gramasi..."
                  className="w-full h-8 pl-8 pr-3 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-400/40" />
              </div>
              {addKodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  {addKodes.map(k => <span key={k} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white">{k}</span>)}
                </div>
              )}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredST.length === 0 ? (
                  <p className="text-center py-4 text-[11px] text-slate-400">Tidak ada shieldtag tersedia</p>
                ) : filteredST.map(st => (
                  <STRow key={st.kode} st={st} selected={addKodes.includes(st.kode)} onToggle={() => toggleAdd(st.kode)} />
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0 bg-white">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={isPending || totalPcs === 0 || !tujuan}
              className="flex-1 h-10 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {isPending ? 'Menyimpan...' : `Simpan Perubahan — ${totalPcs} pcs`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function STRow({ st, selected, onToggle }: { st: ShieldtagOption; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
        selected ? 'bg-rose-50' : 'hover:bg-slate-50'
      )}>
      <div className={cn(
        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
        selected ? 'bg-rose-600 border-rose-600' : 'border-slate-300'
      )}>
        {selected && <Check size={10} className="text-white" />}
      </div>
      <span className="text-[12px] font-mono text-slate-700">{st.kode}</span>
      <span className="text-[11px] text-slate-400 ml-auto">{st.gramasi}gr</span>
      {st.batch_kode && (
        <span className="text-[10px] text-slate-300 font-mono">{st.batch_kode}</span>
      )}
    </button>
  )
}
