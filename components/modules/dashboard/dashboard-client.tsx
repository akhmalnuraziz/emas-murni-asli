// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Package, Layers, Truck, AlertCircle, Warehouse, ArrowRight, Box, Building2, Bell, Search, TrendingUp, TrendingDown, X, Lock } from 'lucide-react'

const STATUS_COLORS = {
  'Cutting':'#8B5CF6','Pas Berat':'#06B6D4','Annealing':'#F59E0B',
  'Siap Packing':'#10B981','Sudah Packing':'#3B82F6','Reject':'#EF4444',
}

function PctBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const up = pct >= 0
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-500' : 'text-red-400'}`}>
      {up ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    'Cutting':'bg-violet-100 text-violet-700','Pas Berat':'bg-cyan-100 text-cyan-700',
    'Annealing':'bg-amber-100 text-amber-700','Siap Packing':'bg-emerald-100 text-emerald-700',
    'Sudah Packing':'bg-blue-100 text-blue-700','Reject':'bg-red-100 text-red-600',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status]??'bg-gray-100 text-gray-500'}`}>{status}</span>
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{background:p.color}}/>
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold">{Number(p.value).toLocaleString('id-ID')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Bell Notification Panel ──────────────────────────────────────────────────
function BellPanel({ notifikasi, onClose }) {
  return (
    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Notifikasi</p>
        <button onClick={onClose}><X size={14} className="text-gray-400"/></button>
      </div>
      {notifikasi.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">Tidak ada notifikasi</p>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {notifikasi.map(n => (
            <div key={n.id} className="px-4 py-3 flex items-start gap-3">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type==='siap_packing' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {n.type==='siap_packing' ? <Box size={12} className="text-emerald-600"/> : <Truck size={12} className="text-amber-600"/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{n.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{n.sub}</p>
              </div>
              <span className="text-[9px] text-gray-400 flex-shrink-0">{n.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardClient({
  namaGudang, userName, userRole, today,
  stats, produksiTerbaru, batchSisa, produksiChart, statusChartData, mutasiTerbaru, notifikasi
}) {
  const [bellOpen, setBellOpen]   = useState(false)
  const [search, setSearch]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState(today)

  const totalStatusPcs = statusChartData.reduce((s,i) => s + i.pcs, 0)

  // Filter produksi terbaru by search + tanggal
  const filteredProduksi = useMemo(() => {
    return produksiTerbaru.filter(item => {
      const matchSearch = !search ||
        item.kode?.toLowerCase().includes(search.toLowerCase()) ||
        (item.nama_item ?? '').toLowerCase().includes(search.toLowerCase()) ||
        item.batch_kode?.toLowerCase().includes(search.toLowerCase())
      const matchDate = (!dateFrom || item.tanggal_produksi >= dateFrom) &&
                        (!dateTo   || item.tanggal_produksi <= dateTo)
      return matchSearch && matchDate
    })
  }, [produksiTerbaru, search, dateFrom, dateTo])

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-black text-gray-900">Dashboard</h1>
            <p className="text-[11px] text-gray-400">Ringkasan aktivitas produksi dan stok</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <button onClick={() => setBellOpen(!bellOpen)}
              className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center relative">
              <Bell size={15} className="text-gray-500"/>
              {notifikasi.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                  {notifikasi.length > 9 ? '9+' : notifikasi.length}
                </span>
              )}
            </button>
            {bellOpen && <BellPanel notifikasi={notifikasi} onClose={() => setBellOpen(false)}/>}
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari produksi, batch, shieldtag…"
            className="w-full h-9 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={12} className="text-gray-400"/>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Filter Tanggal ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <span className="text-[11px] font-semibold text-gray-500 flex-shrink-0">Periode:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 text-xs bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 focus:outline-none min-w-0"/>
          <span className="text-gray-300 flex-shrink-0">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="flex-1 text-xs bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 focus:outline-none min-w-0"/>
          {(dateFrom || dateTo !== today) && (
            <button onClick={() => { setDateFrom(''); setDateTo(today) }}
              className="text-[10px] text-violet-500 font-semibold flex-shrink-0">Reset</button>
          )}
        </div>

        {/* ── Cards 2×2 ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">

          {/* Bahan Baku Aktif */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="w-8 h-8 bg-violet-500 rounded-xl flex items-center justify-center mb-2.5">
              <Layers size={15} className="text-white"/>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bahan Baku Aktif</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
              {stats.batchAktif} <span className="text-xs font-semibold text-gray-400">batch</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{stats.totalBahanAktif.toLocaleString('id-ID')} gr</p>
          </div>

          {/* Bahan Baku Tidak Aktif */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="w-8 h-8 bg-gray-400 rounded-xl flex items-center justify-center mb-2.5">
              <Lock size={15} className="text-white"/>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bahan Tdk Aktif</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
              {stats.batchTidakAktif} <span className="text-xs font-semibold text-gray-400">batch</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{stats.totalBahanTidakAktif.toLocaleString('id-ID')} gr</p>
          </div>

          {/* Produksi Hari Ini (Siap Packing) */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center mb-2.5">
              <Box size={15} className="text-white"/>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Produksi Hari Ini</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
              {stats.siapPackingHariIni} <span className="text-xs font-semibold text-gray-400">pcs</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <p className="text-[11px] text-gray-400">Siap Packing</p>
              <PctBadge pct={stats.siapPackingPct}/>
            </div>
            <p className="text-[10px] text-gray-300">vs kemarin</p>
          </div>

          {/* Reject */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="w-8 h-8 bg-red-400 rounded-xl flex items-center justify-center mb-2.5">
              <AlertCircle size={15} className="text-white"/>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total Reject</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
              {stats.totalRejectPcs} <span className="text-xs font-semibold text-gray-400">pcs</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Semua batch</p>
          </div>

          {/* Stok Gudang CJ */}
          <div className="bg-white rounded-2xl p-4 col-span-2" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Warehouse size={15} className="text-white"/>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stok {namaGudang}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
                  {stats.stokGudangTotal.toLocaleString('id-ID')} <span className="text-xs font-semibold text-gray-400">pcs</span>
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"/>
                    <span className="text-[11px] text-gray-500">Sudah ST:</span>
                    <span className="text-[11px] font-bold text-emerald-600">{stats.stGudangAktif} pcs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400"/>
                    <span className="text-[11px] text-gray-500">Belum ST:</span>
                    <span className="text-[11px] font-bold text-amber-600">{stats.stGudangPending} pcs</span>
                  </div>
                  {stats.stGudangPending === 0 && stats.stokGudangTotal > 0 && (
                    <span className="text-[10px] text-emerald-500 font-bold">✓ Semua tershieldtag</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stok Cabang */}
          <div className="bg-white rounded-2xl p-4 col-span-2" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 size={15} className="text-white"/>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stok Cabang</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5 leading-none">
                  {stats.stokCabang.toLocaleString('id-ID')} <span className="text-xs font-semibold text-gray-400">pcs</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] text-gray-400">Semua cabang</p>
                  <PctBadge pct={stats.stokCabangPct}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mutasi transit alert */}
        {stats.mutasiTransit > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Truck size={16} className="text-amber-500 flex-shrink-0"/>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">{stats.mutasiTransit} Mutasi menunggu ACC</p>
              <p className="text-xs text-amber-500">Penerima belum konfirmasi penerimaan</p>
            </div>
          </div>
        )}

        {/* ── Chart Produksi per Bulan ─────────────────────────────────────── */}
        {produksiChart.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-900">Produksi 6 Bulan Terakhir</h2>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-violet-500 rounded"/>
                  <span className="text-[10px] text-gray-400">Total Produksi (pcs)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 border-t-2 border-dashed border-violet-300"/>
                  <span className="text-[10px] text-gray-400">Total Berat (gr)</span>
                </div>
              </div>
            </div>
            <div style={{height:180}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={produksiChart} margin={{top:5,right:5,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                  <XAxis dataKey="bulan" tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="left"  tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Line yAxisId="left"  type="monotone" dataKey="pcs"  name="Produksi (pcs)" stroke="#8B5CF6" strokeWidth={2} dot={{fill:'#8B5CF6',r:3}} activeDot={{r:5}}/>
                  <Line yAxisId="right" type="monotone" dataKey="gram" name="Berat (gr)"      stroke="#C4B5FD" strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Status Produksi ────────────────────────────────────────────────── */}
        {statusChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Status Produksi</h2>
            <div className="flex items-center gap-4">
              <div style={{width:120,height:120,flexShrink:0,position:'relative'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="pcs" cx="50%" cy="50%" innerRadius={32} outerRadius={55} paddingAngle={2}>
                      {statusChartData.map((e,i) => <Cell key={i} fill={STATUS_COLORS[e.status]??'#E5E7EB'}/>)}
                    </Pie>
                    <Tooltip content={<CustomTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-800">Total</p>
                    <p className="text-sm font-black text-gray-800">{totalStatusPcs} pcs</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {statusChartData.map(({status,pcs}) => {
                  const pct = totalStatusPcs > 0 ? Math.round(pcs/totalStatusPcs*100) : 0
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:STATUS_COLORS[status]??'#E5E7EB'}}/>
                      <span className="text-[11px] text-gray-600 flex-1 truncate">{status}</span>
                      <span className="text-[11px] font-bold text-gray-700">{pct}%</span>
                      <span className="text-[10px] text-gray-400 w-14 text-right">({pcs} pcs)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Bahan Baku Sisa ───────────────────────────────────────────────── */}
        {batchSisa.length > 0 && (
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Bahan Baku Terendah</h2>
            <div className="space-y-3">
              {batchSisa.map(b => {
                const color = b.sisaPct < 20 ? 'bg-red-400' : b.sisaPct < 50 ? 'bg-amber-400' : 'bg-emerald-400'
                return (
                  <div key={b.kode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-800">{b.kode}</span>
                      <span className="text-xs text-gray-500">Sisa {Number(b.sisa).toFixed(2)} gr</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{width:`${Math.min(b.sisaPct,100)}%`}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Produksi Terbaru ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Produksi Terbaru</h2>
            {filteredProduksi.length !== produksiTerbaru.length && (
              <span className="text-[10px] text-violet-500 font-semibold">{filteredProduksi.length} hasil</span>
            )}
          </div>
          <div className="grid px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase"
            style={{gridTemplateColumns:'1.5fr 0.8fr 0.6fr 0.5fr 1fr'}}>
            <span>Produksi</span><span>Batch</span><span>Gram</span><span>Pcs</span><span>Status</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredProduksi.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">Tidak ada data dalam rentang ini</p>
            ) : filteredProduksi.map(item => (
              <div key={item.kode} className="grid px-4 py-2.5 items-center"
                style={{gridTemplateColumns:'1.5fr 0.8fr 0.6fr 0.5fr 1fr'}}>
                <div>
                  <p className="text-[11px] font-bold text-violet-600">{item.kode}</p>
                  <p className="text-[10px] text-gray-400">{item.tanggal_produksi}</p>
                </div>
                <p className="text-[11px] text-gray-600 truncate">{item.batch_kode}</p>
                <p className="text-[11px] font-semibold text-gray-700">{item.gramasi}gr</p>
                <p className="text-[11px] font-bold text-gray-800">{item.pcs_good}</p>
                <StatusBadge status={item.current_status}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mutasi Terbaru ──────────────────────────────────────────────────── */}
        {mutasiTerbaru.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Mutasi Terbaru</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {mutasiTerbaru.map(m => (
                <div key={m.nomor} className="px-4 py-3 flex items-center gap-3">
                  <Truck size={13} className="text-gray-300 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">{m.nomor}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                      <span className="truncate max-w-[80px]">{m.dari_lokasi}</span>
                      <ArrowRight size={9} className="flex-shrink-0"/>
                      <span className="truncate max-w-[80px]">{m.ke_lokasi}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-gray-800">{m.pcs} pcs</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${m.status==='selesai'?'bg-emerald-100 text-emerald-600':m.status==='transit'?'bg-amber-100 text-amber-600':'bg-gray-100 text-gray-500'}`}>{m.status}</span>
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
