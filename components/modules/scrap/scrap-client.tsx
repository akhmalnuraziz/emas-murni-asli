'use client'

import { useState, useTransition } from 'react'
import { Plus, X, Trash2, Check, AlertTriangle, Search, Package } from 'lucide-react'
import { createScrap, voidScrap, updateScrapStatus } from '@/app/(dashboard)/scrap/actions'
import { formatDate } from '@/lib/utils'

const cn = (...c: (string|undefined|false)[]) => c.filter(Boolean).join(' ')
const fmtGram = (n: number) => `${Number(n).toFixed(3)} gr`

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  tersedia:  { bg: 'rgba(34,197,94,0.1)',   text: '#16A34A' },
  terpakai:  { bg: 'rgba(59,130,246,0.1)',  text: '#2563EB' },
  dilebur:   { bg: 'rgba(139,92,246,0.1)',  text: '#7C3AED' },
}

const SUMBER = ['manual','lebur','cutting','pas_berat','annealing','packing','reject_qc']

interface Props {
  scrapList: any[]
  timList: any[]
  adminList: any[]
  userRole: string
  userName: string
  canManage: boolean
}

export default function ScrapClient({ scrapList, timList, adminList, canManage }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [modal, setModal] = useState<'create' | null>(null)
  const [voidModal, setVoidModal] = useState<any | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = scrapList.filter(s => {
    if (filterStatus !== 'semua' && s.status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q || s.kode?.toLowerCase().includes(q) || s.batch_kode?.toLowerCase().includes(q) || s.sumber_proses?.toLowerCase().includes(q)
  })

  const totalBerat = scrapList.reduce((s, i) => s + Number(i.berat_gram ?? 0), 0)
  const totalSisa  = scrapList.filter(i => i.status === 'tersedia').reduce((s, i) => s + Number(i.berat_sisa ?? 0), 0)

  function handleCreate(fd: FormData) {
    setErr('')
    startTransition(async () => {
      const r = await createScrap(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`✅ Scrap ${(r as any).kode} ditambahkan`)
      setModal(null)
    })
  }

  const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

  return (
    <div className="space-y-5 pb-20">
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold text-white shadow-2xl',
          toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-800">Scrap Inventory</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Sisa lebihan proses produksi</p>
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
          { label: 'Tersedia', val: fmtGram(totalSisa), color: '#16A34A' },
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
        {['semua','tersedia','terpakai','dilebur'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-all ${filterStatus === s ? 'text-white' : 'bg-white text-slate-500 border border-slate-300/50'}`}
            style={filterStatus === s
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }
              : undefined}>
            {s === 'semua' ? 'Semua' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
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
                {['KODE','BATCH','SUMBER','BERAT','SISA','STATUS','TGL','AKSI'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <Package size={28} className="text-slate-200 mx-auto mb-2"/>
                  <p className="text-[13px] text-slate-400">Belum ada data scrap</p>
                </td></tr>
              ) : filtered.map((s, i) => {
                const cfg = STATUS_CFG[s.status] ?? STATUS_CFG['tersedia']
                return (
                  <tr key={s.id} className={cn('border-t border-slate-50 hover:bg-slate-50/50', i === 0 ? 'border-transparent' : '')}>
                    <td className="px-4 py-3"><span className="font-mono text-[12px] font-semibold text-slate-700">{s.kode}</span></td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{s.batch_kode || '—'}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 capitalize">{s.sumber_proses}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{fmtGram(s.berat_gram)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold" style={{ color: Number(s.berat_sisa) > 0 ? '#16A34A' : '#94A3B8' }}>
                      {fmtGram(s.berat_sisa ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: cfg.bg, color: cfg.text }}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(s.tanggal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canManage && s.status === 'tersedia' && (
                          <button onClick={async () => {
                            const r = await updateScrapStatus(s.id, 'dilebur', s.berat_gram)
                            if (r?.error) showToast(r.error, false); else showToast('✅ Status diperbarui')
                          }} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">
                            Lebur
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => { setVoidModal(s); setVoidReason('') }}
                            className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
                            <Trash2 size={11}/>
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

      {/* Create Modal */}
      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">Tambah Scrap</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <form id="scrap-form" onSubmit={e => { e.preventDefault(); handleCreate(new FormData(e.currentTarget)) }} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal *</label>
                <input name="tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat (gr) *</label>
                <input name="berat_gram" type="number" step="0.001" min="0.001" required placeholder="0.000" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Sumber Proses</label>
                <select name="sumber_proses" className={inp}>
                  {SUMBER.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Batch (opsional)</label>
                <input name="batch_kode" placeholder="mis. B-030" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tim</label>
                <select name="tim_nama" className={inp}>
                  <option value="">— Pilih Tim —</option>
                  {timList.map((t: any) => <option key={t.id} value={t.nama}>{t.nama}</option>)}
                </select>
              </div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
                <input name="catatan" placeholder="opsional" className={inp}/></div>
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
                <p className="font-semibold">⚠️ Scrap akan di-void dan tidak bisa diaktifkan kembali</p>
              </div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Alasan Void *</label>
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
                    if (r?.error) showToast(r.error, false); else { showToast('Scrap di-void'); setVoidModal(null) }
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
