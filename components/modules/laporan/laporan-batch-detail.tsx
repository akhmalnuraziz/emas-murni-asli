'use client'

import { Download, ArrowLeft, Package, Layers, Tag, Hammer, TrendingDown, CheckCircle2, Clock, FlaskConical, Shield, ArrowRight, CircleDot } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatRupiah, cn } from '@/lib/utils'
import {
  Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

interface Batch {
  kode: string; tanggal: string; supplier: string | null
  bahan_dari_pusat: number | null; timbangan_akhir: number | null
  sisa_fisik: number | null; sisa_bahan_seharusnya: number | null
  hpp_gr: number | null; harga_beli: number | null
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
  current_status: string | null; sisa_serbuk: number | null
  berat_reject: number | null; berat_reject_dilebur: number | null
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
const fg = (n: number | null | undefined, d = 2) => n != null ? Number(n).toFixed(d) : '—'
const pct = (part: number, total: number) => total === 0 ? '0.00' : (part / total * 100).toFixed(2)

const PALETTE = {
  violet: '#7C3AED', green: '#16A34A', red: '#DC2626',
  amber: '#D97706', blue: '#2563EB', cyan: '#0891B2',
}


export default function LaporanBatchDetail({ batch, peleburans, produksiItems, packings, shieldtags, userRole }: Props) {
  const showHpp = canSeeHpp(userRole)

  // ── Kalkulasi utama ──────────────────────────────────────────────────────────
  const bahanDariPusat = Number(batch.bahan_dari_pusat ?? 0)
  const timbanganGudang = Number(batch.timbangan_akhir ?? 0)
  const bahanMasuk    = bahanDariPusat  // alias for flow funnel
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
  const totalSerbuk       = produksiItems.reduce((s, p) => s + Number(p.sisa_serbuk ?? 0), 0)
  const totalPcs          = gramasiRows.reduce((s, r) => s + r.pcs, 0)
  const rejectBlmDilebur  = produksiItems.reduce((s, p) => s + Math.max(0, Number(p.berat_reject ?? 0) - Number(p.berat_reject_dilebur ?? 0)), 0)
  const sisaSeharusnya    = Number(batch.sisa_bahan_seharusnya ?? 0)
  const sisaFisik         = Number(batch.sisa_fisik ?? 0)
  const lossProduksi      = timbanganGudang - totalGramProduksi - totalSerbuk - rejectBlmDilebur - sisaFisik
  const totalLosses       = totalDikasih - totalGramProduksi - totalSerbuk
  const totalLossesPct    = totalDikasih > 0 ? totalLosses / totalDikasih * 100 : 0

  // Shieldtag
  const stAktif   = shieldtags.filter(s => s.status === 'Aktif').length
  const stTransit = shieldtags.filter(s => s.status === 'Transit').length
  const stTerjual = shieldtags.filter(s => s.status === 'Terjual').length
  const stTotal   = shieldtags.length
  const gramasiChartData = gramasiRows.map(r => ({
    gramasi: r.gramasi + 'gr',
    pcs: r.pcs,
    gram: parseFloat(r.total_gram.toFixed(3)),
  }))

  const isSelesai = batch.status === 'terkunci'
  const maxGram = Math.max(bahanMasuk, totalDikasih, totalDiterima, totalGramProduksi, 1)

  // Gram flow steps
  const flowSteps = [
    { label: 'Bahan Masuk',   gram: bahanMasuk,    color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Package },
    { label: 'Dikasih Lebur', gram: totalDikasih,  color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: FlaskConical },
    { label: 'Siap Cetak',    gram: totalDiterima, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CircleDot },
    { label: 'Gram Produksi', gram: totalGramProduksi, color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', icon: Hammer },
  ]

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
    rows.push(['Losses Peleburan', fg(lossLebur), 'gr', pct(lossLebur, totalDikasih) + '%'])
    rows.push([])
    rows.push(['PRODUKSI PER GRAMASI'])
    rows.push(['Gramasi', 'PCS', 'Total Gram', 'Sisa Serbuk'])
    for (const r of gramasiRows) rows.push([r.gramasi + 'gr', String(r.pcs), fg(r.total_gram), fg(r.sisa_serbuk)])
    rows.push(['TOTAL', String(totalPcs), fg(totalGramProduksi), fg(totalSerbuk)])
    rows.push([])
    rows.push(['LOSSES'])
    rows.push(['Losses Produksi', fg(lossProduksi)])
    rows.push(['TOTAL LOSSES', fg(totalLosses), pct(totalLosses, totalDikasih) + '%'])
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `laporan-batch-${batch.kode.replace(/\//g, '-')}.csv`
    a.click()
  }

  return (
    <div className="space-y-5 pb-16 max-w-5xl">

      {/* ── Back nav ── */}
      <Link href="/laporan/batch"
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-violet-600 transition-colors group">
        <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
        Kembali ke Laporan Batch
      </Link>

      {/* ── Hero header card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`h-1.5 ${isSelesai
          ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400'
          : 'bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500'}`} />

        <div className="p-6">
          {/* Top row: identity + export */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isSelesai ? 'bg-green-50' : 'bg-violet-50'}`}>
                <Layers size={22} className={isSelesai ? 'text-green-600' : 'text-violet-600'} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[22px] font-bold text-slate-900 font-mono">{batch.kode}</h1>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${isSelesai ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSelesai ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
                    {batch.status === 'terkunci' ? 'Selesai' : batch.status === 'aktif' ? 'Aktif' : batch.status ?? '—'}
                  </span>
                </div>
                <p className="text-[13px] text-slate-400 mt-1">
                  {formatDate(batch.tanggal)}
                  {batch.supplier && <> · <span className="font-medium text-slate-600">{batch.supplier}</span></>}
                </p>
                {batch.catatan && <p className="text-[11px] italic text-slate-400 mt-0.5">"{batch.catatan}"</p>}
              </div>
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-all">
              <Download size={13}/> Export CSV
            </button>
          </div>

          {/* KPI strip inside header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Bahan Baku', val: `${fg(bahanDariPusat)} gr`, sub: `Timbangan gudang: ${fg(timbanganGudang)} gr`, color: PALETTE.violet, bg: '#F5F3FF' },
              { label: 'Total Gramasi Jadi', val: `${fg(totalGramProduksi)} gr`, color: PALETTE.green, bg: '#F0FDF4' },
              { label: 'Total Produksi', val: `${totalPcs} pcs`, color: PALETTE.blue, bg: '#EFF6FF' },
              { label: 'Total Sisa Serbuk', val: `${fg(totalSerbuk)} gr`, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Reject Blm Dilebur', val: `${fg(rejectBlmDilebur)} gr`, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Sisa Seharusnya', val: `${fg(sisaSeharusnya)} gr`, color: PALETTE.cyan, bg: '#ECFEFF' },
              { label: 'Sisa Bahan Fisik', val: `${fg(sisaFisik)} gr`, color: '#0369A1', bg: '#F0F9FF' },
              { label: 'Loses Produksi', val: `${fg(lossProduksi)} gr`,
                color: lossProduksi > 0.005 ? PALETTE.red : '#16A34A',
                bg: lossProduksi > 0.005 ? '#FEF2F2' : '#F0FDF4' },
            ].map(({ label, val, sub, color, bg }) => (
              <div key={label} className="rounded-xl p-3.5 border" style={{ background: bg, borderColor: color + '30' }}>
                <p className="text-[10px] font-medium text-slate-400">{label}</p>
                <p className="text-[17px] font-bold tabular-nums mt-0.5" style={{ color }}>{val}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gram Flow Funnel + Shieldtag ── */}
      <div className="grid sm:grid-cols-5 gap-4">

        {/* Gram flow — visual step funnel */}
        <div className="sm:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <TrendingDown size={15} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">Alur Produksi Gram</p>
              <p className="text-[11px] text-slate-400">Dari bahan masuk hingga hasil cetak</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {flowSteps.map((step, i) => {
              const barW = maxGram > 0 ? (step.gram / maxGram * 100) : 0
              const prevGram = i === 0 ? bahanMasuk : flowSteps[i - 1].gram
              const stepPct = prevGram > 0 ? (step.gram / prevGram * 100) : 100
              const Icon = step.icon
              return (
                <div key={step.label}>
                  {/* Arrow connector */}
                  {i > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 mb-2">
                      <div className="w-6 flex justify-center">
                        <div className="w-px h-4 bg-slate-200" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowRight size={10} className="text-slate-300" />
                        <span className="text-[10px] font-medium text-slate-400">
                          loss: {fg(flowSteps[i-1].gram - step.gram)} gr
                          ({(100 - stepPct).toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Step card */}
                  <div className="rounded-xl border p-3" style={{ borderColor: step.border, background: step.bg }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: step.color + '20' }}>
                          <Icon size={11} style={{ color: step.color }} />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600">{step.label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[17px] font-bold tabular-nums" style={{ color: step.color }}>
                          {step.gram > 0 ? step.gram.toFixed(3) : '—'} <span className="text-[11px] font-normal">gr</span>
                        </p>
                        {i > 0 && (
                          <p className="text-[10px] font-semibold" style={{ color: step.color }}>
                            {stepPct.toFixed(2)}% dari sebelumnya
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-white/70">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barW}%`, background: step.color }} />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Loss summary */}
            <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              {[
                { label: 'Loss Peleburan', val: lossLebur, ref: totalDikasih, color: '#F59E0B' },
                { label: 'Loss Produksi',  val: lossProduksi, ref: totalDiterima, color: PALETTE.red },
              ].map(({ label, val, ref, color }) => {
                const p = ref > 0 ? val / ref * 100 : 0
                return (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: color + '0D', border: `1px solid ${color}25` }}>
                    <p className="text-[10px] font-medium text-slate-400">{label}</p>
                    <p className="text-[15px] font-bold tabular-nums mt-0.5" style={{ color }}>
                      {fg(val)} <span className="text-[10px] font-medium">gr</span>
                    </p>
                    <p className="text-[10px] font-semibold" style={{ color }}>{p.toFixed(2)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Shieldtag donut + stats */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Shield size={15} className="text-green-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">Status Shieldtag</p>
              <p className="text-[11px] text-slate-400">{stTotal} total terdaftar</p>
            </div>
          </div>

          {stTotal > 0 ? (
            <div className="p-4">
              {/* Big number tiles */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Aktif',   val: stAktif,   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
                  { label: 'Terjual', val: stTerjual, color: PALETTE.violet, bg: '#F5F3FF', border: '#DDD6FE' },
                  { label: 'Transit', val: stTransit, color: PALETTE.blue,   bg: '#EFF6FF', border: '#BFDBFE' },
                ].map(({ label, val, color, bg, border }) => {
                  const p = stTotal > 0 ? val / stTotal * 100 : 0
                  return (
                    <div key={label} className="rounded-xl p-3 text-center border" style={{ background: bg, borderColor: border }}>
                      <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>{val}</p>
                      <p className="text-[10px] font-medium text-slate-500 mt-1">{label}</p>
                      <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>{p.toFixed(0)}%</p>
                    </div>
                  )
                })}
              </div>
              {/* Stacked bar */}
              <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5">
                {stAktif   > 0 && <div className="h-full rounded-sm transition-all" style={{ width: `${stAktif/stTotal*100}%`,   background: '#16A34A' }} />}
                {stTerjual > 0 && <div className="h-full rounded-sm transition-all" style={{ width: `${stTerjual/stTotal*100}%`, background: PALETTE.violet }} />}
                {stTransit > 0 && <div className="h-full rounded-sm transition-all" style={{ width: `${stTransit/stTotal*100}%`, background: PALETTE.blue }} />}
              </div>
              {/* Footer */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Tag size={11} /> Total
                </div>
                <p className="text-[16px] font-bold text-slate-900 tabular-nums">{stTotal} pcs</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-300">
              <Shield size={28} className="mb-2 opacity-30" />
              <p className="text-[12px]">Belum ada shieldtag</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Produksi per Gramasi ── */}
      {gramasiRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Hammer size={15} className="text-violet-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">Produksi per Gramasi</p>
                <p className="text-[11px] text-slate-400">{totalPcs} pcs · {fg(totalGramProduksi, 2)} gr total</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-5 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Horizontal bar chart */}
            <div className="sm:col-span-3 p-4">
              <ResponsiveContainer width="100%" height={Math.max(160, gramasiRows.length * 48)}>
                <BarChart data={gramasiChartData} layout="vertical" barSize={12}
                  margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="gramasi"
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 700 }}
                    axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: any, name: any) => [
                    name === 'pcs' ? `${v} pcs` : `${v} gr`,
                    name === 'pcs' ? 'PCS' : 'Gram',
                  ]} />
                  <Bar dataKey="pcs" fill={PALETTE.violet} radius={[0, 6, 6, 0]} name="pcs" />
                  <Bar dataKey="gram" fill={PALETTE.green} radius={[0, 6, 6, 0]} name="gram" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-5 justify-center mt-1">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                  <span className="w-3 h-2 rounded bg-violet-600 inline-block"/>PCS
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                  <span className="w-3 h-2 rounded bg-green-600 inline-block"/>Gram
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="sm:col-span-2 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Gramasi', 'PCS', 'Gram', 'Serbuk'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gramasiRows.map(r => (
                    <tr key={r.gramasi} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-3 font-bold text-slate-800">{r.gramasi} gr</td>
                      <td className="px-3 py-3 font-bold tabular-nums text-violet-700">{r.pcs}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-green-700">{fg(r.total_gram)}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-amber-600">{fg(r.sisa_serbuk)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-3 py-3 text-[10px] font-bold text-slate-500 uppercase">Total</td>
                    <td className="px-3 py-3 font-bold tabular-nums text-violet-700">{totalPcs}</td>
                    <td className="px-3 py-3 font-bold tabular-nums text-green-700">{fg(totalGramProduksi)}</td>
                    <td className="px-3 py-3 font-bold tabular-nums text-amber-600">{fg(totalSerbuk)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Peleburan detail ── */}
      {peleburans.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
              <FlaskConical size={15} className="text-cyan-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">Detail Peleburan</p>
              <p className="text-[11px] text-slate-400">{peleburans.length} sesi · loss rata-rata {lossPct.toFixed(2)}%</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Kode', 'Tanggal', 'Tim', 'Dikasih', 'Diterima', 'Loss', '%', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {peleburans.map(p => {
                  const loss = Number(p.dikasih_gram) - Number(p.diterima_gram ?? 0)
                  return (
                    <tr key={p.id} className="hover:bg-cyan-50/20 transition-colors">
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
                      <td className="px-4 py-3 text-slate-400 tabular-nums">
                        {p.diterima_gram != null ? pct(loss, Number(p.dikasih_gram)) + '%' : '—'}
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
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase" colSpan={3}>Total</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-800">{fg(totalDikasih)}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-green-700">{fg(totalDiterima)}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-red-500">{fg(lossLebur)}</td>
                  <td className="px-4 py-3 font-bold text-red-500">{pct(lossLebur, totalDikasih)}%</td>
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
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">Packing</p>
              <p className="text-[11px] text-slate-400">
                {packings.length} entry · {packings.reduce((s, p) => s + p.pcs, 0)} pcs total
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Kode', 'Tanggal', 'Gramasi', 'PCS', 'Total Gram', 'PIC'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {packings.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/10 transition-colors">
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

      {/* ── HPP ── */}
      {showHpp && batch.hpp_gr != null && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
              <Tag size={12} className="text-amber-700" />
            </div>
            <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wide">Informasi HPP</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'HPP per Gram', value: formatRupiah(batch.hpp_gr) },
              { label: 'HPP Total Produksi', value: formatRupiah(batch.hpp_gr * totalGramProduksi) },
              ...(batch.harga_beli != null ? [{ label: 'Harga Beli', value: formatRupiah(batch.harga_beli) }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/70 rounded-xl p-3.5 border border-amber-100">
                <p className="text-[10px] font-semibold text-amber-600">{label}</p>
                <p className="text-[16px] font-bold text-amber-900 tabular-nums mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
