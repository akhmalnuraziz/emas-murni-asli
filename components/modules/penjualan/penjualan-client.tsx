'use client'

import { useState, useTransition } from 'react'
import { ShoppingBag, Plus, X, Search, Trash2, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { createPenjualan, voidPenjualan, lookupShieldtag } from '@/app/(dashboard)/penjualan/actions'

type PenjualanItem = {
  id: number
  shieldtag_kode: string
  produk_nama: string
  gramasi: string
  hpp: number
  harga_jual: number
  profit: number
}
type Payment = { id: number; metode: string; jumlah: number; catatan?: string }
type Penjualan = {
  id: number
  no_faktur: string
  tanggal: string
  channel: string
  status: string
  nama_customer: string | null
  pcs: number
  total_harga_jual: number
  total_profit: number
  hpp_total: number
  voided_at: string | null
  items: PenjualanItem[]
  payments: Payment[]
  cabang_nama: string | null
  marketplace_akun: string | null
  no_invoice_mktpl: string | null
}

const CHANNEL_LABEL: Record<string, string> = {
  toko: 'Toko Fisik',
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  raja_emas: 'Raja Emas App',
  cabang: 'Cabang',
}

const METODE_BAYAR = ['Tunai', 'Transfer BCA', 'Transfer BRI', 'Transfer Mandiri', 'QRIS', 'Lainnya']

function fmtRp(v: number) {
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    lunas: 'bg-green-100 text-green-700',
    void:  'bg-red-100 text-red-600',
    pending: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.toUpperCase()}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
      {CHANNEL_LABEL[channel] ?? channel}
    </span>
  )
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
type ItemRow = {
  shieldtag_kode: string
  harga_jual: string
  preview?: { gramasi: string; produk_nama: string; status: string } | null
  lookupError?: string
  looking?: boolean
}

function CreatePenjualanModal({
  cabangList, channels, onClose,
}: {
  cabangList: { kode: string; nama: string }[]
  channels: { channel: string; label: string; fee_persen: string }[]
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [channel, setChannel] = useState('toko')
  const [items, setItems] = useState<ItemRow[]>([{ shieldtag_kode: '', harga_jual: '' }])
  const [payments, setPayments] = useState([{ metode: 'Tunai', jumlah: '' }])

  function addItem() { setItems(prev => [...prev, { shieldtag_kode: '', harga_jual: '' }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, key: keyof ItemRow, val: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val, preview: key === 'shieldtag_kode' ? undefined : it.preview, lookupError: key === 'shieldtag_kode' ? undefined : it.lookupError } : it))
  }

  async function handleKodeLookup(i: number, kode: string) {
    const trimmed = kode.trim().toUpperCase()
    if (!trimmed) return
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, looking: true, preview: undefined, lookupError: undefined } : it))
    const res = await lookupShieldtag(trimmed)
    setItems(prev => prev.map((it, idx) => idx === i ? {
      ...it,
      looking: false,
      preview: 'error' in res ? null : { gramasi: res.gramasi, produk_nama: res.produk_nama, status: res.status },
      lookupError: 'error' in res ? res.error : (res.status !== 'Aktif' ? `Status: ${res.status} (bukan Aktif)` : undefined),
    } : it))
  }

  function addPayment() { setPayments(prev => [...prev, { metode: 'Tunai', jumlah: '' }]) }
  function removePayment(i: number) { setPayments(prev => prev.filter((_, idx) => idx !== i)) }
  function updatePayment(i: number, key: string, val: string) {
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [key]: val } : p))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('items', JSON.stringify(items.map(it => ({
      shieldtag_kode: it.shieldtag_kode.toUpperCase().trim(),
      harga_jual: parseFloat(it.harga_jual) || 0,
    }))))
    fd.set('payments', JSON.stringify(payments.map(p => ({
      metode: p.metode,
      jumlah: parseFloat(p.jumlah) || 0,
    })).filter(p => p.jumlah > 0)))
    startTransition(async () => {
      const res = await createPenjualan(fd)
      if (res?.error) { setError(res.error); return }
      if (res?.id) {
        window.location.href = `/penjualan/faktur/${res.id}`
      } else {
        onClose()
      }
    })
  }

  const isCabang = channel === 'cabang'
  const isMktpl  = !['toko', 'cabang'].includes(channel)
  const feeInfo  = channels.find(c => c.channel === channel)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.97)' }}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">Catat Penjualan Baru</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal *</label>
              <input name="tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Channel *</label>
              <select name="channel" value={channel} onChange={e => setChannel(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white">
                <option value="toko">Toko Fisik</option>
                {channels.map(c => (
                  <option key={c.channel} value={c.channel}>{c.label}</option>
                ))}
                <option value="cabang">Cabang</option>
              </select>
              {isMktpl && feeInfo && (
                <p className="text-[10px] text-slate-400 mt-1">Fee marketplace: {feeInfo.fee_persen}%</p>
              )}
            </div>
          </div>

          {/* Conditional fields */}
          {isCabang && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Cabang *</label>
              <select name="cabang_kode" required className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-purple-400"
                onChange={e => {
                  const opt = e.target.options[e.target.selectedIndex]
                  const form = e.target.form!
                  ;(form.elements.namedItem('cabang_nama') as HTMLInputElement).value = opt.text
                }}>
                <option value="">Pilih cabang…</option>
                {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
              </select>
              <input type="hidden" name="cabang_nama" />
            </div>
          )}
          {isMktpl && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Akun Marketplace</label>
                <input name="marketplace_akun" placeholder="mis. tokomas_emas" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">No. Invoice Marketplace</label>
                <input name="no_invoice_mktpl" placeholder="INV/xxxxxxxx" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nama Customer</label>
              <input name="nama_customer" placeholder="Opsional" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">No. HP</label>
              <input name="hp_customer" placeholder="08xx…" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">No. KTP</label>
              <input name="ktp_customer" placeholder="Opsional" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Alamat</label>
              <input name="alamat_customer" placeholder="Opsional" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500">Item ShieldTag *</label>
              <button type="button" onClick={addItem}
                className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1">
                <Plus size={12} /> Tambah
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <input
                      placeholder="Kode ShieldTag"
                      value={it.shieldtag_kode}
                      onChange={e => updateItem(i, 'shieldtag_kode', e.target.value)}
                      onBlur={e => handleKodeLookup(i, e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-purple-400"
                    />
                    <input
                      placeholder="Harga Jual"
                      type="number"
                      value={it.harga_jual}
                      onChange={e => updateItem(i, 'harga_jual', e.target.value)}
                      className="w-36 rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {it.looking && (
                    <p className="text-[10px] text-slate-400 pl-3">Mencari ShieldTag…</p>
                  )}
                  {it.preview && !it.lookupError && (
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-lg px-2 py-0.5">✓ {it.preview.produk_nama}</span>
                      <span className="text-[10px] text-slate-400">{it.preview.gramasi} gr</span>
                    </div>
                  )}
                  {it.lookupError && (
                    <p className="text-[10px] text-red-500 pl-3">{it.lookupError}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500">Pembayaran</label>
              <button type="button" onClick={addPayment}
                className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1">
                <Plus size={12} /> Tambah metode
              </button>
            </div>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={p.metode} onChange={e => updatePayment(i, 'metode', e.target.value)}
                    className="w-40 rounded-2xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-purple-400">
                    {METODE_BAYAR.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input placeholder="Jumlah" type="number" value={p.jumlah}
                    onChange={e => updatePayment(i, 'jumlah', e.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                  {payments.length > 1 && (
                    <button type="button" onClick={() => removePayment(i)} className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Catatan</label>
            <input name="catatan" placeholder="Opsional" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 rounded-2xl py-2.5 text-sm font-black text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {pending ? 'Menyimpan…' : 'Simpan & Buka Faktur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Row Component ─────────────────────────────────────────────────────────────
function PenjualanRow({ pj, canSeeRp, isOwner }: { pj: Penjualan; canSeeRp: boolean; isOwner: boolean }) {
  const [open, setOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showVoid, setShowVoid] = useState(false)
  const [pending, startTransition] = useTransition()

  function doVoid() {
    if (!voidReason.trim()) return
    startTransition(async () => {
      await voidPenjualan(pj.id, voidReason)
      setShowVoid(false)
    })
  }

  return (
    <div className="rounded-3xl overflow-hidden"
      >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50"
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-black text-sm text-slate-800">{pj.no_faktur}</span>
            <StatusBadge status={pj.status} />
            <ChannelBadge channel={pj.channel} />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {new Date(pj.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}
            {pj.nama_customer ? ` · ${pj.nama_customer}` : ''}
            {' · '}{pj.pcs} pcs
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {canSeeRp && (
            <>
              <p className="text-sm font-black text-slate-800">{fmtRp(pj.total_harga_jual ?? 0)}</p>
              <p className={`text-[11px] font-semibold ${(pj.total_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                profit {fmtRp(pj.total_profit ?? 0)}
              </p>
            </>
          )}
        </div>
        <div className="text-slate-300">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          {/* Items */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Item</p>
            <div className="space-y-1">
              {pj.items.map(it => (
                <div key={it.id} className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-mono font-semibold">{it.shieldtag_kode}</span>
                  <span>{it.gramasi} gr</span>
                  {canSeeRp && <span className="font-bold">{fmtRp(it.harga_jual)}</span>}
                  {canSeeRp && <span className={it.profit >= 0 ? 'text-green-600' : 'text-red-500'}>{fmtRp(it.profit)}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          {pj.payments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pembayaran</p>
              <div className="space-y-1">
                {pj.payments.map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-slate-600">
                    <span>{p.metode}</span>
                    {canSeeRp && <span className="font-bold">{fmtRp(p.jumlah)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cetak Faktur */}
          <a href={`/penjualan/faktur/${pj.id}`} target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-xl px-3 py-1.5 transition-colors border border-violet-200">
            <Printer size={12} /> Cetak Faktur
          </a>

          {/* Void action */}
          {isOwner && pj.status !== 'void' && (
            <div>
              {!showVoid ? (
                <button onClick={() => setShowVoid(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700">
                  <Trash2 size={11} /> Void transaksi
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                    placeholder="Alasan void…"
                    className="flex-1 rounded-2xl border border-red-200 px-3 py-1.5 text-xs focus:outline-none" />
                  <button onClick={doVoid} disabled={pending || !voidReason.trim()}
                    className="rounded-2xl bg-red-500 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                    {pending ? '…' : 'Void'}
                  </button>
                  <button onClick={() => setShowVoid(false)} className="text-xs text-slate-400">Batal</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Client ───────────────────────────────────────────────────────────────
export default function PenjualanClient({
  penjualanList, cabangList, channels, userRole, canSeeRp,
}: {
  penjualanList: Penjualan[]
  cabangList: { kode: string; nama: string }[]
  channels: { channel: string; label: string; fee_persen: string }[]
  userRole: string
  canSeeRp: boolean
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const isOwner = ['owner', 'admin_pusat'].includes(userRole)

  const filtered = penjualanList.filter(pj =>
    !search ||
    pj.no_faktur.toLowerCase().includes(search.toLowerCase()) ||
    (pj.nama_customer ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalBulanIni = penjualanList
    .filter(pj => {
      const now = new Date()
      const d = new Date(pj.tanggal)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, pj) => sum + (pj.total_harga_jual ?? 0), 0)

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Penjualan</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {penjualanList.length} transaksi
            {canSeeRp && ` · Omzet bulan ini: ${fmtRp(totalBulanIni)}`}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
          <Plus size={14} /> Catat Penjualan
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari no. faktur atau nama customer…"
          className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-xl">
          <ShoppingBag size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-[13px] font-medium text-slate-400">Belum ada transaksi penjualan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pj => (
            <PenjualanRow key={pj.id} pj={pj} canSeeRp={canSeeRp} isOwner={isOwner} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePenjualanModal
          cabangList={cabangList}
          channels={channels}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
