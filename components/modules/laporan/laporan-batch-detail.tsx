'use client'

import { Download, ArrowLeft, Package, Layers, Tag, Hammer } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatRupiah, cn } from '@/lib/utils'

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
  sumber_batch_gram: number | null
}

interface ProduksiItem {
  id: number; kode: string; gramasi: string
  pcs: number; total_gram: number | null
  current_status: string | null; sisa_serbuk: number
  peleburan_id: number | null
}

interface Packing {
  id: number; kode: string; gramasi: string | null
  pcs: number; total_gram: number | null; tanggal: string; pic: string | null
}

interface Shieldtag {
  kode: string; gramasi: string | null; status: string
}

interface Props {
  batch: Batch
  peleburans: Peleburan[]
  produksiItems: ProduksiItem[]
  packings: Packing[]
  shieldtags: Shieldtag[]
  userRole: string
}

const canSeeHpp = (r: string) => ['owner', 'admin_pusat', 'accounting'].includes(r)

function fg(n: number | null | undefined, d = 3) {
  return n != null ? Number(n).toFixed(d) : '—'
}

function pct(part: number, total: number) {
  if (total === 0) return '0.00%'
  return (part / total * 100).toFixed(2) + '%'
}

export default function LaporanBatchDetail({ batch, peleburans, produksiItems, packings, shieldtags, userRole }: Props) {
  const showHpp = canSeeHpp(userRole)

  // ── Kalkulasi utama ────────────────────────────────────────────────────────
  const bahanMasuk       = Number(batch.bahan_dari_pusat ?? 0)
  const totalDikasih     = peleburans.reduce((s, p) => s + Number(p.dikasih_gram ?? 0), 0)
  const totalDiterima    = peleburans.reduce((s, p) => s + Number(p.diterima_gram ?? 0), 0)
  const lossLebur        = totalDikasih - totalDiterima
  const lossPct          = totalDikasih > 0 ? lossLebur / totalDikasih * 100 : 0

  // Produksi per gramasi
  const gramasiMap = new Map<string, { pcs: number; total_gram: number; sisa_serbuk: number }>()
  for (const p of produksiItems) {
    const g = p.gramasi
    const cur = gramasiMap.get(g) ?? { pcs: 0, total_gram: 0, sisa_serbuk: 0 }
    gramasiMap.set(g, {
      pcs:        cur.pcs + Number(p.pcs ?? 0),
      total_gram: cur.total_gram + Number(p.total_gram ?? 0),
      sisa_serbuk: cur.sisa_serbuk + Number(p.sisa_serbuk ?? 0),
    })
  }
  const gramasiRows = [...gramasiMap.entries()]
    .map(([gramasi, v]) => ({ gramasi, ...v }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  const totalGramProduksi = gramasiRows.reduce((s, r) => s + r.total_gram, 0)
  const totalSerbuk        = gramasiRows.reduce((s, r) => s + r.sisa_serbuk, 0)
  const totalPcs           = gramasiRows.reduce((s, r) => s + r.pcs, 0)

  const lossProduksi     = totalDiterima - totalGramProduksi - totalSerbuk
  const totalLosses      = totalDikasih - totalGramProduksi - totalSerbuk
  const totalLossesPct   = totalDikasih > 0 ? totalLosses / totalDikasih * 100 : 0

  // Shieldtag summary
  const stAktif    = shieldtags.filter(s => s.status === 'Aktif').length
  const stDist     = shieldtags.filter(s => s.status === 'Terdistribusi').length
  const stTerjual  = shieldtags.filter(s => s.status === 'Terjual').length
  const stTotal    = shieldtags.length

  // Export CSV
  function exportCSV() {
    const rows: string[][] = []
    rows.push([`LAPORAN BATCH — ${batch.kode}`])
    rows.push([`Tanggal`, formatDate(batch.tanggal)])
    rows.push([`Supplier`, batch.supplier ?? '—'])
    rows.push([])

    rows.push(['=== BAHAN BAKU ==='])
    rows.push(['Bahan Masuk dari Pusat', fg(bahanMasuk)])
    rows.push(['Total Dikasih ke Lebur', fg(totalDikasih)])
    rows.push(['Total Diterima (Siap Cetak)', fg(totalDiterima)])
    rows.push(['Losses Peleburan', fg(lossLebur), pct(lossLebur, totalDikasih)])
    rows.push([])

    rows.push(['=== PRODUKSI PER GRAMASI ==='])
    rows.push(['Gramasi', 'PCS', 'Total Gram', 'Sisa Serbuk'])
    for (const r of gramasiRows) {
      rows.push([r.gramasi + 'gr', String(r.pcs), fg(r.total_gram), fg(r.sisa_serbuk)])
    }
    rows.push(['TOTAL', String(totalPcs), fg(totalGramProduksi), fg(totalSerbuk)])
    rows.push([])

    rows.push(['=== LOSSES ==='])
    rows.push(['Losses Produksi', fg(lossProduksi), pct(lossProduksi, totalDiterima)])
    rows.push(['TOTAL LOSSES', fg(totalLosses), pct(totalLosses, totalDikasih)])
    rows.push([])

    rows.push(['=== PELEBURAN ==='])
    rows.push(['Kode', 'Tanggal', 'Dikasih (gr)', 'Diterima (gr)', 'Loss (gr)', 'Tim', 'Status'])
    for (const p of peleburans) {
      const l = Number(p.dikasih_gram) - Number(p.diterima_gram ?? 0)
      rows.push([p.kode, p.tanggal, fg(p.dikasih_gram), fg(p.diterima_gram), fg(l), p.tim_nama ?? '—', p.status])
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `laporan-batch-${batch.kode.replace(/\//g, '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const Card = ({ label, value, sub, accent = '#8B5CF6', bg = 'rgba(139,92,246,0.06)' }: {
    label: string; value: string; sub?: string; accent?: string; bg?: string
  }) => (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${accent}22` }}>
      <p className="text-[10px] font-medium" style={{ color: accent }}>{label}</p>
      <p className="text-[18px] font-semibold text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-6 pb-12 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/laporan?tab=batch" className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-violet-600 mb-3 transition-colors">
            <ArrowLeft size={12} /> Kembali ke Laporan
          </Link>
          <h1 className="text-[20px] font-semibold text-slate-800 font-mono">{batch.kode}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {formatDate(batch.tanggal)}
            {batch.supplier && <> · {batch.supplier}</>}
            {batch.status && (
              <span className={cn('ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                batch.status === 'Selesai' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              )}>{batch.status}</span>
            )}
          </p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* KPI cards baris atas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="Bahan Masuk" value={`${fg(bahanMasuk)} gr`} />
        <Card label="Siap Cetak" value={`${fg(totalDiterima)} gr`} accent="#0EA5E9" bg="rgba(14,165,233,0.06)" />
        <Card label="Total Produksi" value={`${fg(totalGramProduksi)} gr`} accent="#16A34A" bg="rgba(22,163,74,0.06)"
          sub={`${totalPcs} pcs`} />
        <Card label="Total Losses" value={`${fg(totalLosses)} gr`}
          accent={totalLosses > 0 ? '#EF4444' : '#94A3B8'}
          bg={totalLosses > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(148,163,184,0.06)'}
          sub={pct(totalLosses, totalDikasih) + ' dari bahan masuk'} />
      </div>

      {/* Alur gram */}
      <div className="rounded-xl p-5 bg-white border border-slate-200 space-y-4">
        <p className="text-[12px] font-medium text-slate-400">Alur Gram — Batch {batch.kode}</p>

        <div className="space-y-2">
          {[
            { label: 'Bahan Masuk dari Pusat', gram: bahanMasuk, color: '#8B5CF6', pctOf: null as number | null },
            { label: 'Dikasih ke Lebur', gram: totalDikasih, color: '#0EA5E9', pctOf: bahanMasuk },
            { label: 'Diterima (Siap Cetak)', gram: totalDiterima, color: '#22C55E', pctOf: totalDikasih },
            { label: 'Losses Peleburan', gram: lossLebur, color: '#F87171', pctOf: totalDikasih },
            { label: 'Total Gram Produksi', gram: totalGramProduksi, color: '#16A34A', pctOf: totalDiterima },
            { label: 'Sisa Serbuk', gram: totalSerbuk, color: '#F59E0B', pctOf: totalDiterima },
            { label: 'Losses Produksi', gram: lossProduksi, color: '#EF4444', pctOf: totalDiterima },
          ].map(row => {
            const barPct = bahanMasuk > 0 ? Math.min(100, row.gram / bahanMasuk * 100) : 0
            return (
              <div key={row.label} className="flex items-center gap-3">
                <p className="text-[12px] text-slate-600 w-52 flex-shrink-0">{row.label}</p>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: row.color }} />
                </div>
                <p className="text-[12px] font-semibold text-slate-700 w-24 text-right">{fg(row.gram)} gr</p>
                {row.pctOf !== null && (
                  <p className="text-[10px] text-slate-400 w-14 text-right">{pct(row.gram, row.pctOf)}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Peleburan detail */}
      {peleburans.length > 0 && (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Layers size={14} className="text-cyan-500" />
            <p className="text-[13px] font-semibold text-slate-800">Peleburan ({peleburans.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  {['Kode', 'Tanggal', 'Tim', 'Dikasih (gr)', 'Diterima (gr)', 'Loss (gr)', '%', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peleburans.map((p, i) => {
                  const loss = Number(p.dikasih_gram) - Number(p.diterima_gram ?? 0)
                  return (
                    <tr key={p.id} className={cn('border-t border-slate-50 hover:bg-cyan-50/20', i % 2 === 1 && 'bg-slate-50/30')}>
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-cyan-700">{p.kode}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-700">{p.tim_nama ?? '—'}</td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{fg(p.dikasih_gram)}</td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-green-700">
                        {p.diterima_gram != null ? fg(p.diterima_gram) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-red-500">{p.diterima_gram != null ? fg(loss) : '—'}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">{p.diterima_gram != null ? pct(loss, Number(p.dikasih_gram)) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          p.status === 'selesai' ? 'bg-green-50 text-green-700' :
                          p.status === 'proses'  ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-50 text-slate-500'
                        )}>{p.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{fg(totalDikasih)}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{fg(totalDiterima)}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-red-500">{fg(lossLebur)}</td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-red-500">{pct(lossLebur, totalDikasih)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Produksi per gramasi */}
      {gramasiRows.length > 0 && (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Hammer size={14} className="text-violet-500" />
            <p className="text-[13px] font-semibold text-slate-800">Produksi per Gramasi</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  {['Gramasi', 'PCS', 'Total Gram', 'Sisa Serbuk', 'Status Terkini'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gramasiRows.map((r, i) => {
                  // collect statuses
                  const statuses = produksiItems
                    .filter(p => p.gramasi === r.gramasi)
                    .map(p => p.current_status)
                    .filter(Boolean)
                  const uniqueStatuses = [...new Set(statuses)]
                  return (
                    <tr key={r.gramasi} className={cn('border-t border-slate-50 hover:bg-violet-50/10', i % 2 === 1 && 'bg-slate-50/30')}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.gramasi}gr</td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{r.pcs} pcs</td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{fg(r.total_gram)} gr</td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-amber-600">{fg(r.sisa_serbuk)} gr</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {uniqueStatuses.map(s => (
                            <span key={s} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">{s}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">Total</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{totalPcs} pcs</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{fg(totalGramProduksi)} gr</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-amber-600">{fg(totalSerbuk)} gr</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Packing */}
      {packings.length > 0 && (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Package size={14} className="text-blue-500" />
            <p className="text-[13px] font-semibold text-slate-800">Packing ({packings.length} entry · {packings.reduce((s, p) => s + p.pcs, 0)} pcs)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  {['Kode', 'Tanggal', 'Gramasi', 'PCS', 'Total Gram', 'PIC'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packings.map((p, i) => (
                  <tr key={p.id} className={cn('border-t border-slate-50 hover:bg-blue-50/10', i % 2 === 1 && 'bg-slate-50/30')}>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-blue-700">{p.kode}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{p.gramasi ?? '—'}gr</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{p.pcs}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-green-700">{fg(p.total_gram)} gr</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{p.pic ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shieldtag summary */}
      {shieldtags.length > 0 && (
        <div className="rounded-xl p-5 bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={14} className="text-green-500" />
            <p className="text-[13px] font-semibold text-slate-800">Shieldtag — {stTotal} total</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Aktif', val: stAktif, color: '#22C55E' },
              { label: 'Terdistribusi', val: stDist, color: '#3B82F6' },
              { label: 'Terjual', val: stTerjual, color: '#8B5CF6' },
              { label: 'Total', val: stTotal, color: '#64748B' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                <p className="text-[20px] font-semibold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HPP info (restricted) */}
      {showHpp && batch.hpp_gr != null && (
        <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-amber-700">HPP / Gram</p>
            <p className="text-[16px] font-semibold text-amber-800">{formatRupiah(batch.hpp_gr)}</p>
          </div>
          {batch.harga_beli != null && (
            <p className="text-[12px] text-amber-600 mt-1">Harga Beli: {formatRupiah(batch.harga_beli)}</p>
          )}
        </div>
      )}

      {/* Catatan */}
      {batch.catatan && (
        <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
          <p className="text-[12px] font-medium text-slate-400 mb-1">Catatan</p>
          <p className="text-[13px] text-slate-700">{batch.catatan}</p>
        </div>
      )}
    </div>
  )
}
