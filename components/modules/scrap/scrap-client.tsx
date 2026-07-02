'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRealtimeRefresh } from '@/lib/supabase/use-realtime-refresh'
import { toast } from 'sonner'
import { Plus, X, Trash2, Search, Package, Pencil, ChevronDown, ChevronUp, Flame } from 'lucide-react'
import { createScrap, voidScrap, editScrap } from '@/app/(dashboard)/scrap/actions'
import { formatDate } from '@/lib/utils'

const cn = (...c: (string|undefined|false)[]) => c.filter(Boolean).join(' ')
const fmtGram = (n: number) => `${Number(n).toFixed(3)} gr`

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  tersedia: { label: 'Tersedia',  bg: 'rgba(34,197,94,0.1)',   text: '#16A34A' },
  sebagian: { label: 'Sebagian',  bg: 'rgba(245,158,11,0.1)',  text: '#D97706' },
  terpakai: { label: 'Terpakai',  bg: 'rgba(59,130,246,0.1)',  text: '#2563EB' },
  dilebur:  { label: 'Dilebur',   bg: 'rgba(139,92,246,0.1)',  text: '#7C3AED' },
}

const SUMBER_LABEL: Record<string, string> = {
  manual: 'Manual',
  serbuk_produksi: 'Serbuk Produksi',
  buyback: 'Buyback Reject',
}

interface Usage { scrap_id: number; peleburan_kode: string | null; gram: number; created_at: string }

interface Props {
  scrapList: any[]
  adminList: any[]
  usageList: Usage[]
  userRole: string
  userName: string
  canManage: boolean
}

const SCRAP_PAGE_SIZE = 50

export default function ScrapClient({ scrapList, adminList, usageList, canManage }: Props) {
  useRealtimeRefresh(['scrap_inventory'])
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [voidModal, setVoidModal] = useState<any | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [err, setErr] = useState('')

  const usageMap: Record<number, Usage[]> = {}
  for (const u of usageList) {
    (usageMap[u.scrap_id] ??= []).push(u)
  }

  const filtered = scrapList.filter(s => {
    if (filterStatus !== 'semua' && s.status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q || s.kode?.toLowerCase().includes(q) || s.batch_kode?.toLowerCase().includes(q)
      || s.sumber_proses?.toLowerCase().includes(q) || s.catatan?.toLowerCase().includes(q)
  })
  const totalPages = Math.ceil(filtered.length / SCRAP_PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * SCRAP_PAGE_SIZE, page * SCRAP_PAGE_SIZE)

  const totalBerat = scrapList.reduce((s, i) => s + Number(i.berat_gram ?? 0), 0)
  const totalSisa  = scrapList.filter(i => ['tersedia', 'sebagian'].includes(i.status))
    .reduce((s, i) => s + Number(i.berat_sisa ?? 0), 0)

  function handleCreate(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const r = await createScrap(fd)
      if (r?.error) { setErr(r.error); return }
      toast.success(`Scrap ${(r as any).kode} ditambahkan`)
      setModal(null)
    })
  }

  function handleEdit(fd: FormData) {
    if (!editTarget) return
    setErr('')
    startTransition(async () => {
      const r = await editScrap(editTarget.id, fd)
      if (r?.error) { setErr(r.error); return }
      toast.success('Scrap diperbarui')
      setModal(null)
    })
  }

  const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-800">Inventori Scrap</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Serbuk produksi, buyback reject, dan scrap manual — bahan daur ulang untuk peleburan</p>
        </div>
        {canManage && (
          <button onClick={() => { setModal('create'); setErr('') }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-white rounded-xl bg-violet-600 hover:bg-violet-700 transition-colors">
            <Plus size={14}/> Tambah Scrap
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Scrap', val: fmtGram(totalBerat), color: '#64748B' },
          { label: 'Sisa Tersedia', val: fmtGram(totalSisa), color: '#16A34A' },
          { label: 'Entri', val: `${scrapList.length} item`, color: '#7C3AED' },
        ].map(c => (
          <div key={c.label} className="rounded-xl px-4 py-3 bg-white border border-slate-200">
            <p className="text-[10px] font-medium text-slate-400">{c.label}</p>
            <p className="text-[16px] font-semibold mt-0.5" style={{ color: c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex gap-2 flex-wrap items-center">
        {['semua','tersedia','sebagian','terpakai','dilebur'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${filterStatus === s ? 'text-white' : 'bg-white text-slate-500 border border-slate-300/50'}`}
            style={filterStatus === s
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }
              : undefined}>
            {s === 'semua' ? 'Semua' : STATUS_CFG[s]?.label ?? s}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari kode, batch, sumber..."
            className="pl-8 pr-3 h-9 w-52 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200"/>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                {['KODE','ASAL','SUMBER','BERAT AWAL','TERPAKAI','SISA','STATUS','TGL','AKSI'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12">
                  <Package size={28} className="text-slate-200 mx-auto mb-2"/>
                  <p className="text-[13px] text-slate-400">Belum ada data scrap</p>
                </td></tr>
              ) : paginated.map((s, i) => {
                const cfg = STATUS_CFG[s.status] ?? STATUS_CFG['tersedia']
                const usages = usageMap[s.id] ?? []
                const expanded = expandedId === s.id
                return (
                  <Fragment key={s.id}>
                  <tr
                    onClick={() => usages.length > 0 && setExpandedId(expanded ? null : s.id)}
                    className={cn('border-t border-slate-50 hover:bg-slate-50/50', i === 0 ? 'border-transparent' : '', usages.length > 0 ? 'cursor-pointer' : '')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-semibold text-slate-700">{s.kode}</span>
                        {usages.length > 0 && (expanded ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">
                      {s.batch_kode || '—'}{s.gramasi ? <span className="text-slate-400"> · {s.gramasi}gr</span> : null}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{SUMBER_LABEL[s.sumber_proses] ?? s.sumber_proses}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{fmtGram(s.berat_gram)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-500">{fmtGram(s.berat_terpakai ?? 0)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: Number(s.berat_sisa) > 0 ? '#16A34A' : '#94A3B8' }}>
                      {fmtGram(s.berat_sisa ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(s.tanggal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canManage && !s.sumber_ref && ['tersedia','sebagian'].includes(s.status) && (
                          <button onClick={e => { e.stopPropagation(); setEditTarget(s); setErr(''); setModal('edit') }}
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors">
                            <Pencil size={11}/>
                          </button>
                        )}
                        {canManage && (
                          <button onClick={e => { e.stopPropagation(); setVoidModal(s); setVoidReason('') }}
                            className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
                            <Trash2 size={11}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && usages.length > 0 && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={9} className="px-6 py-3">
                        <p className="text-[10px] font-medium text-slate-400 mb-1.5">RIWAYAT PEMAKAIAN</p>
                        <div className="space-y-1">
                          {usages.map((u, j) => (
                            <div key={j} className="flex items-center gap-2 text-[12px]">
                              <Flame size={11} className="text-violet-400"/>
                              <span className="font-mono font-semibold text-slate-600">{u.peleburan_kode ?? '—'}</span>
                              <span className="text-slate-500">memakai <span className="font-semibold">{fmtGram(u.gram)}</span></span>
                              <span className="text-slate-400 ml-auto">{formatDate(u.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{filtered.length} item · Hal {page} dari {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Sebelumnya
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Berikutnya →
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || (modal === 'edit' && editTarget)) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">
                {modal === 'create' ? 'Tambah Scrap Manual' : `Edit Scrap ${editTarget.kode}`}
              </h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <form id="scrap-form"
              onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); modal === 'create' ? handleCreate(fd) : handleEdit(fd) }}
              className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
                <input name="tanggal" type="date" required
                  defaultValue={modal === 'edit' ? editTarget.tanggal?.split('T')[0] : new Date().toISOString().split('T')[0]} className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat (gr) <span className="text-red-500">*</span></label>
                <input name="berat_gram" type="number" step="0.001" min="0.001" required placeholder="0.000"
                  defaultValue={modal === 'edit' ? editTarget.berat_gram : undefined} className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Keterangan</label>
                <input name="catatan" placeholder="opsional"
                  defaultValue={modal === 'edit' ? editTarget.catatan ?? '' : undefined} className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Admin Input</label>
                <select name="admin_input" defaultValue={modal === 'edit' ? editTarget.admin_input ?? '' : ''} className={inp}>
                  <option value="">— Pilih Admin —</option>
                  {adminList.map((a: any) => <option key={a.id} value={a.nama}>{a.nama}</option>)}
                </select>
              </div>
              {err && <p className="text-[12px] text-red-500 font-semibold">{err}</p>}
            </form>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
              <button type="button" onClick={() => setModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button type="submit" form="scrap-form" disabled={isPending} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void confirm */}
      {voidModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">Void Scrap {voidModal.kode}?</h2>
              <button onClick={() => setVoidModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
                <p className="font-semibold">Scrap akan di-void dan tidak bisa diaktifkan kembali.</p>
              </div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Alasan Void <span className="text-red-500">*</span></label>
                <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                  placeholder="Alasan void..." className={inp}/>
              </div>
            </div>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200">
              <button onClick={() => setVoidModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button disabled={!voidReason.trim() || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await voidScrap(voidModal.id, voidReason)
                    if (r?.error) toast.error(r.error); else { toast.success('Scrap di-void'); setVoidModal(null) }
                  })
                }}
                className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {isPending ? 'Memproses...' : 'Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
