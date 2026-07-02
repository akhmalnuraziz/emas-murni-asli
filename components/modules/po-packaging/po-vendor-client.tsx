'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeRefresh } from '@/lib/supabase/use-realtime-refresh'
import { toast as sonnerToast } from 'sonner'
import {
  Plus, X, Check, Edit2, Trash2, ChevronDown, ChevronUp,
  Package2, Truck, ClipboardCheck, AlertTriangle, RotateCcw,
  FileText, Printer, Building2, Search, Eye,
  ArrowRight, CheckCircle2, XCircle, Clock, BoxSelect,
  Package, Tag, BarChart2, ClipboardList, DollarSign, LucideIcon,
} from 'lucide-react'
import {
  createVendor, updateVendor,
  createProdukPackaging, updateProdukPackaging, toggleProdukAktif,
  createKategoriReject, updateKategoriReject, toggleKategoriRejectAktif, deleteKategoriReject,
  createPO, updatePO, voidPO, deletePO,
  createBatchPenerimaan, createBatchPengganti, submitQC, deleteBatch, editQCResult, editBatchPenerimaan,
  deleteRejectItem, resetRejectStatus, createSJRetur, updateSJRetur, deleteSJRetur,
} from '@/app/(dashboard)/po-vendor-packaging/actions'

const fmtRp = (n: number | null | undefined) => {
  if (!n) return '—'
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

import PaginationBar from '@/components/ui/pagination-bar'
const fmtNum = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Tab = 'monitoring' | 'po' | 'batch' | 'reject' | 'dashboard' | 'sj_retur' | 'stok' | 'vendor' | 'master'

interface ConfirmState {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

interface Props {
  vendors: any[]
  produkList: any[]
  kategoriRejectList: any[]
  poList: any[]
  poItems: any[]
  batchList: any[]
  batchItemsList: any[]
  rejectList: any[]
  sjList: any[]
  stokList: any[]
  monitoring: any[]
  timAnggotaList: any[]
  adminInputList: any[]
  userRole: string
  userName: string
  canManage: boolean
  poPage?: number
  poTotal?: number
  poPageSize?: number
  batchPage?: number
  batchTotal?: number
  batchPageSize?: number
}

function showToast(msg: string, ok = true) {
  if (ok) sonnerToast.success(msg); else sonnerToast.error(msg)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:             { label: 'Open',             cls: 'bg-blue-50 text-blue-600' },
    menunggu:         { label: 'Menunggu',         cls: 'bg-blue-50 text-blue-600' },
    partial:          { label: 'Partial',          cls: 'bg-amber-50 text-amber-600' },
    selesai:          { label: 'Selesai',          cls: 'bg-green-50 text-green-700' },
    void:             { label: 'Void',             cls: 'bg-red-50 text-red-500' },
    pending_qc:       { label: 'Pending QC',       cls: 'bg-orange-50 text-orange-600' },
    pending:          { label: 'Pending',          cls: 'bg-slate-50 text-slate-500' },
    diretur:          { label: 'Diretur',          cls: 'bg-orange-50 text-orange-600' },
    menunggu_ganti:   { label: 'Menunggu Ganti',   cls: 'bg-amber-50 text-amber-700' },
    sebagian_diganti: { label: 'Sebagian Diganti', cls: 'bg-blue-50 text-blue-600' },
    selesai_diganti:  { label: 'Selesai Diganti',  cls: 'bg-green-50 text-green-700' },
    overdue:          { label: 'Lewat Tempo',      cls: 'bg-red-50 text-red-600' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-50 text-slate-500' }
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

// Group per-item monitoring rows into per-PO groups
function groupMonitoring(monitoring: any[]) {
  const map = new Map<number, any>()
  for (const row of monitoring) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id, nomor_po: row.nomor_po, vendor_nama: row.vendor_nama,
        status: row.status, tanggal_po: row.tanggal_po, tanggal_jatuh_tempo: row.tanggal_jatuh_tempo,
        items: [],
      })
    }
    map.get(row.id)!.items.push(row)
  }
  return Array.from(map.values())
}

function MonitoringCard({ po }: { po: any }) {
  const [open, setOpen] = useState(false)
  const totalPO     = po.items.reduce((s: number, i: any) => s + i.qty_po, 0)
  const totalDatang = po.items.reduce((s: number, i: any) => s + i.total_datang, 0)
  const totalAcc    = po.items.reduce((s: number, i: any) => s + i.total_acc, 0)
  const totalReject = po.items.reduce((s: number, i: any) => s + i.total_reject, 0)
  const totalSisa   = po.items.reduce((s: number, i: any) => s + Math.max(0, i.sisa_belum_datang), 0)
  const sisaRatio   = totalPO > 0 ? ((totalPO - totalSisa) / totalPO) * 100 : 0

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <button className="w-full flex items-start justify-between px-4 py-3.5 text-left gap-3 bg-white"
        onClick={() => setOpen(p => !p)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-semibold text-violet-700">{po.nomor_po}</span>
            <StatusBadge status={po.status} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{po.vendor_nama} · {po.items.length} produk</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${Math.min(100, sisaRatio)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {fmtNum(totalDatang)}/{fmtNum(totalPO)} pcs datang · {sisaRatio.toFixed(0)}%
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-slate-50 space-y-3">
          {/* Per-item rows */}
          {po.items.map((it: any) => {
            const itemRatio = it.qty_po > 0 ? ((it.qty_po - Math.max(0, it.sisa_belum_datang)) / it.qty_po) * 100 : 0
            return (
              <div key={it.item_id} className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                <p className="text-[12px] font-semibold text-slate-700">{it.produk_nama}</p>
                <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400"
                    style={{ width: `${Math.min(100, itemRatio)}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {[
                    { label: 'PO', val: fmtNum(it.qty_po), color: '#64748B' },
                    { label: 'Datang', val: fmtNum(it.total_datang), color: '#3B82F6' },
                    { label: 'ACC', val: fmtNum(it.total_acc), color: '#16A34A' },
                    { label: 'Reject', val: fmtNum(it.total_reject), color: '#EF4444' },
                    { label: 'Sisa', val: fmtNum(Math.max(0, it.sisa_belum_datang)), color: '#A855F7' },
                  ].map(({ label, val, color }) => (
                    <span key={label} className="text-[10px]" style={{ color }}>
                      <span className="font-semibold">{val}</span> <span className="text-slate-400">{label}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SignaturePad({ onSave, label, initial }: { onSave: (b64: string) => void; label: string; initial?: string | null }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const drawing       = useRef(false)
  const [saved, setSaved] = useState<string | null>(initial ?? null)
  const [empty, setEmpty] = useState(true)

  // Setup high-DPI canvas + initial color
  const initCanvas = (c: HTMLCanvasElement | null) => {
    (canvasRef as any).current = c
    if (!c) return
    const rect = c.getBoundingClientRect()
    const dpr  = window.devicePixelRatio || 1
    // Set internal pixel size = CSS size × DPR (untuk crisp + akurat coord)
    if (c.width !== Math.floor(rect.width * dpr) || c.height !== Math.floor(rect.height * dpr)) {
      c.width  = Math.floor(rect.width * dpr)
      c.height = Math.floor(rect.height * dpr)
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth   = 2
    ctx.lineJoin    = 'round'
    ctx.lineCap     = 'round'
  }

  // Hitung posisi mouse/touch dalam koordinat CSS (sebelum dpr-scale)
  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches?.[0] ?? e.changedTouches?.[0] ?? e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const start = (e: any) => {
    const c = canvasRef.current
    if (!c) return
    drawing.current = true
    setEmpty(false)
    const ctx = c.getContext('2d')!
    const pos = getPos(e, c)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }
  const move = (e: any) => {
    if (!drawing.current) return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const pos = getPos(e, c)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }
  const end = () => { drawing.current = false }

  const clear = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    initCanvas(c)
    setEmpty(true)
    setSaved(null)
  }

  const save = () => {
    const c = canvasRef.current
    if (!c) return
    const url = c.toDataURL('image/png')
    setSaved(url)
    onSave(url)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-white p-2 space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saved} alt={label} className="w-full h-24 object-contain bg-slate-50 rounded-lg"/>
          <button type="button" onClick={() => { setSaved(null); setEmpty(true); setTimeout(() => initCanvas(canvasRef.current), 0) }}
            className="w-full py-1.5 text-[10px] font-semibold rounded-lg border border-violet-200 text-violet-600">
            ✏️ Ulangi
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
            <canvas
              ref={initCanvas}
              className="w-full h-24 touch-none block cursor-crosshair"
              style={{ touchAction: 'none' }}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={e => { e.preventDefault(); start(e) }}
              onTouchMove={e => { e.preventDefault(); move(e) }}
              onTouchEnd={e => { e.preventDefault(); end() }}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={clear}
              className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg border border-slate-200 text-slate-500">Hapus</button>
            <button type="button" onClick={save} disabled={empty}
              className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-violet-600 text-white disabled:opacity-50">Simpan TTD</button>
          </div>
        </>
      )}
    </div>
  )
}

const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

export default function POVendorClient({
  vendors, produkList, kategoriRejectList, poList, poItems, batchList, batchItemsList, rejectList, sjList, stokList, monitoring,
  timAnggotaList, adminInputList, canManage,
  poPage = 1, poTotal = 0, poPageSize = 20,
  batchPage = 1, batchTotal = 0, batchPageSize = 20,
}: Props) {
  useRealtimeRefresh(['po_packaging','po_batch_penerimaan'])
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('monitoring')
  const [search, setSearch] = useState('')

  const [vendorModal, setVendorModal] = useState<'create' | number | null>(null)
  const [produkModal, setProdukModal] = useState<'create' | number | null>(null)
  const [poModal, setPoModal]         = useState<'create' | number | null>(null)
  const [editPoId, setEditPoId]       = useState<number | null>(null)
  const [batchModal, setBatchModal]   = useState<number | null>(null)  // po_id
  const [qcModal, setQcModal]         = useState<any | null>(null)
  const [editQcModal, setEditQcModal] = useState<any | null>(null)
  const [editBatchModal, setEditBatchModal] = useState<any | null>(null)  // penerimaan pending
  const [sjModal, setSjModal]         = useState<number | null>(null)
  const [voidPoId, setVoidPoId]       = useState<number | null>(null)
  const [expandedPO, setExpandedPO]   = useState<number | null>(null)
  const [masterSubtab, setMasterSubtab] = useState<'produk' | 'kategori_reject'>('produk')
  const [kategoriRejectModal, setKategoriRejectModal] = useState<'create' | number | null>(null)
  const [penggantiModal, setPenggantiModal] = useState<any | null>(null)
  const [editSJModal, setEditSJModal] = useState<any | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const askConfirm = (opts: ConfirmState) => setConfirmState(opts)

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'monitoring', label: 'Monitoring',       icon: Eye },
    { key: 'po',         label: 'PO',               icon: FileText },
    { key: 'batch',      label: 'Penerimaan',       icon: Truck },
    { key: 'reject',     label: 'Reject',           icon: AlertTriangle },
    { key: 'sj_retur',   label: 'SJ Retur',         icon: Printer },
    { key: 'stok',       label: 'Stok',             icon: Package2 },
    { key: 'dashboard',  label: 'Dashboard',         icon: BoxSelect },
    { key: 'master',     label: 'Master Data',      icon: BoxSelect },
    { key: 'vendor',     label: 'Vendor',           icon: Building2 },
  ]

  const pendingReject = rejectList.filter((r: any) => r.status_penanganan === 'pending').length
  const monGrouped    = groupMonitoring(monitoring)

  return (
    <div className="space-y-4 pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-800">PO Vendor Packaging</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{poList.length} PO aktif · {pendingReject > 0 ? `${pendingReject} reject pending` : 'semua reject tertangani'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && tab === 'po' && (
            <button onClick={() => setPoModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl bg-violet-600 hover:bg-violet-700">
              <Plus size={13}/> Buat PO
            </button>
          )}
          {canManage && tab === 'vendor' && (
            <button onClick={() => setVendorModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl bg-violet-600 hover:bg-violet-700">
              <Plus size={13}/> Tambah Vendor
            </button>
          )}
          {canManage && tab === 'master' && masterSubtab === 'produk' && (
            <button onClick={() => setProdukModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Plus size={13}/> Tambah Produk
            </button>
          )}
          {canManage && tab === 'master' && masterSubtab === 'kategori_reject' && (
            <button onClick={() => setKategoriRejectModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Plus size={13}/> Tambah Kategori
            </button>
          )}
          {canManage && tab === 'reject' && (
            <button onClick={() => setSjModal(-1)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl bg-orange-500 hover:bg-orange-600">
              <Printer size={13}/> Buat SJ Retur
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${tab === key ? 'text-violet-700 bg-violet-50' : 'text-slate-500 bg-black/[0.03]'}`}>
            <Icon size={12}/>
            {label}
            {key === 'reject' && pendingReject > 0 && (
              <span className="min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-semibold">
                {pendingReject > 9 ? '9+' : pendingReject}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {['po','batch','reject','monitoring','sj_retur'].includes(tab) && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor PO, vendor, produk..."
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"/>
        </div>
      )}

      {/* ── Tab: MONITORING ───────────────────────────────────────────────── */}
      {tab === 'monitoring' && (
        <div className="space-y-3">
          {monGrouped.length === 0 ? (
            <Empty text="Belum ada PO" />
          ) : (
            monGrouped
              .filter(po => !search || po.nomor_po.toLowerCase().includes(search.toLowerCase()) || po.vendor_nama.toLowerCase().includes(search.toLowerCase()))
              .map(po => <MonitoringCard key={po.id} po={po} />)
          )}
        </div>
      )}

      {/* ── Tab: PO ───────────────────────────────────────────────────────── */}
      {tab === 'po' && (
        <div className="space-y-2">
          {poList
            .filter((p: any) => !search || p.nomor_po.toLowerCase().includes(search.toLowerCase()) || p.vendor_nama.toLowerCase().includes(search.toLowerCase()))
            .map((po: any) => {
              const items   = poItems.filter((i: any) => i.po_id === po.id)
              const batches = batchList.filter((b: any) => b.po_id === po.id)
              const isOpen  = expandedPO === po.id
              const totalNilai = items.reduce((s: number, it: any) => s + (it.qty_po * (it.harga_satuan || 0)), 0)
              const hasHarga = items.some((it: any) => it.harga_satuan)
              return (
                <div key={po.id} className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
                    <button className="flex-1 text-left" onClick={() => setExpandedPO(isOpen ? null : po.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-mono font-semibold text-violet-700">{po.nomor_po}</span>
                        <StatusBadge status={po.status} />
                        {hasHarga && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            {fmtRp(totalNilai)}
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {po.vendor_nama} · {items.length} produk · {fmtDate(po.tanggal_po)}
                        {po.tanggal_jatuh_tempo && <span className="text-amber-600 font-medium"> · Jatuh tempo {fmtDate(po.tanggal_jatuh_tempo)}</span>}
                      </p>
                      {/* Items summary inline */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {items.map((it: any) => (
                          <span key={it.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                            {it.produk_nama} · {fmtNum(it.qty_po)} pcs
                            {it.harga_satuan ? <span className="ml-1 text-emerald-600">@ {fmtRp(it.harga_satuan)}</span> : null}
                          </span>
                        ))}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canManage && po.status !== 'void' && (
                        <>
                          <button onClick={() => setBatchModal(po.id)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100">
                            <Truck size={11}/> Terima
                          </button>
                          <button onClick={() => { setEditPoId(po.id); setPoModal(po.id) }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100">
                            <Edit2 size={11}/> Edit
                          </button>
                          <button onClick={() => askConfirm({
                            title: `Hapus PO ${po.nomor_po}?`,
                            message: batches.length > 0
                              ? `PO ini sudah ada ${batches.length} batch penerimaan. Semua data batch, reject, dan SJ Retur terkait akan IKUT TERHAPUS. Stok dari batch yang sudah QC akan di-reverse otomatis. Aksi ini tidak bisa dibatalkan.`
                              : 'Aksi ini tidak bisa dibatalkan.',
                            danger: true,
                            confirmLabel: 'Ya, Hapus PO',
                            onConfirm: async () => {
                              const r = await deletePO(po.id)
                              if (r?.error) showToast(r.error, false)
                              else { showToast('PO dihapus'); router.refresh() }
                            },
                          })} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 bg-red-50 hover:bg-red-100">
                            <Trash2 size={11}/> Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50">
                      {hasHarga && (
                        <div className="rounded-xl bg-white border border-emerald-100 p-2.5 mb-2">
                          <p className="text-[10px] font-medium text-slate-400 mb-1.5">Rincian Harga</p>
                          {items.map((it: any) => (
                            <div key={it.id} className="flex justify-between gap-2 text-[11px] py-0.5">
                              <span className="text-slate-600">{it.produk_nama}</span>
                              <span className="text-slate-700 font-mono">
                                {fmtNum(it.qty_po)} × {fmtRp(it.harga_satuan)} = <b className="text-emerald-700">{fmtRp((it.qty_po || 0) * (it.harga_satuan || 0))}</b>
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between gap-2 mt-1.5 pt-1.5 border-t border-emerald-100 text-[12px]">
                            <span className="font-semibold text-slate-700">Total Nilai PO</span>
                            <span className="font-semibold text-emerald-700">{fmtRp(totalNilai)}</span>
                          </div>
                        </div>
                      )}
                      {batches.length === 0 ? (
                        <p className="text-[12px] text-slate-400 py-2">Belum ada batch penerimaan</p>
                      ) : (
                        <div className="space-y-2">
                          {batches.map((b: any) => {
                            const bChild = batchItemsList.filter((bi: any) => bi.batch_id === b.id)
                            const desc = bChild.length === 0
                              ? `${b.produk_nama ?? '—'} · ${fmtNum(b.qty_diterima)} pcs`
                              : bChild.length === 1
                                ? `${bChild[0].produk_nama} · ${fmtNum(bChild[0].qty_diterima)} pcs`
                                : `${bChild.length} produk · total ${fmtNum(b.qty_diterima)} pcs`
                            return (
                              <div key={b.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 bg-white border border-slate-200">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-mono font-semibold text-slate-700">{b.nomor_batch}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {desc} · {fmtDate(b.tanggal_terima)}
                                    {b.status_qc === 'selesai' ? ` · ACC ${fmtNum(b.qty_acc ?? 0)} / Reject ${fmtNum(b.qty_reject ?? 0)}` : ' · Pending QC'}
                                  </p>
                                </div>
                                {canManage && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {b.status_qc === 'pending' && (
                                      <button onClick={() => setQcModal(b)}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white rounded-lg bg-green-500 hover:bg-green-600">
                                        <ClipboardCheck size={10}/> QC
                                      </button>
                                    )}
                                    {b.status_qc === 'selesai' && (
                                      <button onClick={() => setEditQcModal(b)}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-violet-600 rounded-lg bg-violet-50 hover:bg-violet-100">
                                        <Edit2 size={9}/> Edit QC
                                      </button>
                                    )}
                                    {b.status_qc === 'pending' && !b.is_pengganti && (
                                      <button onClick={() => setEditBatchModal(b)}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-violet-600 rounded-lg bg-violet-50 hover:bg-violet-100">
                                        <Edit2 size={9}/> Edit
                                      </button>
                                    )}
                                    <button onClick={() => askConfirm({
                                      title: `Hapus batch ${b.nomor_batch}?`,
                                      message: b.status_qc === 'selesai'
                                        ? 'Stok ACC dari batch ini akan dikurangi kembali. Reject & SJ Retur terkait juga akan dihapus.'
                                        : 'Aksi ini tidak bisa dibatalkan.',
                                      danger: true, confirmLabel: 'Ya, Hapus Batch',
                                      onConfirm: async () => {
                                        const r = await deleteBatch(b.id)
                                        if (r?.error) showToast(r.error, false)
                                        else { showToast('Batch dihapus'); router.refresh() }
                                      },
                                    })} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-500 rounded-lg bg-red-50 hover:bg-red-100">
                                      <Trash2 size={9}/> Hapus
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          {poList.length === 0 && <Empty text="Belum ada PO" />}
          <PaginationBar page={poPage} total={poTotal} pageSize={poPageSize} paramKey="po_page" label="PO" />
        </div>
      )}

      {/* ── Tab: BATCH PENERIMAAN ─────────────────────────────────────────── */}
      {tab === 'batch' && (
        <div className="space-y-2">
          {batchList
            .filter((b: any) => !search || b.nomor_batch.toLowerCase().includes(search.toLowerCase()) || b.po_nomor.toLowerCase().includes(search.toLowerCase()))
            .map((b: any) => (
              <div key={b.id} className="rounded-xl px-4 py-3 bg-white border border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono font-semibold text-slate-700">{b.nomor_batch}</span>
                      <StatusBadge status={b.status_qc === 'selesai' ? 'selesai' : 'pending_qc'} />
                      {b.is_pengganti && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          🔄 Pengganti (siklus {b.siklus_ke})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      PO: <span className="font-semibold text-violet-700">{b.po_nomor}</span> · {b.vendor_nama}
                    </p>
                    {(() => {
                      const items = batchItemsList.filter((bi: any) => bi.batch_id === b.id)
                      return (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{fmtDate(b.tanggal_terima)} · </span>
                          {items.length === 0
                            ? <span>{b.produk_nama} · {fmtNum(b.qty_diterima)} pcs</span>
                            : items.length === 1
                              ? <span>{items[0].produk_nama} · {fmtNum(items[0].qty_diterima)} pcs</span>
                              : <span>{items.length} produk · total {fmtNum(b.qty_diterima)} pcs</span>}
                        </div>
                      )
                    })()}
                    {b.status_qc === 'selesai' && (
                      <>
                        <div className="flex gap-3 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-green-600">ACC: {fmtNum(b.qty_acc ?? 0)}</span>
                          <span className="text-[10px] font-semibold text-red-500">❌ Reject: {fmtNum(b.qty_reject ?? 0)}</span>
                          {(b.qty_lebih ?? 0) > 0 && <span className="text-[10px] font-semibold text-orange-500">➕ Lebih: {fmtNum(b.qty_lebih)}</span>}
                        </div>
                        {(b.qc_operator_nama || b.qc_admin_nama) && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {b.qc_operator_nama && <>👤 Operator: <b className="text-slate-600">{b.qc_operator_nama}</b></>}
                            {b.qc_operator_nama && b.qc_admin_nama && ' · '}
                            {b.qc_admin_nama && <>📋 Admin: <b className="text-slate-600">{b.qc_admin_nama}</b></>}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {b.status_qc === 'pending' && (
                        <button onClick={() => setQcModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-white rounded-lg bg-green-500 hover:bg-green-600">
                          <ClipboardCheck size={11}/> Input QC
                        </button>
                      )}
                      {b.status_qc === 'pending' && !b.is_pengganti && (
                        <button onClick={() => setEditBatchModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-violet-600 rounded-lg bg-violet-50 hover:bg-violet-100">
                          <Edit2 size={11}/> Edit
                        </button>
                      )}
                      {b.status_qc === 'selesai' && (
                        <button onClick={() => setEditQcModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-violet-600 rounded-lg bg-violet-50 hover:bg-violet-100">
                          <Edit2 size={11}/> Edit QC
                        </button>
                      )}
                      <button onClick={() => askConfirm({
                        title: `Hapus batch ${b.nomor_batch}?`,
                        message: b.status_qc === 'selesai'
                          ? 'Stok ACC dari batch ini akan dikurangi kembali. Reject & SJ Retur terkait juga akan dihapus.'
                          : 'Aksi ini tidak bisa dibatalkan.',
                        danger: true,
                        confirmLabel: 'Ya, Hapus Batch',
                        onConfirm: async () => {
                          const r = await deleteBatch(b.id)
                          if (r?.error) showToast(r.error, false)
                          else { showToast('Batch dihapus'); router.refresh() }
                        },
                      })} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-red-500 rounded-lg bg-red-50 hover:bg-red-100">
                        <Trash2 size={11}/> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          {batchList.length === 0 && <Empty text="Belum ada penerimaan" />}
          <PaginationBar page={batchPage} total={batchTotal} pageSize={batchPageSize} paramKey="batch_page" label="penerimaan" />
        </div>
      )}

      {/* ── Tab: DASHBOARD ───────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <VendorPerformanceDashboard
          rejectList={rejectList}
          sjList={sjList}
          poItems={poItems}
          batchList={batchList}
          poList={poList}
          vendors={vendors}
          produkList={produkList}
        />
      )}

      {/* ── Tab: REJECT ────────────────────────────────────────────────────── */}
      {tab === 'reject' && (
        <div className="space-y-2">
          {rejectList
            .filter((r: any) => !search || r.po_nomor.toLowerCase().includes(search.toLowerCase()) || r.vendor_nama.toLowerCase().includes(search.toLowerCase()))
            .map((r: any) => (
              <div key={r.id} className="rounded-xl px-4 py-3 bg-white border border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.jenis === 'lebihan' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                        {r.jenis === 'lebihan' ? '➕ Lebihan' : '❌ Reject'}
                      </span>
                      <StatusBadge status={r.status_penanganan} />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-800 mt-1">{fmtNum(r.qty)} pcs</p>
                    <p className="text-[11px] text-slate-500">{r.produk_nama} · PO {r.po_nomor} · {r.vendor_nama}</p>
                    <p className="text-[10px] text-slate-400">Batch {r.nomor_batch} · {fmtDate(r.tanggal_terima)}</p>
                    {(r.kategori_nama || r.alasan_manual) && (
                      <p className="text-[10px] mt-0.5">
                        {r.kategori_nama && <span className="font-semibold text-red-600">🏷️ {r.kategori_nama}</span>}
                        {r.kategori_nama && r.alasan_manual && <span className="text-slate-400"> · </span>}
                        {r.alasan_manual && <span className="text-slate-600">{r.alasan_manual}</span>}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.status_penanganan !== 'pending' && (
                        <button onClick={() => askConfirm({
                          title: 'Reset status reject?',
                          message: 'Status akan kembali ke pending. Jika sudah di-SJ-kan, SJ Retur terkait akan ikut dihapus saat tidak ada item lain yang merujuk.',
                          confirmLabel: 'Ya, Reset',
                          onConfirm: async () => {
                            const res = await resetRejectStatus(r.id)
                            if (res?.error) showToast(res.error, false)
                            else { showToast('Status direset ke pending'); router.refresh() }
                          },
                        })} className="px-2 py-1 text-[10px] font-semibold text-amber-600 rounded-lg bg-amber-50 hover:bg-amber-100">
                          Reset
                        </button>
                      )}
                      <button onClick={() => askConfirm({
                        title: `Hapus item reject?`,
                        message: `${r.qty} pcs ${r.produk_nama} akan dihapus permanen. Jika sudah di-SJ-kan, SJ ikut dibatalkan saat tidak ada item lain.`,
                        danger: true,
                        confirmLabel: 'Ya, Hapus',
                        onConfirm: async () => {
                          const res = await deleteRejectItem(r.id)
                          if (res?.error) showToast(res.error, false)
                          else { showToast('Item reject dihapus'); router.refresh() }
                        },
                      })} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          {rejectList.length === 0 && <Empty text="Tidak ada reject" icon={CheckCircle2} />}
        </div>
      )}

      {/* ── Tab: STOK ──────────────────────────────────────────────────────── */}
      {tab === 'stok' && (
        <div className="space-y-3">
          <p className="text-[12px] font-medium text-slate-400">Stok Packaging</p>
          {stokList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <p className="text-[12px] text-slate-400">Belum ada stok — lakukan QC batch penerimaan untuk menambah stok</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stokList.map((s: any) => (
                <div key={s.id} className="rounded-xl px-4 py-3.5 text-center bg-white border border-slate-200">
                  <p className="text-[20px] font-semibold text-slate-800">{fmtNum(s.stok_qty)}</p>
                  <p className="text-[12px] font-semibold text-slate-500 mt-0.5">pcs</p>
                  <div className="w-6 h-0.5 rounded-full mx-auto my-2" style={{ background: s.stok_qty > 0 ? '#7C3AED' : '#e2e8f0' }}/>
                  <p className="text-[11px] font-semibold text-slate-600">{s.produk_nama}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: SJ RETUR ──────────────────────────────────────────────────── */}
      {tab === 'sj_retur' && (
        <div className="space-y-2">
          {sjList.length === 0 ? (
            <Empty text="Belum ada surat jalan retur" />
          ) : (() => {
            const filtered = sjList.filter((sj: any) => !search ||
              sj.nomor_sj.toLowerCase().includes(search.toLowerCase()) ||
              (sj.vendor_nama ?? '').toLowerCase().includes(search.toLowerCase())
            )
            if (filtered.length === 0) return <Empty text="Tidak ada SJ yang cocok" icon={Search}/>
            return (
              <div className="space-y-2">
                {filtered.map((sj: any) => {
                  const totalRetur  = sj.total_qty ?? 0
                  const totalGanti  = sj.total_qty_diganti ?? 0
                  const progress    = totalRetur > 0 ? (totalGanti / totalRetur) * 100 : 0
                  const overdue     = sj.status === 'menunggu_ganti' && sj.tanggal_jatuh_tempo_ganti && new Date(sj.tanggal_jatuh_tempo_ganti) < new Date()
                  const displayStatus = overdue ? 'overdue' : (sj.status || 'menunggu_ganti')
                  return (
                  <div key={sj.id} className="rounded-xl px-4 py-3 bg-white border border-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[12px] font-mono font-semibold text-orange-600">{sj.nomor_sj}</p>
                          <StatusBadge status={displayStatus} />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sj.vendor_nama} · Dikirim {fmtDate(sj.tanggal_retur)}</p>
                        {sj.tanggal_jatuh_tempo_ganti && (
                          <p className={`text-[10px] ${overdue ? 'font-semibold text-red-600' : 'text-amber-600'}`}>
                            ⏰ Jatuh tempo ganti: {fmtDate(sj.tanggal_jatuh_tempo_ganti)}
                            {overdue && ' · LEWAT TEMPO'}
                          </p>
                        )}
                        <div className="mt-1.5 space-y-0.5">
                          {(sj.items ?? []).map((it: any, i: number) => (
                            <p key={i} className="text-[11px] text-slate-600">
                              <span className="font-semibold">{it.produk_nama}</span>
                              <span className="text-slate-400"> · {fmtNum(it.qty_retur)} pcs</span>
                              {it.qty_diganti > 0 && <span className="text-green-600"> · {fmtNum(it.qty_diganti)} sudah diganti</span>}
                              {it.kategori_nama && <span className="text-red-500"> · 🏷️ {it.kategori_nama}</span>}
                            </p>
                          ))}
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-slate-500">{fmtNum(totalGanti)} / {fmtNum(totalRetur)} pcs diganti</span>
                            <span className="text-[10px] font-semibold text-orange-600">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-green-500 transition-all"
                              style={{ width: `${Math.min(100, progress)}%` }}/>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {canManage && sj.status !== 'selesai_diganti' && (
                          <button onClick={() => setPenggantiModal(sj)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-blue-600 rounded-xl bg-blue-50 hover:bg-blue-100">
                            <Truck size={11}/> Terima Pengganti
                          </button>
                        )}
                        <a href={`/po-vendor-packaging/sj-retur/${sj.id}`} target="_blank"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-orange-600 rounded-xl bg-orange-50 hover:bg-orange-100">
                          <Printer size={11}/> Cetak
                        </a>
                        {canManage && (
                          <>
                            <button onClick={() => setEditSJModal(sj)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-violet-600 rounded-xl bg-violet-50 hover:bg-violet-100">
                              <Edit2 size={11}/> Edit
                            </button>
                            <button onClick={() => askConfirm({
                              title: 'Hapus SJ Retur?',
                              message: `SJ ${sj.nomor_sj} (${fmtNum(totalRetur)} pcs) akan dihapus. Semua reject yang terkait akan dikembalikan ke status pending. Batch pengganti dari SJ ini (jika ada) juga akan dihapus & stok di-reverse.`,
                              danger: true,
                              confirmLabel: 'Ya, Hapus SJ',
                              onConfirm: async () => {
                                const r = await deleteSJRetur(sj.id)
                                if (r?.error) showToast(r.error, false)
                                else { showToast('SJ Retur dihapus'); router.refresh() }
                              },
                            })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-red-500 rounded-xl bg-red-50 hover:bg-red-100">
                              <Trash2 size={11}/> Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Tab: MASTER ─────────────────────────────────────────────────────── */}
      {tab === 'master' && (
        <div className="space-y-3">
          {/* Sub-tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
            {[
              { key: 'produk',          label: 'Produk' },
              { key: 'kategori_reject', label: 'Kategori Reject' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setMasterSubtab(key as any)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all ${masterSubtab === key ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-black/[0.03]'}`}>
                {label}
              </button>
            ))}
          </div>

          {masterSubtab === 'produk' && (
            <div className="space-y-2">
              <p className="text-[12px] text-slate-400 px-1">Daftar produk packaging yang bisa dipilih saat buat PO</p>
              {produkList.map((p: any) => (
                <div key={p.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-800">{p.nama}</p>
                      <span className="text-[10px] font-mono text-slate-400">{p.kode}</span>
                      <span className="text-[10px] text-slate-400">· {p.satuan ?? 'pcs'}</span>
                      {!p.aktif && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
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
                        else { showToast(p.aktif ? 'Produk dinonaktifkan' : 'Produk diaktifkan'); router.refresh() }
                      }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${p.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {produkList.length === 0 && <Empty text="Belum ada produk — klik Tambah Produk" />}
            </div>
          )}

          {masterSubtab === 'kategori_reject' && (
            <div className="space-y-2">
              <p className="text-[12px] text-slate-400 px-1">Kategori alasan reject yang muncul saat QC (contoh: Cover Baret, Stiker Kebalik)</p>
              {kategoriRejectList.length === 0 ? (
                <Empty text="Belum ada kategori reject — klik Tambah Kategori" icon={Tag}/>
              ) : kategoriRejectList.map((k: any) => (
                <div key={k.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-800">{k.nama}</p>
                      <span className="text-[10px] font-mono text-slate-400">{k.kode}</span>
                      {!k.aktif && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setKategoriRejectModal(k.id)}
                        className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50">
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={async () => {
                        const r = await toggleKategoriRejectAktif(k.id, !k.aktif)
                        if (r?.error) showToast(r.error, false)
                        else { showToast(k.aktif ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan'); router.refresh() }
                      }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${k.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={() => askConfirm({
                        title: `Hapus kategori "${k.nama}"?`,
                        message: 'Jika kategori sudah dipakai di reject lama, kategori akan dinonaktifkan (soft delete). Jika belum pernah dipakai, kategori dihapus permanen.',
                        danger: true,
                        confirmLabel: 'Ya, Hapus',
                        onConfirm: async () => {
                          const r = await deleteKategoriReject(k.id)
                          if (r?.error) showToast(r.error, false)
                          else { showToast('Kategori dihapus'); router.refresh() }
                        },
                      })}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── Tab: VENDOR ────────────────────────────────────────────────────── */}
      {tab === 'vendor' && (
        <div className="space-y-2">
          {vendors.map((v: any) => (
            <div key={v.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-slate-800">{v.nama}</p>
                  <span className="text-[10px] font-mono text-slate-400">{v.kode}</span>
                  {!v.aktif && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                </div>
                {v.pic && <p className="text-[11px] text-slate-400">PIC: {v.pic}</p>}
                {v.telepon && <p className="text-[11px] text-slate-400">{v.telepon}</p>}
              </div>
              {canManage && (
                <button onClick={() => setVendorModal(v.id)} className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50">
                  <Edit2 size={13}/>
                </button>
              )}
            </div>
          ))}
          {vendors.length === 0 && <Empty text="Belum ada vendor" />}
        </div>
      )}

      {/* ════════════ MODALS ════════════ */}

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
            showToast(produkModal === 'create' ? 'Produk ditambahkan' : 'Produk diperbarui')
            setProdukModal(null); router.refresh()
          }}
        />
      )}

      {confirmState !== null && (
        <ConfirmModal
          state={confirmState}
          onClose={() => setConfirmState(null)}
        />
      )}

      {editSJModal !== null && (
        <EditSJReturModal
          sj={editSJModal}
          onClose={() => setEditSJModal(null)}
          onSave={async (fd) => {
            const r = await updateSJRetur(editSJModal.id, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('SJ Retur diperbarui')
            setEditSJModal(null); router.refresh()
          }}
        />
      )}

      {penggantiModal !== null && (
        <PenggantiModal
          sj={penggantiModal}
          onClose={() => setPenggantiModal(null)}
          onSave={async (fd) => {
            const r = await createBatchPengganti(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('Batch pengganti dibuat — silakan QC di tab Penerimaan')
            setPenggantiModal(null); router.refresh()
          }}
        />
      )}

      {kategoriRejectModal !== null && (
        <KategoriRejectModal
          mode={kategoriRejectModal === 'create' ? 'create' : 'edit'}
          kategori={kategoriRejectModal !== 'create' ? kategoriRejectList.find(k => k.id === kategoriRejectModal) : undefined}
          onClose={() => setKategoriRejectModal(null)}
          onSave={async (fd) => {
            const r = kategoriRejectModal === 'create'
              ? await createKategoriReject(fd)
              : await updateKategoriReject(kategoriRejectModal as number, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(kategoriRejectModal === 'create' ? 'Kategori ditambahkan' : 'Kategori diperbarui')
            setKategoriRejectModal(null); router.refresh()
          }}
        />
      )}

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
            showToast(vendorModal === 'create' ? 'Vendor ditambahkan' : 'Vendor diperbarui')
            setVendorModal(null); router.refresh()
          }}
        />
      )}

      {poModal !== null && (
        <POModal
          mode={poModal === 'create' ? 'create' : 'edit'}
          po={poModal !== 'create' ? poList.find(p => p.id === editPoId) : undefined}
          poItemsForEdit={poModal !== 'create' && editPoId ? poItems.filter(i => i.po_id === editPoId) : []}
          vendors={vendors}
          produkList={produkList}
          allPoItems={poItems}
          allPoList={poList}
          onClose={() => { setPoModal(null); setEditPoId(null) }}
          onSave={async (fd) => {
            const r = poModal === 'create'
              ? await createPO(fd)
              : await updatePO(editPoId!, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(poModal === 'create' ? `PO dibuat: ${(r as any).nomorPO}` : 'PO diperbarui')
            setPoModal(null); setEditPoId(null); router.refresh()
          }}
        />
      )}

      {batchModal !== null && (
        <BatchModal
          po={poList.find(p => p.id === batchModal)!}
          poItemsForPO={poItems.filter(i => i.po_id === batchModal)}
          onClose={() => setBatchModal(null)}
          onSave={async (fd) => {
            const r = await createBatchPenerimaan(fd)
            if (r?.error) { showToast(r.error, false); return }
            const msg = `Batch ${(r as any).nomor} dibuat` + ((r as any).qtyLebih > 0 ? ` · Lebihan: ${(r as any).qtyLebih} pcs` : '')
            showToast(msg)
            setBatchModal(null); router.refresh()
          }}
        />
      )}

      {editBatchModal !== null && (
        <EditBatchModal
          batch={editBatchModal}
          batchItems={batchItemsList.filter((bi: any) => bi.batch_id === editBatchModal.id)}
          poItemsForPO={poItems.filter(i => i.po_id === editBatchModal.po_id)}
          onClose={() => setEditBatchModal(null)}
          onSave={async (fd) => {
            const r = await editBatchPenerimaan(editBatchModal.id, fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(`Penerimaan ${editBatchModal.nomor_batch} diperbarui`)
            setEditBatchModal(null); router.refresh()
          }}
        />
      )}

      {qcModal !== null && (
        <QCModal
          batch={qcModal}
          batchItems={batchItemsList.filter((bi: any) => bi.batch_id === qcModal.id)}
          kategoriList={kategoriRejectList}
          timAnggotaList={timAnggotaList}
          adminInputList={adminInputList}
          mode="create"
          onClose={() => setQcModal(null)}
          onSave={async (fd) => {
            const r = await submitQC(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('QC selesai — stok diperbarui')
            setQcModal(null); router.refresh()
          }}
        />
      )}

      {editQcModal !== null && (
        <QCModal
          batch={editQcModal}
          batchItems={batchItemsList.filter((bi: any) => bi.batch_id === editQcModal.id)}
          kategoriList={kategoriRejectList}
          timAnggotaList={timAnggotaList}
          adminInputList={adminInputList}
          mode="edit"
          onClose={() => setEditQcModal(null)}
          onSave={async (fd) => {
            const r = await editQCResult(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('Hasil QC diperbarui — stok disesuaikan')
            setEditQcModal(null); router.refresh()
          }}
        />
      )}


      {sjModal !== null && (
        <SJReturModal
          vendors={vendors}
          rejectList={rejectList.filter((r: any) => r.status_penanganan === 'pending' && r.jenis === 'reject')}
          onClose={() => setSjModal(null)}
          onSave={async (fd) => {
            const r = await createSJRetur(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast(`SJ Retur ${(r as any).nomor} dibuat`)
            setSjModal(null); router.refresh()
          }}
        />
      )}

      {voidPoId !== null && (
        <VoidModal
          title={`Void PO ${poList.find(p => p.id === voidPoId)?.nomor_po ?? ''}`}
          onClose={() => setVoidPoId(null)}
          onConfirm={async (reason) => {
            const r = await voidPO(voidPoId, reason)
            if (r?.error) { showToast(r.error, false); return }
            showToast('PO divoid')
            setVoidPoId(null); router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ── Modal Shell ───────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X size={14} className="text-slate-500"/>
          </button>
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
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nama Produk *</label>
          <input name="nama" defaultValue={produk?.nama} required placeholder="mis. Akrilik 2x3cm" className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Satuan</label>
          <select name="satuan" defaultValue={produk?.satuan ?? 'pcs'} className={inp}>
            <option value="pcs">pcs</option><option value="set">set</option>
            <option value="lusin">lusin</option><option value="box">box</option><option value="meter">meter</option>
          </select></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Keterangan</label>
          <textarea name="keterangan" defaultValue={produk?.keterangan} rows={2} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
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
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nama Vendor *</label>
          <input name="nama" defaultValue={vendor?.nama} required className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">PIC</label>
          <input name="pic" defaultValue={vendor?.pic} className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Telepon</label>
          <input name="telepon" defaultValue={vendor?.telepon} className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Email</label>
          <input name="email" type="email" defaultValue={vendor?.email} className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Alamat</label>
          <textarea name="alamat" defaultValue={vendor?.alamat} rows={2} className={inp}/></div>
        {mode === 'edit' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" name="aktif" id="aktif" defaultChecked={vendor?.aktif !== false} value="true"/>
            <label htmlFor="aktif" className="text-[13px] text-slate-600">Aktif</label>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </ModalShell>
  )
}

// ── PO Modal (multi-item) ─────────────────────────────────────────────────────
interface ItemRow { produk_id: number; qty_po: number; harga_satuan: number }

function POModal({ mode, po, poItemsForEdit, vendors, produkList, allPoItems, allPoList, onClose, onSave }: {
  mode: string; po?: any; poItemsForEdit: any[];
  vendors: any[]; produkList: any[];
  allPoItems: any[]; allPoList: any[];
  onClose: () => void; onSave: (fd: FormData) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [vendorId, setVendorId] = useState<number>(po?.vendor_id ?? 0)
  const initItems: ItemRow[] = poItemsForEdit.length > 0
    ? poItemsForEdit.map(i => ({ produk_id: i.produk_id, qty_po: i.qty_po, harga_satuan: i.harga_satuan ?? 0 }))
    : [{ produk_id: 0, qty_po: 0, harga_satuan: 0 }]
  const [items, setItems] = useState<ItemRow[]>(initItems)

  // Cari harga terakhir untuk kombinasi produk+vendor
  const lastPriceFor = (produkId: number): { harga: number; tanggal: string; vendor_sama: boolean } | null => {
    if (!produkId) return null
    const poMap = Object.fromEntries(allPoList.map((p: any) => [p.id, p]))
    const candidates = allPoItems
      .filter((it: any) => it.produk_id === produkId && it.harga_satuan && poMap[it.po_id])
      .map((it: any) => ({ harga: it.harga_satuan, tanggal: poMap[it.po_id].tanggal_po, vendor_id: poMap[it.po_id].vendor_id }))
      .sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    if (!candidates.length) return null
    // Prioritas: vendor sama yang terakhir
    const sameVendor = candidates.find((c: any) => c.vendor_id === vendorId)
    if (sameVendor) return { harga: sameVendor.harga, tanggal: sameVendor.tanggal, vendor_sama: true }
    return { harga: candidates[0].harga, tanggal: candidates[0].tanggal, vendor_sama: false }
  }

  const totalNilai = items.reduce((s, it) => s + (it.qty_po * (it.harga_satuan || 0)), 0)
  const setItem = (idx: number, key: keyof ItemRow, val: number) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  const addItem = () => setItems(p => [...p, { produk_id: 0, qty_po: 0, harga_satuan: 0 }])
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx))

  const valid = items.every(it => it.produk_id > 0 && it.qty_po > 0)

  return (
    <ModalShell title={mode === 'create' ? 'Buat PO Baru' : 'Edit PO'} onClose={onClose}>
      <form onSubmit={async e => {
        e.preventDefault()
        if (!valid) return
        const fd = new FormData(e.currentTarget)
        fd.set('items', JSON.stringify(items.map(it => ({
          produk_id: it.produk_id,
          qty_po: it.qty_po,
          harga_satuan: it.harga_satuan || undefined,
        }))))
        setLoading(true)
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        {/* Nomor PO */}
        {mode === 'create' && (
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nomor PO (kosongkan = auto)</label>
            <input name="nomor_po" placeholder="PO/2406/0001" className={inp}/></div>
        )}
        {mode === 'edit' && (
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nomor PO *</label>
            <input name="nomor_po" defaultValue={po?.nomor_po} required className={inp}/></div>
        )}

        {/* Vendor */}
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Vendor *</label>
          <select name="vendor_id" value={vendorId || ''} onChange={e => setVendorId(parseInt(e.target.value) || 0)} required className={inp}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
        </div>

        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal PO *</label>
            <input name="tanggal_po" type="date" defaultValue={po?.tanggal_po} required className={inp}/></div>
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jatuh Tempo</label>
            <input name="tanggal_jatuh_tempo" type="date" defaultValue={po?.tanggal_jatuh_tempo} className={inp}/></div>
        </div>

        {/* Item Rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-slate-500">Produk *</label>
            <button type="button" onClick={addItem}
              className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700">
              <Plus size={11}/> Tambah Produk
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => {
              const hint = lastPriceFor(it.produk_id)
              const subtotal = it.qty_po * (it.harga_satuan || 0)
              return (
                <div key={idx} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Produk {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-500">
                        <X size={13}/>
                      </button>
                    )}
                  </div>
                  <select value={it.produk_id || ''} onChange={e => setItem(idx, 'produk_id', parseInt(e.target.value) || 0)}
                    className={inp} required>
                    <option value="">— Pilih Produk —</option>
                    {produkList.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Qty (pcs) *</label>
                      <input type="number" min="1" value={it.qty_po || ''} onChange={e => setItem(idx, 'qty_po', parseInt(e.target.value) || 0)}
                        required className={inp} placeholder="0"/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Harga Satuan (Rp)</label>
                      <input type="number" min="0" value={it.harga_satuan || ''} onChange={e => setItem(idx, 'harga_satuan', parseFloat(e.target.value) || 0)}
                        className={inp} placeholder="0"/>
                    </div>
                  </div>
                  {hint && (
                    <button type="button" onClick={() => setItem(idx, 'harga_satuan', hint.harga)}
                      className="w-full text-left px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-[10px] text-amber-700 hover:bg-amber-100 transition-colors">
                      💡 Harga terakhir {hint.vendor_sama ? 'vendor ini' : 'vendor lain'}: <b>{fmtRp(hint.harga)}</b> ({fmtDate(hint.tanggal)}) — klik untuk pakai
                    </button>
                  )}
                  {subtotal > 0 && (
                    <p className="text-[11px] text-right text-slate-500">
                      Subtotal: <b className="text-emerald-700">{fmtRp(subtotal)}</b>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {totalNilai > 0 && (
            <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex justify-between items-center">
              <span className="text-[12px] font-semibold text-emerald-700">Total Nilai PO</span>
              <span className="text-[13px] font-semibold text-emerald-700">{fmtRp(totalNilai)}</span>
            </div>
          )}
        </div>

        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
          <textarea name="catatan" defaultValue={po?.catatan} rows={2} className={inp}/></div>

        <button type="submit" disabled={loading || !valid}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Buat PO' : 'Simpan Perubahan'}
        </button>
      </form>
    </ModalShell>
  )
}

// ── Edit Penerimaan Modal (qty/tanggal/catatan — nomor batch tetap) ─────────────
function EditBatchModal({ batch, batchItems, poItemsForPO, onClose, onSave }: {
  batch: any; batchItems: any[]; poItemsForPO: any[];
  onClose: () => void; onSave: (fd: FormData) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const rows = batchItems.filter((bi: any) => bi.po_item_id)
  const effectiveRows = rows.length > 0
    ? rows
    : (batch.po_item_id ? [{ po_item_id: batch.po_item_id, produk_nama: batch.produk_nama, qty_diterima: batch.qty_diterima }] : [])
  const [qty, setQty] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {}
    for (const r of effectiveRows) m[r.po_item_id] = r.qty_diterima
    return m
  })
  const list = effectiveRows.map((r: any) => ({ po_item_id: r.po_item_id, qty_diterima: qty[r.po_item_id] ?? 0 }))
  const totalQty = list.reduce((s, x) => s + x.qty_diterima, 0)
  const valid = list.length > 0 && list.every(x => x.qty_diterima > 0)

  return (
    <ModalShell title={`Edit Penerimaan ${batch.nomor_batch}`} onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-semibold">{batch.po_nomor} · {batch.vendor_nama}</p>
        <p className="text-violet-500 mt-0.5 text-[11px]">Ubah qty diterima. Nomor batch tetap, total di PO ikut disesuaikan otomatis.</p>
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        if (!valid) return
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('items', JSON.stringify(list))
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Terima *</label>
          <input name="tanggal_terima" type="date" required
            defaultValue={batch.tanggal_terima ? String(batch.tanggal_terima).slice(0, 10) : new Date().toISOString().split('T')[0]}
            className={inp}/></div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Produk Diterima ({fmtNum(totalQty)} pcs)</p>
          <div className="space-y-2">
            {effectiveRows.map((r: any) => {
              const pi = poItemsForPO.find((p: any) => p.id === r.po_item_id)
              return (
                <div key={r.po_item_id} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700">{r.produk_nama}</p>
                    {pi && <p className="text-[10px] text-slate-400">PO {fmtNum(pi.qty_po)} pcs</p>}
                  </div>
                  <input type="number" min="1" value={qty[r.po_item_id] ?? ''}
                    onChange={e => setQty(p => ({ ...p, [r.po_item_id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-24 h-8 rounded-lg border border-violet-200 px-2 text-[13px] font-semibold text-violet-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                  <span className="text-[11px] text-slate-400">pcs</span>
                </div>
              )
            })}
          </div>
        </div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
          <textarea name="catatan" rows={2} defaultValue={batch.catatan ?? ''} className={inp}/></div>
        <button type="submit" disabled={loading || !valid}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : `Simpan Perubahan${totalQty > 0 ? ` (${fmtNum(totalQty)} pcs)` : ''}`}
        </button>
      </form>
    </ModalShell>
  )
}

// ── Batch Penerimaan Modal ────────────────────────────────────────────────────
function BatchModal({ po, poItemsForPO, onClose, onSave }: {
  po: any; poItemsForPO: any[];
  onClose: () => void; onSave: (fd: FormData) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  // selectedItems: { [po_item_id]: qty_diterima }
  const [selected, setSelected] = useState<Record<number, number>>({})

  const toggle = (it: any) => {
    setSelected(p => {
      const n = { ...p }
      if (it.id in n) { delete n[it.id]; return n }
      const sisa = Math.max(0, it.qty_po - (it.qty_diterima ?? 0))
      return { ...n, [it.id]: sisa > 0 ? sisa : 1 }
    })
  }
  const setQty = (id: number, v: number) => setSelected(p => ({ ...p, [id]: v }))

  const selectedList = Object.entries(selected).map(([id, qty]) => ({ po_item_id: parseInt(id), qty_diterima: qty }))
  const totalQty = selectedList.reduce((s, x) => s + x.qty_diterima, 0)
  const valid = selectedList.length > 0 && selectedList.every(x => x.qty_diterima > 0)

  return (
    <ModalShell title="Input Penerimaan Barang" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-semibold">{po.nomor_po}</p>
        <p className="text-violet-600 mt-0.5">{po.vendor_nama} · {poItemsForPO.length} produk di PO</p>
        <p className="text-violet-500 mt-0.5 text-[11px]">Centang produk yang diterima & isi qty. Bisa pilih lebih dari satu produk sekaligus.</p>
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        if (!valid) return
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('po_id', String(po.id))
        fd.set('items', JSON.stringify(selectedList))
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nomor Batch <span className="normal-case text-slate-400 font-normal">(kosongkan = auto)</span></label>
            <input name="nomor_batch" placeholder="auto: BATCH/001/MM/YY" className={inp}/></div>
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Terima *</label>
            <input name="tanggal_terima" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
        </div>

        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Produk yang Diterima ({selectedList.length} dipilih · {fmtNum(totalQty)} pcs)</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {poItemsForPO.map((it: any) => {
              const sisa = Math.max(0, it.qty_po - (it.qty_diterima ?? 0))
              const checked = it.id in selected
              return (
                <div key={it.id}
                  className={`rounded-xl border transition-all ${checked ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                  <button type="button" onClick={() => toggle(it)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left">
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${checked ? 'bg-violet-600' : 'border border-slate-300'}`}>
                      {checked && <Check size={10} className="text-white"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700">{it.produk_nama}</p>
                      <p className="text-[10px] text-slate-400">
                        PO {fmtNum(it.qty_po)} pcs · diterima {fmtNum(it.qty_diterima ?? 0)} · sisa <b>{fmtNum(sisa)}</b>
                        {sisa === 0 && <span className="text-green-600 font-semibold"> · sudah terpenuhi (input = lebihan)</span>}
                      </p>
                    </div>
                  </button>
                  {checked && (
                    <div className="px-3 pb-2.5 flex items-center gap-2">
                      <label className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Qty diterima:</label>
                      <input type="number" min="1" value={selected[it.id]}
                        onChange={e => setQty(it.id, Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 h-8 rounded-lg border border-violet-200 px-2 text-[13px] font-semibold text-violet-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                      <span className="text-[11px] text-slate-400">pcs (sisa: {fmtNum(sisa)})</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
          <textarea name="catatan" rows={2} className={inp}/></div>
        <button type="submit" disabled={loading || !valid}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : `Simpan Penerimaan${totalQty > 0 ? ` (${fmtNum(totalQty)} pcs)` : ''}`}
        </button>
      </form>
    </ModalShell>
  )
}

interface RejectRow { qty: number; kategori_id: number | null; alasan_manual: string; catatan: string }
interface ItemQCState { batch_item_id: number; qty_acc: number; rejects: RejectRow[] }

function QCModal({ batch, batchItems, kategoriList, timAnggotaList, adminInputList, mode = 'create', onClose, onSave }: {
  batch: any
  batchItems: any[]
  kategoriList: any[]
  timAnggotaList: any[]
  adminInputList: any[]
  mode?: 'create' | 'edit'
  onClose: () => void
  onSave: (fd: FormData) => Promise<void>
}) {
  const [loading, setLoading]   = useState(false)
  const [ttdOp, setTtdOp]       = useState<string | null>(mode === 'edit' ? (batch.ttd_qc_operator_url ?? null) : null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(mode === 'edit' ? (batch.ttd_qc_admin_url ?? null) : null)
  const [showTtd, setShowTtd]   = useState(mode === 'edit')

  const [items, setItems] = useState<ItemQCState[]>(() => batchItems.map(bi => ({
    batch_item_id: bi.id,
    qty_acc: mode === 'edit' ? (bi.qty_acc ?? 0) : 0,
    rejects: [],  // editor reset rejects (akan diinput ulang)
  })))

  // Tambah/kurangi reject row per batch_item
  const addReject = (biId: number) => setItems(p => p.map(it => it.batch_item_id === biId
    ? { ...it, rejects: [...it.rejects, { qty: 0, kategori_id: null, alasan_manual: '', catatan: '' }] }
    : it))
  const rmReject = (biId: number, idx: number) => setItems(p => p.map(it => it.batch_item_id === biId
    ? { ...it, rejects: it.rejects.filter((_, i) => i !== idx) }
    : it))
  const updReject = (biId: number, idx: number, patch: Partial<RejectRow>) => setItems(p => p.map(it => it.batch_item_id === biId
    ? { ...it, rejects: it.rejects.map((r, i) => i === idx ? { ...r, ...patch } : r) }
    : it))
  const setItemAcc = (biId: number, v: number) => setItems(p => p.map(it => it.batch_item_id === biId ? { ...it, qty_acc: v } : it))

  // Validasi per item
  const itemValidations = batchItems.map(bi => {
    const itemQC  = items.find(i => i.batch_item_id === bi.id)!
    const qtyR    = itemQC.rejects.reduce((s, r) => s + (r.qty || 0), 0)
    const maxChk  = bi.qty_diterima - (bi.qty_lebih ?? 0)
    const total   = itemQC.qty_acc + qtyR
    const ok      = total === maxChk
    const rejectsOk = itemQC.rejects.every(r => r.qty > 0 && (r.kategori_id !== null || r.alasan_manual.trim().length > 0))
    return { bi, itemQC, qtyR, maxChk, total, ok, rejectsOk }
  })
  const allOk = itemValidations.every(v => v.ok && v.rejectsOk)

  return (
    <ModalShell title={mode === 'edit' ? `Edit QC ${batch.nomor_batch}` : 'Input Hasil QC'} onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-semibold">{batch.nomor_batch}</p>
        <p className="text-violet-600 mt-0.5">{batch.vendor_nama} · {batchItems.length} produk</p>
        <p className="text-violet-500 text-[11px] mt-0.5">Isi ACC + reject per produk. Qty ACC bisa 0.</p>
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        if (!allOk) return
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('batch_id', String(batch.id))
        fd.set('items', JSON.stringify(items))
        if (ttdOp)    fd.set('ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('ttd_admin', ttdAdmin)
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal QC *</label>
            <input name="qc_tanggal" type="date" required defaultValue={(batch.qc_tanggal ?? new Date().toISOString().split('T')[0])} className={inp}/></div>
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Operator QC</label>
            <select name="operator_nama" defaultValue={batch.qc_operator_nama ?? ''} className={inp}>
              <option value="">— Pilih operator —</option>
              {timAnggotaList.map((t: any) => <option key={t.id} value={t.nama}>{t.nama}</option>)}
            </select>
          </div>
        </div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Admin Input</label>
          <select name="admin_nama" defaultValue={batch.qc_admin_nama ?? ''} className={inp}>
            <option value="">— Pilih admin —</option>
            {adminInputList.map((a: any) => <option key={a.id} value={a.nama}>{a.nama}</option>)}
          </select>
        </div>

        {/* Per produk: ACC + rejects */}
        {itemValidations.map(({ bi, itemQC, qtyR, maxChk, total, ok, rejectsOk }) => (
          <div key={bi.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-800">{bi.produk_nama}</p>
              <p className="text-[10px] text-slate-400">
                Diterima {fmtNum(bi.qty_diterima)} · Lebihan {fmtNum(bi.qty_lebih ?? 0)} · Perlu QC <b>{fmtNum(maxChk)}</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Qty ACC:</label>
              <input type="number" min="0" max={maxChk} value={itemQC.qty_acc}
                onChange={e => setItemAcc(bi.id, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 h-8 rounded-lg border border-green-300 px-2 text-[13px] font-semibold text-green-700 bg-green-50"/>
              <span className="text-[11px] text-slate-400">+ {fmtNum(qtyR)} reject = <b className={ok ? 'text-green-700' : 'text-red-600'}>{fmtNum(total)} / {fmtNum(maxChk)}</b></span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium text-slate-400">Reject ({fmtNum(qtyR)} pcs)</p>
                <button type="button" onClick={() => addReject(bi.id)}
                  className="text-[10px] font-semibold text-violet-600 flex items-center gap-1">
                  <Plus size={11}/> Tambah Reject
                </button>
              </div>
              {itemQC.rejects.length === 0 ? (
                <p className="text-[10px] text-slate-400 py-1 text-center rounded-lg bg-slate-50 border border-dashed border-slate-200">
                  Tidak ada reject untuk produk ini
                </p>
              ) : (
                <div className="space-y-1.5">
                  {itemQC.rejects.map((r, idx) => (
                    <div key={idx} className="rounded-lg border border-red-200 bg-red-50/50 p-2 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <input type="number" min="1" placeholder="Qty" value={r.qty || ''}
                          onChange={e => updReject(bi.id, idx, { qty: parseInt(e.target.value) || 0 })}
                          className="w-16 h-7 rounded-lg border border-red-200 px-2 text-[11px] font-semibold text-red-700 bg-white"/>
                        <select value={r.kategori_id ?? ''}
                          onChange={e => updReject(bi.id, idx, { kategori_id: e.target.value ? parseInt(e.target.value) : null })}
                          className="flex-1 h-7 rounded-lg border border-red-200 px-2 text-[11px] bg-white">
                          <option value="">— Kategori —</option>
                          {kategoriList.map((k: any) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                        </select>
                        <button type="button" onClick={() => rmReject(bi.id, idx)}
                          className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                          <Trash2 size={11}/>
                        </button>
                      </div>
                      <input type="text" placeholder="Alasan manual (jika tidak ada kategori)"
                        value={r.alasan_manual} onChange={e => updReject(bi.id, idx, { alasan_manual: e.target.value })}
                        className="w-full h-6 rounded border border-red-200 px-2 text-[10px] bg-white"/>
                      <input type="text" placeholder="Catatan"
                        value={r.catatan} onChange={e => updReject(bi.id, idx, { catatan: e.target.value })}
                        className="w-full h-6 rounded border border-red-100 px-2 text-[10px] bg-white"/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(!ok || !rejectsOk) && (
              <div className="rounded-lg px-2 py-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                {!ok && `Total ACC+Reject = ${total} harus ${maxChk}`}
                {!ok && !rejectsOk && ' · '}
                {!rejectsOk && 'Kategori/alasan reject wajib'}
              </div>
            )}
          </div>
        ))}

        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan QC</label>
          <textarea name="catatan_qc" defaultValue={batch.catatan_qc ?? ''} rows={2} className={inp}/></div>
        <button type="button" onClick={() => setShowTtd(p => !p)}
          className="w-full py-2 text-[12px] font-semibold text-violet-600 rounded-xl border border-violet-200">
          {showTtd ? '▲ Sembunyikan TTD' : '✍️ Tambah TTD (Opsional)'}
        </button>
        {showTtd && (
          <div className="space-y-3 rounded-xl p-3 bg-white border border-slate-200">
            <SignaturePad label="TTD Operator" initial={ttdOp} onSave={v => setTtdOp(v)}/>
            <SignaturePad label="TTD Admin" initial={ttdAdmin} onSave={v => setTtdAdmin(v)}/>
          </div>
        )}
        <button type="submit" disabled={loading || !allOk}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : (mode === 'edit' ? 'Simpan Perubahan QC' : 'Simpan Hasil QC')}
        </button>
      </form>
    </ModalShell>
  )
}

function SJReturModal({ vendors, rejectList, onClose, onSave }: { vendors: any[]; rejectList: any[]; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [nomorSJ, setNomorSJ]   = useState('')
  const [tanggal, setTanggal]   = useState(new Date().toISOString().split('T')[0])
  const [tglJatuhTempo, setTglJatuhTempo] = useState('')
  const [catatan, setCatatan]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [selectedQty, setSelectedQty] = useState<Record<number, number>>({})

  // Hanya tampilkan reject pending (yang belum di-SJ-kan)
  const vendorRejects = vendorId
    ? rejectList.filter((r: any) => r.vendor_id === vendorId && r.status_penanganan === 'pending' && r.jenis !== 'lebihan')
    : []
  const isSelected    = (id: number) => id in selectedQty
  const toggle        = (r: any) => {
    setSelectedQty(p => {
      const n = { ...p }
      if (r.id in n) { delete n[r.id]; return n }
      return { ...n, [r.id]: r.qty }
    })
  }
  const setQty        = (id: number, val: number) => setSelectedQty(p => ({ ...p, [id]: val }))
  const selectAll     = () => setSelectedQty(Object.fromEntries(vendorRejects.map((r: any) => [r.id, r.qty])))

  const selectedItems = Object.entries(selectedQty).map(([id, qty]) => ({ reject_id: parseInt(id), qty_retur: qty }))
  const totalSelected = selectedItems.reduce((s, i) => s + i.qty_retur, 0)
  const hasItems      = selectedItems.length > 0 && selectedItems.every(i => i.qty_retur > 0)

  return (
    <ModalShell title="Buat Surat Jalan Retur" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nomor SJ <span className="normal-case text-slate-400 font-normal">(kosongkan = auto: SJ.RTR/001/MM/YY)</span></label>
          <input value={nomorSJ} onChange={e => setNomorSJ(e.target.value)} placeholder="auto-generate jika kosong" className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Vendor *</label>
          <select value={vendorId ?? ''} onChange={e => { setVendorId(parseInt(e.target.value) || null); setSelectedQty({}) }} className={inp}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tgl Retur *</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp}/></div>
          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jatuh Tempo Ganti</label>
            <input type="date" value={tglJatuhTempo} onChange={e => setTglJatuhTempo(e.target.value)} className={inp}/></div>
        </div>

        {vendorId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-semibold text-slate-500">
                Pilih Item ({selectedItems.length} dipilih · {fmtNum(totalSelected)} pcs)
              </p>
              {vendorRejects.length > 0 && (
                <button type="button" onClick={selectAll}
                  className="text-[10px] font-semibold text-violet-600">Pilih Semua</button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vendorRejects.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2 text-center">Tidak ada reject pending dari vendor ini</p>
              ) : vendorRejects.map((r: any) => (
                <div key={r.id}
                  className={`rounded-xl border transition-all ${isSelected(r.id) ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                  <button type="button" onClick={() => toggle(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left">
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${isSelected(r.id) ? 'bg-violet-600' : 'border border-slate-300'}`}>
                      {isSelected(r.id) && <Check size={10} className="text-white"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700">{r.produk_nama}</p>
                      <p className="text-[10px] text-slate-400">Batch {r.nomor_batch} · Total reject: <b>{fmtNum(r.qty)} pcs</b></p>
                      {(r.kategori_nama || r.alasan_manual) && (
                        <p className="text-[10px] text-red-600 truncate">
                          🏷️ {r.kategori_nama ?? r.alasan_manual}
                        </p>
                      )}
                    </div>
                  </button>
                  {/* Qty input muncul saat dipilih */}
                  {isSelected(r.id) && (
                    <div className="px-3 pb-2.5 flex items-center gap-2">
                      <label className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Qty diretur:</label>
                      <input type="number" min="1" max={r.qty} value={selectedQty[r.id] ?? r.qty}
                        onChange={e => setQty(r.id, Math.min(r.qty, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-24 h-8 rounded-lg border border-violet-200 px-2 text-[13px] font-semibold text-violet-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                      <span className="text-[11px] text-slate-400">/ {fmtNum(r.qty)} pcs</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan SJ</label>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} className={inp}/></div>

        <button onClick={async () => {
          if (!vendorId || !hasItems) return
          setLoading(true)
          const fd = new FormData()
          fd.set('vendor_id', String(vendorId))
          if (nomorSJ.trim()) fd.set('nomor_sj', nomorSJ.trim())
          fd.set('tanggal_retur', tanggal)
          if (tglJatuhTempo) fd.set('tanggal_jatuh_tempo_ganti', tglJatuhTempo)
          fd.set('items', JSON.stringify(selectedItems))
          fd.set('catatan', catatan)
          await onSave(fd)
          setLoading(false)
        }} disabled={loading || !vendorId || !hasItems}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Membuat SJ...' : `Buat SJ Retur (${fmtNum(totalSelected)} pcs)`}
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
          <p className="font-semibold">PO akan divoid dan tidak bisa diaktifkan kembali.</p>
        </div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Alasan Void *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required className={inp}/></div>
        <button onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false) }}
          disabled={loading || !reason.trim()}
          className="w-full h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Memproses...' : 'Void PO'}
        </button>
      </div>
    </ModalShell>
  )
}


function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const danger = state.danger ?? false
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            <AlertTriangle size={20}/>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-slate-900">{state.title}</h3>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="px-5 pb-5 pt-2 flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 h-9 rounded-lg text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
            {state.cancelLabel ?? 'Batal'}
          </button>
          <button type="button" disabled={loading}
            onClick={async () => {
              setLoading(true)
              try { await state.onConfirm() } finally { setLoading(false); onClose() }
            }}
            className={`px-4 h-9 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {loading ? 'Memproses...' : (state.confirmLabel ?? 'Konfirmasi')}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditSJReturModal({ sj, onClose, onSave }: { sj: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title={`Edit ${sj.nomor_sj}`} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(new FormData(e.currentTarget)); setLoading(false) }}
        className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[11px] bg-slate-50 border border-slate-200 text-slate-500">
          Vendor: <b className="text-slate-800">{sj.vendor_nama}</b><br/>
          Items SJ tidak bisa diubah (sudah disnapshot dari reject). Untuk ganti items, hapus SJ ini lalu buat baru.
        </div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Retur *</label>
          <input name="tanggal_retur" type="date" required defaultValue={sj.tanggal_retur} className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jatuh Tempo Ganti</label>
          <input name="tanggal_jatuh_tempo_ganti" type="date" defaultValue={sj.tanggal_jatuh_tempo_ganti ?? ''} className={inp}/></div>
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
          <textarea name="catatan" defaultValue={sj.catatan ?? ''} rows={2} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </ModalShell>
  )
}

function VendorPerformanceDashboard({ rejectList, sjList, poItems, batchList, poList, vendors, produkList }: {
  rejectList: any[]; sjList: any[]; poItems: any[]; batchList: any[]
  poList: any[]; vendors: any[]; produkList: any[]
}) {
  const [dsTab, setDsTab] = useState<'overview' | 'reject' | 'kategori' | 'harga'>('overview')
  const todayStr = new Date().toISOString().split('T')[0]

  const onlyReject = rejectList.filter((r: any) => r.jenis !== 'lebihan')

  const hargaMap = new Map<string, number>()
  for (const it of poItems) {
    if (it.harga_satuan) hargaMap.set(`${it.po_id}_${it.produk_id}`, it.harga_satuan)
  }

  const poMap = Object.fromEntries(poList.map((p: any) => [p.id, p]))

  // ── Per-vendor aggregation ─────────────────────────────────────────────
  type VS = {
    id: number; nama: string
    total_diterima: number; total_acc: number; total_reject: number
    total_kerugian: number; po_count: number
    lead_times: number[]; avg_lead_time: number
    harga_list: number[]; avg_harga: number
    pending_sj: number; overdue_sj: number
    acc_rate: number; reject_rate: number; score: number
  }
  const vstats: Record<number, VS> = {}
  for (const v of vendors) {
    vstats[v.id] = {
      id: v.id, nama: v.nama,
      total_diterima: 0, total_acc: 0, total_reject: 0,
      total_kerugian: 0, po_count: 0,
      lead_times: [], avg_lead_time: 0,
      harga_list: [], avg_harga: 0,
      pending_sj: 0, overdue_sj: 0,
      acc_rate: 0, reject_rate: 0, score: 0,
    }
  }

  // batch → diterima/acc/reject + lead time
  const poFirstBatch: Record<number, string> = {}
  for (const b of batchList) {
    if (b.status_qc !== 'selesai') continue
    if (!poFirstBatch[b.po_id] || b.tanggal_terima < poFirstBatch[b.po_id]) poFirstBatch[b.po_id] = b.tanggal_terima
    const vs = vstats[b.vendor_id]; if (!vs) continue
    vs.total_diterima += b.qty_diterima || 0
    vs.total_acc      += b.qty_acc || 0
    vs.total_reject   += b.qty_reject || 0
  }
  for (const [poId, tgl] of Object.entries(poFirstBatch)) {
    const po = poMap[parseInt(poId)]; if (!po?.tanggal_po) continue
    const days = Math.round((new Date(tgl).getTime() - new Date(po.tanggal_po).getTime()) / 86400000)
    if (days >= 0 && days < 365 && vstats[po.vendor_id]) vstats[po.vendor_id].lead_times.push(days)
  }
  for (const po of poList) { if (vstats[po.vendor_id]) vstats[po.vendor_id].po_count++ }
  for (const it of poItems) {
    if (!it.harga_satuan) continue
    const po = poMap[it.po_id]; if (!po) continue
    if (vstats[po.vendor_id]) vstats[po.vendor_id].harga_list.push(it.harga_satuan)
  }
  for (const r of onlyReject) {
    const vs = vstats[r.vendor_id]; if (!vs) continue
    vs.total_kerugian += (r.qty || 0) * (hargaMap.get(`${r.po_id}_${r.produk_id}`) ?? 0)
  }
  for (const sj of sjList) {
    const vs = vstats[sj.vendor_id]; if (!vs) continue
    if (sj.status !== 'selesai_diganti') {
      vs.pending_sj++
      if (sj.tanggal_jatuh_tempo_ganti && sj.tanggal_jatuh_tempo_ganti < todayStr) vs.overdue_sj++
    }
  }
  for (const vs of Object.values(vstats)) {
    vs.avg_lead_time = vs.lead_times.length ? vs.lead_times.reduce((a, b) => a + b, 0) / vs.lead_times.length : 0
    vs.avg_harga     = vs.harga_list.length  ? vs.harga_list.reduce((a, b) => a + b, 0)  / vs.harga_list.length  : 0
    vs.acc_rate      = vs.total_diterima > 0 ? vs.total_acc    / vs.total_diterima : 0
    vs.reject_rate   = vs.total_diterima > 0 ? vs.total_reject / vs.total_diterima : 0
  }

  const allVS = Object.values(vstats).filter(v => v.total_diterima > 0 || v.po_count > 0)
  const maxLead  = Math.max(...allVS.map(v => v.avg_lead_time), 1)
  const maxHarga = Math.max(...allVS.map(v => v.avg_harga), 1)
  const scored = allVS.map(v => ({
    ...v,
    score: Math.max(0, (
      v.acc_rate * 40 +
      (1 - v.reject_rate) * 30 +
      (v.avg_lead_time > 0 ? (1 - v.avg_lead_time / maxLead) : 0.5) * 20 +
      (v.avg_harga > 0 ? (1 - v.avg_harga / maxHarga) : 0.5) * 10 -
      Math.min(v.overdue_sj * 5, 30)
    )),
  })).sort((a, b) => b.score - a.score)

  // ── Reject per PO ──────────────────────────────────────────────────────
  const rejectPerPO = poList.map((po: any) => {
    const batches = batchList.filter((b: any) => b.po_id === po.id && b.status_qc === 'selesai')
    const td = batches.reduce((s: number, b: any) => s + (b.qty_diterima || 0), 0)
    const tr = batches.reduce((s: number, b: any) => s + (b.qty_reject || 0), 0)
    return { ...po, total_diterima: td, total_reject: tr, pct: td > 0 ? tr / td * 100 : 0 }
  }).filter((po: any) => po.total_diterima > 0).sort((a: any, b: any) => b.pct - a.pct)

  // ── Kategori per vendor ────────────────────────────────────────────────
  const kategoriPerVendor: Record<number, Record<string, { qty: number; count: number }>> = {}
  for (const r of onlyReject) {
    const key = r.kategori_nama || r.alasan_manual || 'Tanpa Kategori'
    if (!kategoriPerVendor[r.vendor_id]) kategoriPerVendor[r.vendor_id] = {}
    if (!kategoriPerVendor[r.vendor_id][key]) kategoriPerVendor[r.vendor_id][key] = { qty: 0, count: 0 }
    kategoriPerVendor[r.vendor_id][key].qty += r.qty || 0
    kategoriPerVendor[r.vendor_id][key].count++
  }

  const overdueSJ = sjList.filter((sj: any) =>
    sj.tanggal_jatuh_tempo_ganti && sj.status !== 'selesai_diganti' && sj.tanggal_jatuh_tempo_ganti < todayStr
  )
  const best = scored[0], worst = scored[scored.length - 1]

  const TabBtn = ({ k, label }: { k: typeof dsTab; label: string }) => (
    <button onClick={() => setDsTab(k)}
      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all ${dsTab === k ? 'text-violet-700 bg-violet-50' : 'text-slate-500 bg-black/[0.03]'}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {overdueSJ.length > 0 && (
        <div className="rounded-xl bg-red-50 border-2 border-red-200 px-3 py-2.5 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-600 flex-shrink-0"/>
          <p className="text-[12px] font-semibold text-red-700">{overdueSJ.length} SJ Retur lewat tempo — vendor belum kirim pengganti</p>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
        <TabBtn k="overview"  label="Overview" />
        <TabBtn k="reject"    label="Reject per PO" />
        <TabBtn k="kategori"  label="Kategori Reject" />
        <TabBtn k="harga"     label="Histori Harga" />
      </div>

      {/* ── Overview ── */}
      {dsTab === 'overview' && (
        <div className="space-y-4">
          {scored.length === 0 ? <Empty text="Belum ada data transaksi" icon={BarChart2}/> : (<>
            {/* Best / Worst */}
            <div className="grid grid-cols-2 gap-2">
              {best && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                  <p className="text-[10px] font-semibold text-green-600 mb-1">🏆 Vendor Terbaik</p>
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{best.nama}</p>
                  <p className="text-[12px] font-semibold text-green-700 mt-1">Score {best.score.toFixed(0)}/100</p>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] text-slate-500">ACC {(best.acc_rate * 100).toFixed(1)}%</p>
                    {best.avg_harga > 0 && <p className="text-[10px] text-slate-500">Avg harga {fmtRp(best.avg_harga)}</p>}
                    {best.avg_lead_time > 0 && <p className="text-[10px] text-slate-500">Lead time {best.avg_lead_time.toFixed(1)} hari</p>}
                  </div>
                </div>
              )}
              {worst && worst.id !== best?.id && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-[10px] font-semibold text-red-600 mb-1">Perlu Evaluasi</p>
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{worst.nama}</p>
                  <p className="text-[12px] font-semibold text-red-700 mt-1">Score {worst.score.toFixed(0)}/100</p>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] text-slate-500">Reject {(worst.reject_rate * 100).toFixed(1)}%</p>
                    {worst.avg_lead_time > 0 && <p className="text-[10px] text-slate-500">Lead time {worst.avg_lead_time.toFixed(1)} hari</p>}
                    {worst.overdue_sj > 0 && <p className="text-[10px] text-red-500">{worst.overdue_sj} SJ overdue</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Ranking table */}
            <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-[12px] font-semibold text-slate-700">Ranking Performa Vendor</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Skor: ACC 40% + reject rate 30% + lead time 20% + harga 10%</p>
              </div>
              <div className="divide-y divide-slate-100">
                {scored.map((v, i) => (
                  <div key={v.id} className="px-4 py-3 grid grid-cols-[24px_1fr_auto] gap-2 items-center">
                    <span className={`text-[11px] font-semibold ${i === 0 ? 'text-green-600' : i === scored.length - 1 ? 'text-red-500' : 'text-slate-400'}`}>
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{v.nama}</p>
                      <div className="flex flex-wrap gap-x-2 mt-0.5">
                        <span className="text-[10px] text-green-600">ACC {(v.acc_rate * 100).toFixed(1)}%</span>
                        <span className="text-[10px] text-red-500">Reject {(v.reject_rate * 100).toFixed(1)}%</span>
                        {v.avg_lead_time > 0 && <span className="text-[10px] text-blue-500">{v.avg_lead_time.toFixed(0)} hr lead</span>}
                        {v.overdue_sj > 0 && <span className="text-[10px] text-red-400">{v.overdue_sj} SJ OD</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[13px] font-semibold ${i === 0 ? 'text-green-600' : i === scored.length - 1 ? 'text-red-500' : 'text-slate-700'}`}>
                        {v.score.toFixed(0)}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-0.5">/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-vendor KPI cards */}
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-slate-400 px-1">Detail per Vendor</p>
              {scored.map(v => (
                <div key={v.id} className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-800">{v.nama}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium text-slate-400">Total Diterima</p>
                      <p className="text-[13px] font-semibold text-slate-700">{fmtNum(v.total_diterima)} pcs</p>
                      <p className="text-[10px] text-slate-400">{v.po_count} PO</p>
                    </div>
                    <div className="rounded-lg bg-red-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium text-slate-400">Total Reject</p>
                      <p className="text-[13px] font-semibold text-red-600">{fmtNum(v.total_reject)} pcs</p>
                      <p className="text-[10px] text-red-400">{(v.reject_rate * 100).toFixed(1)}% dari diterima</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium text-slate-400">Total Kerugian</p>
                      <p className="text-[13px] font-semibold text-amber-700">{v.total_kerugian > 0 ? fmtRp(v.total_kerugian) : '—'}</p>
                      <p className="text-[10px] text-slate-400">reject × harga</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium text-slate-400">Avg Lead Time</p>
                      <p className="text-[13px] font-semibold text-blue-700">{v.avg_lead_time > 0 ? `${v.avg_lead_time.toFixed(1)} hari` : '—'}</p>
                      <p className="text-[10px] text-slate-400">PO → terima pertama</p>
                    </div>
                  </div>
                  {v.avg_harga > 0 && (
                    <div className="rounded-lg bg-violet-50 px-2.5 py-2 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-medium text-slate-400">Avg Harga</p>
                        <p className="text-[13px] font-semibold text-violet-700">{fmtRp(v.avg_harga)}</p>
                      </div>
                      <p className="text-[10px] text-slate-400">{v.harga_list.length}× PO</p>
                    </div>
                  )}
                  {(v.pending_sj > 0 || v.overdue_sj > 0) && (
                    <div className="rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-1.5 flex justify-between">
                      <span className="text-[11px] text-orange-700">SJ pending tukar guling: <b>{v.pending_sj}</b></span>
                      {v.overdue_sj > 0 && <span className="text-[11px] text-red-600 font-semibold">{v.overdue_sj} overdue!</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* ── Reject per PO ── */}
      {dsTab === 'reject' && (
        <div className="space-y-2">
          <p className="text-[12px] text-slate-400 px-1">
            {rejectPerPO.length} PO · diurutkan dari reject % tertinggi · hijau &lt;5%, kuning 5-10%, merah &gt;10%
          </p>
          {rejectPerPO.length === 0 ? <Empty text="Belum ada QC selesai" icon={ClipboardList}/> : (
            rejectPerPO.map((po: any) => (
              <div key={po.id} className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 font-mono">{po.nomor_po}</p>
                    <p className="text-[11px] text-slate-400">{po.vendor_nama} · {fmtDate(po.tanggal_po)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[13px] font-semibold ${po.pct > 10 ? 'text-red-600' : po.pct > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                      {po.pct.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-slate-400">{fmtNum(po.total_reject)} / {fmtNum(po.total_diterima)} pcs</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${po.pct > 10 ? 'bg-red-400' : po.pct > 5 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.min(po.pct * 4, 100)}%` }}/>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Kategori Reject per Vendor ── */}
      {dsTab === 'kategori' && (
        <div className="space-y-4">
          {Object.entries(kategoriPerVendor).length === 0 ? <Empty text="Belum ada data reject" icon={Tag}/> : (
            Object.entries(kategoriPerVendor).map(([vid, kat]) => {
              const vs = vstats[parseInt(vid)]; if (!vs) return null
              const sorted = Object.entries(kat).sort((a, b) => b[1].qty - a[1].qty)
              const totalQty = sorted.reduce((s, [, v]) => s + v.qty, 0)
              return (
                <div key={vid} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <p className="text-[12px] font-semibold text-slate-700">{vs.nama}</p>
                    <p className="text-[11px] text-red-500 font-semibold">{fmtNum(totalQty)} pcs reject</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {sorted.slice(0, 8).map(([nama, agg]) => {
                      const pct = totalQty > 0 ? agg.qty / totalQty * 100 : 0
                      return (
                        <div key={nama} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-700 truncate">🏷️ {nama}</p>
                            <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] font-semibold text-orange-600">{fmtNum(agg.qty)} pcs</p>
                            <p className="text-[10px] text-slate-400">{pct.toFixed(1)}% · {agg.count}×</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Histori Harga ── */}
      {dsTab === 'harga' && (
        <HistoriHargaPanel produkList={produkList} poList={poList} poItems={poItems} vendors={vendors}/>
      )}
    </div>
  )
}

function Empty({ text, icon: Icon = Package }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 opacity-40">
      <Icon size={24} className="text-slate-400"/>
      <p className="text-[13px] text-slate-400">{text}</p>
    </div>
  )
}

function PenggantiModal({ sj, onClose, onSave }: { sj: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  // Hanya item yang masih punya sisa perlu ganti (filter penuh diganti & tidak muncul lagi)
  const availableItems = (sj.items ?? []).filter((i: any) => (i.qty_retur ?? 0) > (i.qty_diganti ?? 0))
  // selectedQty: { [sj_item_id]: qty_diterima }
  const [selectedQty, setSelectedQty] = useState<Record<number, number>>({})

  const isSelected = (id: number) => id in selectedQty
  const toggle = (it: any) => {
    setSelectedQty(p => {
      const n = { ...p }
      if (it.id in n) { delete n[it.id]; return n }
      const sisa = (it.qty_retur ?? 0) - (it.qty_diganti ?? 0)
      return { ...n, [it.id]: sisa }
    })
  }
  const setQty = (id: number, v: number) => setSelectedQty(p => ({ ...p, [id]: v }))

  const selectedList = Object.entries(selectedQty).map(([id, qty]) => ({ sj_item_id: parseInt(id), qty_diterima: qty }))
  const totalQty = selectedList.reduce((s, x) => s + x.qty_diterima, 0)
  const overQty = selectedList.some(s => {
    const it = availableItems.find((i: any) => i.id === s.sj_item_id)
    const sisa = it ? (it.qty_retur - (it.qty_diganti ?? 0)) : 0
    return s.qty_diterima > sisa
  })
  const valid = selectedList.length > 0 && selectedList.every(s => s.qty_diterima > 0) && !overQty

  return (
    <ModalShell title="Terima Barang Pengganti dari Vendor" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-blue-50 border border-blue-100 text-blue-700 mb-4">
        <p className="font-semibold">{sj.nomor_sj}</p>
        <p className="text-blue-600 mt-0.5">{sj.vendor_nama} · {availableItems.length} produk masih perlu diganti</p>
        <p className="text-blue-500 mt-0.5 text-[11px]">Bisa pilih lebih dari satu produk sekaligus. Produk yang sudah penuh diganti tidak muncul di daftar.</p>
      </div>
      {availableItems.length === 0 ? (
        <Empty text="Semua item sudah sepenuhnya diganti" icon={CheckCircle2}/>
      ) : (
        <form onSubmit={async e => {
          e.preventDefault()
          if (!valid) return
          setLoading(true)
          const fd = new FormData(e.currentTarget)
          fd.set('sj_retur_id', String(sj.id))
          fd.set('items', JSON.stringify(selectedList))
          await onSave(fd)
          setLoading(false)
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nomor Batch <span className="normal-case text-slate-400 font-normal">(kosongkan = auto)</span></label>
              <input name="nomor_batch" placeholder="auto: SJ.TBP/001/MM/YY" className={inp}/></div>
            <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Terima *</label>
              <input name="tanggal_terima" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">
              Produk yang Diterima ({selectedList.length} dipilih · {fmtNum(totalQty)} pcs)
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableItems.map((it: any) => {
                const sisa = it.qty_retur - (it.qty_diganti ?? 0)
                const checked = isSelected(it.id)
                return (
                  <div key={it.id}
                    className={`rounded-xl border transition-all ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <button type="button" onClick={() => toggle(it)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left">
                      <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${checked ? 'bg-blue-600' : 'border border-slate-300'}`}>
                        {checked && <Check size={10} className="text-white"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700">{it.produk_nama}</p>
                        <p className="text-[10px] text-slate-400">
                          {it.kategori_nama && <span className="text-red-500">🏷️ {it.kategori_nama} · </span>}
                          Sudah diganti {fmtNum(it.qty_diganti ?? 0)} · Sisa perlu ganti <b className="text-blue-600">{fmtNum(sisa)} pcs</b>
                        </p>
                      </div>
                    </button>
                    {checked && (
                      <div className="px-3 pb-2.5 flex items-center gap-2">
                        <label className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Qty diterima:</label>
                        <input type="number" min="1" max={sisa} value={selectedQty[it.id]}
                          onChange={e => setQty(it.id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-24 h-8 rounded-lg border border-blue-200 px-2 text-[13px] font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                        <span className="text-[11px] text-slate-400">/ max {fmtNum(sisa)} pcs</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
            <textarea name="catatan" rows={2} className={inp}/></div>

          {overQty && (
            <p className="text-[10px] text-red-500 px-1">Ada qty yang melebihi sisa perlu ganti</p>
          )}
          <p className="text-[10px] text-amber-700 px-1">
            ⚡ Setelah simpan, batch pengganti muncul di tab <b>Penerimaan</b> menunggu QC. Lanjutkan QC untuk masukkan ke stok.
          </p>

          <button type="submit" disabled={loading || !valid}
            className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-[13px] font-semibold text-white disabled:opacity-50">
            {loading ? 'Menyimpan...' : `Simpan Penerimaan Pengganti${totalQty > 0 ? ` (${fmtNum(totalQty)} pcs)` : ''}`}
          </button>
        </form>
      )}
    </ModalShell>
  )
}

function KategoriRejectModal({ mode, kategori, onClose, onSave }: {
  mode: string; kategori?: any; onClose: () => void; onSave: (fd: FormData) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  return (
    <ModalShell title={mode === 'create' ? 'Tambah Kategori Reject' : 'Edit Kategori Reject'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setLoading(true); await onSave(new FormData(e.currentTarget)); setLoading(false) }}
        className="space-y-3">
        <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nama Kategori *</label>
          <input name="nama" defaultValue={kategori?.nama} required placeholder="mis. Cover Baret" className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Tambah Kategori' : 'Simpan Perubahan'}
        </button>
      </form>
    </ModalShell>
  )
}

function HistoriHargaPanel({ produkList, poList, poItems, vendors }: { produkList: any[]; poList: any[]; poItems: any[]; vendors: any[] }) {
  const [produkId, setProdukId] = useState<number | null>(null)
  const poMap = Object.fromEntries(poList.map((p: any) => [p.id, p]))
  const rows = produkId
    ? poItems
        .filter((it: any) => it.produk_id === produkId && it.harga_satuan)
        .map((it: any) => ({ ...it, po: poMap[it.po_id] }))
        .filter((r: any) => r.po)
        .sort((a: any, b: any) => new Date(b.po.tanggal_po).getTime() - new Date(a.po.tanggal_po).getTime())
    : []

  // Agregat per-vendor: harga rata-rata, terakhir, min, max
  const perVendor = produkId ? Object.values(rows.reduce((acc: any, r: any) => {
    const v = r.po.vendor_id
    if (!acc[v]) acc[v] = { vendor_id: v, vendor_nama: r.po.vendor_nama, prices: [], last: null }
    acc[v].prices.push(r.harga_satuan)
    if (!acc[v].last) acc[v].last = { harga: r.harga_satuan, tanggal: r.po.tanggal_po, nomor: r.po.nomor_po }
    return acc
  }, {})) : []

  const allPrices = rows.map((r: any) => r.harga_satuan)
  const minHarga = allPrices.length ? Math.min(...allPrices) : null
  const maxHarga = allPrices.length ? Math.max(...allPrices) : null

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Pilih Produk</label>
        <select value={produkId ?? ''} onChange={e => setProdukId(parseInt(e.target.value) || null)} className={inp}>
          <option value="">— Pilih produk untuk lihat histori harga —</option>
          {produkList.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>

      {!produkId && <Empty text="Pilih produk untuk lihat perbandingan harga antar vendor" icon={DollarSign}/>}

      {produkId && rows.length === 0 && <Empty text="Belum ada harga PO untuk produk ini" icon={DollarSign}/>}

      {produkId && rows.length > 0 && (
        <>
          {/* Ringkasan per-vendor */}
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-[11px] font-medium text-slate-500 mb-2">Perbandingan Vendor</p>
            <div className="space-y-2">
              {(perVendor as any[])
                .sort((a, b) => a.last.harga - b.last.harga)
                .map((v: any) => {
                  const avg = v.prices.reduce((s: number, p: number) => s + p, 0) / v.prices.length
                  const isMin = v.last.harga === minHarga
                  const isMax = v.last.harga === maxHarga
                  return (
                    <div key={v.vendor_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200 last:border-0">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{v.vendor_nama}</p>
                        <p className="text-[10px] text-slate-400">{v.prices.length}× PO · rata2 {fmtRp(avg)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[13px] font-semibold ${isMin ? 'text-green-600' : isMax ? 'text-red-500' : 'text-slate-700'}`}>
                          {fmtRp(v.last.harga)}
                          {isMin && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Termurah</span>}
                          {isMax && !isMin && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Termahal</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">{fmtDate(v.last.tanggal)}</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Timeline semua PO */}
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-2 px-1">Timeline Harga</p>
            <div className="space-y-1.5">
              {rows.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700">{r.po.vendor_nama}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.po.nomor_po} · {fmtDate(r.po.tanggal_po)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-violet-700">{fmtRp(r.harga_satuan)}</p>
                    <p className="text-[10px] text-slate-400">{fmtNum(r.qty_po)} pcs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
