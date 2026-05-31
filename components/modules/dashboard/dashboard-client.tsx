// @ts-nocheck
'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Layers, Truck, AlertCircle, Warehouse, ArrowRight, TrendingUp, TrendingDown, Box, CheckCircle } from 'lucide-react'

// ─── Colors ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Cutting':       '#8B5CF6',
  'Pas Berat':     '#06B6D4',
  'Annealing':     '#F59E0B',
  'Siap Packing':  '#10B981',
  'Sudah Packing': '#3B82F6',
  'Reject':        '#EF4444',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-start gap-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <p className="text-2xl font-black text-gray-900 leading-none">{value.toLocaleString('id-ID')}</p>
          {unit && <span className="text-xs font-semibold text-gray-400">{unit}</span>}
        </div>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    'Cutting':       'bg-violet-100 text-violet-700',
    'Pas Berat':     'bg-cyan-100 text-cyan-700',
    'Annealing':     'bg-amber-100 text-amber-700',
    'Siap Packing':  'bg-emerald-100 text-emerald-700',
    'Sudah Packing': 'bg-blue-100 text-blue-700',
    'Reject':        'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value?.toLocaleString('id-ID')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardClient({
  namaGudang, userName, userRole, today,
  stats, produksiTerbaru, batchSisa, produksiChart, statusChartData, mutasiTerbaru
}) {
  const [chartType, setChartType] = useState('pcs')

  const totalStatusPcs = statusChartData.reduce((s, i) => s + i.pcs, 0)

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-20">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400">Selamat datang kembali</p>
            <h1 className="text-lg font-black text-gray-900 mt-0.5">{userName} 👋</h1>
            <p className="text-[11px] text-violet-500 font-semibold capitalize">{userRole?.replace(/_/g,' ')}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400">{namaGudang}</p>
            <p className="text-xs text-gray-500 mt-0.5">{today}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Summary Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Layers}       label="Batch Aktif"    value={stats.batchAktif}    unit="batch"   color="bg-violet-500" sub="Sedang berjalan" />
          <StatCard icon={Package}      label="Siap Packing"   value={stats.siapPacking}   unit="pcs"     color="bg-emerald-500" sub="Menunggu packing" />
          <StatCard icon={Warehouse}    label={`Stok ${namaGudang}`} value={stats.stokGudang} unit="pcs" color="bg-blue-500"    sub="Surat sudah cetak" />
          <StatCard icon={AlertCircle}  label="Total Reject"   value={stats.totalRejectPcs} unit="pcs"   color="bg-red-400"    sub="Semua batch" />
        </div>

        {/* Mutasi transit alert */}
        {stats.mutasiTransit > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Truck size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">{stats.mutasiTransit} Mutasi menunggu ACC</p>
              <p className="text-xs text-amber-500">Penerima belum konfirmasi</p>
            </div>
            <ArrowRight size={14} className="text-amber-400" />
          </div>
        )}

        {/* ── Chart Produksi per Bulan ───────────────────────────────────────── */}
        {produksiChart.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Produksi per Bulan</h2>
                <p className="text-[10px] text-gray-400">6 bulan terakhir</p>
              </div>
              <div className="flex gap-1">
                {['pcs','gram'].map(t => (
                  <button key={t} onClick={() => setChartType(t)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${chartType===t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {t === 'pcs' ? 'PCS' : 'Gram'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produksiChart} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey={chartType} name={chartType === 'pcs' ? 'PCS' : 'Gram'} fill="#8B5CF6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Status Produksi Donut ─────────────────────────────────────────── */}
        {statusChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Status Produksi</h2>
                <p className="text-[10px] text-gray-400">Total {totalStatusPcs.toLocaleString('id-ID')} pcs sedang proses</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="pcs" nameKey="status"
                      cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3}>
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#E5E7EB'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {statusChartData.map(({ status, pcs }) => {
                  const pct = totalStatusPcs > 0 ? Math.round(pcs/totalStatusPcs*100) : 0
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[status] ?? '#E5E7EB' }} />
                      <span className="text-[11px] text-gray-600 flex-1 truncate">{status}</span>
                      <span className="text-[11px] font-bold text-gray-800">{pcs} pcs</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Batch Sisa Bahan ──────────────────────────────────────────────── */}
        {batchSisa.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Sisa Bahan Batch</h2>
              <span className="text-[10px] text-gray-400">{batchSisa.length} batch aktif</span>
            </div>
            <div className="space-y-3">
              {batchSisa.map((b) => {
                const sisa = b.sisa_bahan_seharusnya ?? b.timbangan_akhir
                const pct  = b.sisaPct
                const color = pct < 20 ? 'bg-red-400' : pct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                const badge = pct < 20 ? 'bg-red-100 text-red-600' : pct < 50 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'
                return (
                  <div key={b.kode}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">{b.kode}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge}`}>
                          {pct < 20 ? 'Kritis' : pct < 50 ? 'Rendah' : 'Normal'}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">{Number(sisa).toFixed(2)} gr</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct,100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Produksi Terbaru ─────────────────────────────────────────────── */}
        {produksiTerbaru.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Produksi Terbaru</h2>
              <span className="text-[10px] text-gray-400">{produksiTerbaru.length} item</span>
            </div>
            <div className="divide-y divide-gray-50">
              {produksiTerbaru.map((item, i) => (
                <div key={item.kode} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-gray-400">{i+1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{item.nama_item ?? `${item.gramasi} gr`}</p>
                    <p className="text-[10px] text-gray-400">{item.batch_kode} · {item.tanggal}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-gray-700">{item.pcs_good} pcs</p>
                    <StatusBadge status={item.current_status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Mutasi Terbaru ────────────────────────────────────────────────── */}
        {mutasiTerbaru.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Mutasi Terbaru</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {mutasiTerbaru.map((m) => (
                <div key={m.nomor} className="px-4 py-3 flex items-center gap-3">
                  <Truck size={13} className="text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate">{m.nomor}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="truncate max-w-[70px]">{m.dari_lokasi}</span>
                      <ArrowRight size={9} />
                      <span className="truncate max-w-[70px]">{m.ke_lokasi}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">{m.pcs} pcs</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      m.status==='selesai' ? 'bg-emerald-100 text-emerald-600' :
                      m.status==='transit' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
