'use client'

import { useState, useTransition } from 'react'
import { ClipboardList, Plus, Check, X, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  getStokSistem, saveStockOpname, approveStockOpname, getStockOpnameList,
  type StokRow
} from '@/app/(dashboard)/stock-opname/actions'
import type { UserRole } from '@/lib/types/database'

interface Cabang { kode: string; nama: string }

interface Props {
  initialList: any[]
  cabangList: Cabang[]
  userRole: UserRole
  userName: string
}

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  pending_approval: { bg: 'rgba(245,158,11,0.1)', text: '#D97706', label: 'Menunggu Approval' },
  disetujui:        { bg: 'rgba(34,197,94,0.1)',  text: '#16A34A', label: 'Disetujui' },
  ditolak:          { bg: 'rgba(239,68,68,0.1)',  text: '#DC2626', label: 'Ditolak' },
  selesai:          { bg: 'rgba(139,92,246,0.1)', text: '#7C3AED', label: 'Selesai' },
}

const inp = "w-full px-4 py-3 text-[13px] rounded-xl border border-slate-200/70 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all"
const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-medium text-slate-400">{label}</label>
    {children}
  </div>
)

const CAN_APPROVE: UserRole[] = ['owner', 'admin_pusat', 'spv']

export default function StockOpnameClient({ initialList, cabangList, userRole, userName }: Props) {
  const [list, setList] = useState<any[]>(initialList)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  async function reloadList() {
    const res = await getStockOpnameList()
    setList(res.data)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-violet-600">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-slate-900">Stock Opname</h1>
            <p className="text-[12px] text-slate-400">Verifikasi stok fisik vs stok sistem</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={reloadList}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
            <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} /> Muat Ulang
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
            <Plus size={14} /> Buat Stock Opname
          </button>
        </div>
      </div>

      {/* Form baru */}
      {showForm && (
        <StockOpnameForm
          cabangList={cabangList}
          userName={userName}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reloadList() }}
        />
      )}

      {/* Riwayat */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-300 text-[13px]">
            Belum ada stock opname
          </div>
        ) : list.map(so => (
          <SOCard
            key={so.id}
            so={so}
            expanded={expandedId === so.id}
            onToggle={() => setExpandedId(expandedId === so.id ? null : so.id)}
            canApprove={CAN_APPROVE.includes(userRole)}
            userName={userName}
            onApproved={reloadList}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Form buat SO baru ─────────────────────────────────────────────────────────
function StockOpnameForm({ cabangList, userName, onClose, onSaved }: {
  cabangList: Cabang[]
  userName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [lokasi, setLokasi] = useState('gudang_pusat')
  const [rows, setRows] = useState<StokRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [step, setStep] = useState<'pilih' | 'input' | 'done'>('pilih')
  const [savedKode, setSavedKode] = useState('')

  async function loadStok() {
    setLoadingRows(true)
    const r = await getStokSistem(lokasi)
    setRows(r)
    setLoadingRows(false)
    setStep('input')
  }

  function setFisik(gramasi: string, pcs: number) {
    setRows(prev => prev.map(r => {
      if (r.gramasi !== gramasi) return r
      const pcsFisik = isNaN(pcs) ? 0 : pcs
      const gram = parseFloat(gramasi)
      return {
        ...r,
        pcs_fisik: pcsFisik,
        gram_fisik: parseFloat((pcsFisik * gram).toFixed(3)),
        selisih_pcs: pcsFisik - r.pcs_sistem,
        selisih_gram: parseFloat(((pcsFisik - r.pcs_sistem) * gram).toFixed(3)),
      }
    }))
  }

  async function handleSave() {
    setSaving(true); setErr('')
    const lokasiLabel = lokasi === 'gudang_pusat'
      ? 'Gudang Pusat'
      : cabangList.find(c => c.kode === lokasi)?.nama ?? lokasi
    const res = await saveStockOpname({
      lokasi, lokasiLabel,
      dataFisik: rows.map(r => ({ gramasi: r.gramasi, pcs_fisik: r.pcs_fisik })),
      catatan, userName,
    })
    setSaving(false)
    if (!res.success) { setErr(res.error ?? 'Gagal menyimpan'); return }
    setSavedKode(res.kode ?? '')
    setStep('done')
  }

  const lokasiLabel = lokasi === 'gudang_pusat'
    ? 'Gudang Pusat'
    : cabangList.find(c => c.kode === lokasi)?.nama ?? lokasi

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Stock Opname Baru</h2>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
      </div>

      {step === 'done' ? (
        <div className="text-center py-8 space-y-3">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
          <p className="font-semibold text-slate-800">Stock Opname Tersimpan</p>
          <p className="text-[13px] text-slate-500 font-mono">{savedKode}</p>
          {rows.some(r => r.selisih_pcs !== 0) && (
            <p className="text-[12px] text-amber-600 bg-amber-50 rounded-xl px-4 py-2">
              Ada selisih — menunggu approval
            </p>
          )}
          <button onClick={onSaved} className="mt-2 px-6 py-2 rounded-xl text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700">
            Selesai
          </button>
        </div>
      ) : step === 'pilih' ? (
        <div className="space-y-4">
          <F label="Lokasi">
            <select value={lokasi} onChange={e => setLokasi(e.target.value)} className={inp}>
              <option value="gudang_pusat">Gudang Pusat</option>
              {cabangList.map(c => (
                <option key={c.kode} value={c.kode}>{c.nama}</option>
              ))}
            </select>
          </F>
          <button onClick={loadStok} disabled={loadingRows}
            className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
            {loadingRows ? 'Memuat stok sistem…' : `Ambil Stok ${lokasiLabel}`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] font-semibold text-slate-600">
            Lokasi: <span className="text-violet-700">{lokasiLabel}</span>
          </p>
          <p className="text-[12px] text-slate-400">Masukkan jumlah fisik yang dihitung langsung. Sistem akan otomatis menghitung selisih.</p>

          {/* Tabel input */}
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-400">Gramasi</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold text-slate-400">Sistem (pcs)</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold text-slate-400">Fisik (pcs)</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold text-slate-400">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.gramasi} className={cn('border-t border-slate-50', r.selisih_pcs !== 0 ? 'bg-amber-50/40' : '')}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{r.gramasi} gr</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{r.pcs_sistem}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={r.pcs_fisik}
                        onChange={e => setFisik(r.gramasi, parseInt(e.target.value))}
                        className="w-24 text-right px-3 py-1.5 text-[13px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                      />
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold text-[13px]',
                      r.selisih_pcs > 0 ? 'text-emerald-600' : r.selisih_pcs < 0 ? 'text-red-600' : 'text-slate-400'
                    )}>
                      {r.selisih_pcs > 0 ? '+' : ''}{r.selisih_pcs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.some(r => r.selisih_pcs !== 0) && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700">Ada selisih stok — akan membutuhkan approval setelah disimpan.</p>
            </div>
          )}

          <F label="Catatan">
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)}
              className={cn(inp, 'resize-none')} rows={2} placeholder="Keterangan tambahan (opsional)" />
          </F>

          {err && <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-4 py-2">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep('pilih')}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
              Kembali
            </button>
            <button onClick={handleSave} disabled={saving || rows.length === 0}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50 bg-violet-600 hover:bg-violet-700">
              {saving ? 'Menyimpan…' : 'Simpan Stock Opname'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card riwayat SO ───────────────────────────────────────────────────────────
function SOCard({ so, expanded, onToggle, canApprove, userName, onApproved }: {
  so: any; expanded: boolean; onToggle: () => void
  canApprove: boolean; userName: string; onApproved: () => void
}) {
  const [approving, setApproving] = useState(false)
  const [catatan, setCatatan] = useState('')
  const cfg = STATUS_CFG[so.status] ?? STATUS_CFG.selesai
  const selisih: any[] = so.selisih ?? []
  const adaSelisih = selisih.some((s: any) => s.selisih_pcs !== 0)

  async function doApprove(approved: boolean) {
    setApproving(true)
    await approveStockOpname({ id: so.id, kode: so.kode, approved, catatan, userName })
    setApproving(false)
    onApproved()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-[13px] font-semibold text-slate-800">{so.kode}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {formatDate(so.tanggal)} • {so.lokasi === 'gudang_pusat' ? 'Gudang Pusat' : so.lokasi}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.text }}>
            {cfg.label}
          </span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
          {/* Detail tabel */}
          {(so.data_sistem ?? []).length > 0 && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[12px] font-semibold text-slate-400">Gramasi</th>
                    <th className="text-right px-4 py-2.5 text-[12px] font-semibold text-slate-400">Sistem</th>
                    <th className="text-right px-4 py-2.5 text-[12px] font-semibold text-slate-400">Fisik</th>
                    <th className="text-right px-4 py-2.5 text-[12px] font-semibold text-slate-400">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {(so.data_sistem as any[]).map((row: any) => {
                    const fisik = (so.data_fisik as any[])?.find((f: any) => f.gramasi === row.gramasi)
                    const sel = selisih.find((s: any) => s.gramasi === row.gramasi)
                    const diff = sel?.selisih_pcs ?? 0
                    return (
                      <tr key={row.gramasi} className={cn('border-t border-slate-50', diff !== 0 ? 'bg-amber-50/30' : '')}>
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{row.gramasi} gr</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{row.pcs} pcs</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{fisik?.pcs ?? row.pcs} pcs</td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold',
                          diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-300'
                        )}>
                          {diff > 0 ? '+' : ''}{diff}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {so.catatan && (
            <p className="text-[12px] text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
              <span className="font-semibold">Catatan:</span> {so.catatan}
            </p>
          )}

          {so.approved_by && (
            <p className="text-[12px] text-slate-400">
              {so.status === 'disetujui' ? 'Disetujui' : 'Ditolak'} oleh <span className="font-semibold">{so.approved_by}</span>
            </p>
          )}

          {/* Approval panel */}
          {so.status === 'pending_approval' && canApprove && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 space-y-3">
              <p className="text-[12px] font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Menunggu Approval
              </p>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)}
                className="w-full px-3 py-2 text-[12px] rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                rows={2} placeholder="Keterangan approval (opsional)" />
              <div className="flex gap-2">
                <button onClick={() => doApprove(false)} disabled={approving}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                  <X size={13} /> Tolak
                </button>
                <button onClick={() => doApprove(true)} disabled={approving}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-all flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600">
                  <Check size={13} /> Setujui
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
