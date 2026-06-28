'use client'

import { Download, ArrowLeft, Package, Layers, Tag, Hammer, TrendingDown, CheckCircle2, Clock, FlaskConical, Shield } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatRupiah, cn } from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

interface Batch {
  kode: string; tanggal: string; supplier: string | null
  bahan_dari_pusat: number | null; timbangan_akhir: number | null
  sisa_fisik: number | null; hpp_gr: number | null; harga_beli: number | null
  status: string | null; catatan: string | null
}
interface Peleburan {
  id: number; kode: string; tanggal: string
  dikasih_gram: number; diterima_gram: number | null
  status: string; tim_nama: string | null; operator: string | null
}
interface ProduksiItem {
  id: number; kode: string; gramasi: string
  pcs: number; total_gram: number | null
  current_status: string | null; sisa_serbuk: number
}
interface Packing {
  id: number; kode: string; gramasi: string | null
  pcs: number; total_gram: number | null; tanggal: string; pic: string | null
}
interface Shieldtag { kode: string; gramasi: string | null; status: string }
interface Props {
  batch: Batch; peleburans: Peleburan[]; produksiItems: ProduksiItem[]
  packings: Packing[]; shieldtags: Shieldtag[]; userRole: string
}

const canSeeHpp = (r: string) => ['owner', 'admin_pusat', 'accounting', 'manager'].includes(r)
const fg = (n: number | null | undefined, d = 3) => n != null ? Number(n).toFixed(d) : '—'
const pct = (part: number, total: number) => total === 0 ? '0.00%' : (part / total * 100).toFixed(2) + '%'
const fmtGr = (n: number) => n.toFixed(3) + ' gr'

const PALETTE = {
  violet: '#7C3AED', green: '#16A34A', red: '#DC2626',
  amber: '#D97706', blue: '#2563EB', cyan: '#0891B2', slate: '#64748B',
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: any; accent: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent + '15' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="text-[19px] font-bold tabular-nums text-slate-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, sub, color }: { icon: any; title: string; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div>
        <p className="text-[13px] font-bold text-slate-800">{title}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold text-slate-800">{payload[0].name}</p>
      <p className="text-slate-500">{fmtGr(payload[0].value)} · {payload[0].payload.pct}</p>
    </div>
  )
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold" style={{ color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p className="text-slate-600">{payload[0].value} pcs</p>
    </div>
  )
}

export default function LaporanBatchDetail({ batch, peleburans, produksiItems, packings, shieldtags, userRole }: Props) {
  const showHpp = canSeeHpp(userRole)

  // ── Kalkulasi utama ──────────────────────────────────────────────────────────
  const bahanMasuk    = Number(batch.bahan_dari_pusat ?? 0)
  const totalDikasih  = peleburans.reduce((s, p) => s + Number(p.dikasih_gram ?? 0), 0)
  const totalDiterima = peleburans.reduce((s, p) => s + Number(p.diterima_gram ?? 0), 0)
  const lossLebur     = totalDikasih - totalDiterima
  const lossPct       = totalDikasih > 0 ? lossLebur / totalDikasih * 100 : 0

  const gramasiMap = new Map<string, { pcs: number; total_gram: number; sisa_serbuk: number }>()
  for (const p of produksiItems) {
    const g = p.gramasi
    const cur = gramasiMap.get(g) ?? { pcs: 0, total_gram: 0, sisa_serbuk: 0 }
    gramasiMap.set(g, {
      pcs: cur.pcs + Number(p.pcs ?? 0),
      total_gram: cur.total_gram + Number(p.total_gram ?? 0),
      sisa_serbuk: cur.sisa_serbuk + Number(p.sisa_serbuk ?? 0),
    })
  }
  const gramasiRows = [...gramasiMap.entries()]
    .map(([gramasi, v]) => ({ gramasi, ...v }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  const totalGramProduksi = gramasiRows.reduce((s, r) => s + r.total_gram, 0)
  const totalSerbuk       = gramasiRows.reduce((s, r) => s + r.sisa_serbuk, 0)
  const totalPcs          = gramasiRows.reduce((s, r) => s + r.pcs, 0)
  const lossProduksi      = totalDiterima - totalGramProduksi - totalSerbuk
  const totalLosses       = totalDikasih - totalGramProduksi - totalSerbuk
  const totalLossesPct    = totalDikasih > 0 ? totalLosses / totalDikasih * 100 : 0

  // Shieldtag
  const stAktif   = shieldtags.filter(s => s.status === 'Aktif').length
  const stTransit = shieldtags.filter(s => s.status === 'Transit').length
  const stTerjual = shieldtags.filter(s => s.status === 'Terjual').length
  const stTotal   = shieldtags.length

  // Charts data
  const flowData = [
    { name: 'Bahan Masuk', gram: bahanMasuk, pct: '100%', fill: PALETTE.violet },
    { name: 'Dikasih Lebur', gram: totalDikasih, pct: pct(totalDikasih, bahanMasuk), fill: PALETTE.cyan },
    { name: 'Siap Cetak', gram: totalDiterima, pct: pct(totalDiterima, totalDikasih), fill: PALETTE.green },
    { name: 'Gram Produksi', gram: totalGramProduksi, pct: pct(totalGramProduksi, totalDiterima), fill: '#15803D' },
  ]

  const pieData = [
    { name: 'Aktif',   value: stAktif,   fill: '#16A34A' },
    { name: 'Transit', value: stTransit, fill: '#2563EB' },
    { name: 'Terjual', value: stTerjual, fill: PALETTE.violet },
  ].filter(d => d.value > 0)

  const gramasiChartData = gramasiRows.map(r => ({
    gramasi: r.gramasi + 'gr',
    pcs: r.pcs,
    gram: parseFloat(r.total_gram.toFixed(3)),
  }))

  const isSelesai = batch.status === 'Selesai'

  // Export CSV
  function exportCSV() {
    const rows: string[][] = []
    rows.push([`LAPORAN BATCH — ${batch.kode}`])
    rows.push([`Tanggal`, formatDate(batch.tanggal)])
    rows.push([`Supplier`, batch.supplier ?? '—'])
    rows.push([])
    rows.push(['BAHAN BAKU'])
    rows.push(['Bahan Masuk', fg(bahanMasuk), 'gr'])
    rows.push(['Total Dikasih Lebur', fg(totalDikasih), 'gr'])
    rows.push(['Total Diterima (Siap Cetak)', fg(totalDiterima), 'gr'])
    rows.push(['Losses Peleburan', fg(lossLebur), 'gr', pct(lossLebur, totalDikasih)])
    rows.push([])
    rows.push(['PRODUKSI PER GRAMASI'])
    rows.push(['Gramasi', 'PCS', 'Total Gram', 'Sisa Serbuk'])
    for (const r of gramasiRows) rows.push([r.gramasi + 'gr', String(r.pcs), fg(r.total_gram), fg(r.sisa_serbuk)])
    rows.push(['TOTAL', String(totalPcs), fg(totalGramProduksi), fg(totalSerbuk)])
    rows.push([])
    rows.push(['LOSSES'])
    rows.push(['Losses Produksi', fg(lossProduksi)])
    rows.push(['TOTAL LOSSES', fg(totalLosses), pct(totalLosses, totalDikasih)])
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `laporan-batch-${batch.kode.replace(/\//g, '-')}.csv`
    a.click()
  }

  return (
    <div className="space-y-5 pb-16 max-w-5xl">

      {/* ── Header ── */}
      <div>
        <Link href="/laporan/batch"
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-violet-600 mb-4 transition-colors group">
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Kembali ke Laporan Batch
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Gradient bar */}
          <div className={`h-1.5 ${isSelesai ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400' : 'bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500'}`} />

          <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSelesai ? 'bg-green-50' : 'bg-violet-50'}`}>
                <Layers size={22} className={isSelesai ? 'text-green-600' : 'text-violet-600'} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[22px] font-bold text-slate-900 font-mono tracking-wide">{batch.kode}</h1>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${isSelesai ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSelesai ? <CheckCircle2 size={11}/> : <Clock size={11}/>}
                    {batch.status ?? 'Proses'}
                  </span>
                </div>
                <p className="text-[13px] text-slate-400 mt-1">
                  {formatDate(batch.tanggal)}
                  {batch.supplier && <> · <span className="text-slate-600">{batch.supplier}</span></>}
                </p>
                {batch.catatan && <p className="text-[12px] text-slate-400 italic mt-0.5">"{batch.catatan}"</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-all">
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Bahan Masuk" value={`${fg(bahanMasuk, 2)} gr`} icon={Package} accent={PALETTE.violet} />
        <StatCard label="Siap Cetak" value={`${fg(totalDiterima, 2)} gr`}
          sub={`dari ${fg(totalDikasih, 2)} gr lebur`} icon={FlaskConical} accent={PALETTE.cyan} />
        <StatCard label="Total Produksi" value={`${fg(totalGramProduksi, 2)} gr`}
          sub={`${totalPcs.toLocaleString()} pcs`} icon={Hammer} accent={PALETTE.green} />
        <StatCard label="Total Losses"
          value={`${fg(totalLosses, 2)} gr`}
          sub={`${totalLossesPct.toFixed(2)}% dari bahan masuk`}
          icon={TrendingDown}
          accent={totalLosses > 0 ? PALETTE.red : PALETTE.slate} />
      </div>

      {/* ── Alur Gram Chart + Pie Shieldtag ── */}
      <div className="grid sm:grid-cols-5 gap-4">

        {/* Bar chart alur gram — 3 cols */}
        <div className="sm:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader icon={TrendingDown} title="Alur Gram Batch" sub="Dari bahan masuk hingga hasil produksi" color={PALETTE.violet} />
          <div className="px-4 pt-2 pb-4">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={flowData} barSize={32} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="gram" radius={[6, 6, 0, 0]} isAnimationActive>
                  {flowData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Losses row */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { label: 'Loss Peleburan', val: lossLebur, of: totalDikasih, color: '#F59E0B' },
                { label: 'Loss Produksi',  val: lossProduksi, of: totalDiterima, color: PALETTE.red },
              ].map(({ label, val, of: ofVal, color }) => {
                const p = ofVal > 0 ? val / ofVal * 100 : 0
                return (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: color + '10', border: `1px solid ${color}20` }}>
                    <p className="text-[10px] font-medium text-slate-400">{label}</p>
                    <div className="flex items-end justify-between mt-0.5">
                      <p className="text-[14px] font-bold tabular-nums" style={{ color }}>{fg(val, 3)} gr</p>
                      <p className="text-[11px] font-semibold" style={{ color }}>{p.toFixed(2)}%</p>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-white/60">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p * 5)}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Pie shieldtag — 2 cols */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Shield} title="Shieldtag" sub={`${stTotal} total terdaftar`} color={PALETTE.green} />
          <div className="px-4 pb-4">
            {stTotal > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={66}
                      dataKey="value" paddingAngle={3} isAnimationActive>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2 mt-1">
                  {[
                    { label: 'Aktif', val: stAktif, color: '#16A34A' },
                    { label: 'Terjual', val: stTerjual, color: PALETTE.violet },
                    { label: 'Transit', val: stTransit, color: PALETTE.blue },
                  ].filter(d => d.val > 0).map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                      <p className="text-[12px] text-slate-600 flex-1">{label}</p>
                      <p className="text-[12px] font-bold tabular-nums text-slate-800">{val}</p>
                      <p className="text-[10px] text-slate-400 w-12 text-right">{pct(val, stTotal)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-slate-300">
                <Shield size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-[12px]">Belum ada shieldtag</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Produksi per Gramasi Chart ── */}
      {gramasiRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Hammer} title="Produksi per Gramasi" sub={`${totalPcs} pcs · ${fg(totalGramProduksi, 2)} gr total`} color={PALETTE.violet} />
          <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Chart */}
            <div className="p-4">
              <ResponsiveContainer width="100%" height={Math.max(160, gramasiRows.length * 40)}>
                <BarChart data={gramasiChartData} layout="vertical" barSize={14} margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="gramasi" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip formatter={(v: any, name: string) => [name === 'pcs' ? `${v} pcs` : `${v} gr`, name === 'pcs' ? 'PCS' : 'Gram']} />
                  <Bar dataKey="pcs" fill={PALETTE.violet} radius={[0, 4, 4, 0]} name="pcs" />
                  <Bar dataKey="gram" fill={PALETTE.green} radius={[0, 4, 4, 0]} name="gram" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-3 h-2 rounded-sm bg-violet-600 inline-block"/>PCS</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="w-3 h-2 rounded-sm bg-green-600 inline-block"/>Gram</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Gramasi', 'PCS', 'Gram', 'Serbuk'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gramasiRows.map(r => (
                    <tr key={r.gramasi} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-800">{r.gramasi} gr</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-violet-700">{r.pcs}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-green-700">{fg(r.total_gram, 3)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-amber-600">{fg(r.sisa_serbuk, 3)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-violet-700">{totalPcs}</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-green-700">{fg(totalGramProduksi, 3)}</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-amber-600">{fg(totalSerbuk, 3)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Peleburan ── */}
      {peleburans.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader icon={FlaskConical} title="Detail Peleburan"
            sub={`${peleburans.length} sesi · loss rata-rata ${lossPct.toFixed(2)}%`} color={PALETTE.cyan} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Kode', 'Tanggal', 'Tim', 'Dikasih', 'Diterima', 'Loss', '%', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {peleburans.map(p => {
                  const loss = Number(p.dikasih_gram) - Number(p.diterima_gram ?? 0)
                  return (
                    <tr key={p.id} className="hover:bg-cyan-50/20">
                      <td className="px-4 py-3 font-mono font-bold text-cyan-700">{p.kode}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                      <td className="px-4 py-3 text-slate-700">{p.tim_nama ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">{fg(p.dikasih_gram)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-green-700">
                        {p.diterima_gram != null ? fg(p.diterima_gram) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-red-500">
                        {p.diterima_gram != null ? fg(loss) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {p.diterima_gram != null ? pct(loss, Number(p.dikasih_gram)) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          p.status === 'selesai' ? 'bg-green-100 text-green-700' :
                          p.status === 'proses'  ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500')}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                  <td className="px-4 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wide" colSpan={3}>Total</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-800">{fg(totalDikasih)}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-green-700">{fg(totalDiterima)}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-red-500">{fg(lossLebur)}</td>
                  <td className="px-4 py-3 font-bold text-red-500">{pct(lossLebur, totalDikasih)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Packing ── */}
      {packings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Package} title="Packing"
            sub={`${packings.length} entry · ${packings.reduce((s, p) => s + p.pcs, 0)} pcs total`} color={PALETTE.blue} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Kode', 'Tanggal', 'Gramasi', 'PCS', 'Total Gram', 'PIC'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {packings.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/10">
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">{p.kode}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.gramasi ?? '—'} gr</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-700">{p.pcs}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-green-700">{fg(p.total_gram)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.pic ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HPP info ── */}
      {showHpp && batch.hpp_gr != null && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-3">Informasi HPP (Rahasia)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'HPP per Gram', value: formatRupiah(batch.hpp_gr) },
              { label: 'HPP Total Produksi', value: formatRupiah(batch.hpp_gr * totalGramProduksi) },
              ...(batch.harga_beli != null ? [{ label: 'Harga Beli', value: formatRupiah(batch.harga_beli) }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/60 rounded-xl p-3 border border-amber-100">
                <p className="text-[10px] font-medium text-amber-600">{label}</p>
                <p className="text-[15px] font-bold text-amber-900 tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
