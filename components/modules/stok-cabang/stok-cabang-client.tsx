'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Store, Package, Clock, TrendingUp, RefreshCw,
  ChevronDown, ChevronRight, SlidersHorizontal,
  History, AlertTriangle, CheckCircle2, X, Download, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CabangStokSummary } from '@/app/(dashboard)/stok-cabang/actions'
import { createStockAdjustment, getAdjustmentHistory, exportStokCabangCsv } from '@/app/(dashboard)/stok-cabang/actions'

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  stokData: CabangStokSummary[]
  userRole: string
  canAdjust: boolean
  isCabangView?: boolean
}

export default function StokCabangClient({ stokData, canAdjust, isCabangView }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(stokData[0]?.kode ?? null)
  const [search, setSearch] = useState('')

  const filteredData = search.trim()
    ? stokData.filter(c => c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase()))
    : stokData
  const [adjModal, setAdjModal] = useState<{ cabang: CabangStokSummary; gramasi?: string } | null>(null)
  const [histModal, setHistModal] = useState<{ cabang: CabangStokSummary } | null>(null)
  const [histData, setHistData] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  function handleExport() {
    startTransition(async () => {
      const { csv, error } = await exportStokCabangCsv()
      if (error || !csv) return
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `stok-cabang-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  async function openHistory(cabang: CabangStokSummary) {
    setHistModal({ cabang })
    setHistLoading(true)
    const data = await getAdjustmentHistory(cabang.kode)
    setHistData(data)
    setHistLoading(false)
  }

  const totalReadyAll  = stokData.reduce((s, c) => s + c.total_ready, 0)
  const totalOutAll    = stokData.reduce((s, c) => s + c.total_outstanding, 0)
  const totalStokAll   = stokData.reduce((s, c) => s + c.total_stok, 0)

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-600">
            <Store size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">Stok Cabang</h1>
            <p className="text-[12px] text-slate-400">Ready stock + outstanding PO per cabang</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={refresh}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
            <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI summary semua cabang */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Ready Stock" value={totalReadyAll} sub="semua cabang" color="#16A34A" bg="rgba(22,163,74,0.08)" icon={<CheckCircle2 size={16}/>} />
        <KpiCard label="Total Outstanding PO" value={totalOutAll} sub="belum diterima" color="#F97316" bg="rgba(249,115,22,0.08)" icon={<Clock size={16}/>} />
        <KpiCard label="Total Stok" value={totalStokAll} sub="ready + PO" color="#7C3AED" bg="rgba(124,58,237,0.08)" icon={<TrendingUp size={16}/>} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau kode cabang..."
          className="w-full h-9 pl-8 pr-3 text-[12px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300/40"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={12} />
          </button>
        )}
      </div>

      {/* List cabang */}
      {stokData.length === 0 ? (
        <div className="rounded-xl py-16 text-center border border-slate-200 bg-white/70">
          <Store size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[13px] text-slate-400">Belum ada data cabang</p>
          <p className="text-[12px] text-slate-300 mt-1">Tambah cabang dulu di Pengaturan</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="rounded-xl py-12 text-center border border-slate-200 bg-white/70">
          <p className="text-[13px] text-slate-400">Tidak ada cabang cocok dengan "{search}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map(cab => (
            <CabangCard
              key={cab.kode}
              cabang={cab}
              expanded={expanded === cab.kode}
              onToggle={() => setExpanded(expanded === cab.kode ? null : cab.kode)}
              canAdjust={canAdjust}
              onAdjust={(gramasi) => setAdjModal({ cabang: cab, gramasi })}
              onHistory={() => openHistory(cab)}
            />
          ))}
        </div>
      )}

      {/* Adjustment Modal */}
      {adjModal && (
        <AdjustmentModal
          cabang={adjModal.cabang}
          defaultGramasi={adjModal.gramasi}
          onClose={() => setAdjModal(null)}
          onSuccess={() => { setAdjModal(null); refresh() }}
        />
      )}

      {/* History Modal */}
      {histModal && (
        <HistoryModal
          cabang={histModal.cabang}
          data={histData}
          loading={histLoading}
          onClose={() => setHistModal(null)}
        />
      )}
    </div>
  )
}

function CabangCard({ cabang, expanded, onToggle, canAdjust, onAdjust, onHistory }: {
  cabang: CabangStokSummary
  expanded: boolean
  onToggle: () => void
  canAdjust: boolean
  onAdjust: (gramasi?: string) => void
  onHistory: () => void
}) {
  const hasOutstanding = cabang.total_outstanding > 0
  const hasStock = cabang.total_ready > 0

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white/80">
      {/* Cabang header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-50/40">
          <Store size={15} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-[13px] truncate">{cabang.nama}</p>
          <p className="text-[10px] text-slate-400 font-medium">{cabang.kode}</p>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-50 text-green-700">
            <CheckCircle2 size={10} /> {cabang.total_ready} ready
          </span>
          {hasOutstanding && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-600">
              <Clock size={10} /> {cabang.total_outstanding} PO
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700">
            <Package size={10} /> {cabang.total_stok} total
          </span>
          {expanded ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-200">
          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50">
            <p className="text-[11px] text-slate-400 font-medium">
              {cabang.last_adjustment ? `Adj terakhir: ${fmtDate(cabang.last_adjustment)}` : 'Belum ada adjustment'}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                <History size={11} /> Riwayat Adj
              </button>
              {canAdjust && (
                <button onClick={() => onAdjust(undefined)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-colors">
                  <SlidersHorizontal size={11} /> Adjust Stok
                </button>
              )}
            </div>
          </div>

          {/* Stock table */}
          {cabang.rows.length === 0 ? (
            <div className="py-8 text-center">
              <Package size={24} className="mx-auto text-slate-200 mb-2" />
              <p className="text-[12px] text-slate-400">Belum ada stok di cabang ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] font-medium text-slate-400 bg-slate-50/80">
                    <th className="text-left px-5 py-2.5">Gramasi</th>
                    <th className="text-right px-4 py-2.5">Shieldtag</th>
                    <th className="text-right px-4 py-2.5">Adj Net</th>
                    <th className="text-right px-4 py-2.5 text-green-600">Ready Stock</th>
                    <th className="text-right px-4 py-2.5 text-orange-500">Outstanding PO</th>
                    <th className="text-right px-4 py-2.5 text-violet-600">Total Stok</th>
                    {canAdjust && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {cabang.rows.map((row, i) => (
                    <tr key={row.gramasi}
                      className={cn('border-t border-slate-50', i % 2 === 1 ? 'bg-slate-50/30' : '')}>
                      <td className="px-5 py-2.5 font-semibold text-slate-800">{row.gramasi}gr</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 font-mono text-[12px]">{row.qty_shieldtag}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[12px]">
                        <span className={cn(
                          'font-semibold',
                          row.net_adjustment > 0 ? 'text-green-600' :
                          row.net_adjustment < 0 ? 'text-red-500' : 'text-slate-300'
                        )}>
                          {row.net_adjustment > 0 ? '+' : ''}{row.net_adjustment}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-semibold text-green-700">{row.ready_stock}</span>
                        <span className="text-[10px] text-slate-400 ml-1">pcs</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.outstanding_po > 0 ? (
                          <span className="font-semibold text-orange-600">{row.outstanding_po} pcs</span>
                        ) : (
                          <span className="text-slate-200 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-semibold text-violet-700">{row.total_stock}</span>
                        <span className="text-[10px] text-slate-400 ml-1">pcs</span>
                      </td>
                      {canAdjust && (
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => onAdjust(row.gramasi)}
                            className="text-[10px] font-semibold text-violet-500 hover:text-violet-700 hover:underline">
                            Adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                    <td className="px-5 py-2.5 text-[12px] font-semibold text-slate-600">TOTAL</td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-right font-semibold text-green-700">{cabang.total_ready} pcs</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-orange-600">
                      {cabang.total_outstanding > 0 ? `${cabang.total_outstanding} pcs` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-violet-700">{cabang.total_stok} pcs</td>
                    {canAdjust && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="px-5 py-3 flex items-center gap-4 flex-wrap border-t border-slate-50">
            <LegendItem color="text-slate-500" label="Shieldtag = dari sistem mutasi" />
            <LegendItem color="text-green-600" label="Ready Stock = shieldtag + adj" />
            <LegendItem color="text-orange-500" label="Outstanding PO = pesanan belum diterima" />
            <LegendItem color="text-violet-600" label="Total = ready + outstanding" />
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return <p className={`text-[10px] font-medium ${color}`}>• {label}</p>
}

function KpiCard({ label, value, sub, color, bg, icon }: {
  label: string; value: number; sub: string; color: string; bg: string; icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4 border border-slate-200 bg-white/80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-slate-400">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: bg, color }}>{icon}</div>
      </div>
      <p className="text-[20px] font-semibold" style={{ color }}>{value.toLocaleString('id-ID')}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function AdjustmentModal({ cabang, defaultGramasi, onClose, onSuccess }: {
  cabang: CabangStokSummary
  defaultGramasi?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [gramasi, setGramasi] = useState(defaultGramasi ?? '')
  const [qtyAfter, setQtyAfter] = useState('')
  const [alasan, setAlasan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Hitung current ready stock untuk gramasi yang dipilih
  const currentRow = cabang.rows.find(r => r.gramasi === gramasi)
  const currentReady = currentRow?.ready_stock ?? 0

  async function submit() {
    if (!gramasi) return setError('Pilih gramasi dulu')
    const after = parseInt(qtyAfter)
    if (isNaN(after) || after < 0) return setError('Qty harus angka ≥ 0')
    if (!alasan.trim()) return setError('Alasan wajib diisi')
    setLoading(true)
    setError('')
    const res = await createStockAdjustment({
      cabangKode: cabang.kode,
      cabangNama: cabang.nama,
      gramasi,
      qtyBefore: currentReady,
      qtyAfter: after,
      alasan,
    })
    setLoading(false)
    if (res.error) setError(res.error)
    else onSuccess()
  }

  const selisih = qtyAfter !== '' ? parseInt(qtyAfter) - currentReady : null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">Adjust Ready Stock</h2>
            <p className="text-[12px] text-slate-400">{cabang.nama} ({cabang.kode})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 bg-amber-50 border border-amber-100">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 leading-relaxed">
              Adjustment ini <strong>tidak mengubah data di Accurate</strong>. Hanya untuk koreksi tampilan stok di website.
              Pastikan sudah disesuaikan juga di Accurate.
            </p>
          </div>

          {/* Gramasi */}
          <div>
            <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">Gramasi</label>
            <select value={gramasi} onChange={e => setGramasi(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
              <option value="">— pilih gramasi —</option>
              {GRAMASI_OPTIONS.map(g => (
                <option key={g} value={g}>{g} gr</option>
              ))}
            </select>
          </div>

          {/* Current vs New */}
          {gramasi && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-medium text-slate-400 mb-1">Stok Sekarang</p>
                <p className="text-[20px] font-semibold text-slate-700">{currentReady}</p>
                <p className="text-[10px] text-slate-400">pcs</p>
              </div>
              <div className="rounded-xl p-3 bg-violet-50 border border-violet-100">
                <p className="text-[10px] font-medium text-violet-500 uppercase mb-1">Stok Baru</p>
                <input
                  type="number" min="0" value={qtyAfter}
                  onChange={e => setQtyAfter(e.target.value)}
                  placeholder="0"
                  className="w-full text-[20px] font-semibold text-violet-700 bg-transparent border-none outline-none"
                />
                {selisih !== null && (
                  <p className={cn('text-[10px] font-semibold', selisih > 0 ? 'text-green-600' : selisih < 0 ? 'text-red-500' : 'text-slate-400')}>
                    {selisih > 0 ? `+${selisih}` : selisih} pcs
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Alasan */}
          <div>
            <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">
              Alasan <span className="text-red-400">*</span>
            </label>
            <textarea
              value={alasan} onChange={e => setAlasan(e.target.value)}
              rows={3} placeholder="Contoh: Hasil stok opname ditemukan selisih 2 pcs"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 resize-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Batal
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ cabang, data, loading, onClose }: {
  cabang: CabangStokSummary
  data: any[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Riwayat Adjustment</h2>
            <p className="text-[12px] text-slate-400">{cabang.nama}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-slate-400">Memuat riwayat...</div>
          ) : data.length === 0 ? (
            <div className="py-8 text-center">
              <History size={24} className="mx-auto text-slate-200 mb-2" />
              <p className="text-[13px] text-slate-400">Belum ada adjustment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((d, i) => (
                <div key={i} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">{d.gramasi}gr</span>
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        d.selisih > 0 ? 'bg-green-50 text-green-700' :
                        d.selisih < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
                      )}>
                        {d.selisih > 0 ? `+${d.selisih}` : d.selisih} pcs
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{fmtDate(d.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {d.qty_before} → {d.qty_after} pcs
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 italic">"{d.alasan}"</p>
                  <p className="text-[10px] text-slate-300 mt-1">oleh {d.created_by_name ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
