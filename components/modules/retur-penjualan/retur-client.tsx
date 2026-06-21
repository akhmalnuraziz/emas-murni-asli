'use client'

import { useState, useTransition } from 'react'
import { Plus, X, Check, AlertTriangle, RotateCcw, Clock, CheckCircle2, XCircle, Search } from 'lucide-react'
import { createRetur, updateStatusRetur, deleteRetur } from '@/app/(dashboard)/retur-penjualan/actions'
import { formatDate, formatRupiah, cn } from '@/lib/utils'

interface Retur {
  id: number; kode: string; tanggal: string
  no_faktur_asal: string | null; nama_customer: string | null; hp_customer: string | null
  alasan: string; kondisi: string; shieldtag_kodes: string[]
  total_nilai: number; status: string; catatan_admin: string | null; created_at: string
}

interface Props {
  returList: Retur[]
  userRole: string
  canManage: boolean
  canSeeRp: boolean
}

const STATUS_CFG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.1)',  text: '#D97706', icon: Clock,        label: 'Pending'   },
  diproses:  { bg: 'rgba(59,130,246,0.1)',  text: '#2563EB', icon: RotateCcw,    label: 'Diproses'  },
  selesai:   { bg: 'rgba(34,197,94,0.1)',   text: '#16A34A', icon: CheckCircle2, label: 'Selesai'   },
  ditolak:   { bg: 'rgba(239,68,68,0.1)',   text: '#DC2626', icon: XCircle,      label: 'Ditolak'   },
}

const KONDISI_LABEL: Record<string, string> = {
  rusak: '⚠️ Rusak/Cacat', salah_produk: '🔄 Salah Produk', lainnya: '📦 Lainnya',
}

export default function ReturClient({ returList, canManage, canSeeRp }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modal, setModal]   = useState<'form' | 'detail' | null>(null)
  const [active, setActive] = useState<Retur | null>(null)
  const [err, setErr]       = useState('')
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [catatanInput, setCatatanInput] = useState('')

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const filtered = returList.filter(r => {
    if (filterStatus !== 'Semua' && r.status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q || r.kode.toLowerCase().includes(q)
      || (r.nama_customer ?? '').toLowerCase().includes(q)
      || (r.no_faktur_asal ?? '').toLowerCase().includes(q)
  })

  const counts = returList.reduce((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a }, {} as Record<string, number>)

  function handleCreate(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const res = await createRetur(fd)
      if (res?.error) { setErr(res.error); return }
      showToast(`✅ Retur ${res.kode} berhasil dicatat`)
      setModal(null)
    })
  }

  function handleStatus(status: 'diproses' | 'selesai' | 'ditolak') {
    if (!active) return
    startTransition(async () => {
      const res = await updateStatusRetur(active.id, status, catatanInput)
      if (res?.error) { showToast(res.error, false); return }
      showToast(`✅ Status diperbarui ke ${status}`)
      setModal(null)
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-5 pb-8">
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-semibold text-white shadow-2xl',
          toast.ok ? 'bg-emerald-600' : 'bg-red-600')}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>} {toast.msg}
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Retur Penjualan</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">{returList.length} retur tercatat</p>
          </div>
          {canManage && (
            <button onClick={() => { setErr(''); setModal('form') }}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
              <Plus size={14}/> Catat Retur
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {['Semua', 'pending', 'diproses', 'selesai', 'ditolak'].map(s => {
            const cfg = STATUS_CFG[s]
            const cnt = s === 'Semua' ? returList.length : (counts[s] ?? 0)
            const isActive = filterStatus === s
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn('flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors',
                  isActive ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50')}>
                {cfg ? cfg.label : 'Semua'} {cnt > 0 && <span className={`px-1 py-0.5 rounded-full text-[10px] ${isActive?'bg-white/25':'bg-slate-100'}`}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode, nama customer, no. faktur..."
            className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"/>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
              <RotateCcw size={28} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-sm text-slate-400">Belum ada retur{filterStatus !== 'Semua' ? ` berstatus ${filterStatus}` : ''}</p>
            </div>
          ) : filtered.map(r => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending
            const Icon = cfg.icon
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => { setActive(r); setCatatanInput(r.catatan_admin ?? ''); setModal('detail') }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-violet-700 text-sm">{r.kode}</span>
                      {r.no_faktur_asal && <span className="text-xs text-slate-400">← {r.no_faktur_asal}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{r.nama_customer ?? 'Customer tidak diketahui'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{KONDISI_LABEL[r.kondisi] ?? r.kondisi} · {r.alasan.slice(0, 80)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-slate-400">{formatDate(r.tanggal)}</span>
                      {r.shieldtag_kodes?.length > 0 && (
                        <span className="text-[10px] text-violet-500">{r.shieldtag_kodes.length} shieldtag</span>
                      )}
                      {canSeeRp && r.total_nilai > 0 && (
                        <span className="text-[10px] font-bold text-slate-600">{formatRupiah(r.total_nilai)}</span>
                      )}
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    <Icon size={11}/> {cfg.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Modal */}
      {modal === 'form' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Catat Retur Penjualan</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Isi detail retur di bawah ini</p>
              </div>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-slate-500"/>
              </button>
            </div>
            <form action={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal *</label>
                    <input name="tanggal" type="date" defaultValue={today} required
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kondisi *</label>
                    <select name="kondisi" required
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all">
                      <option value="rusak">Rusak / Cacat</option>
                      <option value="salah_produk">Salah Produk</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">No. Faktur Asal</label>
                  <input name="no_faktur_asal" placeholder="INV/202X/XXXX (opsional)"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Customer</label>
                    <input name="nama_customer" placeholder="Opsional"
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">No. HP</label>
                    <input name="hp_customer" placeholder="08xx…"
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Kode ShieldTag</label>
                  <input name="shieldtag_kodes" placeholder="A1B2C3, D4E5F6 (pisah koma)"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alasan Retur *</label>
                  <textarea name="alasan" required rows={3} placeholder="Jelaskan alasan retur..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all resize-none"/>
                </div>
                {err && (
                  <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>
                )}
              </div>
              <div className="px-5 py-4 flex gap-2.5 border-t border-slate-100 flex-shrink-0">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
                  {isPending ? 'Menyimpan...' : 'Simpan Retur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Update Status Modal */}
      {modal === 'detail' && active && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">{active.kode}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Detail retur penjualan</p>
              </div>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-slate-500"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3 text-sm">
                <Row label="Customer"    value={active.nama_customer ?? '—'} />
                <Row label="Faktur Asal" value={active.no_faktur_asal ?? '—'} />
                <Row label="Kondisi"     value={KONDISI_LABEL[active.kondisi] ?? active.kondisi} />
                <Row label="Alasan"      value={active.alasan} />
                {active.shieldtag_kodes?.length > 0 && (
                  <Row label="ShieldTag" value={active.shieldtag_kodes.join(', ')} />
                )}
                {canSeeRp && active.total_nilai > 0 && (
                  <Row label="Nilai" value={formatRupiah(active.total_nilai)} />
                )}
                <Row label="Status"      value={STATUS_CFG[active.status]?.label ?? active.status} />
              </div>
              {canManage && active.status !== 'selesai' && active.status !== 'ditolak' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan Admin</label>
                    <textarea value={catatanInput} onChange={e => setCatatanInput(e.target.value)} rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all resize-none"
                      placeholder="Opsional…"/>
                  </div>
                </div>
              )}
            </div>
            {canManage && active.status !== 'selesai' && active.status !== 'ditolak' && (
              <div className="px-5 py-4 flex gap-2.5 border-t border-slate-100 flex-shrink-0">
                {active.status === 'pending' && (
                  <button onClick={() => handleStatus('diproses')} disabled={isPending}
                    className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
                    Proses
                  </button>
                )}
                <button onClick={() => handleStatus('selesai')} disabled={isPending}
                  className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
                  Selesai
                </button>
                <button onClick={() => handleStatus('ditolak')} disabled={isPending}
                  className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
                  Tolak
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-slate-700 flex-1">{value}</span>
    </div>
  )
}
