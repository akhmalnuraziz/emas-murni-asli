'use client'

import { AlertTriangle, CheckCircle2, Info, ArrowUp, Settings } from 'lucide-react'

type PriorityItem = {
  gramasi: string
  stok: number
  transit: number
  wip: number
  poDemand: number
  poKodes: string[]
  tersedia: number
  safetyStock: number
  rekomendasi: number
  prioritas: 'P1' | 'P2' | 'P3'
}

const P_CFG = {
  P1: {
    label: 'P1 — Urgent',
    desc: 'Ada PO belum terpenuhi',
    icon: AlertTriangle,
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    text: '#DC2626',
  },
  P2: {
    label: 'P2 — Perlu Produksi',
    desc: 'Stok di bawah safety stock',
    icon: Info,
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    text: '#D97706',
  },
  P3: {
    label: 'P3 — Aman',
    desc: 'Stok mencukupi',
    icon: CheckCircle2,
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.15)',
    text: '#16A34A',
  },
}

export default function PrioritasProduksiClient({
  prioritasList, safetyStockGlobal, userRole,
}: {
  prioritasList: PriorityItem[]
  safetyStockGlobal: number
  userRole: string
}) {
  const p1 = prioritasList.filter(p => p.prioritas === 'P1')
  const p2 = prioritasList.filter(p => p.prioritas === 'P2')
  const totalRekomendasi = prioritasList.reduce((s, x) => s + x.rekomendasi, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-700">
            <ArrowUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-slate-900">Prioritas Produksi</h1>
            <p className="text-[12px] text-slate-400">
              Auto-ranking · Safety stock default: {safetyStockGlobal} pcs · {p1.length} urgent · {p2.length} perlu produksi
            </p>
          </div>
        </div>
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <a href="/pengaturan" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors bg-white">
            <Settings size={12} /> Atur Safety Stock
          </a>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['P1','P2','P3'] as const).map(p => {
          const cfg = P_CFG[p]
          const Icon = cfg.icon
          const count = prioritasList.filter(x => x.prioritas === p).length
          return (
            <div key={p} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <Icon size={18} style={{ color: cfg.text }} className="flex-shrink-0" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: cfg.text }}>{count} gramasi</p>
                <p className="text-[10px] font-semibold text-slate-500">{cfg.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total rekomendasi */}
      {totalRekomendasi > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-4 bg-violet-50/20 border border-violet-200/50">
          <div className="text-center">
            <p className="text-[20px] font-semibold text-violet-700">{totalRekomendasi}</p>
            <p className="text-[10px] font-medium text-violet-400">pcs total</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-violet-800">Total Rekomendasi Produksi</p>
            <p className="text-[12px] text-violet-500">
              Jumlah item yang perlu diproduksi untuk memenuhi safety stock + semua PO aktif
            </p>
          </div>
        </div>
      )}

      {prioritasList.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center"
          >
          <CheckCircle2 size={32} className="mx-auto text-slate-200 mb-2" />
          <p className="text-slate-300 text-[13px]">Belum ada data stok atau PO untuk dianalisa.</p>
        </div>
      )}

      {/* Group by priority */}
      {(['P1','P2','P3'] as const).map(p => {
        const items = prioritasList.filter(x => x.prioritas === p)
        if (items.length === 0) return null
        const cfg = P_CFG[p]
        const Icon = cfg.icon
        return (
          <div key={p}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} style={{ color: cfg.text }} />
              <p className="text-[12px] font-medium" style={{ color: cfg.text }}>
                {cfg.label}
              </p>
            </div>
            <div className="rounded-xl overflow-hidden"
              >
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                      {['Gramasi', 'Stok Gudang', 'Transit', 'WIP Produksi', 'Safety Stock', 'PO Demand', 'Rekomendasi', 'PO Aktif'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.gramasi} className={`hover:bg-slate-50/30 ${i !== 0 ? 'border-t border-black/[0.04]' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.gramasi} gr</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold text-[13px] ${item.stok < item.safetyStock ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.stok} pcs
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sky-600 font-semibold">
                          {item.transit > 0 ? `${item.transit} pcs` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {item.wip > 0 ? (
                            <span className="font-semibold text-violet-600">{item.wip} pcs</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium text-[12px]">
                          {item.safetyStock} pcs
                        </td>
                        <td className="px-4 py-3">
                          {item.poDemand > 0 ? (
                            <span className="font-semibold text-red-600">{item.poDemand} pcs</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {item.rekomendasi > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-white text-[12px] px-2.5 py-1 rounded-full"
                              style={{ background: cfg.text }}>
                              +{item.rekomendasi} pcs
                            </span>
                          ) : (
                            <span className="text-[12px] text-green-600 font-semibold">Cukup</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.poKodes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.poKodes.map(k => (
                                <span key={k} className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">{k}</span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
