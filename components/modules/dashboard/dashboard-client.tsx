'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Tag, Hammer, Package2, AlertTriangle, Layers, TrendingUp } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { STATUS_BADGE_STYLES } from '@/lib/utils'
import type { StatusProduksi } from '@/lib/types/database'

interface DashboardProps {
  stats: {
    shieldtagAktif: number
    produksiHariIni: number
    siapPacking: number
    reject: number
    batchAktif: number
  }
  produksiTerbaru: any[]
  batchTerbaru: any[]
  gramasiChartData: { gramasi: string; pcs: number }[]
}

const STAT_CARDS = (stats: DashboardProps['stats']) => [
  {
    label: 'Shieldtag Aktif',
    value: stats.shieldtagAktif.toLocaleString('id-ID'),
    icon: Tag,
    color: 'purple',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    border: 'border-violet-100',
  },
  {
    label: 'Produksi Hari Ini',
    value: stats.produksiHariIni.toString(),
    icon: Hammer,
    color: 'blue',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    border: 'border-blue-100',
  },
  {
    label: 'Siap Packing',
    value: stats.siapPacking.toString(),
    icon: Package2,
    color: 'green',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-100',
  },
  {
    label: 'Reject',
    value: stats.reject.toString(),
    icon: AlertTriangle,
    color: 'red',
    bg: 'bg-red-50',
    iconColor: 'text-red-500',
    border: 'border-red-100',
  },
  {
    label: 'Total Batch',
    value: stats.batchAktif.toString(),
    icon: Layers,
    color: 'amber',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    border: 'border-amber-100',
  },
]

export default function DashboardClient({
  stats, produksiTerbaru, batchTerbaru, gramasiChartData
}: DashboardProps) {
  const now = new Date()
  const jam = now.getHours()
  const greeting = jam < 12 ? 'Selamat Pagi' : jam < 15 ? 'Selamat Siang' : jam < 19 ? 'Selamat Sore' : 'Selamat Malam'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl px-6 py-5 text-white">
        <p className="text-sm font-medium text-violet-200">{greeting}! 👋</p>
        <h2 className="text-xl font-bold mt-1">PT Emas Murni Asli Production System</h2>
        <p className="text-violet-200 text-sm mt-1">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS(stats).map((card) => (
          <div
            key={card.label}
            className={cn('bg-white rounded-2xl p-4 border', card.border)}
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', card.bg)}>
              <card.icon size={17} className={card.iconColor} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts + Tables row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Chart: Shieldtag by Gramasi */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-violet-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Stok Shieldtag per Gramasi</h3>
          </div>
          {gramasiChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gramasiChartData} barSize={28}>
                <XAxis dataKey="gramasi" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: '#f5f3ff' }}
                />
                <Bar dataKey="pcs" radius={[6, 6, 0, 0]}>
                  {gramasiChartData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#7c3aed' : '#a78bfa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">
              Belum ada data shieldtag
            </div>
          )}
        </div>

        {/* Batch terbaru */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">Batch Terbaru</h3>
          {batchTerbaru.length > 0 ? (
            <div className="space-y-2">
              {batchTerbaru.map((b: any) => (
                <div key={b.kode} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{b.kode}</p>
                    <p className="text-xs text-slate-400">{formatDate(b.tanggal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">
                      {Number(b.sisa_fisik ?? 0).toFixed(2)} gr
                    </p>
                    <p className="text-[10px] text-slate-400">
                      dari {Number(b.timbangan_akhir ?? 0).toFixed(2)} gr
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">
              Belum ada batch
            </div>
          )}
        </div>
      </div>

      {/* Produksi terbaru */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Produksi Terbaru</h3>
        {produksiTerbaru.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Kode</th>
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Batch</th>
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Gramasi</th>
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">PCS</th>
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {produksiTerbaru.map((p: any) => (
                  <tr key={p.kode} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-2.5 font-mono text-xs text-slate-600">{p.kode}</td>
                    <td className="py-2.5 text-xs text-slate-500">{p.batch_kode ?? '-'}</td>
                    <td className="py-2.5 font-semibold text-slate-700">{p.gramasi} gr</td>
                    <td className="py-2.5 text-slate-600">{p.pcs} pcs</td>
                    <td className="py-2.5">
                      {p.current_status ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                          STATUS_BADGE_STYLES[p.current_status as StatusProduksi] ?? 'bg-gray-50 text-gray-500 border-gray-200'
                        )}>
                          {p.current_status}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-300 text-sm">Belum ada data produksi</div>
        )}
      </div>
    </div>
  )
}
