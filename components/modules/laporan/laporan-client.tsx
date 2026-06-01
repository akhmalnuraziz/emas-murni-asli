// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { FileText, TrendingUp, TrendingDown, Printer, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react'
import { getLaporanBatch, getLaporanLabaRugi } from '@/app/(dashboard)/laporan/actions'

const fmt  = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtg = (n: number) => Number(n).toFixed(3) + ' gr'
const fmtp = (n: number) => n.toLocaleString('id-ID') + ' pcs'

const CH_LABEL: Record<string, string> = {
  toko:'Toko Fisik', shopee:'Shopee', tiktok:'TikTok', raja_emas:'Raja Emas', lainnya:'Lainnya'
}

// ── Laporan Per Batch ─────────────────────────────────────────────────────────
function TabBatch({ batchList, namaGudang, cabangList }) {
  const [selectedBatch, setSelectedBatch] = useState('')
  const [data, setData]                   = useState<any>(null)
  const [loading, setLoading]             = useState(false)
  const [expandedItem, setExpandedItem]   = useState<string|null>(null)

  async function load(kode: string) {
    setSelectedBatch(kode); setLoading(true)
    const r = await getLaporanBatch(kode)
    setData(r); setLoading(false)
  }

  function printBatch() { window.print() }

  const b = data?.batch
  const s = data?.summary

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Pilih batch */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">Pilih Batch</p>
        <select value={selectedBatch} onChange={e => load(e.target.value)}
          className="w-full h-11 px-3.5 bg-white rounded-xl text-sm focus:outline-none shadow-sm">
          <option value="">-- Pilih batch --</option>
          {batchList.map((b: any) => (
            <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} ({b.tanggal})</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-400 text-sm">Memuat data…</div>}

      {data && b && s && (
        <div className="space-y-4" id="print-area">

          {/* Header batch */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-base font-black text-gray-900">{b.kode}</p>
                <p className="text-xs text-gray-500">{b.nama_batch} · {b.tanggal}</p>
                <p className="text-xs text-gray-400">Supplier: {b.supplier ?? '—'}</p>
              </div>
              <button onClick={printBatch}
                className="h-8 px-3 rounded-xl text-xs font-bold bg-violet-600 text-white flex items-center gap-1.5">
                <Printer size={12}/>Print
              </button>
            </div>

            {/* Summary 3x2 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label:'Bahan Masuk',   val: fmtg(b.timbangan_akhir ?? 0), color:'text-gray-900' },
                { label:'Total Produksi',val: fmtg(s.totalBeratAwal),       color:'text-gray-900' },
                { label:'Sisa Seharusnya',val:fmtg(s.sisaBahan),            color:'text-blue-600' },
                { label:'Sisa Fisik',    val: s.sisaFisik != null ? fmtg(s.sisaFisik) : '—', color:'text-violet-600' },
                { label:'Total Losses',  val: fmtg(s.totalLosses),          color:'text-red-500' },
                { label:'Total Serbuk',  val: fmtg(s.totalSerbuk),          color:'text-amber-600' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-[#F9F9FB] rounded-xl p-2.5 text-center">
                  <p className={`text-sm font-black ${color}`}>{val}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status produksi */}
          <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <p className="text-xs font-bold text-gray-700 mb-2.5">Status Produksi (pcs)</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label:'PCS Good',  val: s.totalPcsGood,   color:'text-emerald-600', bg:'bg-emerald-50' },
                { label:'PCS Reject',val: s.totalPcsReject, color:'text-red-500',     bg:'bg-red-50' },
                { label:'Sudah Pack',val: s.totalPcsPacked, color:'text-blue-600',    bg:'bg-blue-50' },
                { label:'HPP/gr',    val: 'Rp '+Math.round(s.hpp_gr).toLocaleString('id-ID'), color:'text-violet-600', bg:'bg-violet-50' },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
                  <p className={`text-sm font-black ${color}`}>{val}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown per gramasi */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Breakdown per Gramasi</p>
            </div>
            <div className="grid px-4 py-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase"
              style={{gridTemplateColumns:'1fr 0.6fr 0.6fr 0.6fr 0.8fr'}}>
              <span>Produk</span><span className="text-center">PCS</span><span className="text-center">Reject</span><span className="text-center">Pack</span><span className="text-right">Berat</span>
            </div>
            {data.gramasiBreakdown.map((g: any) => (
              <div key={g.gramasi} className="grid px-4 py-2.5 border-t border-gray-50 items-center"
                style={{gridTemplateColumns:'1fr 0.6fr 0.6fr 0.6fr 0.8fr'}}>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{g.nama_item ?? `${g.gramasi} gr`}</p>
                  <p className="text-[10px] text-gray-400">{g.gramasi} gr</p>
                </div>
                <p className="text-xs font-bold text-gray-700 text-center">{g.pcs_good}</p>
                <p className="text-xs font-bold text-red-400 text-center">{g.pcs_reject || '—'}</p>
                <p className="text-xs text-gray-500 text-center">—</p>
                <p className="text-xs font-semibold text-gray-700 text-right">{Number(g.total_gram).toFixed(2)} gr</p>
              </div>
            ))}
          </div>

          {/* Rincian entry produksi */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-700">Rincian Entry Produksi ({data.items.length})</p>
            </div>
            {data.items.map((item: any, i: number) => {
              const isExpanded = expandedItem === item.kode
              const itemEvents = data.events.filter((e: any) => e.produksi_item_id === item.id)
              return (
                <div key={item.kode} className="border-t border-gray-50">
                  <button onClick={() => setExpandedItem(isExpanded ? null : item.kode)}
                    className="w-full grid px-4 py-3 items-center"
                    style={{gridTemplateColumns:'0.4fr 1fr 0.6fr 0.6fr 1fr 1fr'}}>
                    <span className="text-[10px] text-gray-400">{i+1}</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-violet-600">{item.kode}</p>
                      <p className="text-[10px] text-gray-400">{item.tanggal}</p>
                    </div>
                    <p className="text-xs text-gray-600">{item.gramasi} gr</p>
                    <p className="text-xs font-semibold text-gray-800">{item.pcs_good} pcs</p>
                    <p className="text-[10px] text-gray-500">{Number(item.total_gram).toFixed(3)} gr</p>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        item.current_status==='Siap Packing'||item.current_status==='Sudah Packing' ? 'bg-emerald-100 text-emerald-600' :
                        item.current_status==='Reject' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'
                      }`}>{item.current_status}</span>
                      {isExpanded ? <ChevronDown size={11} className="text-gray-400"/> : <ChevronRight size={11} className="text-gray-400"/>}
                    </div>
                  </button>
                  {isExpanded && itemEvents.length > 0 && (
                    <div className="px-4 pb-3 bg-gray-50 space-y-1">
                      {itemEvents.map((e: any, j: number) => (
                        <div key={j} className="flex items-center justify-between text-[11px] py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-500">{e.tanggal}</span>
                          <span className="font-semibold text-gray-700">{e.status}</span>
                          <span className="text-gray-500">{Number(e.total_gram).toFixed(3)} gr</span>
                          <span className="text-red-400">-{Number(e.losses ?? 0).toFixed(4)} gr</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Laporan Laba Rugi ─────────────────────────────────────────────────────────
function TabLabaRugi({ cabangList, namaGudang }) {
  const today     = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0,7)+'-01'
  const [dateFrom, setDateFrom]   = useState(monthStart)
  const [dateTo, setDateTo]       = useState(today)
  const [lokasi, setLokasi]       = useState('')
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [showPengeluaran, setShowPengeluaran] = useState(false)

  async function load() {
    setLoading(true)
    const r = await getLaporanLabaRugi(dateFrom, dateTo, lokasi || undefined)
    setData(r); setLoading(false)
  }

  const lokasiOptions = [{ val:'', label:'Semua Lokasi' }, { val:namaGudang, label:namaGudang }, ...cabangList.map((c: any) => ({val:c.nama, label:c.nama}))]

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 space-y-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
        <p className="text-xs font-bold text-gray-700">Filter Periode</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Dari</p>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full h-10 px-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none"/>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Sampai</p>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full h-10 px-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none"/>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Lokasi</p>
          <select value={lokasi} onChange={e => setLokasi(e.target.value)}
            className="w-full h-10 px-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none">
            {lokasiOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          className="w-full h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
          {loading ? 'Memuat…' : 'Tampilkan Laporan'}
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Print button */}
          <div className="flex justify-end">
            <button onClick={() => window.print()}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-violet-600 text-white flex items-center gap-1.5">
              <Printer size={12}/>Print Laporan
            </button>
          </div>

          {/* Ringkasan P&L */}
          <div className="bg-white rounded-2xl p-4 space-y-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <p className="text-sm font-black text-gray-900">Laporan Laba Rugi</p>
            <p className="text-xs text-gray-400">{data.periode.from} — {data.periode.to}{lokasi ? ` · ${lokasi}` : ' · Semua Lokasi'}</p>

            {/* Pendapatan */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Pendapatan</p>
              {[
                ['Total Penjualan',    fmt(data.pendapatan.totalHJ),      'text-gray-900'],
                ['HPP Terjual',       `(${fmt(data.pendapatan.totalHPP)})`, 'text-red-500'],
                ['Fee Marketplace',   `(${fmt(data.pendapatan.totalFee)})`, 'text-orange-500'],
              ].map(([k,v,c]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-600">{k}</span>
                  <span className={`font-bold ${c}`}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-black border-t border-gray-100 pt-2">
                <span className="text-gray-700">Gross Profit</span>
                <span className={data.pendapatan.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {fmt(data.pendapatan.grossProfit)}
                </span>
              </div>
            </div>

            {/* Pengeluaran */}
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Pengeluaran Operasional</p>
                <button onClick={() => setShowPengeluaran(!showPengeluaran)}
                  className="text-[10px] text-violet-500 font-semibold">
                  {showPengeluaran ? 'Sembunyikan' : 'Detail'}
                </button>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total Pengeluaran</span>
                <span className="font-bold text-red-500">({fmt(data.pengeluaran.total)})</span>
              </div>
              {showPengeluaran && Object.entries(data.pengeluaran.perKategori).map(([k,v]: any) => (
                <div key={k} className="flex justify-between text-[11px] pl-3">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-600">{fmt(v)}</span>
                </div>
              ))}
            </div>

            {/* Net Profit */}
            <div className={`rounded-2xl px-4 py-3 flex items-center justify-between ${data.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {data.netProfit >= 0 ? <TrendingUp size={18} className="text-emerald-500"/> : <TrendingDown size={18} className="text-red-500"/>}
                <div>
                  <p className="text-sm font-black text-gray-900">Net Profit</p>
                  <p className={`text-[10px] font-semibold ${data.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    Margin {data.marginPct}%
                  </p>
                </div>
              </div>
              <p className={`text-lg font-black ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmt(data.netProfit)}
              </p>
            </div>
          </div>

          {/* Per Channel */}
          {Object.keys(data.pendapatan.perChannel).length > 0 && (
            <div className="bg-white rounded-2xl p-4" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
              <p className="text-xs font-bold text-gray-700 mb-3">Penjualan per Channel</p>
              <div className="space-y-2">
                {Object.entries(data.pendapatan.perChannel).map(([ch, d]: any) => {
                  const pct = data.pendapatan.totalHJ > 0 ? Math.round(d.hj / data.pendapatan.totalHJ * 100) : 0
                  return (
                    <div key={ch}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700">{CH_LABEL[ch] ?? ch}</span>
                        <span className="text-gray-600">{fmt(d.hj)} · {d.pcs} pcs</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Total Transaksi', val: data.pendapatan.totalTransaksi+' trx', color:'text-gray-900' },
              { label:'Avg per Transaksi', val: data.pendapatan.totalTransaksi > 0 ? fmt(data.pendapatan.totalHJ/data.pendapatan.totalTransaksi) : '—', color:'text-violet-600' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-2xl p-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <p className={`text-lg font-black ${color}`}>{val}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key:'batch',    label:'Per Batch',  icon: FileText },
  { key:'labarugi', label:'Laba Rugi',  icon: BarChart2 },
]

export default function LaporanClient({ batchList, cabangList, namaGudang }) {
  const [tab, setTab] = useState('batch')

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-0">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Laporan</h1>
          <div className="flex gap-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl whitespace-nowrap transition-all
                  ${tab===key ? 'bg-white text-violet-700 shadow-sm border-t border-x border-gray-200' : 'text-gray-400'}`}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'batch'    && <TabBatch batchList={batchList} namaGudang={namaGudang} cabangList={cabangList}/>}
      {tab === 'labarugi' && <TabLabaRugi cabangList={cabangList} namaGudang={namaGudang}/>}
    </div>
  )
}
