'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Plus, X, Check, Edit2, Trash2, ChevronDown, ChevronUp,
  Package2, Truck, ClipboardCheck, AlertTriangle, RotateCcw,
  FileText, Printer, Building2, Search, Filter, Eye,
  ArrowRight, CheckCircle2, XCircle, Clock, BoxSelect, Copy,
} from 'lucide-react'
import {
  createVendor, updateVendor,
  createProdukPackaging, updateProdukPackaging, toggleProdukAktif,
  createPO, updatePO, voidPO,
  createBatchPenerimaan, submitQC,
  updatePenangananReject, createSJRetur,
} from '@/app/(dashboard)/po-vendor-packaging/actions'

const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')

const fmtNum = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Tab = 'monitoring' | 'po' | 'batch' | 'reject' | 'stok' | 'vendor' | 'master'

interface Props {
  vendors: any[]
  produkList: any[]
  poList: any[]
  batchList: any[]
  rejectList: any[]
  sjList: any[]
  stokList: any[]
  monitoring: any[]
  userRole: string
  userName: string
  canManage: boolean
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const show = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'bg-blue-50 text-blue-600' },
    partial:     { label: 'Partial',     cls: 'bg-amber-50 text-amber-600' },
    selesai:     { label: 'Selesai',     cls: 'bg-green-50 text-green-700' },
    void:        { label: 'Void',        cls: 'bg-red-50 text-red-500' },
    pending_qc:  { label: 'Pending QC',  cls: 'bg-orange-50 text-orange-600' },
    pending:     { label: 'Pending',     cls: 'bg-gray-50 text-gray-500' },
    diretur:     { label: 'Diretur',     cls: 'bg-green-50 text-green-700' },
    disimpan:    { label: 'Disimpan',    cls: 'bg-purple-50 text-purple-600' },
    ditukar:     { label: 'Ditukar',     cls: 'bg-teal-50 text-teal-700' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

// ── Monitoring card ───────────────────────────────────────────────────────────
function MonitoringCard({ m }: { m: any }) {
  const [open, setOpen] = useState(false)
  const sisaRatio = m.qty_po > 0 ? ((m.qty_po - m.sisa_belum_datang) / m.qty_po) * 100 : 0
  const accRatio  = m.total_datang > 0 ? (m.total_acc / m.total_datang) * 100 : 0

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
      <button className="w-full flex items-start justify-between px-4 py-3.5 text-left gap-3"
        style={{ background: 'rgba(255,255,255,0.9)' }} onClick={() => setOpen(p => !p)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-bold text-violet-700">{m.nomor_po}</span>
            <StatusBadge status={m.status} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{m.vendor_nama} · {m.produk_nama}</p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, sisaRatio)}%`, background: 'linear-gradient(90deg,#7C3AED,#A78BFA)' }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {fmtNum(m.qty_po - m.sisa_belum_datang)}/{fmtNum(m.qty_po)} pcs datang · {sisaRatio.toFixed(0)}%
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 grid grid-cols-3 sm:grid-cols-6 gap-2"
          style={{ background: 'rgba(248,250,252,0.95)' }}>
          {[
            { label: 'PO', val: fmtNum(m.qty_po), color: '#64748B' },
            { label: 'Datang', val: fmtNum(m.total_datang), color: '#3B82F6' },
            { label: 'ACC', val: fmtNum(m.total_acc), color: '#16A34A' },
            { label: 'Reject', val: fmtNum(m.total_reject), color: '#EF4444' },
            { label: 'Retur', val: fmtNum(m.reject_sudah_retur), color: '#F97316' },
            { label: 'Sisa PO', val: fmtNum(Math.max(0, m.sisa_belum_datang)), color: '#A855F7' },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl px-2.5 py-2 text-center"
              style={{ background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}>
              <p className="text-[13px] font-extrabold" style={{ color }}>{val}</p>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Signature pad ─────────────────────────────────────────────────────────────
function SignaturePad({ onSave, label }: { onSave: (b64: string) => void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src  = 'touches' in e ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }
  const start = (e: any) => { drawing.current = true; draw(e) }
  const end   = () => { drawing.current = false }
  const draw  = (e: any) => {
    if (!drawing.current) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const pos = getPos(e, c)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }
  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
  }
  const save = () => { onSave(canvasRef.current!.toDataURL('image/png')) }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
        <canvas width={260} height={90}
          className="w-full touch-none block cursor-crosshair"
          style={{ display: 'block' }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
          onTouchStart={e => { e.preventDefault(); start(e) }}
          onTouchMove={e => { e.preventDefault(); draw(e) }}
          onTouchEnd={end}
          ref={(c) => {
            (canvasRef as any).current = c
            if (c) { const ctx = c.getContext('2d')!; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round' }
          }}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={clear}
          className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-500">Hapus</button>
        <button type="button" onClick={save}
          className="flex-1 py-1.5 text-[10px] font-bold rounded-lg text-white"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>Simpan TTD</button>
      </div>
    </div>
  )
}

const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

// ── Main Component ─────────────────────────────────────────────────────────────
export default function POVendorClient({
  vendors, produkList, poList, batchList, rejectList, sjList, stokList, monitoring, canManage,
}: Props) {
  const { toast, show: showToast } = useToast()
  const [tab, setTab] = useState<Tab>('monitoring')
  const [search, setSearch] = useState('')

  // ── Modal states ──────────────────────────────────────────────────────────
  const [vendorModal, setVendorModal] = useState<'create' | number | null>(null)
  const [produkModal, setProdukModal] = useState<'create' | number | null>(null)
  const [poModal, setPoModal]         = useState<'create' | number | null>(null)
  const [editPoId, setEditPoId]       = useState<number | null>(null)
  const [duplikatSrc, setDuplikatSrc] = useState<any | null>(null)
  const [batchModal, setBatchModal]   = useState<number | null>(null)  // po_id
  const [qcModal, setQcModal]         = useState<any | null>(null)     // batch object
  const [rejectModal, setRejectModal] = useState<any | null>(null)
  const [sjModal, setSjModal]         = useState<number | null>(null)  // vendor_id
  const [voidPoId, setVoidPoId]       = useState<number | null>(null)
  const [expandedPO, setExpandedPO]   = useState<number | null>(null)

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'monitoring', label: 'Monitoring',  icon: Eye },
    { key: 'po',         label: 'PO',          icon: FileText },
    { key: 'batch',      label: 'Penerimaan',  icon: Truck },
    { key: 'reject',     label: 'Reject',      icon: AlertTriangle },
    { key: 'stok',       label: 'Stok',        icon: Package2 },
    { key: 'master',     label: 'Master Produk', icon: BoxSelect },
    { key: 'vendor',     label: 'Vendor',      icon: Building2 },
  ]

  const pendingReject = rejectList.filter((r: any) => r.status_penanganan === 'pending').length

  return (
    <div className="space-y-4 pb-20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-2xl text-[13px] font-semibold shadow-xl flex items-center gap-2 transition-all ${toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.ok ? <CheckCircle2 size={15}/> : <XCircle size={15}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-black text-slate-800">PO Vendor Packaging</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{poList.length} PO aktif · {pendingReject > 0 ? `${pendingReject} reject pending` : 'semua reject tertangani'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && tab === 'po' && (
            <button onClick={() => setPoModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <Plus size={13}/> Buat PO
            </button>
          )}
          {canManage && tab === 'vendor' && (
            <button onClick={() => setVendorModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <Plus size={13}/> Tambah Vendor
            </button>
          )}
          {canManage && tab === 'master' && (
            <button onClick={() => setProdukModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
              <Plus size={13}/> Tambah Produk
            </button>
          )}
          {canManage && tab === 'reject' && (
            <button onClick={() => setSjModal(-1)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
              <Printer size={13}/> Buat SJ Retur
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all flex-shrink-0 relative ${tab === key ? 'text-violet-700' : 'text-slate-500'}`}
            style={tab === key ? { background: 'rgba(124,58,237,0.1)' } : { background: 'rgba(0,0,0,0.03)' }}>
            <Icon size={12}/>
            {label}
            {key === 'reject' && pendingReject > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-black">
                {pendingReject > 9 ? '9+' : pendingReject}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {['po','batch','reject','monitoring'].includes(tab) && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor PO, vendor, produk..."
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"/>
        </div>
      )}

      {/* ── Tab: MONITORING ─────────────────────────────────────────────────── */}
      {tab === 'monitoring' && (
        <div className="space-y-3">
          {monitoring.length === 0 ? (
            <Empty text="Belum ada PO" />
          ) : (
            monitoring
              .filter((m: any) => !search || m.nomor_po.toLowerCase().includes(search.toLowerCase()) || m.vendor_nama.toLowerCase().includes(search.toLowerCase()))
              .map((m: any) => <MonitoringCard key={m.id} m={m} />)
          )}
        </div>
      )}

      {/* ── Tab: PO ─────────────────────────────────────────────────────────── */}
      {tab === 'po' && (
        <div className="space-y-2">
          {poList.filter((p: any) => !search || p.nomor_po.toLowerCase().includes(search.toLowerCase()) || p.vendor_nama.toLowerCase().includes(search.toLowerCase())).map((po: any) => {
            const mon = monitoring.find((m: any) => m.id === po.id)
            const isOpen = expandedPO === po.id
            const batches = batchList.filter((b: any) => b.po_id === po.id)
            return (
              <div key={po.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: 'rgba(255,255,255,0.9)' }}>
                  <button className="flex-1 text-left" onClick={() => setExpandedPO(isOpen ? null : po.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono font-bold text-violet-700">{po.nomor_po}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {po.vendor_nama} · {po.produk_nama} · {fmtNum(po.qty_po)} pcs · {fmtDate(po.tanggal_po)}
                      {po.tanggal_jatuh_tempo && <span className="text-amber-600 font-medium"> · Jatuh tempo {fmtDate(po.tanggal_jatuh_tempo)}</span>}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {canManage && po.status !== 'void' && (
                      <>
                        <button onClick={() => setBatchModal(po.id)}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="Input Penerimaan">
                          <Truck size={13}/>
                        </button>
                        <button onClick={() => { setDuplikatSrc(po); setPoModal('create') }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Duplikat PO">
                          <Copy size={13}/>
                        </button>
                        <button onClick={() => { setEditPoId(po.id); setPoModal(po.id) }}
                          className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50" title="Edit PO">
                          <Edit2 size={13}/>
                        </button>
                        {batches.length === 0 && (
                          <button onClick={() => setVoidPoId(po.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="Void PO">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1" style={{ background: 'rgba(248,250,252,0.95)' }}>
                    {batches.length === 0 ? (
                      <p className="text-[12px] text-slate-400 py-2">Belum ada batch penerimaan</p>
                    ) : (
                      <div className="space-y-2">
                        {batches.map((b: any) => (
                          <div key={b.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                            style={{ background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div>
                              <p className="text-[12px] font-mono font-bold text-slate-700">{b.nomor_batch}</p>
                              <p className="text-[10px] text-slate-400">
                                {fmtDate(b.tanggal_terima)} · {fmtNum(b.qty_diterima)} pcs
                                {b.status_qc === 'selesai' ? ` · ✅ ACC ${fmtNum(b.qty_acc ?? 0)} / Reject ${fmtNum(b.qty_reject ?? 0)}` : ' · ⏳ Pending QC'}
                              </p>
                            </div>
                            {canManage && b.status_qc === 'pending' && (
                              <button onClick={() => setQcModal(b)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white rounded-lg"
                                style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)' }}>
                                <ClipboardCheck size={10}/> QC
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {poList.length === 0 && <Empty text="Belum ada PO" />}
        </div>
      )}

      {/* ── Tab: BATCH PENERIMAAN ─────────────────────────────────────────── */}
      {tab === 'batch' && (
        <div className="space-y-2">
          {batchList
            .filter((b: any) => !search || b.nomor_batch.toLowerCase().includes(search.toLowerCase()) || b.po_nomor.toLowerCase().includes(search.toLowerCase()))
            .map((b: any) => (
            <div key={b.id} className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono font-bold text-slate-700">{b.nomor_batch}</span>
                    <StatusBadge status={b.status_qc === 'selesai' ? 'selesai' : 'pending_qc'} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    PO: <span className="font-semibold text-violet-700">{b.po_nomor}</span> · {b.vendor_nama}
                  </p>
                  <p className="text-[11px] text-slate-500">{b.produk_nama} · {fmtNum(b.qty_diterima)} pcs · {fmtDate(b.tanggal_terima)}</p>
                  {b.status_qc === 'selesai' && (
                    <div className="flex gap-3 mt-1.5">
                      <span className="text-[10px] font-bold text-green-600">✅ ACC: {fmtNum(b.qty_acc ?? 0)}</span>
                      <span className="text-[10px] font-bold text-red-500">❌ Reject: {fmtNum(b.qty_reject ?? 0)}</span>
                      {(b.qty_lebih ?? 0) > 0 && <span className="text-[10px] font-bold text-orange-500">➕ Lebih: {fmtNum(b.qty_lebih)}</span>}
                    </div>
                  )}
                </div>
                {canManage && b.status_qc === 'pending' && (
                  <button onClick={() => setQcModal(b)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold text-white rounded-xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)' }}>
                    <ClipboardCheck size={11}/> Input QC
                  </button>
                )}
              </div>
            </div>
          ))}
          {batchList.length === 0 && <Empty text="Belum ada penerimaan" />}
        </div>
      )}

      {/* ── Tab: REJECT ────────────────────────────────────────────────────── */}
      {tab === 'reject' && (
        <div className="space-y-2">
          {rejectList
            .filter((r: any) => !search || r.po_nomor.toLowerCase().includes(search.toLowerCase()) || r.vendor_nama.toLowerCase().includes(search.toLowerCase()))
            .map((r: any) => (
            <div key={r.id} className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.9)', border: `1px solid ${r.jenis === 'lebihan' ? 'rgba(249,115,22,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.jenis === 'lebihan' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                      {r.jenis === 'lebihan' ? '➕ Lebihan' : '❌ Reject'}
                    </span>
                    <StatusBadge status={r.status_penanganan} />
                  </div>
                  <p className="text-[13px] font-bold text-slate-800 mt-1">{fmtNum(r.qty)} pcs</p>
                  <p className="text-[11px] text-slate-500">{r.produk_nama} · PO {r.po_nomor} · {r.vendor_nama}</p>
                  <p className="text-[10px] text-slate-400">Batch {r.nomor_batch} · {fmtDate(r.tanggal_terima)}</p>
                  {r.penanganan_keterangan && (
                    <p className="text-[10px] text-slate-400 mt-0.5">Ket: {r.penanganan_keterangan}</p>
                  )}
                </div>
                {canManage && r.status_penanganan === 'pending' && (
                  <button onClick={() => setRejectModal(r)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold text-slate-600 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(0,0,0,0.05)' }}>
                    <ArrowRight size={11}/> Tangani
                  </button>
                )}
              </div>
            </div>
          ))}
          {rejectList.length === 0 && <Empty text="Tidak ada reject" icon="✅" />}
        </div>
      )}

      {/* ── Tab: STOK ──────────────────────────────────────────────────────── */}
      {tab === 'stok' && (
        <div className="space-y-3">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Stok Akrilik per Gramasi</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stokList.map((s: any) => (
              <div key={s.id} className="rounded-2xl px-4 py-3.5 text-center"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <p className="text-[20px] font-black text-slate-800">{fmtNum(s.stok_qty)}</p>
                <p className="text-[12px] font-bold text-slate-500 mt-0.5">pcs</p>
                <div className="w-6 h-0.5 rounded-full mx-auto my-2"
                  style={{ background: s.stok_qty > 0 ? '#7C3AED' : '#e2e8f0' }}/>
                <p className="text-[11px] font-semibold text-slate-600">{s.produk_nama}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mt-4">Riwayat SJ Retur</p>
          {sjList.length === 0 ? (
            <Empty text="Belum ada surat jalan retur" />
          ) : (
            <div className="space-y-2">
              {sjList.map((sj: any) => (
                <div key={sj.id} className="rounded-2xl px-4 py-3 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <div>
                    <p className="text-[12px] font-mono font-bold text-orange-600">{sj.nomor_sj}</p>
                    <p className="text-[11px] text-slate-500">{sj.vendor_nama} · {fmtNum(sj.total_qty)} pcs · {fmtDate(sj.tanggal_retur)}</p>
                  </div>
                  <a href={`/po-vendor-packaging/sj-retur/${sj.id}`} target="_blank"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold text-orange-600 rounded-xl"
                    style={{ background: 'rgba(249,115,22,0.08)' }}>
                    <Printer size={11}/> Cetak
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: MASTER PRODUK ─────────────────────────────────────────────── */}
      {tab === 'master' && (
        <div className="space-y-2">
          <p className="text-[12px] text-slate-400 px-1">Daftar produk packaging yang bisa dipilih saat buat PO</p>
          {produkList.map((p: any) => (
            <div key={p.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-slate-800">{p.nama}</p>
                  <span className="text-[10px] font-mono text-slate-400">{p.kode}</span>
                  <span className="text-[10px] text-slate-400">· {p.satuan ?? 'pcs'}</span>
                  {!p.aktif && <span className="text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                </div>
                {p.keterangan && <p className="text-[11px] text-slate-400 mt-0.5">{p.keterangan}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setProdukModal(p.id)}
                    className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50">
                    <Edit2 size={13}/>
                  </button>
                  <button onClick={async () => {
                    const r = await toggleProdukAktif(p.id, !p.aktif)
                    if (r?.error) showToast(r.error, false)
                    else showToast(p.aktif ? 'Produk dinonaktifkan' : '✅ Produk diaktifkan')
                  }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${p.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {produkList.length === 0 && <Empty text="Belum ada produk — klik Tambah Produk" />}
        </div>
      )}

      {/* ── Tab: VENDOR ────────────────────────────────────────────────────── */}
      {tab === 'vendor' && (
        <div className="space-y-2">
          {vendors.map((v: any) => (
            <div key={v.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-slate-800">{v.nama}</p>
                  <span className="text-[10px] font-mono text-slate-400">{v.kode}</span>
                  {!v.aktif && <span className="text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                </div>
                {v.pic && <p className="text-[11px] text-slate-400">PIC: {v.pic}</p>}
                {v.telepon && <p className="text-[11px] text-slate-400">{v.telepon}</p>}
              </div>
              {canManage && (
                <button onClick={() => setVendorModal(v.id)}
                  className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50">
                  <Edit2 size={13}/>
                </button>
              )}
            </div>
          ))}
          {vendors.length === 0 && <Empty text="Belum ada vendor" />}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── Produk Modal ─────────────────────────────────────────────────── */}
      {produkModal !== null && (
        <ProdukModal
          mode={produkModal === 'create' ? 'create' : 'edit'}
          produk={produkModal !== 'create' ? produkList.find((p: any) => p.id === produkModal) : undefined}
          onClose={() => setProdukModal(null)}
          onSave={async (fd) => {
            const r = produkModal === 'create'
              ? await createProdukPackaging(fd)
              : await updateProdukPackaging(produkModal as number, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(produkModal === 'create' ? '✅ Produk ditambahkan' : '✅ Produk diperbarui')
            setProdukModal(null)
          }}
        />
      )}

      {/* ── Vendor Modal ─────────────────────────────────────────────────── */}
      {vendorModal !== null && (
        <VendorModal
          mode={vendorModal === 'create' ? 'create' : 'edit'}
          vendor={vendorModal !== 'create' ? vendors.find(v => v.id === vendorModal) : undefined}
          onClose={() => setVendorModal(null)}
          onSave={async (fd) => {
            const r = vendorModal === 'create'
              ? await createVendor(fd)
              : await updateVendor(vendorModal as number, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(vendorModal === 'create' ? '✅ Vendor ditambahkan' : '✅ Vendor diperbarui')
            setVendorModal(null)
          }}
        />
      )}

      {/* ── PO Modal ─────────────────────────────────────────────────────── */}
      {poModal !== null && (
        <POModal
          mode={poModal === 'create' ? 'create' : 'edit'}
          po={poModal !== 'create' ? poList.find(p => p.id === editPoId) : undefined}
          duplikat={poModal === 'create' ? duplikatSrc : undefined}
          vendors={vendors}
          produkList={produkList}
          onClose={() => { setPoModal(null); setEditPoId(null); setDuplikatSrc(null) }}
          onSave={async (fd) => {
            const r = poModal === 'create'
              ? await createPO(fd)
              : await updatePO(editPoId!, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(poModal === 'create' ? `✅ PO dibuat: ${(r as any).nomorPO}` : '✅ PO diperbarui')
            setPoModal(null); setEditPoId(null); setDuplikatSrc(null)
          }}
        />
      )}

      {/* ── Batch Penerimaan Modal ───────────────────────────────────────── */}
      {batchModal !== null && (
        <BatchModal
          po={poList.find(p => p.id === batchModal)!}
          monitoring={monitoring.find(m => m.id === batchModal)}
          onClose={() => setBatchModal(null)}
          onSave={async (fd) => {
            const r = await createBatchPenerimaan(fd)
            if (r?.error) { showToast(r.error, false); return }
            const msg = `✅ Batch ${(r as any).nomor} dibuat` + ((r as any).qtyLebih > 0 ? ` · Lebihan: ${(r as any).qtyLebih} pcs` : '')
            showToast(msg)
            setBatchModal(null)
          }}
        />
      )}

      {/* ── QC Modal ─────────────────────────────────────────────────────── */}
      {qcModal !== null && (
        <QCModal
          batch={qcModal}
          onClose={() => setQcModal(null)}
          onSave={async (fd) => {
            const r = await submitQC(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('✅ QC selesai — stok diperbarui')
            setQcModal(null)
          }}
        />
      )}

      {/* ── Reject Penanganan Modal ──────────────────────────────────────── */}
      {rejectModal !== null && (
        <RejectModal
          item={rejectModal}
          onClose={() => setRejectModal(null)}
          onSave={async (status, ket) => {
            const r = await updatePenangananReject(rejectModal.id, status, ket)
            if (r?.error) { showToast(r.error, false); return }
            showToast('✅ Status reject diperbarui')
            setRejectModal(null)
          }}
        />
      )}

      {/* ── SJ Retur Modal ──────────────────────────────────────────────── */}
      {sjModal !== null && (
        <SJReturModal
          vendors={vendors}
          rejectList={rejectList.filter((r: any) => r.status_penanganan === 'pending' && r.jenis === 'reject')}
          onClose={() => setSjModal(null)}
          onSave={async (fd) => {
            const r = await createSJRetur(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(`✅ SJ Retur ${(r as any).nomor} dibuat`)
            setSjModal(null)
          }}
        />
      )}

      {/* ── Void PO Confirm ─────────────────────────────────────────────── */}
      {voidPoId !== null && (
        <VoidModal
          title={`Void PO ${poList.find(p => p.id === voidPoId)?.nomor_po ?? ''}`}
          onClose={() => setVoidPoId(null)}
          onConfirm={async (reason) => {
            const r = await voidPO(voidPoId, reason)
            if (r?.error) { showToast(r.error, false); return }
            showToast('✅ PO divoid')
            setVoidPoId(null)
          }}
        />
      )}
    </div>
  )
}

// ── Sub-modals ─────────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function ProdukModal({ mode, produk, onClose, onSave }: { mode: string; produk?: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title={mode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(new FormData(e.currentTarget)); setLoading(false) }}
        className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Produk *</label>
          <input name="nama" defaultValue={produk?.nama} required placeholder="mis. Akrilik 2x3cm" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Satuan</label>
          <select name="satuan" defaultValue={produk?.satuan ?? 'pcs'} className={inp}>
            <option value="pcs">pcs</option>
            <option value="set">set</option>
            <option value="lusin">lusin</option>
            <option value="box">box</option>
            <option value="meter">meter</option>
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan</label>
          <textarea name="keterangan" defaultValue={produk?.keterangan} rows={2} placeholder="Deskripsi singkat produk..." className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Tambah Produk' : 'Simpan Perubahan'}
        </button>
      </form>
    </ModalShell>
  )
}

function VendorModal({ mode, vendor, onClose, onSave }: { mode: string; vendor?: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title={mode === 'create' ? 'Tambah Vendor' : 'Edit Vendor'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(new FormData(e.currentTarget)); setLoading(false) }}
        className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Vendor *</label>
          <input name="nama" defaultValue={vendor?.nama} required className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">PIC</label>
          <input name="pic" defaultValue={vendor?.pic} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Telepon</label>
          <input name="telepon" defaultValue={vendor?.telepon} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
          <input name="email" type="email" defaultValue={vendor?.email} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alamat</label>
          <textarea name="alamat" defaultValue={vendor?.alamat} rows={2} className={inp}/></div>
        {mode === 'edit' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" name="aktif" id="aktif" defaultChecked={vendor?.aktif !== false} value="true"/>
            <label htmlFor="aktif" className="text-[13px] text-slate-600">Aktif</label>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </ModalShell>
  )
}

function POModal({ mode, po, duplikat, vendors, produkList, onClose, onSave }: { mode: string; po?: any; duplikat?: any; vendors: any[]; produkList: any[]; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const src = duplikat ?? po  // duplikat pre-fills create form; po pre-fills edit form
  const isDuplikat = mode === 'create' && !!duplikat
  return (
    <ModalShell title={mode === 'create' ? (isDuplikat ? `Duplikat PO — ${duplikat.produk_nama}` : 'Buat PO Baru') : 'Edit PO'} onClose={onClose}>
      {isDuplikat && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-[12px] text-amber-700">
          Menyalin dari <span className="font-bold">{duplikat.nomor_po}</span> · Isi tanggal &amp; qty baru, nomor PO akan digenerate otomatis.
        </div>
      )}
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(new FormData(e.currentTarget)); setLoading(false) }}
        className="space-y-3">
        {!isDuplikat && (
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nomor PO (kosongkan untuk auto)</label>
            <input name="nomor_po" defaultValue={po?.nomor_po} placeholder="PO/2406/0001" className={inp}/></div>
        )}
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor *</label>
          <select name="vendor_id" defaultValue={src?.vendor_id} required className={inp} disabled={mode === 'edit'}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
          {mode === 'edit' && <input type="hidden" name="vendor_id" value={po?.vendor_id}/>}
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Produk *</label>
          <select name="produk_id" defaultValue={src?.produk_id} required className={inp} disabled={mode === 'edit'}>
            <option value="">— Pilih Produk —</option>
            {produkList.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          {mode === 'edit' && <input type="hidden" name="produk_id" value={po?.produk_id}/>}
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty PO (pcs) *</label>
          <input name="qty_po" type="number" min="1" defaultValue={isDuplikat ? undefined : src?.qty_po} required className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal PO *</label>
          <input name="tanggal_po" type="date" defaultValue={src?.tanggal_po} required className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Jatuh Tempo</label>
          <input name="tanggal_jatuh_tempo" type="date" defaultValue={src?.tanggal_jatuh_tempo} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Harga Satuan (Rp)</label>
          <input name="harga_satuan" type="number" min="0" defaultValue={src?.harga_satuan} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
          <textarea name="catatan" defaultValue={src?.catatan} rows={2} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Buat PO' : 'Simpan Perubahan'}
        </button>
      </form>
    </ModalShell>
  )
}

function BatchModal({ po, monitoring, onClose, onSave }: { po: any; monitoring?: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const sisaPO = monitoring ? Math.max(0, monitoring.sisa_belum_datang) : po.qty_po
  return (
    <ModalShell title="Input Penerimaan Barang" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-bold">{po.nomor_po}</p>
        <p className="text-violet-600 mt-0.5">{po.vendor_nama} · {po.produk_nama}</p>
        <p className="text-violet-600 mt-0.5">
          PO: <b>{po.qty_po?.toLocaleString('id-ID')} pcs</b> · Sisa belum datang: <b>{sisaPO?.toLocaleString('id-ID')} pcs</b>
        </p>
        {sisaPO === 0 && <p className="font-bold text-green-600 mt-1">✅ PO sudah terpenuhi — input ini akan dianggap sebagai kelebihan</p>}
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('po_id', String(po.id))
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Terima *</label>
          <input name="tanggal_terima" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty Diterima (pcs) *</label>
          <input name="qty_diterima" type="number" min="1" required className={inp}
            placeholder={`max sisa PO: ${sisaPO} pcs (lebih = kelebihan)`}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
          <textarea name="catatan" rows={2} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Penerimaan'}
        </button>
      </form>
    </ModalShell>
  )
}

function QCModal({ batch, onClose, onSave }: { batch: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const [qtyAcc, setQtyAcc]     = useState(0)
  const [qtyReject, setQtyReject] = useState(0)
  const [ttdOp, setTtdOp]     = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)
  const [showTtd, setShowTtd]   = useState(false)

  const maxCheck = batch.qty_diterima - (batch.qty_lebih ?? 0)
  const total    = qtyAcc + qtyReject
  const ok       = total === maxCheck

  return (
    <ModalShell title="Input Hasil QC" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-bold">{batch.nomor_batch}</p>
        <p className="text-violet-600 mt-0.5">{batch.produk_nama} · {batch.vendor_nama}</p>
        <p className="text-violet-600 mt-0.5">
          Diterima: <b>{batch.qty_diterima} pcs</b>
          {(batch.qty_lebih ?? 0) > 0 && <> · Lebihan: <b className="text-amber-600">{batch.qty_lebih} pcs</b></>}
          {' '}· Perlu QC: <b>{maxCheck} pcs</b>
        </p>
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('batch_id', String(batch.id))
        fd.set('qty_acc', String(qtyAcc))
        fd.set('qty_reject', String(qtyReject))
        if (ttdOp)    fd.set('ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('ttd_admin', ttdAdmin)
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal QC *</label>
          <input name="qc_tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty ACC (Lolos QC) *</label>
          <input type="number" min="0" max={maxCheck} value={qtyAcc} onChange={e => setQtyAcc(parseInt(e.target.value) || 0)} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty Reject *</label>
          <input type="number" min="0" max={maxCheck} value={qtyReject} onChange={e => setQtyReject(parseInt(e.target.value) || 0)} className={inp}/></div>
        {/* Validation indicator */}
        <div className={`rounded-xl px-3 py-2 text-[12px] font-semibold flex items-center gap-2 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {ok ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
          {ok ? `✅ Total sesuai (${maxCheck} pcs)` : `Total ACC+Reject = ${total} ≠ ${maxCheck}`}
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Operator QC</label>
          <input name="operator_nama" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Admin/Manager</label>
          <input name="admin_nama" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan QC</label>
          <textarea name="catatan_qc" rows={2} className={inp}/></div>
        {/* Optional TTD */}
        <button type="button" onClick={() => setShowTtd(p => !p)}
          className="w-full py-2 text-[12px] font-semibold text-violet-600 rounded-xl border border-violet-200">
          {showTtd ? '▲ Sembunyikan TTD' : '✍️ Tambah TTD (Opsional)'}
        </button>
        {showTtd && (
          <div className="space-y-3 rounded-2xl p-3 bg-violet-50">
            <SignaturePad label="TTD Operator" onSave={v => setTtdOp(v)}/>
            <SignaturePad label="TTD Admin/Manager" onSave={v => setTtdAdmin(v)}/>
          </div>
        )}
        <button type="submit" disabled={loading || !ok}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Hasil QC'}
        </button>
      </form>
    </ModalShell>
  )
}

function RejectModal({ item, onClose, onSave }: { item: any; onClose: () => void; onSave: (status: string, ket: string) => Promise<void> }) {
  const [status, setStatus] = useState('disimpan')
  const [ket, setKet] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title="Tangani Reject/Lebihan" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 mb-4">
        <p className="font-bold">{item.qty} pcs — {item.produk_nama}</p>
        <p className="mt-0.5">PO {item.po_nomor} · Batch {item.nomor_batch}</p>
        <p>{item.vendor_nama} · {fmtDate(item.tanggal_terima)}</p>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-[12px] font-semibold text-slate-500 mb-1.5">Status Penanganan</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 'disimpan', label: '📦 Disimpan' },
              { val: 'ditukar',  label: '🔄 Ditukar' },
              ...(item.jenis === 'reject' ? [{ val: 'diretur', label: '↩️ Retur via SJ' }] : []),
            ].map(({ val, label }) => (
              <button key={val} type="button" onClick={() => setStatus(val)}
                className={`py-2 text-[12px] font-bold rounded-xl border transition-all ${status === val ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {status === 'diretur' && <p className="text-[10px] text-orange-500 mt-1">Untuk retur massal, gunakan fitur Buat SJ Retur</p>}
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan</label>
          <textarea value={ket} onChange={e => setKet(e.target.value)} rows={2} className={inp}
            placeholder="Misal: ditukar dengan Akrilik 2gr, atau disimpan sebagai cadangan"/></div>
        <button onClick={async () => { setLoading(true); await onSave(status, ket); setLoading(false) }}
          disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </ModalShell>
  )
}

function SJReturModal({ vendors, rejectList, onClose, onSave }: { vendors: any[]; rejectList: any[]; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [vendorId, setVendorId]     = useState<number | null>(null)
  const [selected, setSelected]     = useState<number[]>([])
  const [tanggal, setTanggal]       = useState(new Date().toISOString().split('T')[0])
  const [catatan, setCatatan]       = useState('')
  const [loading, setLoading]       = useState(false)

  const vendorRejects = vendorId ? rejectList.filter((r: any) => r.vendor_id === vendorId) : []
  const totalSelected = rejectList.filter((r: any) => selected.includes(r.id)).reduce((s: number, r: any) => s + r.qty, 0)

  const toggle = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const selectAll = () => setSelected(vendorRejects.map((r: any) => r.id))

  return (
    <ModalShell title="Buat Surat Jalan Retur" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor *</label>
          <select value={vendorId ?? ''} onChange={e => { setVendorId(parseInt(e.target.value) || null); setSelected([]) }}
            className={inp}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Retur *</label>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp}/></div>

        {vendorId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-semibold text-slate-500">Pilih Item Reject ({selected.length} dipilih · {totalSelected} pcs)</p>
              {vendorRejects.length > 0 && (
                <button type="button" onClick={selectAll}
                  className="text-[10px] font-bold text-violet-600">Pilih Semua</button>
              )}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {vendorRejects.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2 text-center">Tidak ada reject pending dari vendor ini</p>
              ) : vendorRejects.map((r: any) => (
                <button key={r.id} type="button" onClick={() => toggle(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${selected.includes(r.id) ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected.includes(r.id) ? 'bg-violet-600' : 'border border-gray-300'}`}>
                    {selected.includes(r.id) && <Check size={10} className="text-white"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700">{r.produk_nama} · {r.qty} pcs</p>
                    <p className="text-[10px] text-slate-400">Batch {r.nomor_batch} · {fmtDate(r.tanggal_terima)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan SJ</label>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} className={inp}/></div>

        <button onClick={async () => {
          if (!vendorId || !selected.length) return
          setLoading(true)
          const fd = new FormData()
          fd.set('vendor_id', String(vendorId))
          fd.set('tanggal_retur', tanggal)
          fd.set('reject_ids', JSON.stringify(selected))
          fd.set('catatan', catatan)
          await onSave(fd)
          setLoading(false)
        }} disabled={loading || !vendorId || !selected.length}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Membuat SJ...' : `Buat SJ Retur (${totalSelected} pcs)`}
        </button>
      </div>
    </ModalShell>
  )
}

function VoidModal({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">
          <p className="font-semibold">⚠️ PO akan divoid dan tidak bisa diaktifkan kembali</p>
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alasan Void *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required className={inp}
            placeholder="Alasan mengapa PO ini divoid..."/></div>
        <button onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false) }}
          disabled={loading || !reason.trim()}
          className="w-full h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
          {loading ? 'Memproses...' : 'Void PO'}
        </button>
      </div>
    </ModalShell>
  )
}

function Empty({ text, icon = '📦' }: { text: string; icon?: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 opacity-40">
      <span className="text-[24px]">{icon}</span>
      <p className="text-[13px] text-slate-400">{text}</p>
    </div>
  )
}
