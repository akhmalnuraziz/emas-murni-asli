'use client'

import { useState, useTransition, useCallback } from 'react'
import { getAuditLogs } from '@/app/(dashboard)/audit-log/actions'
import { Search, Filter, X, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

// ── Config ────────────────────────────────────────────────────────────────────
const ACTION_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  'CREATE':  { label: 'Tambah',  color: '#059669', bg: '#ECFDF5', dot: '#059669' },
  'EDIT':    { label: 'Edit',    color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
  'UPDATE':  { label: 'Update',  color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
  'VOID':    { label: 'Void',    color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
  'DELETE':  { label: 'Hapus',   color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
  'REJECT':  { label: 'Reject',  color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  'PRINT':   { label: 'Cetak',   color: '#7C3AED', bg: '#F5F3FF', dot: '#7C3AED' },
  'LOGIN':   { label: 'Login',   color: '#0891B2', bg: '#ECFEFF', dot: '#0891B2' },
}
const getAction = (a: string) => ACTION_CFG[a?.toUpperCase()] ?? { label: a, color: '#6B7280', bg: '#F3F4F6', dot: '#6B7280' }

const MODULE_LABEL: Record<string, string> = {
  'PRODUKSI': 'Produksi', 'produksi': 'Produksi',
  'packing': 'Packing Log', 'PACKING': 'Packing Log',
  'shieldtag': 'Shieldtag', 'SHIELDTAG': 'Shieldtag',
  'master_batch': 'Bahan Baku', 'BAHAN_BAKU': 'Bahan Baku',
  'mutasi': 'Mutasi', 'MUTASI': 'Mutasi',
  'PENJUALAN': 'Penjualan', 'penjualan': 'Penjualan',
  'PENGELUARAN': 'Pengeluaran', 'pengeluaran': 'Pengeluaran',
  'pengaturan': 'Pengaturan', 'PENGATURAN': 'Pengaturan',
}
const getModule = (m: string) => MODULE_LABEL[m] ?? m

const ROLE_BADGE: Record<string, string> = {
  'owner': 'bg-violet-100 text-violet-700',
  'admin_pusat': 'bg-blue-100 text-blue-700',
  'spv': 'bg-cyan-100 text-cyan-700',
  'kepala_cabang': 'bg-amber-100 text-amber-700',
  'operator_produksi': 'bg-green-100 text-green-700',
}

function fmtTime(ts: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) +
    ' · ' + d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
}

function JsonDiff({ before, after }: { before: any; after: any }) {
  if (!before && !after) return null
  const keys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]))
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-gray-100 text-[11px] font-mono">
      <div className="grid grid-cols-2 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        <span>Sebelum</span><span>Sesudah</span>
      </div>
      {keys.map(k => {
        const bv = before?.[k]
        const av = after?.[k]
        const changed = JSON.stringify(bv) !== JSON.stringify(av)
        return (
          <div key={k} className={`grid grid-cols-2 px-3 py-1.5 border-t border-gray-50 ${changed ? 'bg-amber-50' : ''}`}>
            <div className="pr-2">
              <span className="text-[10px] text-gray-400 block">{k}</span>
              <span className={`${changed ? 'text-red-500 line-through' : 'text-gray-600'} break-all`}>
                {bv != null ? String(bv) : '—'}
              </span>
            </div>
            <div className="pl-2">
              <span className="text-[10px] text-gray-400 block">&nbsp;</span>
              <span className={`${changed ? 'text-green-600 font-semibold' : 'text-gray-600'} break-all`}>
                {av != null ? String(av) : '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LogCard({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false)
  const ac = getAction(log.action)
  const hasDetail = log.before_data || log.after_data || log.reason
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div className="px-4 py-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ color: ac.color, background: ac.bg }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.dot }} />
              {ac.label}
            </span>
            {/* Module */}
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {getModule(log.module)}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtTime(log.timestamp)}</span>
        </div>

        {/* Record key */}
        {log.record_key && (
          <p className="text-sm font-bold text-gray-900 mb-1">{log.record_key}</p>
        )}

        {/* User row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-violet-600">
                {(log.user_name ?? '?')[0]?.toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-gray-700 font-medium">{log.user_name ?? 'System'}</span>
            {log.user_role && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[log.user_role] ?? 'bg-gray-100 text-gray-500'}`}>
                {log.user_role}
              </span>
            )}
          </div>
          {hasDetail && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-violet-500 font-semibold">
              Detail {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </button>
          )}
        </div>

        {/* Reason */}
        {log.reason && (
          <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
            📝 {log.reason}
          </p>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <JsonDiff before={log.before_data} after={log.after_data} />
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AuditLogClient({
  initialLogs, initialTotal, stats
}: {
  initialLogs: any[]
  initialTotal: number
  stats: Record<string, number>
}) {
  const [logs, setLogs]       = useState(initialLogs)
  const [total, setTotal]     = useState(initialTotal)
  const [page, setPage]       = useState(1)
  const [loading, startLoad]  = useTransition()
  const [showFilter, setShowFilter] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [action,   setAction]   = useState('')
  const [module,   setModule]   = useState('')
  const [userName, setUserName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState(today)

  const totalPages = Math.ceil(total / 30)
  const hasFilter = action || module || userName || dateFrom

  const load = useCallback((p: number, reset = false) => {
    startLoad(async () => {
      const r = await getAuditLogs({ page: p, action, module, user_name: userName, dateFrom, dateTo })
      if (reset) { setLogs(r.logs); setTotal(r.total); setPage(1) }
      else { setLogs(prev => [...prev, ...r.logs]); setPage(p) }
    })
  }, [action, module, userName, dateFrom, dateTo])

  function applyFilter() {
    setShowFilter(false)
    load(1, true)
  }

  function resetFilter() {
    setAction(''); setModule(''); setUserName(''); setDateFrom(''); setDateTo(today)
    setShowFilter(false)
    startLoad(async () => {
      const r = await getAuditLogs({ page: 1 })
      setLogs(r.logs); setTotal(r.total); setPage(1)
    })
  }

  const ACTIONS = ['CREATE','EDIT','UPDATE','VOID','DELETE','REJECT','PRINT']
  const MODULES = ['PRODUKSI','packing','shieldtag','master_batch','mutasi','PENJUALAN','PENGELUARAN','pengaturan']

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-20">

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {Object.entries(ACTION_CFG).slice(0,6).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-2xl px-3 py-2.5 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p className="text-lg font-black" style={{ color: cfg.color }}>
              {stats[key] ?? 0}
            </p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="px-4 mt-3 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={userName} onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            placeholder="Cari nama user…"
            className="w-full h-10 pl-8 pr-3 bg-white rounded-2xl text-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}/>
        </div>
        <button onClick={() => setShowFilter(!showFilter)}
          className={`h-10 px-3 rounded-2xl flex items-center gap-1.5 text-sm font-semibold border transition-colors
            ${hasFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-100'}`}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <Filter size={13}/>
          Filter {hasFilter && '•'}
        </button>
        <button onClick={() => load(1, true)} disabled={loading}
          className="h-10 w-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <RefreshCw size={14} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`}/>
        </button>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────────── */}
      {showFilter && (
        <div className="mx-4 mt-2 bg-white rounded-2xl border border-gray-100 p-4 space-y-3"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Filter</p>
            {hasFilter && <button onClick={resetFilter} className="text-xs text-red-500 font-semibold">Reset</button>}
          </div>

          {/* Action filter */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Tipe Aksi</p>
            <div className="flex flex-wrap gap-1.5">
              {ACTIONS.map(a => {
                const cfg = getAction(a)
                const active = action === a
                return (
                  <button key={a} onClick={() => setAction(active ? '' : a)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
                    style={{ color: active ? 'white' : cfg.color, background: active ? cfg.dot : cfg.bg }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Module filter */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Modul</p>
            <div className="flex flex-wrap gap-1.5">
              {MODULES.map(m => (
                <button key={m} onClick={() => setModule(module === m ? '' : m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all
                    ${module === m ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {getModule(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Date filter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Dari</p>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full h-9 px-3 bg-[#F2F2F7] rounded-xl text-xs focus:outline-none"/>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Sampai</p>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full h-9 px-3 bg-[#F2F2F7] rounded-xl text-xs focus:outline-none"/>
            </div>
          </div>

          <button onClick={applyFilter}
            className="w-full h-10 rounded-xl bg-violet-600 text-white text-sm font-bold">
            Terapkan Filter
          </button>
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <div className="px-4 mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {total.toLocaleString('id-ID')} aktivitas {hasFilter ? '(terfilter)' : 'total'}
        </p>
        {hasFilter && (
          <button onClick={resetFilter} className="flex items-center gap-1 text-xs text-violet-500 font-semibold">
            <X size={11}/> Hapus filter
          </button>
        )}
      </div>

      {/* ── Log List ──────────────────────────────────────────────────────── */}
      <div className="px-4 mt-2 space-y-2.5">
        {logs.length === 0 && !loading && (
          <div className="bg-white rounded-2xl p-10 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-semibold text-gray-500">Belum ada aktivitas</p>
            <p className="text-xs text-gray-400 mt-1">Aktivitas akan muncul di sini setelah ada aksi di sistem</p>
          </div>
        )}
        {logs.map((log: any) => <LogCard key={log.id} log={log} />)}
      </div>

      {/* ── Load More ────────────────────────────────────────────────────── */}
      {page < totalPages && (
        <div className="px-4 mt-4">
          <button onClick={() => load(page + 1)} disabled={loading}
            className="w-full h-11 rounded-2xl bg-white border border-gray-100 text-sm font-semibold text-violet-600 disabled:opacity-50"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {loading ? 'Memuat…' : `Muat lebih banyak (${total - logs.length} lagi)`}
          </button>
        </div>
      )}
    </div>
  )
}
