// @ts-nocheck
'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Search, ChevronDown, ChevronRight, Check, X, AlertTriangle, ArrowRight, Package, Printer, Clock, CheckCircle, XCircle, Filter } from 'lucide-react'
import { createMutasi, accMutasi, tolakMutasi, getSTAvailable } from '@/app/(dashboard)/mutasi/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INP = "w-full h-11 px-3.5 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:bg-white transition-all"

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    transit:  { label: 'Transit',  cls: 'bg-amber-50 text-amber-600' },
    selesai:  { label: 'Selesai',  cls: 'bg-emerald-50 text-emerald-600' },
    ditolak:  { label: 'Ditolak',  cls: 'bg-red-50 text-red-500' },
    pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
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

function FL({ label, req, children }: { label: string; req?: boolean; children: any }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{req && <span className="text-violet-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

// ─── Surat Jalan Print View ───────────────────────────────────────────────────
function SuratJalan({ mutasi, onClose }: { mutasi: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Surat Jalan</h2>
              <p className="text-xs text-violet-500 font-semibold">{mutasi.nomor}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()}
                className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-violet-600 text-white">
                <Printer size={12} />Cetak
              </button>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <X size={14} className="text-gray-500" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4 print-area">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['No. Surat', mutasi.nomor],
                ['Tanggal',   mutasi.tanggal],
                ['Dari',      mutasi.dari_lokasi],
                ['Ke',        mutasi.ke_lokasi],
                ['Pengirim',  mutasi.pengirim_name ?? '—'],
                ['Keterangan',mutasi.keterangan ?? '—'],
              ].map(([k,v]) => (
                <div key={k}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{k}</p>
                  <p className="text-sm font-semibold text-gray-800">{v}</p>
                </div>
              ))}
            </div>

            {/* List ST */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                Daftar Shieldtag ({(mutasi.shieldtag_kodes ?? []).length} pcs)
              </p>
              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">
                  <span>No</span><span>Kode ST</span><span>Produk</span>
                </div>
                {(mutasi.shieldtag_details ?? mutasi.shieldtag_kodes ?? []).map((st: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 px-3 py-2 border-t text-xs">
                    <span className="text-gray-400">{i + 1}</span>
                    <span className="font-mono font-semibold text-gray-700">{typeof st === 'string' ? st : st.kode}</span>
                    <span className="text-gray-600">{typeof st === 'string' ? mutasi.gramasi ?? '—' : (st.produk_nama ?? st.gramasi ?? '—')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tanda tangan */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              {['Pengirim', 'Penerima'].map(role => (
                <div key={role} className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-12">{role}</p>
                  <div className="border-t border-gray-300 pt-1">
                    <p className="text-[10px] text-gray-400">( __________________ )</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Buat Mutasi Modal ────────────────────────────────────────────────────────
function BuatMutasiModal({ cabang, namaGudang, userRole, userCabangKode, onClose, showToast }: {
  cabang: any[]; namaGudang: string; userRole: string; userCabangKode: string | null
  onClose: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [step, setStep] = useState<'form'|'pilih_st'|'confirm'>('form')
  const [pend, start] = useTransition()
  const [dari, setDari] = useState('')
  const [ke, setKe]     = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [stList, setStList]     = useState<any[]>([])
  const [selectedST, setSelectedST] = useState<string[]>([])
  const [stSearch, setStSearch] = useState('')
  const [loadingST, setLoadingST] = useState(false)
  const [err, setErr] = useState('')

  // Lokasi options
  const lokasiList = [
    { kode: '', nama: namaGudang },
    ...cabang.filter(c => c.aktif).map(c => ({ kode: c.kode, nama: c.nama })),
  ]

  async function loadST() {
    if (!dari) { setErr('Pilih lokasi asal dulu'); return }
    if (!ke)   { setErr('Pilih lokasi tujuan dulu'); return }
    setErr('')
    setLoadingST(true)
    const r = await getSTAvailable(dari === '' ? namaGudang : lokasiList.find(l=>l.kode===dari)?.nama ?? dari)
    setLoadingST(false)
    if (r.error) { setErr(r.error); return }
    setStList(r.data ?? [])
    setStep('pilih_st')
  }

  function toggleST(kode: string) {
    setSelectedST(prev => prev.includes(kode) ? prev.filter(k => k !== kode) : [...prev, kode])
  }

  function submit() {
    if (selectedST.length === 0) { setErr('Pilih minimal 1 Shieldtag'); return }
    start(async () => {
      const fd = new FormData()
      const dariLokasi = dari === '' ? namaGudang : lokasiList.find(l=>l.kode===dari)?.nama ?? dari
      const keLokasi   = ke === ''   ? namaGudang : lokasiList.find(l=>l.kode===ke)?.nama   ?? ke
      fd.set('dari_lokasi', dariLokasi)
      fd.set('ke_lokasi',   keLokasi)
      fd.set('dari_kode',   dari)
      fd.set('ke_kode',     ke)
      fd.set('keterangan',  keterangan)
      fd.set('st_kodes',    JSON.stringify(selectedST))
      const r = await createMutasi(fd)
      if (r?.error) { setErr(r.error); return }
      showToast(`Mutasi ${r.nomor} dibuat ✓`)
      onClose()
    })
  }

  const filteredST = stList.filter(st =>
    !stSearch || st.kode.toLowerCase().includes(stSearch.toLowerCase()) ||
    (st.packing?.produksi_item?.produk?.nama ?? st.packing?.produksi_item?.nama_item ?? '').toLowerCase().includes(stSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Buat Mutasi</h2>
            <p className="text-xs text-violet-500">
              {step === 'form' ? 'Isi detail mutasi' : step === 'pilih_st' ? `Pilih Shieldtag (${selectedST.length} dipilih)` : 'Konfirmasi'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-xl text-xs text-red-600 font-medium">
              <AlertTriangle size={13} className="flex-shrink-0" />
              {err}
            </div>
          )}

          {step === 'form' && (
            <>
              <FL label="Dari Lokasi" req>
                <select value={dari} onChange={e => setDari(e.target.value)} className={INP}>
                  {lokasiList.map(l => <option key={l.kode} value={l.kode}>{l.nama}</option>)}
                </select>
              </FL>
              <FL label="Ke Lokasi" req>
                <select value={ke} onChange={e => setKe(e.target.value)} className={INP}>
                  <option value="">Pilih tujuan…</option>
                  {lokasiList.filter(l => l.kode !== dari).map(l => <option key={l.kode} value={l.kode}>{l.nama}</option>)}
                </select>
              </FL>
              <FL label="Keterangan">
                <input value={keterangan} onChange={e => setKeterangan(e.target.value)}
                  className={INP} placeholder="Opsional…" />
              </FL>
              <button onClick={loadST} disabled={loadingST || !ke}
                className="w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                {loadingST ? 'Memuat ST…' : 'Lanjut → Pilih Shieldtag'}
              </button>
            </>
          )}

          {step === 'pilih_st' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  {stList.length} ST tersedia · {selectedST.length} dipilih
                </p>
                {selectedST.length > 0 && (
                  <button onClick={() => setSelectedST([])} className="text-xs text-red-400 font-semibold">Reset</button>
                )}
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={stSearch} onChange={e => setStSearch(e.target.value)}
                  placeholder="Cari kode ST / produk…"
                  className="w-full h-10 pl-8 pr-3 bg-[#F2F2F7] rounded-xl text-sm focus:outline-none" />
              </div>

              {/* Select all */}
              <button onClick={() => setSelectedST(filteredST.map(s => s.kode))}
                className="text-xs font-semibold text-violet-500">
                Pilih Semua ({filteredST.length})
              </button>

              {filteredST.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Package size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Tidak ada ST tersedia di lokasi ini</p>
                </div>
              )}

              <div className="space-y-1.5">
                {filteredST.map(st => {
                  const produkNama = st.packing?.produksi_item?.produk?.nama ?? st.packing?.produksi_item?.nama_item ?? `${st.gramasi} gr`
                  const isSelected = selectedST.includes(st.kode)
                  return (
                    <button key={st.kode} onClick={() => toggleST(st.kode)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all ${isSelected ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-white'}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-violet-500 bg-violet-500' : 'border-gray-300'}`}>
                        {isSelected && <Check size={11} className="text-white" />}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-gray-800">{st.kode}</p>
                        <p className="text-[11px] text-gray-500 truncate">{produkNama} · {st.gramasi} gr</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep('form')} className="flex-1 h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600">← Kembali</button>
                <button onClick={submit} disabled={pend || selectedST.length === 0}
                  className="flex-[2] h-11 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                  {pend ? 'Menyimpan…' : `Buat Mutasi (${selectedST.length} ST)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Card Mutasi ─────────────────────────────────────────────────────────────
function MutasiCard({ m, canACC, onShowSurat, showToast }: {
  m: any; canACC: boolean; onShowSurat: (m: any) => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [pend, start] = useTransition()
  const [tolakConf, setTolakConf] = useState(false)
  const [catatan, setCatatan] = useState('')

  function doACC() {
    start(async () => {
      const r = await accMutasi(m.id, catatan)
      if (r?.error) { showToast(r.error, false); return }
      showToast('Mutasi di-ACC ✓')
    })
  }

  function doTolak() {
    if (!catatan.trim()) { showToast('Isi alasan penolakan dulu', false); return }
    start(async () => {
      const r = await tolakMutasi(m.id, catatan)
      if (r?.error) { showToast(r.error, false); return }
      showToast('Mutasi ditolak')
      setTolakConf(false)
    })
  }

  const stKodes = m.shieldtag_kodes ?? []

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="px-4 py-3.5">
        {/* Row 1: nomor + status */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-violet-600">{m.nomor}</p>
          <StatusBadge status={m.status} />
        </div>

        {/* Row 2: dari → ke */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-1.5">
          <span className="font-semibold truncate max-w-[100px]">{m.dari_lokasi}</span>
          <ArrowRight size={11} className="text-gray-400 flex-shrink-0" />
          <span className="font-semibold truncate max-w-[100px]">{m.ke_lokasi}</span>
          <span className="ml-auto text-gray-400 flex-shrink-0">{stKodes.length} pcs</span>
        </div>

        {/* Row 3: tanggal + pengirim */}
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>{m.tanggal} · {m.pengirim_name ?? '—'}</span>
          <div className="flex gap-1.5">
            <button onClick={() => onShowSurat(m)}
              className="flex items-center gap-1 text-violet-500 font-semibold">
              <Printer size={11} />Surat
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-gray-400">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Detail
            </button>
          </div>
        </div>

        {/* ACC buttons */}
        {canACC && m.status === 'transit' && !tolakConf && (
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
            <input value={catatan} onChange={e => setCatatan(e.target.value)}
              className="w-full h-9 px-3 bg-[#F2F2F7] rounded-xl text-xs focus:outline-none"
              placeholder="Catatan penerima (opsional)…" />
            <div className="flex gap-2">
              <button onClick={() => setTolakConf(true)}
                className="flex-1 h-10 rounded-xl bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center gap-1">
                <XCircle size={13} />Tolak
              </button>
              <button onClick={doACC} disabled={pend}
                className="flex-[2] h-10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                <CheckCircle size={13} />{pend ? 'Menyimpan…' : 'ACC Terima'}
              </button>
            </div>
          </div>
        )}

        {/* Tolak confirm */}
        {tolakConf && (
          <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
            <input value={catatan} onChange={e => setCatatan(e.target.value)}
              className="w-full h-9 px-3 bg-red-50 rounded-xl text-xs focus:outline-none border border-red-200"
              placeholder="Alasan penolakan (wajib)…" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setTolakConf(false); setCatatan('') }}
                className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold">Batal</button>
              <button onClick={doTolak} disabled={pend}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-50">
                {pend ? '…' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded: list ST */}
      {expanded && (
        <div className="border-t border-gray-50 bg-[#FAFAFA] px-4 py-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Shieldtag ({stKodes.length})</p>
          <div className="space-y-1">
            {stKodes.map((kode: string, i: number) => (
              <div key={kode} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-300 w-5">{i+1}.</span>
                <span className="font-mono font-semibold text-gray-700">{kode}</span>
              </div>
            ))}
          </div>
          {m.keterangan && (
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">📝 {m.keterangan}</p>
          )}
          {m.acc_catatan && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold">{m.status === 'ditolak' ? '❌' : '✅'} {m.acc_name}:</span> {m.acc_catatan}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MutasiClient({ mutasiList, cabang, namaGudang, userRole, userCabangKode, pendingACC }: {
  mutasiList: any[]; cabang: any[]; namaGudang: string
  userRole: string; userCabangKode: string | null; pendingACC: number
}) {
  const [showBuat, setShowBuat]   = useState(false)
  const [suratFor, setSuratFor]   = useState<any | null>(null)
  const [filter, setFilter]       = useState<'semua'|'transit'|'selesai'|'ditolak'>('semua')
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState<{ text: string; ok: boolean } | null>(null)

  const canBuat = ['owner','admin_pusat','spv','kepala_cabang'].includes(userRole)
  const canACC  = ['owner','admin_pusat','spv','kepala_cabang'].includes(userRole)

  function showToast(text: string, ok = true) { setToast({ text, ok }); setTimeout(() => setToast(null), 3000) }

  const filtered = mutasiList.filter(m => {
    const matchFilter = filter === 'semua' || m.status === filter
    const matchSearch = !search || m.nomor.toLowerCase().includes(search.toLowerCase()) ||
      m.dari_lokasi?.toLowerCase().includes(search.toLowerCase()) ||
      m.ke_lokasi?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Toast msg={toast} />

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-black/5">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Mutasi</h1>
              {pendingACC > 0 && (
                <p className="text-xs text-amber-600 font-semibold mt-0.5">
                  ⏳ {pendingACC} menunggu ACC
                </p>
              )}
            </div>
            {canBuat && (
              <button onClick={() => setShowBuat(true)}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
                <Plus size={14} />Buat
              </button>
            )}
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {(['semua','transit','selesai','ditolak'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  filter === f ? 'bg-violet-600 text-white' : 'bg-white text-gray-500'
                }`}>
                {f === 'semua' ? 'Semua' : f === 'transit' ? '🚚 Transit' : f === 'selesai' ? '✅ Selesai' : '❌ Ditolak'}
                {f === 'transit' && pendingACC > 0 && (
                  <span className="ml-1 bg-amber-400 text-white text-[9px] px-1.5 rounded-full">{pendingACC}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-20">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor, lokasi…"
            className="w-full h-10 pl-8 pr-3 bg-white rounded-xl text-sm focus:outline-none shadow-sm" />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <ArrowRight size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada mutasi</p>
          </div>
        )}

        {filtered.map(m => (
          <MutasiCard key={m.id} m={m} canACC={canACC}
            onShowSurat={setSuratFor} showToast={showToast} />
        ))}
      </div>

      {showBuat && (
        <BuatMutasiModal
          cabang={cabang} namaGudang={namaGudang}
          userRole={userRole} userCabangKode={userCabangKode}
          onClose={() => setShowBuat(false)} showToast={showToast}
        />
      )}

      {suratFor && <SuratJalan mutasi={suratFor} onClose={() => setSuratFor(null)} />}
    </div>
  )
}
