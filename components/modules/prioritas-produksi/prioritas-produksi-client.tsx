'use client'

import { AlertTriangle, CheckCircle2, Info, ArrowUp } from 'lucide-react'

type PriorityItem = {
  gramasi: string
  stok: number
  transit: number
  poDemand: number
  poKodes: string[]
  tersedia: number
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
    badge: 'bg-red-100 text-red-700',
  },
  P2: {
    label: 'P2 — Perlu Produksi',
    desc: 'Stok di bawah safety stock',
    icon: Info,
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    text: '#D97706',
    badge: 'bg-amber-100 text-amber-700',
  },
  P3: {
    label: 'P3 — Aman',
    desc: 'Stok mencukupi',
    icon: CheckCircle2,
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.15)',
    text: '#16A34A',
    badge: 'bg-green-100 text-green-700',
  },
}

export default function PrioritasProduksiClient({
  prioritasList, safetyStock,
}: {
  prioritasList: PriorityItem[]
  safetyStock: number
}) {
  const p1 = prioritasList.filter(p => p.prioritas === 'P1')
  const p2 = prioritasList.filter(p => p.prioritas === 'P2')
  const p3 = prioritasList.filter(p => p.prioritas === 'P3')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}>
          <ArrowUp size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Prioritas Produksi</h1>
          <p className="text-xs text-slate-400">
            Auto-ranking · Safety stock: {safetyStock} pcs · {p1.length} urgent · {p2.length} perlu produksi
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3">
        {(['P1','P2','P3'] as const).map(p => {
          const cfg = P_CFG[p]
          const Icon = cfg.icon
          const count = prioritasList.filter(x => x.prioritas === p).length
          return (
            <div key={p} className="rounded-3xl p-4 flex items-center gap-3"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <Icon size={18} style={{ color: cfg.text }} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-black" style={{ color: cfg.text }}>{count} gramasi</p>
                <p className="text-[10px] font-semibold text-slate-500">{cfg.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {prioritasList.length === 0 && (
        <div className="rounded-3xl py-20 text-center"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <CheckCircle2 size={32} className="mx-auto text-slate-200 mb-2" />
          <p className="text-slate-300 text-sm">Belum ada data stok atau PO untuk dianalisa.</p>
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
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.text }}>
                {cfg.label}
              </p>
            </div>
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `${cfg.bg}`, borderBottom: `1px solid ${cfg.border}` }}>
                    {['Gramasi', 'Stok Gudang', 'Transit', 'PO Demand', 'PO Aktif'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.gramasi} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.04)' }}
                      className="hover:bg-slate-50/30">
                      <td className="px-4 py-3 font-black text-slate-800">{item.gramasi} gr</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${item.stok < safetyStock ? 'text-red-600' : 'text-slate-800'}`}>
                          {item.stok} pcs
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sky-600 font-semibold">
                        {item.transit > 0 ? `${item.transit} pcs` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.poDemand > 0 ? (
                          <span className="font-bold text-red-600">{item.poDemand} pcs</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.poKodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.poKodes.map(k => (
                              <span key={k} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">{k}</span>
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
        )
      })}
    </div>
  )
}
