'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Tag, Hammer, Package2, AlertTriangle, ArrowLeftRight,
  TrendingUp, ShoppingCart, RotateCcw, Layers, Flame,
  Scale, Thermometer, CheckCircle2, Clock,
} from 'lucide-react'
import { cn, formatRupiah, formatDate } from '@/lib/utils'

interface Props {
  userName: string
  userRole: string
  canSeeRp: boolean
  stok: { pcs: number; gram: number; nilaiRp: number }
  transit: { pcs: number; gram: number }
  penjualan: { pcs: number; omzetRp: number; buybackCount: number }
  reject: { count: number; gram: number }
  pipeline: Record<string, number>
  gramasiChartData: { gramasi: string; pcs: number }[]
  batchTerbaru: any[]
  mutasiTransit: any[]
}

const PIPELINE_STAGES = [
  { key: 'Cutting',      label: 'Cutting',      icon: Hammer,       color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  { key: 'Pas Berat',    label: 'Pas Berat',    icon: Scale,        color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
  { key: 'Annealing',    label: 'Annealing',    icon: Thermometer,  color: '#EAB308', bg: 'rgba(234,179,8,0.08)'  },
  { key: 'Siap Packing', label: 'Siap Packing', icon: Package2,     color: '#22C55E', bg: 'rgba(34,197,94,0.08)'  },
]

export default function DashboardClient({
  userName, canSeeRp,
  stok, transit, penjualan, reject, pipeline, gramasiChartData, batchTerbaru, mutasiTransit,
}: Props) {
  const now = new Date()
  const jam = now.getHours()
  const greeting = jam < 12 ? 'Selamat Pagi' : jam < 15 ? 'Selamat Siang' : jam < 19 ? 'Selamat Sore' : 'Selamat Malam'
  const bulan = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const hasBalanceAlert = reject.count > 0 || transit.pcs > 20

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-3xl px-6 py-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'white' }} />
        <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full opacity-5"
          style={{ background: 'white' }} />
        <p className="text-sm font-medium text-violet-200 relative">{greeting}, {userName || 'Tim'}! 👋</p>
        <h2 className="text-xl font-black mt-1 relative">PT Emas Murni Asli</h2>
        <p className="text-violet-200 text-xs mt-1 relative">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Balance Alert */}
      {hasBalanceAlert && (
        <div className="rounded-3xl px-5 py-4 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={15} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">Perlu Perhatian</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {reject.count > 0 && (
                <p className="text-xs text-red-600">
                  {reject.count} item reject ({reject.gram.toFixed(2)} gr) belum dilebur
                </p>
              )}
              {transit.pcs > 20 && (
                <p className="text-xs text-red-600">
                  {transit.pcs} pcs sedang transit ke cabang, belum konfirmasi terima
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row 1 — Main KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Stok Aktif"
          value={stok.pcs.toLocaleString('id-ID') + ' pcs'}
          sub={stok.gram.toFixed(2) + ' gr'}
          sub2={canSeeRp ? formatRupiah(stok.nilaiRp) : undefined}
          icon={Tag} color="#7C3AED" bg="rgba(124,58,237,0.08)"
        />
        <KpiCard
          label="Transit Cabang"
          value={transit.pcs.toLocaleString('id-ID') + ' pcs'}
          sub={transit.gram.toFixed(2) + ' gr'}
          icon={ArrowLeftRight} color="#0EA5E9" bg="rgba(14,165,233,0.08)"
          alert={transit.pcs > 0}
        />
        <KpiCard
          label={`Terjual (${bulan})`}
          value={penjualan.pcs.toLocaleString('id-ID') + ' pcs'}
          sub={canSeeRp ? formatRupiah(penjualan.omzetRp) : undefined}
          sub2={penjualan.buybackCount > 0 ? `${penjualan.buybackCount} buyback` : undefined}
          icon={ShoppingCart} color="#16A34A" bg="rgba(22,163,74,0.08)"
        />
        <KpiCard
          label="Reject Belum Dilebur"
          value={reject.count + ' item'}
          sub={reject.gram.toFixed(2) + ' gr'}
          icon={AlertTriangle} color={reject.count > 0 ? '#EF4444' : '#94A3B8'}
          bg={reject.count > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.08)'}
          alert={reject.count > 0}
        />
      </div>

      {/* Row 2 — Production Pipeline */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pipeline Produksi</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(({ key, label, icon: Icon, color, bg }) => {
            const count = pipeline[key] ?? 0
            return (
              <div key={key} className="rounded-3xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-800">{count}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">{label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Row 3 — Chart + Mutasi Transit */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Chart stok per gramasi */}
        <div className="rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-violet-500" />
            <h3 className="font-bold text-slate-800 text-sm">Stok Aktif per Gramasi</h3>
          </div>
          {gramasiChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gramasiChartData} barSize={24}>
                <XAxis dataKey="gramasi" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }}
                  cursor={{ fill: '#f5f3ff' }}
                />
                <Bar dataKey="pcs" radius={[6, 6, 0, 0]}>
                  {gramasiChartData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#7C3AED' : '#A78BFA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="Belum ada stok shieldtag aktif" />
          )}
        </div>

        {/* Mutasi transit */}
        <div className="rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-sky-500" />
            <h3 className="font-bold text-slate-800 text-sm">Mutasi Menunggu Konfirmasi</h3>
          </div>
          {mutasiTransit.length > 0 ? (
            <div className="space-y-2">
              {mutasiTransit.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{m.tujuan_cabang ?? 'Cabang'}</p>
                    <p className="text-xs text-slate-400">{formatDate(m.tanggal_kirim)}</p>
                  </div>
                  <span className="text-sm font-bold text-sky-600">{m.pcs} pcs</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart text="Tidak ada mutasi yang menunggu" icon="✅" />
          )}
        </div>
      </div>

      {/* Row 4 — Batch terbaru */}
      <div className="rounded-3xl p-5"
        style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Layers size={15} className="text-amber-500" />
          <h3 className="font-bold text-slate-800 text-sm">Batch Aktif</h3>
        </div>
        {batchTerbaru.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Kode', 'Tanggal', 'Supplier', 'Berat Akhir', 'Siap Cetak', 'Status'].map(h => (
                    <th key={h} className="text-left pb-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchTerbaru.map((b: any, i: number) => (
                  <tr key={b.kode} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="py-2.5 pr-4 font-mono text-xs font-bold text-violet-700">{b.kode}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">{formatDate(b.tanggal)}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{b.supplier ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-sm font-semibold text-slate-800">
                      {b.timbangan_akhir ? `${Number(b.timbangan_akhir).toFixed(2)} gr` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-sm font-semibold text-emerald-700">
                      {b.bahan_siap_cetak ? `${Number(b.bahan_siap_cetak).toFixed(2)} gr` : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-full',
                        b.status === 'Selesai' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      )}>
                        {b.status ?? 'Proses'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyChart text="Belum ada batch" />
        )}
      </div>

    </div>
  )
}

function KpiCard({ label, value, sub, sub2, icon: Icon, color, bg, alert }: {
  label: string; value: string; sub?: string; sub2?: string
  icon: any; color: string; bg: string; alert?: boolean
}) {
  return (
    <div className={cn(
      'rounded-3xl p-4',
      alert ? 'ring-1 ring-red-200' : ''
    )} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: bg }}>
        <Icon size={17} style={{ color }} />
      </div>
      <p className="text-xl font-black text-slate-800 leading-tight">{value}</p>
      {sub  && <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{sub}</p>}
      {sub2 && <p className="text-[11px] text-violet-500 font-semibold">{sub2}</p>}
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">{label}</p>
    </div>
  )
}

function EmptyChart({ text, icon = '📊' }: { text: string; icon?: string }) {
  return (
    <div className="h-40 flex flex-col items-center justify-center gap-2">
      <span className="text-2xl opacity-20">{icon}</span>
      <p className="text-xs text-slate-300">{text}</p>
    </div>
  )
}
