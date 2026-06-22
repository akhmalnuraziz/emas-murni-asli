'use client'

import { useEffect, useState } from 'react'
import { Warehouse, ShieldCheck, ShieldAlert, RefreshCw, Package } from 'lucide-react'
import { fetchInventoryGudang, type GudangRow } from '@/app/(dashboard)/inventory/actions'

function fgr(n: number) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export default function InventoryClient() {
  const [rows, setRows] = useState<GudangRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetchInventoryGudang()
    if (res.error) setErr(res.error)
    else { setRows(res.rows); setErr(null) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const totalPacked  = rows.reduce((a, r) => a + r.total_packed, 0)
  const totalTagged  = rows.reduce((a, r) => a + r.tershieldtag, 0)
  const totalBelum   = rows.reduce((a, r) => a + r.belum_shieldtag, 0)
  const totalGram    = rows.reduce((a, r) => a + r.total_gram, 0)

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Gudang Pusat</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Semua barang dari packing masuk sini otomatis</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Muat ulang
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Stok Gudang" value={`${totalPacked} pcs`} sub={`${fgr(totalGram)} gr`} icon={<Package size={16} />} tone="violet" />
        <KPI label="Sudah Shieldtag" value={`${totalTagged} pcs`} sub="Siap dikirim ke cabang" icon={<ShieldCheck size={16} />} tone="green" />
        <KPI label="Belum Shieldtag" value={`${totalBelum} pcs`} sub="Perlu didaftarkan dulu" icon={<ShieldAlert size={16} />} tone="amber" />
        <KPI label="Varian" value={`${rows.length}`} sub="jenis gramasi" icon={<Warehouse size={16} />} tone="slate" />
      </div>

      {/* Gate notice */}
      {totalBelum > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200">
          <ShieldAlert size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 leading-relaxed">
            <span className="font-bold">{totalBelum} pcs</span> belum punya shieldtag. Barang sudah ada di gudang,
            tapi <span className="font-semibold">belum bisa dikirim ke cabang</span> — daftarkan shieldtag-nya dulu.
          </p>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="rounded-2xl px-4 py-3 text-[12px] text-red-600 bg-red-50 border border-red-100">{err}</div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-slate-400">Memuat stok gudang…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
              <Package size={24} className="text-violet-400" />
            </div>
            <p className="text-[13px] font-medium text-slate-400">Gudang masih kosong</p>
            <p className="text-[12px] text-slate-300 mt-1">Barang masuk otomatis setelah ada Packing Log.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3">Gramasi</th>
                  <th className="text-right px-4 py-3">Total Gudang</th>
                  <th className="text-right px-4 py-3">Tershieldtag</th>
                  <th className="text-right px-4 py-3">Belum Shieldtag</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.gramasi} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{r.gramasi}gr</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{r.total_packed} pcs</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{r.tershieldtag} pcs</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">{r.belum_shieldtag} pcs</td>
                    <td className="px-4 py-3 text-center">
                      {r.belum_shieldtag === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                          <ShieldCheck size={11} /> Siap mutasi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                          <ShieldAlert size={11} /> Sebagian belum
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, sub, icon, tone }: { label: string; value: string; sub: string; icon: React.ReactNode; tone: string }) {
  const tones: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    slate:  'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tones[tone] ?? tones.slate}`}>{icon}</div>
      </div>
      <p className="text-[20px] font-bold text-slate-900 leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}
