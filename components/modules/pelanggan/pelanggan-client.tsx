'use client'

import { useState } from 'react'
import { Users, Search, Phone, CreditCard, ShoppingCart, TrendingUp, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRupiah, formatDate, cn } from '@/lib/utils'

interface Pelanggan {
  key: string
  nama: string
  hp: string | null
  ktp: string | null
  txCount: number
  totalPcs: number
  totalBelanja: number
  lastTanggal: string
  channels: string[]
  transactions: any[]
}

interface Props {
  pelangganList: Pelanggan[]
  userRole: string
  canSeeRp: boolean
}

const CHANNEL_LABEL: Record<string, string> = {
  toko: 'Toko', shopee: 'Shopee', tokopedia: 'Tokopedia',
  tiktok: 'TikTok', cabang: 'Cabang', raja_emas: 'Raja Emas',
}

export default function PelangganClient({ pelangganList, canSeeRp }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sort, setSort] = useState<'belanja' | 'transaksi' | 'terakhir'>('belanja')

  const filtered = pelangganList
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.nama.toLowerCase().includes(q) || (p.hp ?? '').includes(q) || (p.ktp ?? '').includes(q)
    })
    .sort((a, b) => {
      if (sort === 'transaksi') return b.txCount - a.txCount
      if (sort === 'terakhir') return b.lastTanggal.localeCompare(a.lastTanggal)
      return b.totalBelanja - a.totalBelanja
    })

  const totalCustomer = pelangganList.length
  const repeatBuyer = pelangganList.filter(p => p.txCount > 1).length
  const totalOmzet = pelangganList.reduce((s, p) => s + p.totalBelanja, 0)

  return (
    <div className="space-y-5 pb-8">
      <div className="space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Database Pelanggan</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Agregasi dari riwayat penjualan · {totalCustomer} pelanggan unik</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Pelanggan', value: totalCustomer.toLocaleString('id-ID'), icon: Users, cls: 'bg-violet-50 text-violet-600' },
            { label: 'Repeat Buyer', value: repeatBuyer.toLocaleString('id-ID'), icon: TrendingUp, cls: 'bg-green-50 text-green-600' },
            { label: 'Total Omzet', value: canSeeRp ? formatRupiah(totalOmzet) : '—', icon: ShoppingCart, cls: 'bg-sky-50 text-sky-600' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${k.cls}`}>
                <k.icon size={15} />
              </div>
              <p className="text-[18px] font-bold text-slate-800 leading-none tabular-nums">{k.value}</p>
              <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, no. HP, atau KTP..."
              className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={13} className="text-slate-400" /></button>}
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            {(['belanja', 'transaksi', 'terakhir'] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                className={cn('px-3 py-2 text-[12px] font-bold transition-colors',
                  sort === s ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                {s === 'belanja' ? 'Omzet' : s === 'transaksi' ? 'Transaksi' : 'Terbaru'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center"
              >
              <Users size={28} className="text-slate-200 mx-auto mb-2" />
              <p className="text-[13px] text-slate-400">Tidak ada pelanggan ditemukan</p>
            </div>
          ) : filtered.map((p, i) => (
            <div key={p.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpanded(expanded === p.key ? null : p.key)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[13px] text-violet-700 bg-violet-50">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-[13px] truncate">{p.nama}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.hp && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Phone size={9}/>{p.hp}</span>}
                      {p.ktp && <span className="text-[11px] text-slate-400 flex items-center gap-1"><CreditCard size={9}/>{p.ktp}</span>}
                      {p.channels.map(ch => (
                        <span key={ch} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{CHANNEL_LABEL[ch] ?? ch}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[13px] font-black text-slate-800">{p.txCount}x beli · {p.totalPcs} pcs</p>
                    {canSeeRp && <p className="text-[11px] text-violet-600 font-semibold">{formatRupiah(p.totalBelanja)}</p>}
                    <p className="text-[10px] text-slate-400">Terakhir {formatDate(p.lastTanggal)}</p>
                  </div>
                  {expanded === p.key ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </div>

              {expanded === p.key && (
                <div className="border-t border-slate-50 px-4 pb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3">Riwayat Transaksi</p>
                  <div className="space-y-1.5">
                    {p.transactions.sort((a: any, b: any) => b.tanggal.localeCompare(a.tanggal)).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-[12px] font-mono font-bold text-violet-700">{tx.no_faktur}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(tx.tanggal)} · {tx.pcs} pcs {tx.gramasi}gr via {CHANNEL_LABEL[tx.channel] ?? tx.channel}</p>
                        </div>
                        {canSeeRp && <p className="text-[12px] font-bold text-slate-700">{formatRupiah(Number(tx.total_harga_jual ?? 0))}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
