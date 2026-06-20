'use client'

import { useState, useTransition } from 'react'
import {
  RotateCcw, Plus, X, Check, RefreshCw, ChevronDown, ChevronUp,
  Camera, User, Phone, Tag, AlertTriangle, CheckCircle2, Wrench, Flame, Archive
} from 'lucide-react'
import { cn, formatDate, formatRupiah } from '@/lib/utils'
import { createBuyback, prossesBuyback, getBuybackList } from '@/app/(dashboard)/buyback/actions'
import type { UserRole } from '@/lib/types/database'

interface Props {
  initialList: any[]
  userRole: UserRole
  userName: string
}

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

const HASIL_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pending:       { label: 'Pending Inspeksi', bg: 'rgba(100,116,139,0.1)', text: '#475569', icon: AlertTriangle },
  ready_resell:  { label: 'Siap Jual Lagi',   bg: 'rgba(34,197,94,0.1)',  text: '#16A34A', icon: CheckCircle2  },
  repair:        { label: 'Perlu Repair',      bg: 'rgba(59,130,246,0.1)', text: '#2563EB', icon: Wrench        },
  holding_reject:{ label: 'Holding Reject',    bg: 'rgba(239,68,68,0.1)',  text: '#DC2626', icon: Archive       },
  akan_dilebur:  { label: 'Akan Dilebur',      bg: 'rgba(245,158,11,0.1)', text: '#D97706', icon: Flame         },
}

const inp = "w-full px-4 py-3 text-sm rounded-2xl border border-gray-200/70 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all"
const F = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">
      {label}{req && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
)

const CAN_PROSES: UserRole[] = ['owner', 'admin_pusat', 'spv']

async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 5)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        let { width: w, height: h } = img
        const max = 1200
        if (w > max || h > max) { const r = Math.min(max/w, max/h); w = Math.floor(w*r); h = Math.floor(h*r) }
        c.width = w; c.height = h; c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        c.toBlob(blob => {
          if (!blob) { resolve(''); return }
          const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob)
        }, 'image/jpeg', 0.8)
      }
      img.src = URL.createObjectURL(file)
    })
    if (b64) results.push(b64)
  }
  return results
}

export default function BuybackClient({ initialList, userRole, userName }: Props) {
  const [list, setList] = useState<any[]>(initialList)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  async function reloadList() {
    const res = await getBuybackList()
    setList(res.data)
  }

  const pendingCount = list.filter(b => b.status === 'pending').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            <RotateCcw size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Buyback</h1>
            <p className="text-xs text-slate-400">Terima buyback, inspeksi, dan tentukan tindakan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              {pendingCount} pending inspeksi
            </span>
          )}
          <button onClick={reloadList}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors">
            <RefreshCw size={13} /> Muat Ulang
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
            <Plus size={14} /> Terima Buyback
          </button>
        </div>
      </div>

      {/* Panduan flow */}
      <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 mb-2">Flow Buyback (PRD v5)</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          {['Terima Buyback', '→', 'Inspeksi', '→', ['Siap Jual','Repair','Holding Reject','Lebur']].map((step, i) =>
            Array.isArray(step) ? (
              <span key={i} className="flex gap-1 flex-wrap">
                {step.map(s => <span key={s} className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[10px] font-semibold">{s}</span>)}
              </span>
            ) : <span key={i} className={step === '→' ? 'text-slate-300' : 'font-semibold text-slate-600'}>{step}</span>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <BuybackForm
          userName={userName}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reloadList() }}
        />
      )}

      {/* List */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-300 text-sm">
            Belum ada data buyback
          </div>
        ) : list.map(b => (
          <BuybackCard
            key={b.id}
            buyback={b}
            expanded={expandedId === b.id}
            onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
            canProses={CAN_PROSES.includes(userRole)}
            userName={userName}
            onUpdated={reloadList}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Form terima buyback baru ──────────────────────────────────────────────────
function BuybackForm({ userName, onClose, onSaved }: {
  userName: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    namaCustomer: '', hpCustomer: '', shieldtagKode: '',
    gramasi: '1', kondisiEmas: 'bagus', kondisiTag: 'bagus',
    hasilInspeksi: 'ready_resell', hargaBeli: '', catatan: '',
  })
  const [fotos, setFotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const b64s = await filesToBase64(files)
    setFotos(prev => [...prev, ...b64s].slice(0, 5))
    e.target.value = ''
  }

  async function handleSave() {
    if (!form.namaCustomer) { setErr('Nama customer wajib diisi'); return }
    setSaving(true); setErr('')
    const res = await createBuyback({
      ...form,
      hargaBeli: parseInt(form.hargaBeli) || 0,
      fotosB64: fotos,
      userName,
    })
    setSaving(false)
    if (!res.success) { setErr(res.error ?? 'Gagal'); return }
    setDone(res.kode ?? '')
  }

  if (done) return (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center space-y-3">
      <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
      <p className="font-bold text-slate-800">Buyback Diterima</p>
      <p className="text-sm font-mono text-slate-500">{done}</p>
      <button onClick={onSaved} className="px-6 py-2 rounded-xl text-sm font-bold text-white"
        style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
        Selesai
      </button>
    </div>
  )

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">Terima Buyback Baru</h2>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F label="Nama Customer" req>
          <input value={form.namaCustomer} onChange={e => set('namaCustomer', e.target.value)}
            className={inp} placeholder="Nama lengkap customer" />
        </F>
        <F label="No. HP">
          <input value={form.hpCustomer} onChange={e => set('hpCustomer', e.target.value)}
            className={inp} placeholder="08xx-xxxx-xxxx" />
        </F>
        <F label="Kode Shieldtag">
          <input value={form.shieldtagKode} onChange={e => set('shieldtagKode', e.target.value.toUpperCase())}
            className={cn(inp, 'font-mono')} placeholder="Misal: 1H80AA" />
        </F>
        <F label="Gramasi">
          <select value={form.gramasi} onChange={e => set('gramasi', e.target.value)} className={inp}>
            {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}
          </select>
        </F>
        <F label="Kondisi Emas">
          <select value={form.kondisiEmas} onChange={e => set('kondisiEmas', e.target.value)} className={inp}>
            <option value="bagus">Bagus</option>
            <option value="rusak_ringan">Rusak Ringan</option>
            <option value="rusak_berat">Rusak Berat</option>
          </select>
        </F>
        <F label="Kondisi Shieldtag">
          <select value={form.kondisiTag} onChange={e => set('kondisiTag', e.target.value)} className={inp}>
            <option value="bagus">Bagus</option>
            <option value="rusak">Rusak</option>
            <option value="hilang">Hilang</option>
          </select>
        </F>
        <F label="Hasil Inspeksi" req>
          <select value={form.hasilInspeksi} onChange={e => set('hasilInspeksi', e.target.value)} className={inp}>
            <option value="ready_resell">Siap Jual Lagi</option>
            <option value="repair">Perlu Repair</option>
            <option value="reject">Holding Reject</option>
            <option value="lebur">Akan Dilebur</option>
          </select>
        </F>
        <F label="Harga Beli Kembali (Rp)">
          <input type="number" value={form.hargaBeli} onChange={e => set('hargaBeli', e.target.value)}
            className={inp} placeholder="0" min={0} />
        </F>
      </div>

      <F label="Foto Kondisi Barang">
        <div className="flex gap-2 flex-wrap">
          {fotos.map((f, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
              <img src={f} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center">
                <X size={10} />
              </button>
            </div>
          ))}
          {fotos.length < 5 && (
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-violet-300 transition-colors">
              <Camera size={18} className="text-slate-300" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            </label>
          )}
        </div>
      </F>

      <F label="Catatan">
        <textarea value={form.catatan} onChange={e => set('catatan', e.target.value)}
          className={cn(inp, 'resize-none')} rows={2} placeholder="Keterangan tambahan" />
      </F>

      {err && <p className="text-xs text-red-600 bg-red-50 rounded-2xl px-4 py-2">{err}</p>}

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
          Batal
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          {saving ? 'Menyimpan…' : 'Simpan Buyback'}
        </button>
      </div>
    </div>
  )
}

// ─── Card item buyback ─────────────────────────────────────────────────────────
function BuybackCard({ buyback: b, expanded, onToggle, canProses, userName, onUpdated }: {
  buyback: any; expanded: boolean; onToggle: () => void
  canProses: boolean; userName: string; onUpdated: () => void
}) {
  const [aksi, setAksi] = useState<string>('')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const cfg = HASIL_CFG[b.status] ?? HASIL_CFG.pending
  const StatusIcon = cfg.icon

  async function doProses() {
    if (!aksi) return
    setSaving(true)
    await prossesBuyback({ id: b.id, kode: b.kode, aksi: aksi as any, catatan, userName })
    setSaving(false)
    onUpdated()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50"
        onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: cfg.bg }}>
            <StatusIcon size={16} style={{ color: cfg.text }} />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-slate-800">{b.kode}</p>
            <p className="text-xs text-slate-400">{b.nama_customer} • {formatDate(b.tanggal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {b.shieldtag_kode && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{b.shieldtag_kode}</span>
          )}
          {b.gramasi && (
            <span className="text-xs font-bold text-slate-600">{b.gramasi} gr</span>
          )}
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><p className="text-slate-400 mb-0.5">HP Customer</p><p className="font-semibold text-slate-700">{b.hp_customer || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Kondisi Emas</p><p className="font-semibold text-slate-700 capitalize">{b.kondisi_emas?.replace(/_/g,' ') || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Kondisi Tag</p><p className="font-semibold text-slate-700 capitalize">{b.kondisi_tag?.replace(/_/g,' ') || '—'}</p></div>
            <div><p className="text-slate-400 mb-0.5">Harga Beli</p><p className="font-semibold text-slate-700">{formatRupiah(b.harga_beli)}</p></div>
          </div>

          {(b.foto ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(b.foto as string[]).map((url, i) => (
                <img key={i} src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-100" />
              ))}
            </div>
          )}

          {b.catatan && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-2xl px-4 py-3">
              <span className="font-semibold">Catatan:</span> {b.catatan}
            </p>
          )}

          {b.approved_by && (
            <p className="text-xs text-slate-400">Diproses oleh <span className="font-semibold">{b.approved_by}</span></p>
          )}

          {/* Panel proses jika masih pending */}
          {b.status === 'pending' && canProses && (
            <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4 space-y-3">
              <p className="text-xs font-bold text-violet-700">Tentukan Tindakan Buyback</p>
              <select value={aksi} onChange={e => setAksi(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">-- Pilih tindakan --</option>
                <option value="ready_resell">Siap Jual Lagi (kondisi bagus)</option>
                <option value="repair">Repair (perlu perbaikan)</option>
                <option value="reject">Holding Reject (tidak layak jual)</option>
                <option value="lebur">Lebur (tidak bisa diperbaiki)</option>
              </select>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-violet-200 bg-white focus:outline-none resize-none"
                rows={2} placeholder="Keterangan (opsional)" />
              <button onClick={doProses} disabled={saving || !aksi}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                {saving ? 'Memproses…' : 'Konfirmasi Tindakan'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
