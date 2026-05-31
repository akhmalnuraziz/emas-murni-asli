// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Search, Building2, Package, Tag, Settings } from 'lucide-react'
import {
  updatePengaturan,
  createSeries, updateSeries, deleteSeries,
  createProduk, updateProduk, deleteProduk,
  createCabang, updateCabang, deleteCabang,
} from '@/app/(dashboard)/pengaturan/actions'

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const INP = "w-full h-11 px-3.5 bg-[#F2F2F7] rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all border-0"

function FL({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{req && <span className="text-violet-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

function Toast({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg ${msg.ok ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}>
        {msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
        {msg.text}
      </div>
    </div>
  )
}

// ─── Tab Umum ─────────────────────────────────────────────────────────────────
function TabUmum({ settings }: { settings: any[] }) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(settings.map(s => [s.key, s.value ?? '']))
  )
  const [pend, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function save(key: string) {
    start(async () => {
      const r = await updatePengaturan(key, vals[key])
      if (r?.error) { setMsg({ text: r.error, ok: false }); return }
      setMsg({ text: 'Tersimpan ✓', ok: true })
      setTimeout(() => setMsg(null), 3000)
    })
  }

  return (
    <div className="space-y-4 p-4">
      <Toast msg={msg} />
      {settings.map(s => (
        <div key={s.key} className="bg-white rounded-2xl p-4 space-y-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{s.label}</p>
          <div className="flex gap-2">
            <input value={vals[s.key] ?? ''} onChange={e => setVals(v => ({ ...v, [s.key]: e.target.value }))}
              className={INP} />
            <button onClick={() => save(s.key)} disabled={pend}
              className="h-11 px-4 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {pend ? '…' : 'Simpan'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Series ───────────────────────────────────────────────────────────────
function TabSeries({ series }: { series: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ nama: '', keterangan: '' })
  const [pend, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [delConf, setDelConf] = useState<number | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    start(async () => {
      const r = editId ? await updateSeries(editId, fd) : await createSeries(fd)
      if (r?.error) { flash(r.error, false); return }
      flash(editId ? 'Series diperbarui ✓' : 'Series ditambah ✓')
      setShowForm(false); setEditId(null); setDraft({ nama: '', keterangan: '' })
    })
  }

  function startEdit(s: any) { setEditId(s.id); setDraft({ nama: s.nama, keterangan: s.keterangan ?? '' }); setShowForm(true) }

  function doDelete(id: number) {
    start(async () => {
      const r = await deleteSeries(id)
      if (r?.error) { flash(r.error, false); return }
      flash('Series dihapus'); setDelConf(null)
    })
  }

  return (
    <div className="p-4 space-y-3">
      <Toast msg={msg} />
      <button onClick={() => { setShowForm(!showForm); setEditId(null); setDraft({ nama: '', keterangan: '' }) }}
        className="w-full h-11 rounded-2xl border-2 border-dashed border-violet-300 flex items-center justify-center gap-2 text-sm font-semibold text-violet-500 hover:bg-violet-50 transition-all">
        <Plus size={16} />{showForm && !editId ? 'Batal' : '+ Tambah Series'}
      </button>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p className="text-sm font-bold text-gray-800">{editId ? 'Edit Series' : 'Series Baru'}</p>
          <FL label="Nama Series" req>
            <input name="nama" value={draft.nama} onChange={e => setDraft(d => ({ ...d, nama: e.target.value }))}
              className={INP} placeholder="cth: Imlek 2027" required />
          </FL>
          <FL label="Keterangan">
            <input name="keterangan" value={draft.keterangan} onChange={e => setDraft(d => ({ ...d, keterangan: e.target.value }))}
              className={INP} placeholder="Opsional…" />
          </FL>
          {editId && <input type="hidden" name="aktif" value="1" />}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
            <button type="submit" disabled={pend}
              className="flex-1 h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {pend ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {series.map(s => (
        <div key={s.id} className={`bg-white rounded-2xl p-4 flex items-center justify-between ${!s.aktif ? 'opacity-50' : ''}`}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div>
            <p className="text-sm font-bold text-gray-800">{s.nama}</p>
            {s.keterangan && <p className="text-xs text-gray-400">{s.keterangan}</p>}
            {!s.aktif && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Nonaktif</span>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => startEdit(s)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50">
              <Pencil size={13} />
            </button>
            {delConf === s.id ? (
              <div className="flex gap-1">
                <button onClick={() => doDelete(s.id)} disabled={pend} className="px-2 h-8 text-[10px] font-bold rounded-xl bg-red-500 text-white">
                  {pend ? '…' : 'Hapus'}
                </button>
                <button onClick={() => setDelConf(null)} className="px-2 h-8 text-[10px] font-semibold rounded-xl bg-gray-100 text-gray-600">Batal</button>
              </div>
            ) : (
              <button onClick={() => setDelConf(s.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Produk ───────────────────────────────────────────────────────────────
function TabProduk({ produk, series }: { produk: any[]; series: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ nama: '', gramasi: '1', series_id: '', aktif: '1' })
  const [filterSeries, setFilterSeries] = useState('')
  const [search, setSearch] = useState('')
  const [pend, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [delConf, setDelConf] = useState<number | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  const filtered = produk.filter(p => {
    const matchSearch = !search || p.nama.toLowerCase().includes(search.toLowerCase())
    const matchSeries = !filterSeries || String(p.series_id) === filterSeries
    return matchSearch && matchSeries
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    start(async () => {
      const r = editId ? await updateProduk(editId, fd) : await createProduk(fd)
      if (r?.error) { flash(r.error, false); return }
      flash(editId ? 'Produk diperbarui ✓' : 'Produk ditambah ✓')
      setShowForm(false); setEditId(null)
    })
  }

  function startEdit(p: any) {
    setEditId(p.id)
    setDraft({ nama: p.nama, gramasi: p.gramasi, series_id: String(p.series_id), aktif: p.aktif ? '1' : '0' })
    setShowForm(true)
  }

  function doDelete(id: number) {
    start(async () => {
      const r = await deleteProduk(id)
      if (r?.error) { flash(r.error, false); return }
      flash('Produk dinonaktifkan'); setDelConf(null)
    })
  }

  const seriesMap = Object.fromEntries(series.map(s => [s.id, s.nama]))

  return (
    <div className="p-4 space-y-3">
      <Toast msg={msg} />

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk…"
            className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none" />
        </div>
        <select value={filterSeries} onChange={e => setFilterSeries(e.target.value)}
          className="h-10 px-3 bg-[#F2F2F7] rounded-xl text-sm text-gray-600 focus:outline-none">
          <option value="">Semua Series</option>
          {series.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </div>

      <button onClick={() => { setShowForm(!showForm); setEditId(null); setDraft({ nama: '', gramasi: '1', series_id: String(series[0]?.id ?? ''), aktif: '1' }) }}
        className="w-full h-11 rounded-2xl border-2 border-dashed border-violet-300 flex items-center justify-center gap-2 text-sm font-semibold text-violet-500 hover:bg-violet-50 transition-all">
        <Plus size={16} />{showForm && !editId ? 'Batal' : '+ Tambah Produk'}
      </button>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p className="text-sm font-bold text-gray-800">{editId ? 'Edit Produk' : 'Produk Baru'}</p>
          <FL label="Nama Produk" req>
            <input name="nama" value={draft.nama} onChange={e => setDraft(d => ({ ...d, nama: e.target.value }))}
              className={INP} placeholder="cth: LM REI 1GR IMLEK" required />
          </FL>
          <div className="grid grid-cols-2 gap-3">
            <FL label="Gramasi" req>
              <select name="gramasi" value={draft.gramasi} onChange={e => setDraft(d => ({ ...d, gramasi: e.target.value }))}
                className={INP}>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}
              </select>
            </FL>
            <FL label="Series" req>
              <select name="series_id" value={draft.series_id} onChange={e => setDraft(d => ({ ...d, series_id: e.target.value }))}
                className={INP} required>
                <option value="">Pilih series…</option>
                {series.filter(s => s.aktif).map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </FL>
          </div>
          {editId && (
            <FL label="Status">
              <select name="aktif" value={draft.aktif} onChange={e => setDraft(d => ({ ...d, aktif: e.target.value }))} className={INP}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </FL>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
            <button type="submit" disabled={pend}
              className="flex-1 h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {pend ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <p className="text-xs text-gray-400 text-center">{filtered.length} produk</p>
      {filtered.map(p => (
        <div key={p.id} className={`bg-white rounded-2xl p-4 flex items-center justify-between ${!p.aktif ? 'opacity-50' : ''}`}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{p.nama}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">{p.gramasi} gr</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold">
                {seriesMap[p.series_id] ?? '—'}
              </span>
              {!p.aktif && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">Nonaktif</span>}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => startEdit(p)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50">
              <Pencil size={13} />
            </button>
            {delConf === p.id ? (
              <div className="flex gap-1">
                <button onClick={() => doDelete(p.id)} disabled={pend} className="px-2 h-8 text-[10px] font-bold rounded-xl bg-red-500 text-white">{pend ? '…' : 'Nonaktif'}</button>
                <button onClick={() => setDelConf(null)} className="px-2 h-8 text-[10px] font-semibold rounded-xl bg-gray-100 text-gray-600">Batal</button>
              </div>
            ) : (
              <button onClick={() => setDelConf(p.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Cabang ───────────────────────────────────────────────────────────────
function TabCabang({ cabang }: { cabang: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ kode: '', nama: '', alamat: '', kepala: '', telp: '', aktif: '1' })
  const [search, setSearch] = useState('')
  const [pend, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [delConf, setDelConf] = useState<number | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  const filtered = cabang.filter(c =>
    !search || c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase())
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    start(async () => {
      const r = editId ? await updateCabang(editId, fd) : await createCabang(fd)
      if (r?.error) { flash(r.error, false); return }
      flash(editId ? 'Cabang diperbarui ✓' : 'Cabang ditambah ✓')
      setShowForm(false); setEditId(null)
    })
  }

  function startEdit(c: any) {
    setEditId(c.id)
    setDraft({ kode: c.kode, nama: c.nama, alamat: c.alamat ?? '', kepala: c.kepala ?? '', telp: c.telp ?? '', aktif: c.aktif ? '1' : '0' })
    setShowForm(true)
  }

  function doDelete(id: number) {
    start(async () => {
      const r = await deleteCabang(id)
      if (r?.error) { flash(r.error, false); return }
      flash('Cabang dinonaktifkan'); setDelConf(null)
    })
  }

  return (
    <div className="p-4 space-y-3 pb-20">
      <Toast msg={msg} />

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari cabang…"
          className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none" />
      </div>

      <button onClick={() => { setShowForm(!showForm); setEditId(null); setDraft({ kode: '', nama: '', alamat: '', kepala: '', telp: '', aktif: '1' }) }}
        className="w-full h-11 rounded-2xl border-2 border-dashed border-violet-300 flex items-center justify-center gap-2 text-sm font-semibold text-violet-500 hover:bg-violet-50 transition-all">
        <Plus size={16} />{showForm && !editId ? 'Batal' : '+ Tambah Cabang'}
      </button>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p className="text-sm font-bold text-gray-800">{editId ? 'Edit Cabang' : 'Cabang Baru'}</p>
          <div className="grid grid-cols-2 gap-3">
            <FL label="Kode Cabang" req>
              <input name="kode" value={draft.kode} onChange={e => setDraft(d => ({ ...d, kode: e.target.value.toUpperCase() }))}
                className={INP} placeholder="cth: CJ-011" required />
            </FL>
            <FL label="Nama Cabang" req>
              <input name="nama" value={draft.nama} onChange={e => setDraft(d => ({ ...d, nama: e.target.value }))}
                className={INP} placeholder="cth: Cabang Bekasi" required />
            </FL>
          </div>
          <FL label="Alamat">
            <input name="alamat" value={draft.alamat} onChange={e => setDraft(d => ({ ...d, alamat: e.target.value }))}
              className={INP} placeholder="Alamat lengkap…" />
          </FL>
          <div className="grid grid-cols-2 gap-3">
            <FL label="Kepala Cabang">
              <input name="kepala" value={draft.kepala} onChange={e => setDraft(d => ({ ...d, kepala: e.target.value }))}
                className={INP} placeholder="Nama PIC" />
            </FL>
            <FL label="No HP">
              <input name="telp" value={draft.telp} onChange={e => setDraft(d => ({ ...d, telp: e.target.value }))}
                className={INP} placeholder="0812…" />
            </FL>
          </div>
          {editId && (
            <FL label="Status">
              <select name="aktif" value={draft.aktif} onChange={e => setDraft(d => ({ ...d, aktif: e.target.value }))} className={INP}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </FL>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
            <button type="submit" disabled={pend}
              className="flex-1 h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {pend ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <p className="text-xs text-gray-400 text-center">{filtered.length} cabang</p>
      {filtered.map(c => (
        <div key={c.id} className={`bg-white rounded-2xl p-4 flex items-start justify-between gap-3 ${!c.aktif ? 'opacity-50' : ''}`}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{c.kode}</span>
              {!c.aktif && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Nonaktif</span>}
            </div>
            <p className="text-sm font-bold text-gray-800 mt-1">{c.nama}</p>
            {c.alamat && <p className="text-xs text-gray-400 truncate">{c.alamat}</p>}
            {c.kepala && <p className="text-xs text-gray-500 mt-0.5">👤 {c.kepala}{c.telp ? ` · ${c.telp}` : ''}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => startEdit(c)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50">
              <Pencil size={13} />
            </button>
            {delConf === c.id ? (
              <div className="flex gap-1">
                <button onClick={() => doDelete(c.id)} disabled={pend} className="px-2 h-8 text-[10px] font-bold rounded-xl bg-red-500 text-white">{pend ? '…' : 'Nonaktif'}</button>
                <button onClick={() => setDelConf(null)} className="px-2 h-8 text-[10px] font-semibold rounded-xl bg-gray-100 text-gray-600">Batal</button>
              </div>
            ) : (
              <button onClick={() => setDelConf(c.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'umum',    label: 'Umum',    icon: Settings  },
  { key: 'produk',  label: 'Produk',  icon: Package   },
  { key: 'series',  label: 'Series',  icon: Tag       },
  { key: 'cabang',  label: 'Cabang',  icon: Building2 },
]

export default function PengaturanClient({ settings, series, produk, cabang }: {
  settings: any[]; series: any[]; produk: any[]; cabang: any[]
}) {
  const [tab, setTab] = useState('umum')

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-0">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Pengaturan</h1>
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl whitespace-nowrap transition-all flex-shrink-0
                  ${tab === key
                    ? 'bg-white text-violet-700 shadow-sm border-t border-x border-gray-200'
                    : 'text-gray-400 hover:text-gray-600'}`}>
                <Icon size={13} />
                {label}
                {key === 'cabang' && <span className="ml-0.5 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{cabang.length}</span>}
                {key === 'produk' && <span className="ml-0.5 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{produk.length}</span>}
                {key === 'series' && <span className="ml-0.5 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{series.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === 'umum'   && <TabUmum settings={settings} />}
      {tab === 'series' && <TabSeries series={series} />}
      {tab === 'produk' && <TabProduk produk={produk} series={series} />}
      {tab === 'cabang' && <TabCabang cabang={cabang} />}
    </div>
  )
}
