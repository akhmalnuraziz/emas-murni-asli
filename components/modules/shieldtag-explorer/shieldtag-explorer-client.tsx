'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search, Tag, Package, Hammer, Layers, ArrowLeftRight,
  ShoppingCart, RotateCcw, ScrollText, CheckCircle2, XCircle,
  Clock, AlertTriangle, ChevronRight
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { searchShieldtag, type ShieldtagDetail } from '@/app/(dashboard)/shieldtag-explorer/actions'

const STATUS_TAG_CFG: Record<string, { bg: string; text: string }> = {
  'Aktif':         { bg: 'rgba(34,197,94,0.1)',  text: '#16A34A' },
  'Terdistribusi': { bg: 'rgba(59,130,246,0.1)', text: '#2563EB' },
  'Terjual':       { bg: 'rgba(139,92,246,0.1)', text: '#7C3AED' },
  'VOID':          { bg: 'rgba(239,68,68,0.1)',  text: '#DC2626' },
  'RETURNED':      { bg: 'rgba(245,158,11,0.1)', text: '#D97706' },
}

export default function ShieldtagExplorerClient() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ShieldtagDetail | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q.toUpperCase()); handleSearchWithKode(q) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSearchWithKode(kode: string) {
    setLoading(true); setErr(''); setResult(null)
    const res = await searchShieldtag(kode.trim())
    setLoading(false)
    if (res.error) { setErr(res.error); return }
    setResult(res.data ?? null)
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setErr(''); setResult(null)
    const res = await searchShieldtag(query.trim())
    setLoading(false)
    if (res.error) { setErr(res.error); return }
    setResult(res.data ?? null)
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          <Search size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-slate-900">Shieldtag Explorer</h1>
          <p className="text-[12px] text-slate-400">Lacak riwayat lengkap satu emas dari kode shieldtag-nya</p>
        </div>
      </div>

      {/* Search box */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
        <p className="text-[12px] text-slate-400">Masukkan kode shieldtag (contoh: <span className="font-mono font-semibold">1H80AA</span>)</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-3 text-[13px] font-mono rounded-2xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all tracking-wider"
            placeholder="Kode Shieldtag…"
          />
          <button onClick={handleSearch} disabled={loading}
            className="px-6 py-3 rounded-2xl text-[13px] font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
            <Search size={15} /> {loading ? 'Mencari…' : 'Cari'}
          </button>
        </div>
        {err && (
          <p className="text-[12px] text-red-600 bg-red-50 rounded-2xl px-4 py-2 flex items-center gap-1.5">
            <XCircle size={13} /> {err}
          </p>
        )}
      </div>

      {/* Hasil */}
      {result && <ShieldtagResult data={result} />}

      {/* Empty state */}
      {!result && !err && !loading && (
        <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center space-y-2">
          <Tag size={36} className="mx-auto text-slate-200" />
          <p className="text-slate-300 text-[13px]">Ketik kode shieldtag dan tekan Cari</p>
        </div>
      )}
    </div>
  )
}

// ─── Hasil pencarian ───────────────────────────────────────────────────────────
function ShieldtagResult({ data }: { data: ShieldtagDetail }) {
  const { tag, packing, produksiItem, produksiEvents, batch, mutasi, penjualan, auditLogs, buyback } = data
  const statusCfg = STATUS_TAG_CFG[tag.status] ?? { bg: '#f1f5f9', text: '#64748b' }

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              <Tag size={24} className="text-white" />
            </div>
            <div>
              <p className="text-[20px] font-black font-mono tracking-wider text-slate-900">{tag.kode}</p>
              <p className="text-[13px] text-slate-400 mt-0.5">
                {tag.gramasi ? `${tag.gramasi} gram` : '—'}
                {tag.batch_kode && <> · Batch <span className="font-mono font-semibold text-slate-600">{tag.batch_kode}</span></>}
              </p>
            </div>
          </div>
          <span className="text-[13px] font-bold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{ background: statusCfg.bg, color: statusCfg.text }}>
            {tag.status}
          </span>
        </div>

        {/* Quick info grid */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCell label="Tgl Registrasi" value={tag.tgl_regis ? formatDate(tag.tgl_regis) : '—'} />
          <InfoCell label="Lokasi" value={tag.lokasi ?? '—'} />
          <InfoCell label="Tgl Distribusi" value={tag.tgl_dist ? formatDate(tag.tgl_dist) : '—'} />
          <InfoCell label="Tgl Terjual" value={tag.tgl_jual ? formatDate(tag.tgl_jual) : '—'} />
        </div>

        {tag.replaced_by_kode && (
          <div className="mt-4 text-[12px] text-amber-700 bg-amber-50 rounded-2xl px-4 py-2.5 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Digantikan oleh: <span className="font-mono font-bold">{tag.replaced_by_kode}</span>
          </div>
        )}
        {tag.replaces_kode && (
          <div className="mt-4 text-[12px] text-blue-700 bg-blue-50 rounded-2xl px-4 py-2.5 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Menggantikan: <span className="font-mono font-bold">{tag.replaces_kode}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <h3 className="font-bold text-slate-800 text-[13px] mb-4">Timeline Perjalanan</h3>
        <div className="space-y-1">
          {/* Batch */}
          {batch && <TimelineItem icon={Layers} color="#8B5CF6" label="Batch" sub={batch.kode} detail={`${Number(batch.timbangan_akhir ?? 0).toFixed(2)} gr · HPP Rp${Number(batch.hpp_gr ?? 0).toLocaleString('id-ID')}/gr`} date={formatDate(batch.tanggal)} />}

          {/* Produksi */}
          {produksiItem && <TimelineItem icon={Hammer} color="#3B82F6" label="Produksi" sub={produksiItem.kode} detail={`${produksiItem.gramasi}gr × ${produksiItem.pcs} pcs`} date={formatDate(produksiItem.created_at)} />}

          {/* Events produksi */}
          {produksiEvents.map(ev => (
            <TimelineItem key={ev.id} icon={ChevronRight} color="#94A3B8" label={ev.status} sub={ev.user_name ?? ''} detail={ev.total_gram ? `${Number(ev.total_gram).toFixed(3)} gr` : ''} date={formatDate(ev.created_at)} indent />
          ))}

          {/* Packing */}
          {packing && <TimelineItem icon={Package} color="#22C55E" label="Packing" sub={packing.kode} detail={`${packing.pcs} pcs · ${Number(packing.total_gram ?? 0).toFixed(3)} gr`} date={formatDate(packing.tanggal)} />}

          {/* Shieldtag register */}
          {tag.tgl_regis && <TimelineItem icon={Tag} color="#7C3AED" label="Registrasi Shieldtag" sub={tag.kode} detail="" date={formatDate(tag.tgl_regis)} />}

          {/* Mutasi */}
          {mutasi.map((m, i) => (
            <TimelineItem key={i} icon={ArrowLeftRight} color="#0EA5E9" label="Transfer" sub={`${m.cabang_asal ?? 'Gudang'} → ${m.cabang_tujuan ?? '?'}`} detail={m.status_terima} date={m.tanggal_kirim ? formatDate(m.tanggal_kirim) : '—'} />
          ))}

          {/* Penjualan */}
          {penjualan && <TimelineItem icon={ShoppingCart} color="#16A34A" label="Terjual" sub={penjualan.toko ?? 'Toko'} detail={`${formatRupiah(penjualan.harga_jual)} · ${penjualan.nama_customer}`} date={formatDate(penjualan.tanggal)} />}

          {/* Buyback */}
          {buyback && <TimelineItem icon={RotateCcw} color="#D97706" label="Buyback" sub={buyback.nama_customer} detail={`${buyback.hasil_inspeksi?.replace(/_/g,' ')} · ${formatRupiah(buyback.harga_beli)}`} date={formatDate(buyback.tanggal)} />}

          {/* Void */}
          {tag.voided_at && (
            <TimelineItem icon={XCircle} color="#EF4444" label="VOID" sub={tag.void_operator_nama ?? ''} detail={tag.void_reason ?? ''} date={formatDate(tag.voided_at)} />
          )}
        </div>
      </div>

      {/* Audit Log */}
      {auditLogs.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 text-[13px] mb-4">Riwayat Perubahan</h3>
          <div className="space-y-2">
            {auditLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-[12px] py-2 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 flex-shrink-0 mt-0.5">
                  <ScrollText size={12} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700">
                    {log.action} <span className="text-slate-400 font-normal">by</span> {log.user_name}
                    {log.user_role && <span className="text-slate-300"> ({log.user_role})</span>}
                  </p>
                  {log.reason && <p className="text-slate-400 mt-0.5">{log.reason}</p>}
                </div>
                <p className="text-slate-300 flex-shrink-0">{log.timestamp ? formatDate(log.timestamp) : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold text-slate-700">{value}</p>
    </div>
  )
}

function TimelineItem({ icon: Icon, color, label, sub, detail, date, indent }: {
  icon: any; color: string; label: string; sub: string; detail: string; date: string; indent?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2', indent && 'pl-8')}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        {sub && <p className="text-[12px] text-slate-400 font-mono">{sub}</p>}
        {detail && <p className="text-[12px] text-slate-400">{detail}</p>}
      </div>
      <p className="text-[11px] text-slate-300 flex-shrink-0">{date}</p>
    </div>
  )
}
