'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeftRight, Send, Store, ShieldCheck, X, RefreshCw, Check,
  Truck, PackageCheck, AlertTriangle, Search, ListChecks, ChevronRight, Printer
} from 'lucide-react'
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
        <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center">
          <ArrowLeftRight size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-slate-900">Pemindahan Barang</h1>
          <p className="text-[12px] text-slate-400">Kirim barang tershieldtag ke cabang, kelola stok &amp; riwayat</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['kirim', 'Kirim Barang', Send], ['terima', 'Konfirmasi Terima', PackageCheck], ['stok', 'Stok Cabang', Store], ['riwayat', 'Riwayat', Truck]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-all border ${
              tab === key
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
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

// ─── SERIAL PICKER MODAL ───────────────────────────────────────────────────────
function SerialPickerModal({ gramasi, available, selected, onConfirm, onClose }: {
  gramasi: string
  available: Shieldtag[]
  selected: Set<string>
  onConfirm: (kodes: Set<string>) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState(new Set(selected))
  const [search, setSearch] = useState('')

  const filtered = available.filter(t =>
    !search || t.kode.toLowerCase().includes(search.toLowerCase())
  )
  const allChecked = filtered.length > 0 && filtered.every(t => local.has(t.kode))

  function toggle(kode: string) {
    setLocal(prev => { const n = new Set(prev); n.has(kode) ? n.delete(kode) : n.add(kode); return n })
  }
  function toggleAll() {
    setLocal(prev => {
      const n = new Set(prev)
      if (allChecked) filtered.forEach(t => n.delete(t.kode))
      else filtered.forEach(t => n.add(t.kode))
      return n
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Pilih Serial Emas {gramasi}gr</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{available.length} tersedia di gudang</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode serial…"
              className="w-full h-9 rounded-lg border border-slate-200 pl-8 pr-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all font-mono" />
          </div>
        </div>

        {/* Select all */}
        <div className="px-5 py-2 border-b border-slate-100">
          <button onClick={toggleAll} className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 hover:text-violet-600">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allChecked ? 'bg-violet-500 border-violet-500' : 'border-slate-300'}`}>
              {allChecked && <Check size={10} className="text-white" />}
            </div>
            {allChecked ? 'Batal Semua' : 'Pilih Semua'} ({filtered.length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-0.5">
          {filtered.map(t => {
            const checked = local.has(t.kode)
            return (
              <button key={t.kode} onClick={() => toggle(t.kode)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left">
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${checked ? 'bg-violet-500 border-violet-500' : 'border-slate-300'}`}>
                  {checked && <Check size={10} className="text-white" />}
                </div>
                <span className="font-mono text-[13px] font-semibold text-slate-800">{t.kode}</span>
                {t.batch_kode && <span className="text-[10px] text-slate-400 ml-auto">{t.batch_kode}</span>}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-100 flex-shrink-0 items-center">
          <p className="text-[12px] text-slate-500 font-semibold flex-1">{local.size} Serial dipilih</p>
          <button onClick={() => onConfirm(local)}
            className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-bold text-white transition-colors disabled:opacity-50">
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── KIRIM MUTASI ──────────────────────────────────────────────────────────────
function KirimMutasi({ cabangList }: { cabangList: Cabang[] }) {
  const [tags, setTags] = useState<Shieldtag[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pickerGramasi, setPickerGramasi] = useState<string | null>(null)
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

  function confirmPicker(kodes: Set<string>) {
    if (!pickerGramasi) return
    const grItems = grouped.get(pickerGramasi) ?? []
    // Remove all serials for this gramasi from selected, then add the new ones
    setSelected(prev => {
      const next = new Set(prev)
      grItems.forEach(t => next.delete(t.kode))
      kodes.forEach(k => next.add(k))
      return next
    })
    setPickerGramasi(null)
  }

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

  const totalSelected = selected.size

  return (
    <div className="space-y-4">
      {/* Form header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      </div>

      {/* Item table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-green-500" />
            <span className="text-[13px] font-bold text-slate-800">Daftar Barang</span>
          </div>
          <div className="flex items-center gap-3">
            {totalSelected > 0 && (
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
                {totalSelected} pcs dipilih
              </span>
            )}
            <button onClick={load} className="text-violet-500 p-1.5 hover:bg-violet-50 rounded-lg" title="Refresh">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-400">Memuat shieldtag…</div>
        ) : tags.length === 0 ? (
          <div className="py-14 text-center">
            <ShieldCheck size={28} className="text-slate-200 mx-auto mb-2" />
            <p className="text-[13px] text-slate-400">Belum ada barang tershieldtag di gudang.</p>
            <p className="text-[12px] text-slate-300 mt-1">Registrasi shieldtag dulu agar barang bisa dimutasi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Nama Barang', 'Gramasi', 'Tersedia', 'Dipilih', 'Satuan', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedGramasi.map((gramasi, i) => {
                  const items = grouped.get(gramasi)!
                  const selCount = items.filter(t => selected.has(t.kode)).length
                  const currentSelected = new Set(items.filter(t => selected.has(t.kode)).map(t => t.kode))
                  return (
                    <tr key={gramasi}
                      className={`border-t border-slate-100 hover:bg-violet-50/20 transition-colors ${i === 0 ? 'border-t-0' : ''}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50">
                            <span className="text-[9px] font-black text-amber-600">AU</span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-[13px]">Emas {gramasi} gr</p>
                            <p className="text-[10px] text-slate-400">LOGAM MULIA</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[12px] font-bold px-2 py-1 rounded-lg text-amber-700 bg-amber-50">{gramasi}gr</span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-600 text-[13px]">{items.length}</td>
                      <td className="px-4 py-3.5">
                        {selCount > 0
                          ? <span className="font-bold text-violet-600">{selCount}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] font-semibold text-slate-500">PCS</td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setPickerGramasi(gramasi)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                            selCount > 0
                              ? 'bg-violet-600 text-white hover:bg-violet-700'
                              : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                          }`}>
                          <ListChecks size={12} />
                          {selCount > 0 ? `${selCount} dipilih` : 'Pilih Serial'}
                          <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with send button */}
        {tags.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
            {msg && (
              <p className={`text-[12px] flex-1 px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 border border-red-100 text-red-600'}`}>
                {msg.text}
              </p>
            )}
            <div className="ml-auto flex items-center gap-3">
              {totalSelected > 0 && (
                <p className="text-[12px] text-slate-500">
                  Total <span className="font-bold text-slate-800">{totalSelected} pcs</span>
                </p>
              )}
              <button onClick={submit} disabled={submitting || totalSelected === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-bold text-white transition-colors disabled:opacity-40 bg-violet-600 hover:bg-violet-700">
                <Send size={14} /> {submitting ? 'Mengirim…' : 'Kirim Barang'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Serial picker modal */}
      {pickerGramasi && (
        <SerialPickerModal
          gramasi={pickerGramasi}
          available={grouped.get(pickerGramasi) ?? []}
          selected={new Set((grouped.get(pickerGramasi) ?? []).filter(t => selected.has(t.kode)).map(t => t.kode))}
          onConfirm={confirmPicker}
          onClose={() => setPickerGramasi(null)}
        />
      )}
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

  if (loading) return <div className="py-12 text-center text-[13px] text-slate-400">Memuat mutasi yang menunggu konfirmasi…</div>
  if (rows.length === 0) return (
    <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
      <PackageCheck size={28} className="text-slate-300 mx-auto mb-2" />
      <p className="text-[13px] text-slate-400">Tidak ada mutasi yang menunggu konfirmasi terima.</p>
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
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <button onClick={onToggle} className="w-full flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50">
            <Truck size={15} className="text-violet-600" />
          </div>
          <div className="text-left">
            <p className="font-mono text-[12px] font-bold text-slate-800">{mutasi.kode}</p>
            <p className="text-[11px] text-slate-400">dari Gudang Pusat → {cabangNama} · {mutasi.tanggal_kirim}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-bold text-slate-800">{mutasi.pcs} pcs dikirim</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Belum Diterima</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 pt-4 space-y-3 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Centang shieldtag yang fisiknya benar-benar diterima</p>
          <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {sentKodes.map(kode => {
              const ok = checked.has(kode)
              return (
                <button key={kode} onClick={() => toggle(kode)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors border ${
                    ok
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                  {ok ? <Check size={10} className="inline mr-1" /> : <X size={10} className="inline mr-1" />}{kode}
                </button>
              )
            })}
          </div>

          {hilangCount > 0 && (
            <div className="rounded-lg px-3 py-2.5 space-y-2 bg-red-50 border border-red-100">
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle size={13} />
                <p className="text-[12px] font-bold">{hilangCount} shieldtag tidak dicocokkan — terdeteksi short-shipment</p>
              </div>
              <input value={alasanHilang} onChange={e => setAlasanHilang(e.target.value)}
                placeholder="Alasan/keterangan kehilangan (wajib diisi)" className={inp} />
            </div>
          )}

          <Field label="Catatan Penerimaan">
            <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional" className={inp} />
          </Field>

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-[12px] ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 border border-red-100 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          <button onClick={submit} disabled={submitting}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-bold text-white transition-colors disabled:opacity-40 ${
              hilangCount > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'
            }`}>
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
          className="h-9 px-3 rounded-lg text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all">
          {cabangList.map(c => <option key={c.kode} value={c.kode}>{c.nama}</option>)}
        </select>
        <div className="flex gap-2 text-[12px]">
          <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 font-semibold">Total Ready: {totalStok} pcs</span>
          <span className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 font-semibold">Total PO: {totalPo} pcs</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-slate-400">Memuat stok…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Gramasi</th>
                  <th className="text-right px-4 py-3">Stok Ready</th>
                  <th className="text-right px-4 py-3">PO</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-[13px] text-slate-400">Belum ada stok di cabang ini.</td></tr>
                ) : visibleRows.map((r, i) => (
                  <tr key={r.gramasi} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
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

  if (loading) return <div className="py-12 text-center text-[13px] text-slate-400">Memuat riwayat…</div>
  if (rows.length === 0) return (
    <div className="py-12 text-center bg-white border border-slate-200 rounded-xl">
      <p className="text-[13px] text-slate-400">Belum ada mutasi.</p>
    </div>
  )

  return (
    <div className="space-y-2.5">
      {rows.map(m => (
        <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50">
                <Truck size={15} className="text-violet-600" />
              </div>
              <div>
                <p className="font-mono text-[12px] font-bold text-slate-800">{m.kode}</p>
                <p className="text-[11px] text-slate-400">{cabangNama(m.cabang_tujuan)} · {m.tanggal_kirim}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[13px] font-bold text-slate-800">{m.pcs} pcs</p>
                <RiwayatBadge status={m.status} statusTerima={m.status_terima} />
              </div>
              <a href={`/mutasi/print/${m.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors bg-violet-50 text-violet-700 hover:bg-violet-100"
                title="Print Surat Jalan">
                <Printer size={13}/> SJ
              </a>
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
const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}
