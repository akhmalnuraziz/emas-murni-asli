'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRealtimeRefresh } from '@/lib/supabase/use-realtime-refresh'
import { toast } from 'sonner'
import { Plus, X, Check, ChevronDown, ChevronUp, Trash2, ClipboardList, Search, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { createPO, editPO, updateStatusPO, updateQtyDikirim, deletePO } from '@/app/(dashboard)/po-cabang/actions'
import { konfirmasiTerimaPoItem } from '@/app/(dashboard)/stok-cabang/actions'
import PaginationBar from '@/components/ui/pagination-bar'

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'
const today = new Date().toISOString().split('T')[0]

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  menunggu:  { label: 'Menunggu',  bg: 'rgba(245,158,11,0.1)',  text: '#D97706' },
  pending:   { label: 'Menunggu',  bg: 'rgba(245,158,11,0.1)',  text: '#D97706' },
  diproses:  { label: 'Diproses',  bg: 'rgba(59,130,246,0.1)',  text: '#2563EB' },
  partial:   { label: 'Sebagian',  bg: 'rgba(249,115,22,0.1)',  text: '#EA580C' },
  selesai:   { label: 'Selesai',   bg: 'rgba(34,197,94,0.1)',   text: '#16A34A' },
  ditolak:   { label: 'Ditolak',   bg: 'rgba(239,68,68,0.1)',   text: '#DC2626' },
}

interface PoItem { id: number; produk_nama: string; gramasi: string; qty_diminta: number; qty_dikirim: number | null; qty_diterima: number | null; diterima_by: string | null; catatan_item: string | null }
interface Po { id: number; kode: string; cabang_kode: string; cabang_nama: string; tanggal: string; status: string; catatan: string | null; catatan_admin: string | null; created_at: string; items: PoItem[] }

type TabFilter = 'semua' | 'diproses' | 'selesai' | 'ditolak'

export default function PoCabangClient({
  poList, cabangList, userRole, userName, page = 1, total = 0, pageSize = 20,
}: {
  poList: Po[]; cabangList: { kode: string; nama: string }[]; userRole: string; userName: string
  page?: number; total?: number; pageSize?: number
}) {
  useRealtimeRefresh(['po_cabang','po_cabang_item'])
  const [isPending, start] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Po | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('semua')

  const canApprove = true /* ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv'].includes(userRole) */
  const canDelete  = true /* ROLE_CHECK_DISABLED: ['owner', 'admin_pusat'].includes(userRole) */

  function handleUpdateStatus(poId: number, status: 'diproses' | 'selesai' | 'ditolak', catatan?: string) {
    start(async () => {
      const r = await updateStatusPO(poId, status, catatan)
      if (r?.error) { toast.error(r.error); return }
      toast.success(`Status PO diubah ke ${status}`)
    })
  }

  function handleDelete(poId: number) {
    if (!confirm('Hapus PO ini?')) return
    start(async () => {
      const r = await deletePO(poId)
      if (r?.error) { toast.error(r.error); return }
      toast.success('PO dihapus')
    })
  }

  const counts = {
    semua:    poList.length,
    diproses: poList.filter(p => p.status === 'diproses' || p.status === 'menunggu' || p.status === 'pending').length,
    selesai:  poList.filter(p => p.status === 'selesai').length,
    ditolak:  poList.filter(p => p.status === 'ditolak').length,
  }

  const displayed = useMemo(() => {
    let list = poList
    if (tab === 'diproses') list = list.filter(p => ['diproses','menunggu','pending'].includes(p.status))
    else if (tab === 'selesai') list = list.filter(p => p.status === 'selesai')
    else if (tab === 'ditolak') list = list.filter(p => p.status === 'ditolak')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.kode.toLowerCase().includes(q) ||
        p.cabang_nama.toLowerCase().includes(q) ||
        p.items.some(it => it.gramasi.includes(q))
      )
    }
    return list
  }, [poList, tab, search])

  const TABS: { key: TabFilter; label: string; count: number }[] = [
    { key: 'semua',    label: 'Semua',    count: counts.semua    },
    { key: 'diproses', label: 'Diproses', count: counts.diproses },
    { key: 'selesai',  label: 'Selesai',  count: counts.selesai  },
    { key: 'ditolak',  label: 'Ditolak',  count: counts.ditolak  },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">PO Cabang</h1>
            <p className="text-[12px] text-slate-400">
              {counts.diproses} diproses · {counts.selesai} selesai
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-sky-500 hover:bg-sky-600">
          <Plus size={15} /> Buat PO
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors ${
              tab === t.key
                ? 'bg-sky-500 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode PO, cabang, atau gramasi..."
          className="w-full h-9 pl-8 pr-8 text-[12px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/40" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={12} />
          </button>
        )}
      </div>

      {/* PO list */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
            <ClipboardList size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-slate-300 text-[13px]">
              {search ? `Tidak ada PO cocok dengan "${search}"` : 'Belum ada PO.'}
            </p>
          </div>
        )}
        <PaginationBar page={page} total={total} pageSize={pageSize} label="PO" />
        {displayed.map(po => {
          const cfg = STATUS_CFG[po.status] ?? STATUS_CFG.pending
          const isOpen = expanded === po.id
          const totalDiminta = po.items.reduce((s, it) => s + it.qty_diminta, 0)
          const totalDikirim = po.items.reduce((s, it) => s + (it.qty_dikirim ?? 0), 0)
          const canEdit = po.status !== 'selesai' && po.status !== 'ditolak'
          return (
            <div key={po.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Expand toggle */}
                <button onClick={() => setExpanded(isOpen ? null : po.id)}
                  className="flex-1 flex items-center gap-4 text-left hover:bg-slate-50/50 -mx-5 px-5 -my-4 py-4 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-[13px] text-sky-700">{po.kode}</span>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-700 mt-0.5">{po.cabang_nama}</p>
                    <p className="text-[12px] text-slate-400">{formatDate(po.tanggal)} · {po.items.length} item · {totalDiminta} pcs diminta</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
                </button>

                {/* Action buttons — always visible */}
                {canEdit && (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button onClick={() => setEditTarget(po)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center text-slate-400 transition-colors"
                      title="Edit PO">
                      <Pencil size={13} />
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(po.id)} disabled={isPending}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-400 transition-colors"
                        title="Hapus PO">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-4">
                  {/* Items table */}
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50">
                          {['Produk', 'Gramasi', 'Diminta', 'Dikirim', 'Diterima'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((it, i) => {
                          const diterima = it.qty_diterima ?? 0
                          const dikirim  = it.qty_dikirim ?? 0
                          return (
                            <tr key={it.id} className={i % 2 === 0 ? '' : 'bg-slate-50/30'}>
                              <td className="px-3 py-2 text-slate-700 font-medium">{it.produk_nama}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{it.gramasi} gr</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{it.qty_diminta} pcs</td>
                              <td className="px-3 py-2">
                                {canApprove && po.status === 'diproses' ? (
                                  <QtyDikirimInput itemId={it.id} current={dikirim} max={it.qty_diminta} />
                                ) : (
                                  <span className={`font-semibold ${dikirim >= it.qty_diminta ? 'text-blue-600' : 'text-slate-500'}`}>
                                    {dikirim} pcs
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {diterima >= it.qty_diminta ? (
                                  <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    ✓ {diterima} pcs
                                  </span>
                                ) : dikirim > 0 ? (
                                  <KonfirmasiTerimaInput
                                    itemId={it.id} poId={po.id}
                                    current={diterima} maxQty={dikirim}
                                    onDone={() => toast.success('Penerimaan dicatat')}
                                  />
                                ) : (
                                  <span className="text-slate-300 text-[12px]">Belum dikirim</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-600 text-[12px]" colSpan={2}>Total</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{totalDiminta} pcs</td>
                          <td className="px-3 py-2 font-semibold text-blue-600">{totalDikirim} pcs</td>
                          <td className="px-3 py-2 font-semibold text-green-600">
                            {po.items.reduce((s, it) => s + (it.qty_diterima ?? 0), 0)} pcs
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {po.catatan && (
                    <p className="text-[12px] text-slate-500 bg-slate-50 rounded-xl px-4 py-2">
                      <span className="font-semibold">Catatan: </span>{po.catatan}
                    </p>
                  )}
                  {po.catatan_admin && (
                    <p className="text-[12px] text-sky-700 bg-sky-50 rounded-xl px-4 py-2">
                      <span className="font-semibold">Catatan Admin: </span>{po.catatan_admin}
                    </p>
                  )}

                  {/* Hanya tolak masih tersedia — selesai otomatis dari mutasi */}
                  {canApprove && po.status === 'diproses' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStatus(po.id, 'ditolak', 'Ditolak oleh admin')} disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                        <X size={12} /> Tolak PO
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <PaginationBar page={page} total={total} pageSize={pageSize} label="PO" />
      </div>

      {/* Create modal */}
      {showCreate && (
        <PoModal
          cabangList={cabangList}
          onClose={() => setShowCreate(false)}
          onSaved={(kode) => { toast.success(`PO ${kode} dibuat — langsung diproses`); setShowCreate(false) }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <PoModal
          cabangList={cabangList}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { toast.success('PO berhasil diubah'); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

// ── Inline qty dikirim editor ──────────────────────────────────────────────────
function QtyDikirimInput({ itemId, current, max }: { itemId: number; current: number; max: number }) {
  const [val, setVal] = useState(String(current))
  const [isPending, start] = useTransition()
  function save() {
    const n = parseInt(val)
    if (isNaN(n) || n < 0 || n > max) return
    start(async () => { await updateQtyDikirim(itemId, n) })
  }
  return (
    <div className="flex items-center gap-1">
      <input type="number" min="0" max={max} value={val} onChange={e => setVal(e.target.value)}
        onBlur={save} disabled={isPending}
        className="w-16 h-7 px-2 text-[12px] rounded-xl border border-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-sky-300" />
      <span className="text-[10px] text-slate-400">/{max}</span>
    </div>
  )
}

// ── Konfirmasi Terima Input ────────────────────────────────────────────────────
function KonfirmasiTerimaInput({ itemId, poId, current, maxQty, onDone }: {
  itemId: number; poId: number; current: number; maxQty: number; onDone: () => void
}) {
  const [val, setVal] = useState(String(maxQty))
  const [isPending, start] = useTransition()
  function confirm() {
    const n = parseInt(val)
    if (isNaN(n) || n < 0 || n > maxQty) return
    start(async () => {
      await konfirmasiTerimaPoItem({ itemId, poId, qtyDiterima: n })
      onDone()
    })
  }
  return (
    <div className="flex items-center gap-1">
      <input type="number" min="0" max={maxQty} value={val} onChange={e => setVal(e.target.value)}
        className="w-14 h-7 px-2 text-[12px] rounded-xl border border-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-green-300" />
      <span className="text-[10px] text-slate-400">/{maxQty}</span>
      <button onClick={confirm} disabled={isPending}
        className="text-[10px] font-semibold text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
        {isPending ? '...' : 'Terima'}
      </button>
    </div>
  )
}

// ── Create / Edit PO Modal ─────────────────────────────────────────────────────
type NewItem = { produk_nama: string; gramasi: string; qty_diminta: number; catatan_item: string }

function PoModal({ cabangList, initial, onClose, onSaved }: {
  cabangList: { kode: string; nama: string }[]
  initial?: Po
  onClose: () => void
  onSaved: (kode?: string) => void
}) {
  const isEdit = !!initial
  const [isPending, start] = useTransition()
  const [err, setErr] = useState('')
  const [cabangKode, setCabangKode] = useState(initial?.cabang_kode ?? '')
  const [tanggal, setTanggal] = useState(initial?.tanggal ?? today)
  const [catatan, setCatatan] = useState(initial?.catatan ?? '')
  const [items, setItems] = useState<NewItem[]>(
    initial?.items.map(it => ({
      produk_nama: it.produk_nama,
      gramasi: it.gramasi,
      qty_diminta: it.qty_diminta,
      catatan_item: it.catatan_item ?? '',
    })) ?? [{ produk_nama: '', gramasi: '1', qty_diminta: 1, catatan_item: '' }]
  )

  const addItem = () => setItems(p => [...p, { produk_nama: '', gramasi: '1', qty_diminta: 1, catatan_item: '' }])
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i))
  const setItem = (i: number, k: keyof NewItem, v: string | number) =>
    setItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it))

  function handleSubmit() {
    if (!cabangKode) { setErr('Cabang wajib dipilih'); return }
    const cabang = cabangList.find(c => c.kode === cabangKode)
    const fd = new FormData()
    fd.set('cabang_kode', cabangKode)
    fd.set('cabang_nama', cabang?.nama ?? '')
    fd.set('tanggal', tanggal)
    fd.set('catatan', catatan)
    fd.set('items', JSON.stringify(items.map(it => ({
      ...it,
      produk_nama: it.produk_nama || `LM REI ${it.gramasi}GR`,
      qty_diminta: Number(it.qty_diminta),
    }))))
    start(async () => {
      if (isEdit) {
        const r = await editPO(initial!.id, fd)
        if (r?.error) { setErr(r.error); return }
        onSaved()
      } else {
        const r = await createPO(fd)
        if (r?.error) { setErr(r.error); return }
        onSaved(r.kode!)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{isEdit ? `Edit PO — ${initial!.kode}` : 'Buat PO Baru'}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? 'Ubah detail PO' : 'Status langsung Diproses'}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {err && <p className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Cabang Tujuan *</label>
              <select value={cabangKode} onChange={e => setCabangKode(e.target.value)} className={inp}>
                <option value="">Pilih cabang…</option>
                {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal *</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} className={inp} placeholder="Opsional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-medium text-slate-500">Item pesanan *</label>
              <button onClick={addItem} className="flex items-center gap-1 text-[12px] text-sky-600 font-semibold hover:underline">
                <Plus size={12} /> Tambah item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_64px_auto] gap-2 items-center">
                  <input value={it.produk_nama} onChange={e => setItem(i, 'produk_nama', e.target.value)}
                    className={inp} placeholder={`LM REI ${it.gramasi}GR`} />
                  <select value={it.gramasi} onChange={e => setItem(i, 'gramasi', e.target.value)} className={inp}>
                    {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}
                  </select>
                  <input type="number" min="1" value={it.qty_diminta}
                    onChange={e => setItem(i, 'qty_diminta', parseInt(e.target.value) || 1)}
                    className={inp + ' text-center'} />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <div className="text-[10px] text-slate-400 pl-1">Nama Produk · Gramasi · Qty (pcs)</div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="flex-1 h-9 rounded-lg bg-sky-500 hover:bg-sky-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'Simpan Perubahan' : 'Buat PO'}
          </button>
        </div>
      </div>
    </div>
  )
}
