'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, Send, Store, ShieldCheck, X, RefreshCw, Check, Truck, PackageCheck, AlertTriangle } from 'lucide-react'
import {
  fetchShieldtagSiapMutasi, kirimMutasiCabang, fetchStokCabang,
  fetchMutasiList, fetchMutasiPendingTerima, terimaMutasiCabang,
} from '@/app/(dashboard)/mutasi/actions'

interface Cabang { kode: string; nama: string }
interface Shieldtag { id: number; kode: string; gramasi: string; batch_kode: string }
interface StokRow { id?: number; gramasi: string; stok_ready: number; po_pcs: number }
interface MutasiRow {
  id: number; kode: string; cabang_tujuan: string | null; tanggal_kirim: string | null
  shieldtag_kodes: string[] | null; pcs: number | null; pcs_diterima: number | null
  catatan: string | null; status: string | null; status_terima: string | null
}

const GRAMASI_ORDER = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

export default function MutasiClient({ cabangList }: { cabangList: Cabang[] }) {
  const [tab, setTab] = useState<'kirim' | 'terima' | 'stok' | 'riwayat'>('kirim')
  const [selectedCabang, setSelectedCabang] = useState(cabangList[0]?.kode ?? '')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          <ArrowLeftRight size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Pemindahan Barang</h1>
          <p className="text-xs text-slate-400">Kirim barang tershieldtag ke cabang, kelola stok & riwayat</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['kirim', 'Kirim Barang', Send], ['terima', 'Konfirmasi Terima', PackageCheck], ['stok', 'Stok Cabang', Store], ['riwayat', 'Riwayat', Truck]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all"
            style={tab === key
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }
              : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'kirim' && <KirimMutasi cabangList={cabangList} />}
      {tab === 'terima' && <TerimaMutasi cabangList={cabangList} />}
      {tab === 'stok' && (
        <StokCabang cabangList={cabangList} selectedCabang={selectedCabang} setSelectedCabang={setSelectedCabang} />
      )}
      {tab === 'riwayat' && <RiwayatMutasi cabangList={cabangList} />}
    </div>
  )
}

// ─── KIRIM MUTASI ──────────────────────────────────────────────────────────────
function KirimMutasi({ cabangList }: { cabangList: Cabang[] }) {
  const [tags, setTags] = useState<Shieldtag[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cabang, setCabang] = useState(cabangList[0]?.kode ?? '')
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [noSurat, setNoSurat] = useState('')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetchShieldtagSiapMutasi()
    setTags(res.rows as Shieldtag[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function toggle(kode: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(kode)) next.delete(kode); else next.add(kode)
      return next
    })
  }

  // Group by gramasi
  const grouped = new Map<string, Shieldtag[]>()
  for (const t of tags) {
    if (!grouped.has(t.gramasi)) grouped.set(t.gramasi, [])
    grouped.get(t.gramasi)!.push(t)
  }
  const sortedGramasi = [...grouped.keys()].sort((a, b) => {
    const ia = GRAMASI_ORDER.indexOf(a), ib = GRAMASI_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  async function submit() {
    if (selected.size === 0) { setMsg({ type: 'err', text: 'Pilih minimal 1 shieldtag' }); return }
    if (!cabang) { setMsg({ type: 'err', text: 'Pilih cabang tujuan' }); return }
    setSubmitting(true); setMsg(null)
    const fd = new FormData()
    fd.set('cabang_kode', cabang)
    fd.set('tanggal_kirim', tanggal)
    fd.set('no_surat', noSurat)
    fd.set('catatan', catatan)
    fd.set('shieldtag_kodes', JSON.stringify([...selected]))
    const res = await kirimMutasiCabang(fd)
    setSubmitting(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    setMsg({ type: 'ok', text: `Mutasi ${res.kode} berhasil dikirim ke cabang.` })
    setSelected(new Set())
    load()
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Shieldtag picker */}
      <div className="lg:col-span-2 rounded-3xl p-4"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-green-500" />
            <h2 className="text-sm font-bold text-slate-800">Shieldtag Siap Mutasi</h2>
          </div>
          <button onClick={load} className="text-violet-500 p-1.5 hover:bg-violet-50 rounded-lg">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Memuat shieldtag…</div>
        ) : tags.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">Belum ada barang tershieldtag di gudang.</p>
            <p className="text-xs text-slate-300 mt-1">Registrasi shieldtag dulu agar barang bisa dimutasi.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {sortedGramasi.map(gramasi => {
              const items = grouped.get(gramasi)!
              const allSel = items.every(t => selected.has(t.kode))
              return (
                <div key={gramasi}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600">{gramasi}gr <span className="text-slate-400">({items.length} pcs)</span></span>
                    <button onClick={() => setSelected(prev => {
                      const next = new Set(prev)
                      if (allSel) items.forEach(t => next.delete(t.kode))
                      else items.forEach(t => next.add(t.kode))
                      return next
                    })} className="text-[11px] font-semibold text-violet-500 hover:underline">
                      {allSel ? 'Batal semua' : 'Pilih semua'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(t => {
                      const sel = selected.has(t.kode)
                      return (
                        <button key={t.kode} onClick={() => toggle(t.kode)}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all"
                          style={sel
                            ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff' }
                            : { background: 'rgba(0,0,0,0.03)', color: '#475569', border: '1px solid rgba(0,0,0,0.06)' }}>
                          {sel && <Check size={10} className="inline mr-1" />}{t.kode}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Kirim form */}
      <div className="rounded-3xl p-4 space-y-3 h-fit"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <h2 className="text-sm font-bold text-slate-800">Detail Pengiriman</h2>

        <div className="rounded-2xl px-3 py-2.5 text-center"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <p className="text-2xl font-extrabold text-violet-700">{selected.size}</p>
          <p className="text-[11px] text-slate-500">pcs dipilih</p>
        </div>

        <Field label="Cabang Tujuan">
          <select value={cabang} onChange={e => setCabang(e.target.value)} className={inp}>
            {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
          </select>
        </Field>
        <Field label="Tanggal Kirim">
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inp} />
        </Field>
        <Field label="No. Surat Mutasi">
          <input value={noSurat} onChange={e => setNoSurat(e.target.value)} placeholder="Opsional" className={inp} />
        </Field>
        <Field label="Catatan">
          <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional" className={inp} />
        </Field>

        {msg && (
          <div className={`rounded-xl px-3 py-2 text-xs ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        <button onClick={submit} disabled={submitting || selected.size === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
          <Send size={15} /> {submitting ? 'Mengirim…' : 'Kirim Barang'}
        </button>
      </div>
    </div>
  )
}

// ─── TERIMA MUTASI (konfirmasi penerima di cabang) ─────────────────────────────
function TerimaMutasi({ cabangList }: { cabangList: Cabang[] }) {
  const [rows, setRows] = useState<MutasiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)
  const cabangNama = (kode: string | null) => cabangList.find(c => c.kode === kode)?.nama ?? kode ?? '-'

  async function load() {
    setLoading(true)
    const res = await fetchMutasiPendingTerima()
    setRows(res.rows as MutasiRow[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Memuat mutasi yang menunggu konfirmasi…</div>
  if (rows.length === 0) return (
    <div className="py-12 text-center rounded-3xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)' }}>
      <PackageCheck size={28} className="text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-400">Tidak ada mutasi yang menunggu konfirmasi terima.</p>
    </div>
  )

  return (
    <div className="space-y-2.5">
      {rows.map(m => (
        <TerimaCard key={m.id} mutasi={m} cabangNama={cabangNama(m.cabang_tujuan)}
          open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)}
          onDone={() => { setOpenId(null); load() }} />
      ))}
    </div>
  )
}

function TerimaCard({ mutasi, cabangNama, open, onToggle, onDone }: {
  mutasi: MutasiRow; cabangNama: string; open: boolean; onToggle: () => void; onDone: () => void
}) {
  const sentKodes = mutasi.shieldtag_kodes ?? []
  const [checked, setChecked] = useState<Set<string>>(new Set(sentKodes))
  const [alasanHilang, setAlasanHilang] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const hilangCount = sentKodes.length - checked.size

  function toggle(kode: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(kode)) next.delete(kode); else next.add(kode)
      return next
    })
  }

  async function submit() {
    if (hilangCount > 0 && !alasanHilang.trim()) {
      setMsg({ type: 'err', text: 'Isi alasan/keterangan untuk shieldtag yang tidak ditemukan.' })
      return
    }
    setSubmitting(true); setMsg(null)
    const fd = new FormData()
    fd.set('mutasi_id', String(mutasi.id))
    fd.set('diterima_kodes', JSON.stringify([...checked]))
    fd.set('catatan', catatan)
    fd.set('alasan_hilang', alasanHilang)
    const res = await terimaMutasiCabang(fd)
    setSubmitting(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    onDone()
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <Truck size={15} className="text-violet-600" />
          </div>
          <div className="text-left">
            <p className="font-mono text-xs font-bold text-slate-800">{mutasi.kode}</p>
            <p className="text-[11px] text-slate-400">dari Gudang Pusat → {cabangNama} · {mutasi.tanggal_kirim}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800">{mutasi.pcs} pcs dikirim</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Belum Diterima</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Centang shieldtag yang fisiknya benar-benar diterima</p>
          <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {sentKodes.map(kode => {
              const ok = checked.has(kode)
              return (
                <button key={kode} onClick={() => toggle(kode)}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all"
                  style={ok
                    ? { background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff' }
                    : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {ok ? <Check size={10} className="inline mr-1" /> : <X size={10} className="inline mr-1" />}{kode}
                </button>
              )
            })}
          </div>

          {hilangCount > 0 && (
            <div className="rounded-2xl px-3 py-2.5 space-y-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle size={13} />
                <p className="text-xs font-bold">{hilangCount} shieldtag tidak dicocokkan — terdeteksi short-shipment</p>
              </div>
              <input value={alasanHilang} onChange={e => setAlasanHilang(e.target.value)}
                placeholder="Alasan/keterangan kehilangan (wajib diisi)" className={inp} />
            </div>
          )}

          <Field label="Catatan Penerimaan">
            <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional" className={inp} />
          </Field>

          {msg && (
            <div className={`rounded-xl px-3 py-2 text-xs ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          <button onClick={submit} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: hilangCount > 0 ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'linear-gradient(135deg,#10B981,#059669)' }}>
            <PackageCheck size={15} /> {submitting ? 'Menyimpan…' : hilangCount > 0 ? 'Konfirmasi (dengan Short-Shipment)' : 'Konfirmasi Penerimaan'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── STOK CABANG ────────────────────────────────────────────────────────────────
function StokCabang({ cabangList, selectedCabang, setSelectedCabang }: {
  cabangList: Cabang[]; selectedCabang: string; setSelectedCabang: (k: string) => void
}) {
  const [rows, setRows] = useState<StokRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetchStokCabang(selectedCabang)
    // Merge with all gramasi so semua baris muncul
    const map = new Map<string, StokRow>()
    for (const g of GRAMASI_ORDER) map.set(g, { gramasi: g, stok_ready: 0, po_pcs: 0 })
    for (const r of res.rows as StokRow[]) map.set(r.gramasi, r)
    setRows([...map.values()])
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedCabang])

  const visibleRows = rows.filter(r => r.stok_ready > 0 || r.po_pcs > 0)
  const totalStok = rows.reduce((a, r) => a + r.stok_ready, 0)
  const totalPo   = rows.reduce((a, r) => a + r.po_pcs, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedCabang} onChange={e => setSelectedCabang(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(209,213,219,0.5)' }}>
          {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
        </select>
        <div className="flex gap-2 text-xs">
          <span className="px-3 py-2 rounded-xl bg-green-50 text-green-700 font-semibold">Total Ready: {totalStok} pcs</span>
          <span className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 font-semibold">Total PO: {totalPo} pcs</span>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Memuat stok…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wide" style={{ background: 'rgba(139,92,246,0.04)' }}>
                  <th className="text-left px-4 py-3">Gramasi</th>
                  <th className="text-right px-4 py-3">Stok Ready</th>
                  <th className="text-right px-4 py-3">PO</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-400">Belum ada stok di cabang ini.</td></tr>
                ) : visibleRows.map((r, i) => (
                  <tr key={r.gramasi} className={i % 2 ? 'bg-white/40' : ''} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3 font-bold text-slate-800">{r.gramasi}gr</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{r.stok_ready} pcs</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">{r.po_pcs > 0 ? `PO ${r.po_pcs}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 px-1">
        Stok ready &amp; PO dihitung otomatis (computed) dari lokasi/status shieldtag dan PO cabang yang masih terbuka — bukan angka yang diinput manual. Stok ready bertambah saat mutasi dikonfirmasi diterima di cabang.
      </p>
    </div>
  )
}

// ─── RIWAYAT MUTASI ─────────────────────────────────────────────────────────────
function RiwayatMutasi({ cabangList }: { cabangList: Cabang[] }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const cabangNama = (kode: string) => cabangList.find(c => c.kode === kode)?.nama ?? kode

  useEffect(() => {
    (async () => {
      const res = await fetchMutasiList()
      setRows(res.rows)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Memuat riwayat…</div>
  if (rows.length === 0) return (
    <div className="py-12 text-center rounded-3xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)' }}>
      <p className="text-sm text-slate-400">Belum ada mutasi.</p>
    </div>
  )

  return (
    <div className="space-y-2.5">
      {rows.map(m => (
        <div key={m.id} className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <Truck size={15} className="text-violet-600" />
              </div>
              <div>
                <p className="font-mono text-xs font-bold text-slate-800">{m.kode}</p>
                <p className="text-[11px] text-slate-400">{cabangNama(m.cabang_tujuan)} · {m.tanggal_kirim}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{m.pcs} pcs</p>
              <RiwayatBadge status={m.status} statusTerima={m.status_terima} />
            </div>
          </div>
          {m.catatan && <p className="text-[11px] text-slate-400 mt-2 italic">{m.catatan}</p>}
        </div>
      ))}
    </div>
  )
}

function RiwayatBadge({ status, statusTerima }: { status: string | null; statusTerima: string | null }) {
  if (status === 'SHORT_SHIP') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Short-Shipment</span>
  if (status === 'SELESAI') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Selesai</span>
  if (statusTerima === 'Sudah Diterima') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Diterima</span>
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Belum Diterima</span>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white/80 border border-slate-200'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

