'use client'

import { useState, useRef } from 'react'
import {
  Plus, X, Check, Edit2, Trash2, ChevronDown, ChevronUp,
  Package2, Truck, ClipboardCheck, AlertTriangle, RotateCcw,
  FileText, Printer, Building2, Search, Eye,
  ArrowRight, CheckCircle2, XCircle, Clock, BoxSelect,
} from 'lucide-react'
import {
  createVendor, updateVendor,
  createProdukPackaging, updateProdukPackaging, toggleProdukAktif,
  createKategoriReject, updateKategoriReject, toggleKategoriRejectAktif, deleteKategoriReject,
  createPO, updatePO, voidPO, deletePO,
  createBatchPenerimaan, createBatchPengganti, submitQC, deleteBatch, editQCResult,
  deleteRejectItem, resetRejectStatus, createSJRetur,
} from '@/app/(dashboard)/po-vendor-packaging/actions'

const fmtRp = (n: number | null | undefined) => {
  if (!n) return '—'
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

const fmtNum = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Tab = 'monitoring' | 'po' | 'batch' | 'reject' | 'dashboard' | 'stok' | 'vendor' | 'master'

interface Props {
  vendors: any[]
  produkList: any[]
  kategoriRejectList: any[]
  poList: any[]
  poItems: any[]
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:             { label: 'Open',             cls: 'bg-blue-50 text-blue-600' },
    menunggu:         { label: 'Menunggu',         cls: 'bg-blue-50 text-blue-600' },
    partial:          { label: 'Partial',          cls: 'bg-amber-50 text-amber-600' },
    selesai:          { label: 'Selesai',          cls: 'bg-green-50 text-green-700' },
    void:             { label: 'Void',             cls: 'bg-red-50 text-red-500' },
    pending_qc:       { label: 'Pending QC',       cls: 'bg-orange-50 text-orange-600' },
    pending:          { label: 'Pending',          cls: 'bg-gray-50 text-gray-500' },
    diretur:          { label: 'Diretur',          cls: 'bg-orange-50 text-orange-600' },
    menunggu_ganti:   { label: 'Menunggu Ganti',   cls: 'bg-amber-50 text-amber-700' },
    sebagian_diganti: { label: 'Sebagian Diganti', cls: 'bg-blue-50 text-blue-600' },
    selesai_diganti:  { label: 'Selesai Diganti',  cls: 'bg-green-50 text-green-700' },
    overdue:          { label: 'Lewat Tempo',      cls: 'bg-red-50 text-red-600' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
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
    <div className="rounded-2xl overflow-hidden border border-slate-200">
      <button className="w-full flex items-start justify-between px-4 py-3.5 text-left gap-3 bg-white"
        onClick={() => setOpen(p => !p)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-bold text-violet-700">{po.nomor_po}</span>
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
              <div key={it.item_id} className="rounded-xl bg-white border border-slate-100 px-3 py-2.5">
                <p className="text-[12px] font-bold text-slate-700">{it.produk_nama}</p>
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
                      <span className="font-bold">{val}</span> <span className="text-slate-400">{label}</span>
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
          className="flex-1 py-1.5 text-[10px] font-bold rounded-lg bg-violet-600 text-white">Simpan TTD</button>
      </div>
    </div>
  )
}

const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

export default function POVendorClient({
  vendors, produkList, kategoriRejectList, poList, poItems, batchList, rejectList, sjList, stokList, monitoring, canManage,
}: Props) {
  const { toast, show: showToast } = useToast()
  const [tab, setTab] = useState<Tab>('monitoring')
  const [search, setSearch] = useState('')

  const [vendorModal, setVendorModal] = useState<'create' | number | null>(null)
  const [produkModal, setProdukModal] = useState<'create' | number | null>(null)
  const [poModal, setPoModal]         = useState<'create' | number | null>(null)
  const [editPoId, setEditPoId]       = useState<number | null>(null)
  const [batchModal, setBatchModal]   = useState<number | null>(null)  // po_id
  const [qcModal, setQcModal]         = useState<any | null>(null)
  const [editQcModal, setEditQcModal] = useState<any | null>(null)
  const [sjModal, setSjModal]         = useState<number | null>(null)
  const [voidPoId, setVoidPoId]       = useState<number | null>(null)
  const [expandedPO, setExpandedPO]   = useState<number | null>(null)
  const [masterSubtab, setMasterSubtab] = useState<'produk' | 'kategori_reject' | 'histori_harga'>('produk')
  const [kategoriRejectModal, setKategoriRejectModal] = useState<'create' | number | null>(null)
  const [penggantiModal, setPenggantiModal] = useState<any | null>(null)

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'monitoring', label: 'Monitoring',       icon: Eye },
    { key: 'po',         label: 'PO',               icon: FileText },
    { key: 'batch',      label: 'Penerimaan',       icon: Truck },
    { key: 'reject',     label: 'Reject',           icon: AlertTriangle },
    { key: 'dashboard',  label: 'Dashboard Reject', icon: BoxSelect },
    { key: 'stok',       label: 'Stok',             icon: Package2 },
    { key: 'master',     label: 'Master',           icon: BoxSelect },
    { key: 'vendor',     label: 'Vendor',           icon: Building2 },
  ]

  const pendingReject = rejectList.filter((r: any) => r.status_penanganan === 'pending').length
  const monGrouped    = groupMonitoring(monitoring)

  return (
    <div className="space-y-4 pb-20">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-2xl text-[13px] font-semibold shadow-xl flex items-center gap-2 ${toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
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
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl bg-violet-600 hover:bg-violet-700">
              <Plus size={13}/> Buat PO
            </button>
          )}
          {canManage && tab === 'vendor' && (
            <button onClick={() => setVendorModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl bg-violet-600 hover:bg-violet-700">
              <Plus size={13}/> Tambah Vendor
            </button>
          )}
          {canManage && tab === 'master' && masterSubtab === 'produk' && (
            <button onClick={() => setProdukModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl bg-emerald-600 hover:bg-emerald-700">
              <Plus size={13}/> Tambah Produk
            </button>
          )}
          {canManage && tab === 'master' && masterSubtab === 'kategori_reject' && (
            <button onClick={() => setKategoriRejectModal('create')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl bg-emerald-600 hover:bg-emerald-700">
              <Plus size={13}/> Tambah Kategori
            </button>
          )}
          {canManage && tab === 'reject' && (
            <button onClick={() => setSjModal(-1)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white rounded-2xl bg-orange-500 hover:bg-orange-600">
              <Printer size={13}/> Buat SJ Retur
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${tab === key ? 'text-violet-700 bg-violet-50' : 'text-slate-500 bg-black/[0.03]'}`}>
            <Icon size={12}/>
            {label}
            {key === 'reject' && pendingReject > 0 && (
              <span className="min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-black">
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
                <div key={po.id} className="rounded-2xl overflow-hidden border border-slate-200">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
                    <button className="flex-1 text-left" onClick={() => setExpandedPO(isOpen ? null : po.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-mono font-bold text-violet-700">{po.nomor_po}</span>
                        <StatusBadge status={po.status} />
                        {hasHarga && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
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
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100">
                            <Truck size={11}/> Terima
                          </button>
                          <button onClick={() => { setEditPoId(po.id); setPoModal(po.id) }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100">
                            <Edit2 size={11}/> Edit
                          </button>
                          <button onClick={async () => {
                            const label = batches.length > 0
                              ? `PO ini sudah ada ${batches.length} batch penerimaan. Semua data batch & reject terkait akan IKUT TERHAPUS.\n\nYakin hapus permanen?`
                              : `Hapus PO ${po.nomor_po} permanen? Tidak bisa dibatalkan.`
                            if (!confirm(label)) return
                            const r = await deletePO(po.id)
                            if (r?.error) showToast(r.error, false)
                            else showToast('✅ PO dihapus')
                          }} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100">
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
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Rincian Harga</p>
                          {items.map((it: any) => (
                            <div key={it.id} className="flex justify-between gap-2 text-[11px] py-0.5">
                              <span className="text-slate-600">{it.produk_nama}</span>
                              <span className="text-slate-700 font-mono">
                                {fmtNum(it.qty_po)} × {fmtRp(it.harga_satuan)} = <b className="text-emerald-700">{fmtRp((it.qty_po || 0) * (it.harga_satuan || 0))}</b>
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between gap-2 mt-1.5 pt-1.5 border-t border-emerald-100 text-[12px]">
                            <span className="font-bold text-slate-700">Total Nilai PO</span>
                            <span className="font-black text-emerald-700">{fmtRp(totalNilai)}</span>
                          </div>
                        </div>
                      )}
                      {batches.length === 0 ? (
                        <p className="text-[12px] text-slate-400 py-2">Belum ada batch penerimaan</p>
                      ) : (
                        <div className="space-y-2">
                          {batches.map((b: any) => (
                            <div key={b.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 bg-white border border-slate-100">
                              <div>
                                <p className="text-[12px] font-mono font-bold text-slate-700">{b.nomor_batch}</p>
                                <p className="text-[10px] text-slate-400">
                                  {b.produk_nama} · {fmtDate(b.tanggal_terima)} · {fmtNum(b.qty_diterima)} pcs
                                  {b.status_qc === 'selesai' ? ` · ✅ ACC ${fmtNum(b.qty_acc ?? 0)} / Reject ${fmtNum(b.qty_reject ?? 0)}` : ' · ⏳ Pending QC'}
                                </p>
                              </div>
                              {canManage && b.status_qc === 'pending' && (
                                <button onClick={() => setQcModal(b)}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white rounded-lg bg-green-500 hover:bg-green-600">
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
              <div key={b.id} className="rounded-2xl px-4 py-3 bg-white border border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono font-bold text-slate-700">{b.nomor_batch}</span>
                      <StatusBadge status={b.status_qc === 'selesai' ? 'selesai' : 'pending_qc'} />
                      {b.is_pengganti && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          🔄 Pengganti (siklus {b.siklus_ke})
                        </span>
                      )}
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
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {b.status_qc === 'pending' && (
                        <button onClick={() => setQcModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-white rounded-lg bg-green-500 hover:bg-green-600">
                          <ClipboardCheck size={11}/> Input QC
                        </button>
                      )}
                      {b.status_qc === 'selesai' && (
                        <button onClick={() => setEditQcModal(b)}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-violet-600 rounded-lg bg-violet-50 hover:bg-violet-100">
                          <Edit2 size={11}/> Edit QC
                        </button>
                      )}
                      <button onClick={async () => {
                        if (!confirm(`Hapus batch ${b.nomor_batch}? ${b.status_qc === 'selesai' ? 'Stok ACC akan dikurangi kembali.' : ''}`)) return
                        const r = await deleteBatch(b.id)
                        if (r?.error) showToast(r.error, false)
                        else showToast('✅ Batch dihapus')
                      }} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-red-500 rounded-lg bg-red-50 hover:bg-red-100">
                        <Trash2 size={11}/> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          {batchList.length === 0 && <Empty text="Belum ada penerimaan" />}
        </div>
      )}

      {/* ── Tab: DASHBOARD REJECT ─────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <DashboardRejectPanel
          rejectList={rejectList}
          sjList={sjList}
          poItems={poItems}
          batchList={batchList}
        />
      )}

      {/* ── Tab: REJECT ────────────────────────────────────────────────────── */}
      {tab === 'reject' && (
        <div className="space-y-2">
          {rejectList
            .filter((r: any) => !search || r.po_nomor.toLowerCase().includes(search.toLowerCase()) || r.vendor_nama.toLowerCase().includes(search.toLowerCase()))
            .map((r: any) => (
              <div key={r.id} className="rounded-2xl px-4 py-3 bg-white border border-slate-200">
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
                    {(r.kategori_nama || r.alasan_manual) && (
                      <p className="text-[10px] mt-0.5">
                        {r.kategori_nama && <span className="font-bold text-red-600">🏷️ {r.kategori_nama}</span>}
                        {r.kategori_nama && r.alasan_manual && <span className="text-slate-400"> · </span>}
                        {r.alasan_manual && <span className="text-slate-600">{r.alasan_manual}</span>}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.status_penanganan !== 'pending' && (
                        <button onClick={async () => {
                          if (!confirm('Reset status ke pending? SJ Retur terkait juga akan dibatalkan.')) return
                          const res = await resetRejectStatus(r.id)
                          if (res?.error) showToast(res.error, false)
                          else showToast('✅ Status direset ke pending')
                        }} className="px-2 py-1 text-[10px] font-bold text-amber-600 rounded-lg bg-amber-50 hover:bg-amber-100">
                          Reset
                        </button>
                      )}
                      <button onClick={async () => {
                        if (!confirm(`Hapus item reject ini (${r.qty} pcs)? Tidak bisa dibatalkan.`)) return
                        const res = await deleteRejectItem(r.id)
                        if (res?.error) showToast(res.error, false)
                        else showToast('✅ Item reject dihapus')
                      }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 size={12}/>
                      </button>
                    </div>
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
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Stok Packaging</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stokList.map((s: any) => (
              <div key={s.id} className="rounded-2xl px-4 py-3.5 text-center bg-white border border-slate-200">
                <p className="text-[20px] font-black text-slate-800">{fmtNum(s.stok_qty)}</p>
                <p className="text-[12px] font-bold text-slate-500 mt-0.5">pcs</p>
                <div className="w-6 h-0.5 rounded-full mx-auto my-2" style={{ background: s.stok_qty > 0 ? '#7C3AED' : '#e2e8f0' }}/>
                <p className="text-[11px] font-semibold text-slate-600">{s.produk_nama}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mt-4">Riwayat SJ Retur</p>
          {sjList.length === 0 ? (
            <Empty text="Belum ada surat jalan retur" />
          ) : (
            <div className="space-y-2">
              {sjList.map((sj: any) => {
                const totalRetur  = sj.total_qty ?? 0
                const totalGanti  = sj.total_qty_diganti ?? 0
                const progress    = totalRetur > 0 ? (totalGanti / totalRetur) * 100 : 0
                const overdue     = sj.status === 'menunggu_ganti' && sj.tanggal_jatuh_tempo_ganti && new Date(sj.tanggal_jatuh_tempo_ganti) < new Date()
                const displayStatus = overdue ? 'overdue' : (sj.status || 'menunggu_ganti')
                return (
                <div key={sj.id} className="rounded-2xl px-4 py-3 bg-white border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-mono font-bold text-orange-600">{sj.nomor_sj}</p>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{sj.vendor_nama} · Dikirim {fmtDate(sj.tanggal_retur)}</p>
                      {sj.tanggal_jatuh_tempo_ganti && (
                        <p className={`text-[10px] ${overdue ? 'font-bold text-red-600' : 'text-amber-600'}`}>
                          ⏰ Jatuh tempo ganti: {fmtDate(sj.tanggal_jatuh_tempo_ganti)}
                          {overdue && ' · LEWAT TEMPO'}
                        </p>
                      )}
                      {/* Detail produk */}
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
                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-slate-500">{fmtNum(totalGanti)} / {fmtNum(totalRetur)} pcs diganti</span>
                          <span className="text-[10px] font-bold text-orange-600">{progress.toFixed(0)}%</span>
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
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold text-blue-600 rounded-xl bg-blue-50 hover:bg-blue-100">
                          <Truck size={11}/> Terima Pengganti
                        </button>
                      )}
                      <a href={`/po-vendor-packaging/sj-retur/${sj.id}`} target="_blank"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold text-orange-600 rounded-xl bg-orange-50 hover:bg-orange-100">
                        <Printer size={11}/> Cetak
                      </a>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
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
              { key: 'histori_harga',   label: 'Histori Harga' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setMasterSubtab(key as any)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${masterSubtab === key ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-black/[0.03]'}`}>
                {label}
              </button>
            ))}
          </div>

          {masterSubtab === 'produk' && (
            <div className="space-y-2">
              <p className="text-[12px] text-slate-400 px-1">Daftar produk packaging yang bisa dipilih saat buat PO</p>
              {produkList.map((p: any) => (
                <div key={p.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
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
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${p.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
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
                <Empty text="Belum ada kategori reject — klik Tambah Kategori" icon="🏷️"/>
              ) : kategoriRejectList.map((k: any) => (
                <div key={k.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-slate-800">{k.nama}</p>
                      <span className="text-[10px] font-mono text-slate-400">{k.kode}</span>
                      {!k.aktif && <span className="text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
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
                        else showToast(k.aktif ? 'Kategori dinonaktifkan' : '✅ Kategori diaktifkan')
                      }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${k.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Hapus kategori "${k.nama}"?`)) return
                        const r = await deleteKategoriReject(k.id)
                        if (r?.error) showToast(r.error, false)
                        else showToast('Kategori dihapus')
                      }}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {masterSubtab === 'histori_harga' && (
            <HistoriHargaPanel produkList={produkList} poList={poList} poItems={poItems} vendors={vendors}/>
          )}
        </div>
      )}

      {/* ── Tab: VENDOR ────────────────────────────────────────────────────── */}
      {tab === 'vendor' && (
        <div className="space-y-2">
          {vendors.map((v: any) => (
            <div key={v.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
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
            showToast(produkModal === 'create' ? '✅ Produk ditambahkan' : '✅ Produk diperbarui')
            setProdukModal(null)
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
            showToast('✅ Batch pengganti dibuat — silakan QC di tab Penerimaan')
            setPenggantiModal(null)
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
            showToast(kategoriRejectModal === 'create' ? '✅ Kategori ditambahkan' : '✅ Kategori diperbarui')
            setKategoriRejectModal(null)
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
            showToast(vendorModal === 'create' ? '✅ Vendor ditambahkan' : '✅ Vendor diperbarui')
            setVendorModal(null)
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
            showToast(poModal === 'create' ? `✅ PO dibuat: ${(r as any).nomorPO}` : '✅ PO diperbarui')
            setPoModal(null); setEditPoId(null)
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
            const msg = `✅ Batch ${(r as any).nomor} dibuat` + ((r as any).qtyLebih > 0 ? ` · Lebihan: ${(r as any).qtyLebih} pcs` : '')
            showToast(msg)
            setBatchModal(null)
          }}
        />
      )}

      {qcModal !== null && (
        <QCModal
          batch={qcModal}
          kategoriList={kategoriRejectList}
          onClose={() => setQcModal(null)}
          onSave={async (fd) => {
            const r = await submitQC(fd)
            if (r?.error) { showToast(r.error, false); return }
            showToast('✅ QC selesai — stok diperbarui')
            setQcModal(null)
          }}
        />
      )}

      {editQcModal !== null && (
        <EditQCModal
          batch={editQcModal}
          onClose={() => setEditQcModal(null)}
          onSave={async (newAcc, newReject, catatan) => {
            const r = await editQCResult(editQcModal.id, newAcc, newReject, catatan)
            if (r?.error) { showToast(r.error, false); return }
            showToast('✅ Hasil QC diperbarui — stok disesuaikan')
            setEditQcModal(null)
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
            showToast(`✅ SJ Retur ${(r as any).nomor} dibuat`)
            setSjModal(null)
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
            showToast('✅ PO divoid')
            setVoidPoId(null)
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
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
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Produk *</label>
          <input name="nama" defaultValue={produk?.nama} required placeholder="mis. Akrilik 2x3cm" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Satuan</label>
          <select name="satuan" defaultValue={produk?.satuan ?? 'pcs'} className={inp}>
            <option value="pcs">pcs</option><option value="set">set</option>
            <option value="lusin">lusin</option><option value="box">box</option><option value="meter">meter</option>
          </select></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan</label>
          <textarea name="keterangan" defaultValue={produk?.keterangan} rows={2} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
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
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
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
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nomor PO (kosongkan = auto)</label>
            <input name="nomor_po" placeholder="PO/2406/0001" className={inp}/></div>
        )}
        {mode === 'edit' && (
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nomor PO *</label>
            <input name="nomor_po" defaultValue={po?.nomor_po} required className={inp}/></div>
        )}

        {/* Vendor */}
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor *</label>
          <select name="vendor_id" value={vendorId || ''} onChange={e => setVendorId(parseInt(e.target.value) || 0)} required className={inp}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
        </div>

        {/* Tanggal */}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal PO *</label>
            <input name="tanggal_po" type="date" defaultValue={po?.tanggal_po} required className={inp}/></div>
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jatuh Tempo</label>
            <input name="tanggal_jatuh_tempo" type="date" defaultValue={po?.tanggal_jatuh_tempo} className={inp}/></div>
        </div>

        {/* Item Rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Produk *</label>
            <button type="button" onClick={addItem}
              className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-700">
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
                    <span className="text-[11px] font-bold text-slate-500">Produk {idx + 1}</span>
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
              <span className="text-[12px] font-bold text-emerald-700">Total Nilai PO</span>
              <span className="text-[14px] font-black text-emerald-700">{fmtRp(totalNilai)}</span>
            </div>
          )}
        </div>

        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
          <textarea name="catatan" defaultValue={po?.catatan} rows={2} className={inp}/></div>

        <button type="submit" disabled={loading || !valid}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Buat PO' : 'Simpan Perubahan'}
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
  const [loading, setLoading]       = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<number>(poItemsForPO[0]?.id ?? 0)

  const selectedItem = poItemsForPO.find(i => i.id === selectedItemId)
  const sisaPO = selectedItem ? Math.max(0, selectedItem.qty_po - selectedItem.qty_diterima) : 0

  return (
    <ModalShell title="Input Penerimaan Barang" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700 mb-4">
        <p className="font-bold">{po.nomor_po}</p>
        <p className="text-violet-600 mt-0.5">{po.vendor_nama} · {poItemsForPO.length} produk</p>
      </div>
      <form onSubmit={async e => {
        e.preventDefault()
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('po_id', String(po.id))
        fd.set('po_item_id', String(selectedItemId))
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        {/* Item picker */}
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Produk yang Diterima *</label>
          <select value={selectedItemId} onChange={e => setSelectedItemId(parseInt(e.target.value))} className={inp} required>
            {poItemsForPO.map((it: any) => (
              <option key={it.id} value={it.id}>
                {it.produk_nama} · PO {fmtNum(it.qty_po)} pcs · Sisa {fmtNum(Math.max(0, it.qty_po - it.qty_diterima))} pcs
              </option>
            ))}
          </select>
          {selectedItem && (
            <p className="text-[11px] text-slate-500 mt-1">
              Sudah diterima: <b>{fmtNum(selectedItem.qty_diterima)} pcs</b> · Sisa PO: <b>{fmtNum(sisaPO)} pcs</b>
              {sisaPO === 0 && <span className="text-green-600 font-bold"> · ✅ Sudah terpenuhi (input = kelebihan)</span>}
            </p>
          )}
        </div>

        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nomor Batch <span className="normal-case text-slate-400 font-normal">(kosongkan = auto)</span></label>
          <input name="nomor_batch" placeholder="mis. BTH-001 / 250622-A" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Terima *</label>
          <input name="tanggal_terima" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty Diterima (pcs) *</label>
          <input name="qty_diterima" type="number" min="1" required className={inp}
            placeholder={`sisa PO: ${sisaPO} pcs`}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
          <textarea name="catatan" rows={2} className={inp}/></div>
        <button type="submit" disabled={loading || !selectedItemId}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Penerimaan'}
        </button>
      </form>
    </ModalShell>
  )
}

interface RejectRow { qty: number; kategori_id: number | null; alasan_manual: string; catatan: string }

function QCModal({ batch, kategoriList, onClose, onSave }: { batch: any; kategoriList: any[]; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading]         = useState(false)
  const [qtyAcc, setQtyAcc]           = useState(0)
  const [rejectRows, setRejectRows]   = useState<RejectRow[]>([])
  const [ttdOp, setTtdOp]             = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin]       = useState<string | null>(null)
  const [showTtd, setShowTtd]         = useState(false)

  const maxCheck  = batch.qty_diterima - (batch.qty_lebih ?? 0)
  const qtyReject = rejectRows.reduce((s, r) => s + (r.qty || 0), 0)
  const total     = qtyAcc + qtyReject
  const ok        = total === maxCheck
  const rejectValid = rejectRows.every(r => r.qty > 0 && (r.kategori_id !== null || r.alasan_manual.trim().length > 0))

  const addRow = () => setRejectRows(p => [...p, { qty: 0, kategori_id: null, alasan_manual: '', catatan: '' }])
  const rmRow  = (idx: number) => setRejectRows(p => p.filter((_, i) => i !== idx))
  const updRow = (idx: number, patch: Partial<RejectRow>) =>
    setRejectRows(p => p.map((r, i) => i === idx ? { ...r, ...patch } : r))

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
        if (!ok) return
        if (!rejectValid) return
        setLoading(true)
        const fd = new FormData(e.currentTarget)
        fd.set('batch_id', String(batch.id))
        fd.set('qty_acc', String(qtyAcc))
        fd.set('reject_items', JSON.stringify(rejectRows))
        if (ttdOp)    fd.set('ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('ttd_admin', ttdAdmin)
        await onSave(fd)
        setLoading(false)
      }} className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal QC *</label>
          <input name="qc_tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty ACC (Lolos QC) *</label>
          <input type="number" min="0" max={maxCheck} value={qtyAcc} onChange={e => setQtyAcc(parseInt(e.target.value) || 0)} className={inp}/></div>

        {/* Reject Items multi-row */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Reject Items ({fmtNum(qtyReject)} pcs)</label>
            <button type="button" onClick={addRow}
              className="text-[10px] font-bold text-violet-600 flex items-center gap-1">
              <Plus size={12}/> Tambah
            </button>
          </div>
          {rejectRows.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
              Tidak ada reject — klik "Tambah" jika ada barang reject
            </p>
          ) : (
            <div className="space-y-2">
              {rejectRows.map((r, idx) => (
                <div key={idx} className="rounded-xl border border-red-200 bg-red-50/50 p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <input type="number" min="1" placeholder="Qty" value={r.qty || ''}
                      onChange={e => updRow(idx, { qty: parseInt(e.target.value) || 0 })}
                      className="w-20 h-8 rounded-lg border border-red-200 px-2 text-[12px] font-bold text-red-700 bg-white"/>
                    <select value={r.kategori_id ?? ''}
                      onChange={e => updRow(idx, { kategori_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="flex-1 h-8 rounded-lg border border-red-200 px-2 text-[12px] bg-white">
                      <option value="">— Pilih Kategori —</option>
                      {kategoriList.map((k: any) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => rmRow(idx)}
                      className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                  <input type="text" placeholder="Alasan manual (jika tidak ada di kategori)"
                    value={r.alasan_manual} onChange={e => updRow(idx, { alasan_manual: e.target.value })}
                    className="w-full h-7 rounded-lg border border-red-200 px-2 text-[11px] bg-white"/>
                  <input type="text" placeholder="Catatan tambahan (opsional)"
                    value={r.catatan} onChange={e => updRow(idx, { catatan: e.target.value })}
                    className="w-full h-7 rounded-lg border border-red-100 px-2 text-[11px] bg-white"/>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-xl px-3 py-2 text-[12px] font-semibold flex items-center gap-2 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {ok ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
          {ok ? `✅ Total sesuai (${maxCheck} pcs)` : `Total ACC+Reject = ${total} ≠ ${maxCheck}`}
        </div>
        {!rejectValid && rejectRows.length > 0 && (
          <div className="rounded-xl px-3 py-2 text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
            ⚠️ Setiap reject harus punya qty &gt; 0 dan kategori (atau alasan manual)
          </div>
        )}
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Operator QC</label>
          <input name="operator_nama" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Admin/Manager</label>
          <input name="admin_nama" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan QC</label>
          <textarea name="catatan_qc" rows={2} className={inp}/></div>
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
        <button type="submit" disabled={loading || !ok || !rejectValid}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Hasil QC'}
        </button>
      </form>
    </ModalShell>
  )
}

function SJReturModal({ vendors, rejectList, onClose, onSave }: { vendors: any[]; rejectList: any[]; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [vendorId, setVendorId] = useState<number | null>(null)
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
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vendor *</label>
          <select value={vendorId ?? ''} onChange={e => { setVendorId(parseInt(e.target.value) || null); setSelectedQty({}) }} className={inp}>
            <option value="">— Pilih Vendor —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.nama}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tgl Retur *</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp}/></div>
          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jatuh Tempo Ganti</label>
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
                  className="text-[10px] font-bold text-violet-600">Pilih Semua</button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vendorRejects.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2 text-center">Tidak ada reject pending dari vendor ini</p>
              ) : vendorRejects.map((r: any) => (
                <div key={r.id}
                  className={`rounded-xl border transition-all ${isSelected(r.id) ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                  <button type="button" onClick={() => toggle(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left">
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${isSelected(r.id) ? 'bg-violet-600' : 'border border-gray-300'}`}>
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
                        className="w-24 h-8 rounded-lg border border-violet-200 px-2 text-[13px] font-bold text-violet-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                      <span className="text-[11px] text-slate-400">/ {fmtNum(r.qty)} pcs</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan SJ</label>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} className={inp}/></div>

        <button onClick={async () => {
          if (!vendorId || !hasItems) return
          setLoading(true)
          const fd = new FormData()
          fd.set('vendor_id', String(vendorId))
          fd.set('tanggal_retur', tanggal)
          if (tglJatuhTempo) fd.set('tanggal_jatuh_tempo_ganti', tglJatuhTempo)
          fd.set('items', JSON.stringify(selectedItems))
          fd.set('catatan', catatan)
          await onSave(fd)
          setLoading(false)
        }} disabled={loading || !vendorId || !hasItems}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
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
          <p className="font-semibold">⚠️ PO akan divoid dan tidak bisa diaktifkan kembali</p>
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alasan Void *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required className={inp}/></div>
        <button onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false) }}
          disabled={loading || !reason.trim()}
          className="w-full h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-bold text-white disabled:opacity-50">
          {loading ? 'Memproses...' : 'Void PO'}
        </button>
      </div>
    </ModalShell>
  )
}

function EditQCModal({ batch, onClose, onSave }: {
  batch: any
  onClose: () => void
  onSave: (acc: number, reject: number, catatan: string) => Promise<void>
}) {
  const maxCheck = batch.qty_diterima - (batch.qty_lebih ?? 0)
  const [qtyAcc, setQtyAcc]       = useState<number>(batch.qty_acc ?? 0)
  const [qtyReject, setQtyReject] = useState<number>(batch.qty_reject ?? 0)
  const [catatan, setCatatan]     = useState<string>(batch.catatan_qc ?? '')
  const [loading, setLoading]     = useState(false)

  const total = qtyAcc + qtyReject
  const ok    = total === maxCheck

  return (
    <ModalShell title="Edit Hasil QC" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-amber-50 border border-amber-100 text-amber-700 mb-4">
        <p className="font-bold">{batch.nomor_batch} · {batch.produk_nama}</p>
        <p className="mt-0.5">Diterima: <b>{batch.qty_diterima} pcs</b> · QC: <b>{maxCheck} pcs</b>
          {(batch.qty_lebih ?? 0) > 0 && <> · Lebihan: <b>{batch.qty_lebih} pcs</b></>}
        </p>
        <p className="mt-0.5 text-amber-600">⚠️ Stok akan disesuaikan otomatis dengan selisih ACC baru vs lama.</p>
      </div>
      <div className="space-y-3">
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty ACC (Lolos QC) *</label>
          <input type="number" min="0" max={maxCheck} value={qtyAcc}
            onChange={e => setQtyAcc(parseInt(e.target.value) || 0)} className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty Reject *</label>
          <input type="number" min="0" max={maxCheck} value={qtyReject}
            onChange={e => setQtyReject(parseInt(e.target.value) || 0)} className={inp}/></div>
        <div className={`rounded-xl px-3 py-2 text-[12px] font-semibold flex items-center gap-2 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {ok ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
          {ok ? `✅ Total sesuai (${maxCheck} pcs)` : `Total ${total} ≠ ${maxCheck}`}
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan QC</label>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} className={inp}/></div>
        <button onClick={async () => {
          if (!ok) return
          setLoading(true)
          await onSave(qtyAcc, qtyReject, catatan)
          setLoading(false)
        }} disabled={loading || !ok}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </ModalShell>
  )
}

function DashboardRejectPanel({ rejectList, sjList, poItems, batchList }: {
  rejectList: any[]; sjList: any[]; poItems: any[]; batchList: any[]
}) {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStr = now.toISOString().split('T')[0]

  // Hanya reject (bukan lebihan)
  const onlyReject = rejectList.filter((r: any) => r.jenis !== 'lebihan')

  // Lookup harga: po_id + produk_id → harga_satuan
  const hargaMap = new Map<string, number>()
  for (const it of poItems) {
    if (it.harga_satuan) hargaMap.set(`${it.po_id}_${it.produk_id}`, it.harga_satuan)
  }
  const hargaReject = (r: any) => hargaMap.get(`${r.po_id}_${r.produk_id}`) ?? 0

  // Reject bulan ini
  const rejectThisMonth = onlyReject.filter((r: any) => r.created_at && new Date(r.created_at) >= startMonth)
  const totalQtyMonth   = rejectThisMonth.reduce((s: number, r: any) => s + (r.qty || 0), 0)
  const totalNilaiMonth = rejectThisMonth.reduce((s: number, r: any) => s + (r.qty * hargaReject(r)), 0)
  const totalRejectAll  = onlyReject.length

  // Top vendor by reject qty
  const vendorAgg: Record<number, { vendor_nama: string; qty: number; count: number }> = {}
  for (const r of onlyReject) {
    if (!vendorAgg[r.vendor_id]) vendorAgg[r.vendor_id] = { vendor_nama: r.vendor_nama, qty: 0, count: 0 }
    vendorAgg[r.vendor_id].qty += r.qty || 0
    vendorAgg[r.vendor_id].count += 1
  }
  const topVendor = Object.values(vendorAgg).sort((a: any, b: any) => b.qty - a.qty).slice(0, 5)
  const leastVendor = Object.values(vendorAgg).sort((a: any, b: any) => a.qty - b.qty).slice(0, 3)

  // Top kategori
  const kategoriAgg: Record<string, { qty: number; count: number }> = {}
  for (const r of onlyReject) {
    const key = r.kategori_nama || r.alasan_manual || 'Tanpa Kategori'
    if (!kategoriAgg[key]) kategoriAgg[key] = { qty: 0, count: 0 }
    kategoriAgg[key].qty += r.qty || 0
    kategoriAgg[key].count += 1
  }
  const topKategori = Object.entries(kategoriAgg)
    .sort((a, b) => b[1].qty - a[1].qty).slice(0, 10)

  // Status SJ Counts
  const sjStatus = { menunggu_ganti: 0, sebagian_diganti: 0, selesai_diganti: 0 }
  for (const sj of sjList) {
    if (sj.status && sj.status in sjStatus) (sjStatus as any)[sj.status] += 1
  }

  // Alert: SJ overdue dan belum selesai
  const overdueSJ = sjList.filter((sj: any) =>
    sj.tanggal_jatuh_tempo_ganti && sj.status !== 'selesai_diganti' && sj.tanggal_jatuh_tempo_ganti < todayStr
  )

  return (
    <div className="space-y-4">
      {/* Alert overdue */}
      {overdueSJ.length > 0 && (
        <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600"/>
            <p className="text-[13px] font-black text-red-700">
              {overdueSJ.length} SJ Retur Lewat Tempo Penggantian!
            </p>
          </div>
          <div className="space-y-1.5">
            {overdueSJ.slice(0, 5).map((sj: any) => {
              const sisa = (sj.total_qty ?? 0) - (sj.total_qty_diganti ?? 0)
              return (
                <div key={sj.id} className="flex items-center justify-between text-[11px]">
                  <span>
                    <span className="font-mono font-bold text-red-700">{sj.nomor_sj}</span>
                    <span className="text-slate-500"> · {sj.vendor_nama}</span>
                  </span>
                  <span className="text-red-600 font-bold">{fmtNum(sisa)} pcs belum diganti</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ringkasan Bulan Ini */}
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ringkasan Reject Bulan Ini</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white border border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Kejadian</p>
            <p className="text-[20px] font-black text-slate-800 mt-1">{fmtNum(rejectThisMonth.length)}</p>
            <p className="text-[10px] text-slate-400">{fmtNum(totalRejectAll)} all-time</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Qty</p>
            <p className="text-[20px] font-black text-red-600 mt-1">{fmtNum(totalQtyMonth)}</p>
            <p className="text-[10px] text-slate-400">pcs reject</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Nilai</p>
            <p className="text-[14px] font-black text-amber-700 mt-1">{fmtRp(totalNilaiMonth)}</p>
            <p className="text-[10px] text-slate-400">kerugian potensial</p>
          </div>
        </div>
      </div>

      {/* Status SJ */}
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status SJ Retur</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-[20px] font-black text-amber-700">{sjStatus.menunggu_ganti}</p>
            <p className="text-[10px] font-bold text-amber-600 mt-1">Menunggu Ganti</p>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-[20px] font-black text-blue-700">{sjStatus.sebagian_diganti}</p>
            <p className="text-[10px] font-bold text-blue-600 mt-1">Sebagian Diganti</p>
          </div>
          <div className="rounded-2xl bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-[20px] font-black text-green-700">{sjStatus.selesai_diganti}</p>
            <p className="text-[10px] font-bold text-green-600 mt-1">Selesai Diganti</p>
          </div>
        </div>
      </div>

      {/* Top Vendor */}
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top 5 Vendor dengan Reject Terbanyak</p>
        {topVendor.length === 0 ? (
          <Empty text="Belum ada data reject" icon="📊"/>
        ) : (
          <div className="space-y-1.5">
            {topVendor.map((v: any, i: number) => {
              const max = topVendor[0].qty
              const pct = max > 0 ? (v.qty / max) * 100 : 0
              return (
                <div key={i} className="rounded-xl bg-white border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-bold text-slate-700">{i + 1}. {v.vendor_nama}</p>
                    <p className="text-[12px] font-black text-red-600">{fmtNum(v.qty)} pcs</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${pct}%` }}/>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{v.count} kejadian reject</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Vendor dengan Reject Paling Sedikit */}
      {leastVendor.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Vendor Terbaik (Reject Paling Sedikit)</p>
          <div className="space-y-1.5">
            {leastVendor.map((v: any, i: number) => (
              <div key={i} className="rounded-xl bg-green-50 border border-green-100 p-2.5 flex justify-between">
                <p className="text-[12px] font-bold text-slate-700">{i + 1}. {v.vendor_nama}</p>
                <p className="text-[12px] font-bold text-green-700">{fmtNum(v.qty)} pcs · {v.count}×</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Kategori */}
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top 10 Kategori Reject</p>
        {topKategori.length === 0 ? (
          <Empty text="Belum ada data kategori" icon="🏷️"/>
        ) : (
          <div className="space-y-1.5">
            {topKategori.map(([nama, agg], i) => {
              const max = topKategori[0][1].qty
              const pct = max > 0 ? (agg.qty / max) * 100 : 0
              return (
                <div key={nama} className="rounded-xl bg-white border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-semibold text-slate-700 truncate">{i + 1}. 🏷️ {nama}</p>
                    <p className="text-[12px] font-bold text-orange-600">{fmtNum(agg.qty)} pcs</p>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-orange-400" style={{ width: `${pct}%` }}/>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{agg.count}× reject</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
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

function PenggantiModal({ sj, onClose, onSave }: { sj: any; onClose: () => void; onSave: (fd: FormData) => Promise<void> }) {
  const [loading, setLoading] = useState(false)
  const items = (sj.items ?? []).filter((i: any) => (i.qty_retur ?? 0) > (i.qty_diganti ?? 0))
  const [selectedItemId, setSelectedItemId] = useState<number>(items[0]?.id ?? 0)
  const [qtyDiterima, setQtyDiterima] = useState(0)

  const selectedItem = items.find((i: any) => i.id === selectedItemId)
  const sisaPerluGanti = selectedItem ? (selectedItem.qty_retur - (selectedItem.qty_diganti ?? 0)) : 0

  return (
    <ModalShell title="Terima Barang Pengganti dari Vendor" onClose={onClose}>
      <div className="rounded-lg px-3 py-2 text-[12px] bg-blue-50 border border-blue-100 text-blue-700 mb-4">
        <p className="font-bold">{sj.nomor_sj}</p>
        <p className="text-blue-600 mt-0.5">{sj.vendor_nama} · {items.length} item perlu diganti</p>
      </div>
      {items.length === 0 ? (
        <Empty text="Semua item sudah sepenuhnya diganti" icon="✅"/>
      ) : (
        <form onSubmit={async e => {
          e.preventDefault()
          if (!selectedItemId || qtyDiterima <= 0) return
          setLoading(true)
          const fd = new FormData(e.currentTarget)
          fd.set('sj_retur_id', String(sj.id))
          fd.set('sj_item_id', String(selectedItemId))
          fd.set('qty_diterima', String(qtyDiterima))
          await onSave(fd)
          setLoading(false)
        }} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Item yang Diganti *</label>
            <select value={selectedItemId} onChange={e => setSelectedItemId(parseInt(e.target.value))} className={inp} required>
              {items.map((it: any) => {
                const sisa = it.qty_retur - (it.qty_diganti ?? 0)
                return (
                  <option key={it.id} value={it.id}>
                    {it.produk_nama} · perlu ganti {fmtNum(sisa)} pcs (dari {fmtNum(it.qty_retur)})
                  </option>
                )
              })}
            </select>
            {selectedItem && (
              <p className="text-[11px] text-slate-500 mt-1">
                {selectedItem.kategori_nama && <span className="text-red-500">🏷️ {selectedItem.kategori_nama} · </span>}
                Sudah diganti: <b>{fmtNum(selectedItem.qty_diganti ?? 0)}</b> · Sisa perlu ganti: <b className="text-blue-600">{fmtNum(sisaPerluGanti)} pcs</b>
              </p>
            )}
          </div>

          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nomor Batch <span className="normal-case text-slate-400 font-normal">(kosongkan = auto)</span></label>
            <input name="nomor_batch" placeholder="mis. BTH-G-001" className={inp}/></div>

          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tanggal Terima *</label>
            <input name="tanggal_terima" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/></div>

          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qty Diterima *</label>
            <input type="number" min="1" value={qtyDiterima || ''} onChange={e => setQtyDiterima(parseInt(e.target.value) || 0)}
              required className={inp} placeholder="0"/>
            {qtyDiterima > sisaPerluGanti && (
              <p className="text-[10px] text-red-500 mt-1">⚠️ Qty melebihi sisa perlu ganti ({fmtNum(sisaPerluGanti)})</p>
            )}
          </div>

          <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Catatan</label>
            <textarea name="catatan" rows={2} className={inp}/></div>

          <p className="text-[10px] text-amber-700 px-1">
            ⚡ Setelah simpan, batch pengganti akan muncul di tab <b>Penerimaan</b> dan menunggu QC. Lanjutkan QC seperti biasa untuk masukkan ke stok.
          </p>

          <button type="submit" disabled={loading || qtyDiterima <= 0 || qtyDiterima > sisaPerluGanti}
            className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-[13px] font-bold text-white disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Penerimaan Pengganti'}
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
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nama Kategori *</label>
          <input name="nama" defaultValue={kategori?.nama} required placeholder="mis. Cover Baret" className={inp}/></div>
        <div><label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Urutan Tampil</label>
          <input name="urutan" type="number" defaultValue={kategori?.urutan ?? 0} className={inp}/></div>
        <button type="submit" disabled={loading}
          className="w-full h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white disabled:opacity-50">
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
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pilih Produk</label>
        <select value={produkId ?? ''} onChange={e => setProdukId(parseInt(e.target.value) || null)} className={inp}>
          <option value="">— Pilih produk untuk lihat histori harga —</option>
          {produkList.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>

      {!produkId && <Empty text="Pilih produk untuk lihat perbandingan harga antar vendor" icon="💰"/>}

      {produkId && rows.length === 0 && <Empty text="Belum ada harga PO untuk produk ini" icon="💰"/>}

      {produkId && rows.length > 0 && (
        <>
          {/* Ringkasan per-vendor */}
          <div className="rounded-2xl bg-white border border-slate-200 p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Perbandingan Vendor</p>
            <div className="space-y-2">
              {(perVendor as any[])
                .sort((a, b) => a.last.harga - b.last.harga)
                .map((v: any) => {
                  const avg = v.prices.reduce((s: number, p: number) => s + p, 0) / v.prices.length
                  const isMin = v.last.harga === minHarga
                  const isMax = v.last.harga === maxHarga
                  return (
                    <div key={v.vendor_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-700 truncate">{v.vendor_nama}</p>
                        <p className="text-[10px] text-slate-400">{v.prices.length}× PO · rata2 {fmtRp(avg)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[13px] font-black ${isMin ? 'text-green-600' : isMax ? 'text-red-500' : 'text-slate-700'}`}>
                          {fmtRp(v.last.harga)}
                          {isMin && <span className="ml-1 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Termurah</span>}
                          {isMax && !isMin && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Termahal</span>}
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
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">Timeline Harga</p>
            <div className="space-y-1.5">
              {rows.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-700">{r.po.vendor_nama}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.po.nomor_po} · {fmtDate(r.po.tanggal_po)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-violet-700">{fmtRp(r.harga_satuan)}</p>
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
