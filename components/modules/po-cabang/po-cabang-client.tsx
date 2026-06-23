'use client'

import { useState, useTransition } from 'react'
import { Plus, X, Check, ChevronDown, ChevronUp, Trash2, ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { createPO, updateStatusPO, updateQtyDikirim, deletePO } from '@/app/(dashboard)/po-cabang/actions'
import { konfirmasiTerimaPoItem } from '@/app/(dashboard)/stok-cabang/actions'

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'
const today = new Date().toISOString().split('T')[0]

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.1)',  text: '#D97706' },
  diproses:  { label: 'Diproses',  bg: 'rgba(59,130,246,0.1)',  text: '#2563EB' },
  partial:   { label: 'Sebagian',  bg: 'rgba(249,115,22,0.1)',  text: '#EA580C' },
  selesai:   { label: 'Selesai',   bg: 'rgba(34,197,94,0.1)',   text: '#16A34A' },
  ditolak:   { label: 'Ditolak',   bg: 'rgba(239,68,68,0.1)',   text: '#DC2626' },
}

interface PoItem { id: number; produk_nama: string; gramasi: string; qty_diminta: number; qty_dikirim: number | null; qty_diterima: number | null; diterima_by: string | null; catatan_item: string | null }
interface Po { id: number; kode: string; cabang_kode: string; cabang_nama: string; tanggal: string; status: string; catatan: string | null; catatan_admin: string | null; created_at: string; items: PoItem[] }

export default function PoCabangClient({
  poList, cabangList, userRole, userName,
}: {
  poList: Po[]; cabangList: { kode: string; nama: string }[]; userRole: string; userName: string
}) {
  const [isPending, start] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const canApprove = ['owner', 'admin_pusat', 'spv'].includes(userRole)
  const canDelete  = ['owner', 'admin_pusat'].includes(userRole)

  function handleUpdateStatus(poId: number, status: 'diproses' | 'selesai' | 'ditolak', catatan?: string) {
    start(async () => {
      const r = await updateStatusPO(poId, status, catatan)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast(`✅ Status PO diubah ke ${status}`)
    })
  }

  function handleDelete(poId: number) {
    if (!confirm('Hapus PO ini?')) return
    start(async () => {
      const r = await deletePO(poId)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ PO dihapus')
    })
  }

  const counts = {
    pending:  poList.filter(p => p.status === 'pending').length,
    diproses: poList.filter(p => p.status === 'diproses').length,
    selesai:  poList.filter(p => p.status === 'selesai').length,
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-[13px] font-semibold text-white shadow-lg bg-violet-700">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-slate-900">PO Cabang</h1>
            <p className="text-[12px] text-slate-400">
              {counts.pending} pending · {counts.diproses} diproses · {counts.selesai} selesai
            </p>
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setErr('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-sky-500 hover:bg-sky-600">
          <Plus size={15} /> Buat PO
        </button>
      </div>

      {/* PO list */}
      <div className="space-y-3">
        {poList.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center"
            >
            <ClipboardList size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-slate-300 text-[13px]">Belum ada PO. Buat PO baru dari tombol di atas.</p>
          </div>
        )}
        {poList.map(po => {
          const cfg = STATUS_CFG[po.status] ?? STATUS_CFG.pending
          const isOpen = expanded === po.id
          const totalDiminta = po.items.reduce((s, it) => s + it.qty_diminta, 0)
          const totalDikirim = po.items.reduce((s, it) => s + (it.qty_dikirim ?? 0), 0)
          return (
            <div key={po.id} className="rounded-xl overflow-hidden"
              >
              <button onClick={() => setExpanded(isOpen ? null : po.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[13px] text-sky-700">{po.kode}</span>
                    <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700 mt-0.5">{po.cabang_nama}</p>
                  <p className="text-[12px] text-slate-400">{formatDate(po.tanggal)} · {po.items.length} item · {totalDiminta} pcs diminta</p>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4">
                  {/* Items table */}
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50">
                          {['Produk', 'Gramasi', 'Diminta', 'Dikirim', 'Diterima'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((it, i) => {
                          const diterima = it.qty_diterima ?? 0
                          const dikirim  = it.qty_dikirim ?? 0
                          const sisaKonfirmasi = Math.max(0, dikirim - diterima)
                          return (
                            <tr key={it.id} className={i % 2 === 0 ? '' : 'bg-slate-50/30'}>
                              <td className="px-3 py-2 text-slate-700 font-medium">{it.produk_nama}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{it.gramasi} gr</td>
                              <td className="px-3 py-2 font-bold text-slate-800">{it.qty_diminta} pcs</td>
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
                                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    ✓ {diterima} pcs
                                  </span>
                                ) : dikirim > 0 ? (
                                  <KonfirmasiTerimaInput
                                    itemId={it.id} poId={po.id}
                                    current={diterima} maxQty={dikirim}
                                    onDone={() => showToast('✅ Penerimaan dicatat')}
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
                          <td className="px-3 py-2 font-bold text-slate-600 text-[12px]" colSpan={2}>Total</td>
                          <td className="px-3 py-2 font-bold text-slate-800">{totalDiminta} pcs</td>
                          <td className="px-3 py-2 font-bold text-blue-600">{totalDikirim} pcs</td>
                          <td className="px-3 py-2 font-bold text-green-600">
                            {po.items.reduce((s, it) => s + (it.qty_diterima ?? 0), 0)} pcs
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Notes */}
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

                  {/* Actions */}
                  {canApprove && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {po.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateStatus(po.id, 'diproses')} disabled={isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-blue-500 hover:bg-blue-600">
                            <Check size={12} /> Proses
                          </button>
                          <button onClick={() => handleUpdateStatus(po.id, 'ditolak', 'Ditolak oleh admin')} disabled={isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                            <X size={12} /> Tolak
                          </button>
                        </>
                      )}
                      {po.status === 'diproses' && (
                        <button onClick={() => handleUpdateStatus(po.id, 'selesai')} disabled={isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-emerald-500 hover:bg-emerald-600">
                          <Check size={12} /> Tandai Selesai
                        </button>
                      )}
                      {canDelete && po.status !== 'selesai' && (
                        <button onClick={() => handleDelete(po.id)} disabled={isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors ml-auto">
                          <Trash2 size={12} /> Hapus
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreatePoModal
          cabangList={cabangList}
          onClose={() => setShowCreate(false)}
          onCreated={(kode) => { showToast(`✅ PO ${kode} dibuat`); setShowCreate(false) }}
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
        className="text-[10px] font-bold text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
        {isPending ? '...' : 'Terima'}
      </button>
    </div>
  )
}

// ── Create PO Modal ────────────────────────────────────────────────────────────
type NewItem = { produk_nama: string; gramasi: string; qty_diminta: number; catatan_item: string }

function CreatePoModal({ cabangList, onClose, onCreated }: {
  cabangList: { kode: string; nama: string }[]
  onClose: () => void
  onCreated: (kode: string) => void
}) {
  const [isPending, start] = useTransition()
  const [err, setErr] = useState('')
  const [cabangKode, setCabangKode] = useState('')
  const [tanggal, setTanggal] = useState(today)
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState<NewItem[]>([
    { produk_nama: '', gramasi: '1', qty_diminta: 1, catatan_item: '' }
  ])

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
      const r = await createPO(fd)
      if (r?.error) { setErr(r.error); return }
      onCreated(r.kode!)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Buat PO Baru</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Isi detail pesanan ke cabang</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {err && <p className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Cabang Tujuan *</label>
              <select value={cabangKode} onChange={e => setCabangKode(e.target.value)} className={inp}>
                <option value="">Pilih cabang…</option>
                {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal *</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} className={inp} placeholder="Opsional" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Item Pesanan *</label>
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
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Buat PO
          </button>
        </div>
      </div>
    </div>
  )
}
