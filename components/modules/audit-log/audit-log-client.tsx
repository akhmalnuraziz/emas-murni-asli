'use client'

import { useMemo, useState } from 'react'
import {
  Search, X, ScrollText, Clock, User, ChevronRight,
  PlusCircle, Pencil, Trash2, ShieldCheck, HelpCircle, Filter
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'

interface AuditLogRow {
  id: number
  timestamp: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  action: string
  module: string
  record_key: string | null
  record_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  reason: string | null
}

interface Props {
  logs: AuditLogRow[]
  userRole: string
}

// ─── Normalization helpers (production data has inconsistent casing) ────────
function normModule(m: string | null | undefined): string {
  if (!m) return 'LAINNYA'
  return m.trim().toUpperCase().replace(/[_-]+/g, ' ')
}

function normAction(a: string | null | undefined): string {
  if (!a) return '-'
  return a.trim().toUpperCase().replace(/[_-]+/g, ' ')
}

const MODULE_PALETTE = [
  { text: '#7C3AED', bg: 'rgba(139,92,246,0.1)', dot: '#8B5CF6' },
  { text: '#2563EB', bg: 'rgba(59,130,246,0.1)', dot: '#3B82F6' },
  { text: '#B45309', bg: 'rgba(245,158,11,0.1)', dot: '#F59E0B' },
  { text: '#16A34A', bg: 'rgba(34,197,94,0.1)', dot: '#22C55E' },
  { text: '#DB2777', bg: 'rgba(236,72,153,0.1)', dot: '#EC4899' },
  { text: '#0E7490', bg: 'rgba(6,182,212,0.1)', dot: '#06B6D4' },
  { text: '#9333EA', bg: 'rgba(168,85,247,0.1)', dot: '#A855F7' },
  { text: '#475569', bg: 'rgba(100,116,139,0.1)', dot: '#64748B' },
]

function moduleStyle(mod: string) {
  let hash = 0
  for (let i = 0; i < mod.length; i++) hash = (hash * 31 + mod.charCodeAt(i)) >>> 0
  return MODULE_PALETTE[hash % MODULE_PALETTE.length]
}

function actionStyle(action: string): { text: string; bg: string; icon: typeof PlusCircle } {
  const a = action.toUpperCase()
  if (a.includes('CREATE') || a.includes('INSERT') || a.includes('REGISTER') || a.includes('TAMBAH'))
    return { text: '#16A34A', bg: 'rgba(34,197,94,0.1)', icon: PlusCircle }
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('UBAH'))
    return { text: '#2563EB', bg: 'rgba(59,130,246,0.1)', icon: Pencil }
  if (a.includes('DELETE') || a.includes('VOID') || a.includes('REJECT') || a.includes('HAPUS'))
    return { text: '#DC2626', bg: 'rgba(239,68,68,0.1)', icon: Trash2 }
  if (a.includes('APPROVE') || a.includes('CONFIRM') || a.includes('TERIMA') || a.includes('TTD'))
    return { text: '#7C3AED', bg: 'rgba(139,92,246,0.1)', icon: ShieldCheck }
  return { text: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: HelpCircle }
}

const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"

function JsonBlock({ label, data, color }: { label: string; data: Record<string, unknown> | null; color: string }) {
  const entries = data ? Object.entries(data) : []
  return (
    <div className="rounded-lg px-3 py-2 bg-slate-50 border border-slate-200">
      <p className="text-[10px] font-medium mb-2" style={{ color }}>{label}</p>
      {entries.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">Tidak ada data</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 text-[12px]">
              <span className="text-slate-400 font-medium flex-shrink-0">{k}</span>
              <span className="font-mono text-slate-700 text-right break-all">
                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailDrawer({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  const mod = normModule(log.module)
  const mcfg = moduleStyle(mod)
  const acfg = actionStyle(normAction(log.action))
  const ActionIcon = acfg.icon

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: acfg.bg }}>
              <ActionIcon size={16} style={{ color: acfg.text }}/>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-900">{log.record_key || log.record_id || `#${log.id}`}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: mcfg.bg, color: mcfg.text }}>{mod}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: acfg.bg, color: acfg.text }}>{normAction(log.action)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0"><X size={14}/></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg px-3 py-2 bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-400 font-medium">Waktu</p>
              <p className="text-[13px] font-semibold text-slate-700 mt-0.5">{formatDateTime(log.timestamp)}</p>
            </div>
            <div className="rounded-lg px-3 py-2 bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-400 font-medium">Oleh</p>
              <p className="text-[13px] font-semibold text-slate-700 mt-0.5">{log.user_name || '—'} <span className="text-slate-400 font-normal">({log.user_role || '—'})</span></p>
            </div>
          </div>

          {log.reason && (
            <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
              <p className="text-[10px] font-medium mb-1">Alasan</p>
              <p>{log.reason}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <JsonBlock label="Sebelum" data={log.before_data} color="#DC2626"/>
            <JsonBlock label="Sesudah" data={log.after_data} color="#16A34A"/>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuditLogClient({ logs }: Props) {
  const [search, setSearch] = useState('')
  const [filterModule, setFilterModule] = useState('Semua')
  const [filterAction, setFilterAction] = useState('Semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailItem, setDetailItem] = useState<AuditLogRow | null>(null)

  const modules = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(l => set.add(normModule(l.module)))
    return ['Semua', ...Array.from(set).sort()]
  }, [logs])

  const actions = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(l => set.add(normAction(l.action)))
    return ['Semua', ...Array.from(set).sort()]
  }, [logs])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    logs.forEach(l => { const m = normModule(l.module); c[m] = (c[m] ?? 0) + 1 })
    return c
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(l => {
      if (filterModule !== 'Semua' && normModule(l.module) !== filterModule) return false
      if (filterAction !== 'Semua' && normAction(l.action) !== filterAction) return false
      if (dateFrom && l.timestamp < dateFrom) return false
      if (dateTo && l.timestamp > `${dateTo}T23:59:59`) return false
      if (!q) return true
      return (
        l.record_key?.toLowerCase().includes(q) ||
        l.record_id?.toLowerCase().includes(q) ||
        l.user_name?.toLowerCase().includes(q) ||
        l.reason?.toLowerCase().includes(q) ||
        normAction(l.action).toLowerCase().includes(q)
      )
    })
  }, [logs, search, filterModule, filterAction, dateFrom, dateTo])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = logs.filter(l => l.timestamp?.startsWith(todayStr)).length
  const distinctUsers = new Set(logs.map(l => l.user_name).filter(Boolean)).size

  return (
    <div className="space-y-5 pb-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Audit Center</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">{logs.length} aktivitas tercatat (500 terbaru)</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Log', val: logs.length, cls: 'text-violet-600' },
            { label: 'Hari Ini', val: todayCount, cls: 'text-blue-600' },
            { label: 'Modul Aktif', val: modules.length - 1, cls: 'text-green-600' },
            { label: 'User Tercatat', val: distinctUsers, cls: 'text-amber-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-[10.5px] font-medium text-slate-400">{c.label}</p>
              <p className={`text-[22px] font-semibold mt-1 tabular-nums leading-none ${c.cls}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari record, user, alasan, aksi..."
              className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
              style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(209,213,219,0.5)' }}/>
          </div>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={cn(inp, 'w-auto min-w-[140px]')}>
            {actions.map(a => <option key={a} value={a}>{a === 'Semua' ? 'Semua Aksi' : a}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={cn(inp, 'w-auto')}/>
          <span className="text-slate-400 text-[12px]">s/d</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={cn(inp, 'w-auto')}/>
          {(search || filterAction !== 'Semua' || dateFrom || dateTo || filterModule !== 'Semua') && (
            <button onClick={() => { setSearch(''); setFilterAction('Semua'); setDateFrom(''); setDateTo(''); setFilterModule('Semua') }}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-500 hover:text-red-500 rounded-xl transition-colors">
              <X size={12}/> Reset
            </button>
          )}
        </div>

        {/* Module tabs */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={13} className="text-slate-400 flex-shrink-0"/>
          {modules.map(m => {
            const isAct = filterModule === m
            const mcfg = m !== 'Semua' ? moduleStyle(m) : null
            const cnt = m === 'Semua' ? logs.length : (counts[m] ?? 0)
            return (
              <button key={m} onClick={() => setFilterModule(m)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={isAct
                  ? { background: mcfg?.dot ?? 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: `0 4px 12px ${mcfg?.dot ?? '#8B5CF6'}40` }
                  : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
                {m} {cnt > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(107,114,128,0.12)' }}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-auto"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 40px rgba(139,92,246,0.08)' }}>
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(243,244,246,0.9)', background: 'rgba(249,250,251,0.6)' }}>
                {['WAKTU', 'MODUL', 'AKSI', 'RECORD', 'USER', 'ALASAN', ''].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-medium text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(139,92,246,0.08)' }}>
                    <ScrollText size={28} className="text-violet-300"/>
                  </div>
                  <p className="text-[13px] font-medium text-slate-400">Tidak ada aktivitas yang cocok</p>
                </td></tr>
              ) : filtered.map((l, idx) => {
                const mod = normModule(l.module)
                const mcfg = moduleStyle(mod)
                const acfg = actionStyle(normAction(l.action))
                return (
                  <tr key={l.id}
                    className={cn('border-t transition-colors hover:bg-violet-50/20 cursor-pointer', idx === 0 ? 'border-transparent' : '')}
                    style={{ borderColor: 'rgba(243,244,246,0.7)' }}
                    onClick={() => setDetailItem(l)}>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5"><Clock size={11} className="text-slate-300"/>{formatDateTime(l.timestamp)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: mcfg.bg, color: mcfg.text }}>{mod}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: acfg.bg, color: acfg.text }}>{normAction(l.action)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-semibold text-slate-900">{l.record_key || l.record_id || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      <div className="flex items-center gap-1.5"><User size={11} className="text-slate-300"/>{l.user_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 max-w-[200px] truncate">{l.reason || '—'}</td>
                    <td className="px-4 py-3"><ChevronRight size={14} className="text-slate-300"/></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailItem && <DetailDrawer log={detailItem} onClose={() => setDetailItem(null)}/>}
    </div>
  )
}
