// @ts-nocheck
'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Layers, Truck, AlertCircle, Warehouse, ArrowRight, Box, CheckCircle, Tag, Building2 } from 'lucide-react'

const STATUS_COLORS = {
  'Cutting':       '#8B5CF6',
  'Pas Berat':     '#06B6D4',
  'Annealing':     '#F59E0B',
  'Siap Packing':  '#10B981',
  'Sudah Packing': '#3B82F6',
  'Reject':        '#EF4444',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">{Number(p.value).toLocaleString('id-ID')}</span>
        </div>
      ))}
    </div>
  )
}

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
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

export default function DashboardClient({
  namaGudang, userName, userRole, today,
  stats, produksiTerbaru, batchSisa, produksiChart, statusChartData, mutasiTerbaru
}) {
  const totalStatusPcs = statusChartData.reduce((s, i) => s + i.pcs, 0)

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900">Dashboard</h1>
            <p className="text-[11px] text-gray-400">Ringkasan aktivitas produksi dan stok</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-700">{userName}</p>
            <p className="text-[10px] text-violet-500 capitalize">{userRole?.replace(/_/g,' ')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── 5 Summary Cards (horizontal scroll) ───────────────────────────── */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">

          {/* Bahan Baku Aktif */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-44" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-violet-500 rounded-xl flex items-center justify-center mb-2">
              <Layers size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bahan Baku Aktif</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.batchAktif} <span className="text-sm font-semibold text-gray-400">Batch</span></p>
            <p className="text-[11px] text-gray-500 mt-1">{stats.totalBahanAktif.toLocaleString('id-ID')} gr total</p>
          </div>

          {/* Produksi Hari Ini */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-44" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center mb-2">
              <Package size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Produksi Hari Ini</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.produksiHariIni} <span className="text-sm font-semibold text-gray-400">pcs</span></p>
            <p className="text-[11px] text-gray-500 mt-1">Item dibuat hari ini</p>
          </div>

          {/* Siap Packing */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-44" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center mb-2">
              <Box size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Siap Packing</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.siapPacking} <span className="text-sm font-semibold text-gray-400">pcs</span></p>
            <p className="text-[11px] text-gray-500 mt-1">Menunggu packing</p>
          </div>

          {/* Reject */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-44" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-red-400 rounded-xl flex items-center justify-center mb-2">
              <AlertCircle size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Reject</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.totalRejectPcs} <span className="text-sm font-semibold text-gray-400">pcs</span></p>
            <p className="text-[11px] text-gray-500 mt-1">Semua batch</p>
          </div>

          {/* Stok Gudang CJ */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-52" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center mb-2">
              <Warehouse size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stok {namaGudang}</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.stokGudangTotal.toLocaleString('id-ID')} <span className="text-sm font-semibold text-gray-400">pcs</span></p>
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-gray-500">Shieldtag: </span>
                <span className="font-bold text-emerald-600">{stats.stGudangAktif} pcs</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-gray-500">Belum ST: </span>
                <span className="font-bold text-amber-600">{stats.stGudangPending} pcs</span>
              </div>
              {stats.stGudangPending === 0 && stats.stokGudangTotal > 0 && (
                <p className="text-[10px] text-emerald-500 font-semibold">✓ Semua tershieldtag</p>
              )}
            </div>
          </div>

          {/* Stok Cabang */}
          <div className="bg-white rounded-2xl p-4 flex-shrink-0 w-44" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="w-8 h-8 bg-orange-400 rounded-xl flex items-center justify-center mb-2">
              <Building2 size={15} className="text-white" />
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stok Cabang</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{stats.stokCabang.toLocaleString('id-ID')} <span className="text-sm font-semibold text-gray-400">pcs</span></p>
            <p className="text-[11px] text-gray-500 mt-1">Semua cabang</p>
          </div>

        </div>

        {/* Mutasi transit alert */}
        {stats.mutasiTransit > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Truck size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">{stats.mutasiTransit} Mutasi menunggu ACC</p>
              <p className="text-xs text-amber-500">Penerima belum konfirmasi penerimaan</p>
            </div>
          </div>
        )}

        {/* ── Chart Produksi per Bulan (DUAL: PCS + Gram) ─────────────────── */}
        {produksiChart.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-900">Produksi 6 Bulan Terakhir</h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-violet-500 rounded" />
                  <span className="text-[10px] text-gray-400">Total Produksi (pcs)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-violet-200 rounded border-dashed" style={{borderTop:'1.5px dashed #A78BFA'}} />
                  <span className="text-[10px] text-gray-400">Total Berat (gr)</span>
                </div>
              </div>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={produksiChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="left"  type="monotone" dataKey="pcs"  name="Produksi (pcs)" stroke="#8B5CF6" strokeWidth={2} dot={{ fill:'#8B5CF6', r:3 }} activeDot={{ r:5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="gram" name="Berat (gr)"      stroke="#A78BFA" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Status Produksi + Bahan Baku Terendah ────────────────────────── */}
        <div className="grid grid-cols-1 gap-4">

          {/* Status Donut */}
          {statusChartData.length > 0 && (
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Status Produksi</h2>
              <div className="flex items-center gap-4">
                <div style={{ width: 120, height: 120, flexShrink: 0, position:'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="pcs" nameKey="status"
                        cx="50%" cy="50%" innerRadius={32} outerRadius={55} paddingAngle={2}>
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#E5E7EB'} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-800">{totalStatusPcs}</p>
                      <p className="text-[9px] text-gray-400">pcs</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {statusChartData.map(({ status, pcs }) => {
                    const pct = totalStatusPcs > 0 ? Math.round(pcs/totalStatusPcs*100) : 0
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[status] ?? '#E5E7EB' }} />
                        <span className="text-[11px] text-gray-600 flex-1 truncate">{status}</span>
                        <span className="text-[11px] font-bold text-gray-700">{pct}%</span>
                        <span className="text-[10px] text-gray-400 w-12 text-right">({pcs} pcs)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bahan Baku Terendah */}
          {batchSisa.length > 0 && (
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Bahan Baku Terendah</h2>
              <div className="space-y-3">
                {batchSisa.map((b) => {
                  const sisa  = Number(b.sisa_bahan_seharusnya ?? b.timbangan_akhir).toFixed(2)
                  const pct   = b.sisaPct
                  const color = pct < 20 ? 'bg-red-400' : pct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                  const badge = pct < 20
                    ? 'bg-red-100 text-red-600'
                    : pct < 50 ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-700'
                  const label = pct < 20 ? 'Kritis' : pct < 50 ? 'Rendah' : 'Normal'
                  return (
                    <div key={b.kode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{b.kode}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge}`}>{label}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">Sisa {sisa} gr</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width:`${Math.min(pct,100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Produksi Terbaru ────────────────────────────────────────────── */}
        {produksiTerbaru.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Produksi Terbaru</h2>
              <span className="text-[10px] text-violet-500 font-semibold">Lihat Semua</span>
            </div>
            {/* Table header */}
            <div className="grid px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: '1.5fr 1fr 0.7fr 0.7fr 1fr' }}>
              <span>Produksi</span><span>Batch</span><span>Gramasi</span><span>Pcs</span><span>Status</span>
            </div>
            <div className="divide-y divide-gray-50">
              {produksiTerbaru.map((item, i) => (
                <div key={item.kode} className="grid px-4 py-2.5 items-center"
                  style={{ gridTemplateColumns: '1.5fr 1fr 0.7fr 0.7fr 1fr' }}>
                  <div>
                    <p className="text-[11px] font-bold text-violet-600">{item.kode}</p>
                    <p className="text-[10px] text-gray-400">{item.tanggal}</p>
                  </div>
                  <p className="text-[11px] text-gray-600 truncate">{item.batch_kode}</p>
                  <p className="text-[11px] font-semibold text-gray-700">{item.gramasi} gr</p>
                  <p className="text-[11px] font-bold text-gray-800">{item.pcs_good}</p>
                  <StatusBadge status={item.current_status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Mutasi Terbaru ──────────────────────────────────────────────── */}
        {mutasiTerbaru.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Mutasi Terbaru</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {mutasiTerbaru.map((m) => (
                <div key={m.nomor} className="px-4 py-3 flex items-center gap-3">
                  <Truck size={13} className="text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">{m.nomor}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                      <span className="truncate max-w-[80px]">{m.dari_lokasi}</span>
                      <ArrowRight size={9} className="flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{m.ke_lokasi}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-gray-800">{m.pcs} pcs</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      m.status==='selesai' ? 'bg-emerald-100 text-emerald-600' :
                      m.status==='transit' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'}`}>{m.status}</span>
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
