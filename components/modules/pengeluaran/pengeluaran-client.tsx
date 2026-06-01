// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check, AlertTriangle, Search, Trash2, Tag, Filter } from 'lucide-react'
import { createPengeluaran, createKategori, deleteKategori, voidPengeluaran } from '@/app/(dashboard)/pengeluaran/actions'

const INP = "w-full h-11 px-3.5 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all"
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const WARNA_OPTIONS = ['#8B5CF6','#06B6D4','#F59E0B','#10B981','#EF4444','#3B82F6','#EC4899','#6B7280']

function Toast({ msg }: { msg: any }) {
  if (!msg) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg ${msg.ok ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}>
        {msg.ok ? <Check size={14}/> : <AlertTriangle size={14}/>} {msg.text}
      </div>
    </div>
  )
}

export default function PengeluaranClient({ pengeluaranList, kategoriList, cabangList, namaGudang, userRole }) {
  const router = useRouter()
  const [tab, setTab]           = useState<'list'|'kategori'>('list')
  const [showForm, setShowForm] = useState(false)
  const [pend, start]           = useTransition()
  const [toast, setToast]       = useState<any>(null)
  const [err, setErr]           = useState('')
  const [search, setSearch]     = useState('')
  const [filterLokasi, setFilterLokasi] = useState('')
  const [filterKat, setFilterKat]       = useState('')
  const [voidId, setVoidId]     = useState<number|null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidPend, startVoid]   = useTransition()

  // Kategori form
  const [newKatNama, setNewKatNama]   = useState('')
  const [newKatWarna, setNewKatWarna] = useState('#8B5CF6')
  const [katPend, startKat]           = useTransition()

  // Pengeluaran form
  const today = new Date().toISOString().split('T')[0]
  const [draft, setDraft] = useState({
    tanggal: today, kategori_id: '', nama: '', nominal: '', lokasi: namaGudang, keterangan: ''
  })

  const canManage = ['owner','admin_pusat','spv','kepala_cabang'].includes(userRole)

  function flash(text: string, ok = true) { setToast({ text, ok }); setTimeout(() => setToast(null), 3500) }

  const lokasiOptions = [namaGudang, ...cabangList.map(c => c.nama)]

  const filtered = pengeluaranList.filter(p => {
    const matchSearch = !search || p.nama.toLowerCase().includes(search.toLowerCase()) ||
      (p.kategori?.nama ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLokasi = !filterLokasi || p.lokasi === filterLokasi
    const matchKat    = !filterKat    || String(p.kategori_id) === filterKat
    return matchSearch && matchLokasi && matchKat
  })

  const totalFiltered = filtered.reduce((s, p) => s + parseFloat(p.nominal), 0)

  function submitPengeluaran(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(draft).forEach(([k,v]) => fd.set(k, String(v)))
    start(async () => {
      const r = await createPengeluaran(fd)
      if (r?.error) { setErr(r.error); return }
      flash('Pengeluaran dicatat ✓')
      setShowForm(false)
      setDraft({ tanggal: today, kategori_id: '', nama: '', nominal: '', lokasi: namaGudang, keterangan: '' })
      router.refresh()
    })
  }

  function submitKategori() {
    if (!newKatNama.trim()) return
    startKat(async () => {
      const r = await createKategori(newKatNama, newKatWarna)
      if (r?.error) { flash(r.error, false); return }
      flash('Kategori ditambahkan ✓')
      setNewKatNama(''); router.refresh()
    })
  }

  function doVoid() {
    if (!voidId || !voidReason.trim()) return
    startVoid(async () => {
      const r = await voidPengeluaran(voidId, voidReason)
      if (r?.error) { flash(r.error, false); return }
      flash('Pengeluaran dihapus ✓')
      setVoidId(null); setVoidReason(''); router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Toast msg={toast}/>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pengeluaran</h1>
              {filtered.length > 0 && (
                <p className="text-xs text-gray-400">{filtered.length} transaksi · Total {fmt(totalFiltered)}</p>
              )}
            </div>
            {canManage && (
              <button onClick={() => setShowForm(!showForm)}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                <Plus size={14}/>{showForm ? 'Batal' : '+ Catat'}
              </button>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 pb-0">
            {[['list','Daftar'],['kategori','Kategori']].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k as any)}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all ${tab===k ? 'bg-white text-violet-700 shadow-sm border-t border-x border-gray-200' : 'text-gray-400'}`}>
                {l}{k==='kategori' && ` (${kategoriList.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-20">

        {/* Form tambah pengeluaran */}
        {showForm && tab === 'list' && (
          <form onSubmit={submitPengeluaran} className="bg-white rounded-2xl p-4 space-y-3" style={{boxShadow:'0 1px 6px rgba(0,0,0,0.08)'}}>
            <p className="text-sm font-bold text-gray-900">Catat Pengeluaran Baru</p>
            {err && <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl text-xs text-red-600"><AlertTriangle size={12}/>{err}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tanggal *</p>
                <input type="date" value={draft.tanggal}
                  onChange={e => setDraft(d => ({...d, tanggal:e.target.value}))}
                  className={INP} required/>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Kategori</p>
                <select value={draft.kategori_id}
                  onChange={e => setDraft(d => ({...d, kategori_id:e.target.value}))}
                  className={INP}>
                  <option value="">Pilih kategori…</option>
                  {kategoriList.filter(k => k.aktif).map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Nama Pengeluaran *</p>
              <input value={draft.nama} onChange={e => setDraft(d => ({...d, nama:e.target.value}))}
                className={INP} placeholder="cth: Gaji karyawan Mei, Listrik April…" required/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Nominal (Rp) *</p>
                <input type="number" value={draft.nominal}
                  onChange={e => setDraft(d => ({...d, nominal:e.target.value}))}
                  className={INP} placeholder="0" required/>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Lokasi *</p>
                <select value={draft.lokasi}
                  onChange={e => setDraft(d => ({...d, lokasi:e.target.value}))}
                  className={INP}>
                  {lokasiOptions.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Keterangan</p>
              <input value={draft.keterangan} onChange={e => setDraft(d => ({...d, keterangan:e.target.value}))}
                className={INP} placeholder="Opsional…"/>
            </div>

            <button type="submit" disabled={pend}
              className="w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
              {pend && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {pend ? 'Menyimpan…' : 'Simpan Pengeluaran'}
            </button>
          </form>
        )}

        {/* TAB: DAFTAR */}
        {tab === 'list' && (
          <>
            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <div className="relative flex-shrink-0 flex-1 min-w-0">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari…"
                  className="w-full h-9 pl-7 pr-3 bg-white rounded-xl text-xs focus:outline-none shadow-sm"/>
              </div>
              <select value={filterLokasi} onChange={e => setFilterLokasi(e.target.value)}
                className="h-9 px-2.5 bg-white rounded-xl text-xs shadow-sm focus:outline-none flex-shrink-0">
                <option value="">Semua Lokasi</option>
                {lokasiOptions.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
                className="h-9 px-2.5 bg-white rounded-xl text-xs shadow-sm focus:outline-none flex-shrink-0">
                <option value="">Semua Kategori</option>
                {kategoriList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Tag size={28} className="mx-auto mb-2 opacity-20"/>
                <p className="text-sm">Belum ada pengeluaran</p>
              </div>
            ) : filtered.map(p => {
              const kat = p.kategori
              return (
                <div key={p.id} className="bg-white rounded-2xl px-4 py-3.5 flex items-start gap-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{background: (kat?.warna ?? '#8B5CF6')+'18'}}>
                    <Tag size={14} style={{color: kat?.warna ?? '#8B5CF6'}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{p.nama}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {kat && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{background:(kat.warna ?? '#8B5CF6')+'18', color: kat.warna ?? '#8B5CF6'}}>{kat.nama}</span>}
                      <span className="text-[10px] text-gray-400">{p.lokasi}</span>
                      <span className="text-[10px] text-gray-400">{p.tanggal}</span>
                    </div>
                    {p.keterangan && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.keterangan}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-gray-900">{fmt(parseFloat(p.nominal))}</p>
                    {canManage && (
                      <button onClick={() => { setVoidId(p.id); setVoidReason('') }}
                        className="mt-1 w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center ml-auto">
                        <Trash2 size={11} className="text-red-400"/>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* TAB: KATEGORI */}
        {tab === 'kategori' && (
          <>
            {canManage && (
              <div className="bg-white rounded-2xl p-4 space-y-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <p className="text-sm font-bold text-gray-900">Tambah Kategori Baru</p>
                <input value={newKatNama} onChange={e => setNewKatNama(e.target.value)}
                  className={INP} placeholder="Nama kategori…"/>
                <div className="flex gap-2 flex-wrap">
                  {WARNA_OPTIONS.map(w => (
                    <button key={w} onClick={() => setNewKatWarna(w)}
                      className={`w-8 h-8 rounded-xl transition-transform ${newKatWarna===w ? 'scale-125 ring-2 ring-offset-1 ring-violet-400' : ''}`}
                      style={{background:w}}/>
                  ))}
                </div>
                <button onClick={submitKategori} disabled={katPend || !newKatNama.trim()}
                  className="w-full h-10 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                  {katPend ? 'Menyimpan…' : '+ Tambah Kategori'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {kategoriList.map(k => (
                <div key={k.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{background: k.warna+'30'}}>
                    <div className="w-full h-full rounded-xl" style={{background: k.warna+'50'}}/>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{background: k.warna}}/>
                    <p className="text-sm font-bold text-gray-800">{k.nama}</p>
                    {!k.aktif && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                  </div>
                  {canManage && k.aktif && (
                    <button onClick={async () => {
                      const r = await deleteKategori(k.id)
                      if (r?.error) flash(r.error, false)
                      else { flash('Kategori dinonaktifkan'); router.refresh() }
                    }} className="ml-auto w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                      <X size={11} className="text-red-400"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Void confirm */}
      {voidId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900">Hapus Pengeluaran?</h3>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Alasan *</p>
              <input value={voidReason} onChange={e => setVoidReason(e.target.value)}
                className={INP} placeholder="Alasan penghapusan…" autoFocus/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setVoidId(null)} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
              <button onClick={doVoid} disabled={voidPend || !voidReason.trim()}
                className="flex-1 h-11 rounded-xl bg-red-500 text-sm font-bold text-white disabled:opacity-40">
                {voidPend ? '…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
