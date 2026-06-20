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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            <Warehouse size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Gudang Pusat</h1>
            <p className="text-xs text-slate-400">Semua barang dari packing masuk sini otomatis</p>
          </div>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
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
        <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-bold">{totalBelum} pcs</span> belum punya shieldtag. Barang udah ada di gudang,
            tapi <span className="font-semibold">belum bisa dikirim ke cabang</span> — daftarkan shieldtag-nya dulu ya!
          </p>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="rounded-2xl px-4 py-3 text-xs text-red-600 bg-red-50 border border-red-100">{err}</div>
      )}

      {/* Table */}
      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Memuat stok gudang…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(139,92,246,0.08)' }}>
              <Package size={28} className="text-violet-300" />
            </div>
            <p className="text-sm text-slate-400">Gudang masih kosong nih 📦</p>
            <p className="text-xs text-slate-300 mt-1">Barang bakal masuk otomatis setelah ada Packing Log.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wide"
                  style={{ background: 'rgba(139,92,246,0.04)' }}>
                  <th className="text-left px-4 py-3">Gramasi</th>
                  <th className="text-right px-4 py-3">Total Gudang</th>
                  <th className="text-right px-4 py-3">Tershieldtag</th>
                  <th className="text-right px-4 py-3">Belum Shieldtag</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.gramasi} className={i % 2 ? 'bg-white/40' : ''}
                    style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
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
  const tones: Record<string, { bg: string; fg: string }> = {
    violet: { bg: 'rgba(139,92,246,0.1)', fg: '#7C3AED' },
    green:  { bg: 'rgba(34,197,94,0.1)',  fg: '#16A34A' },
    amber:  { bg: 'rgba(245,158,11,0.1)', fg: '#D97706' },
    slate:  { bg: 'rgba(100,116,139,0.1)', fg: '#475569' },
  }
  const t = tones[tone] ?? tones.slate
  return (
    <div className="rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: t.bg, color: t.fg }}>{icon}</div>
      </div>
      <p className="text-xl font-extrabold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
