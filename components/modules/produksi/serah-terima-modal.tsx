'use client'

import { useState } from 'react'
import { X, Camera, AlertTriangle } from 'lucide-react'
import LossApprovalPanel from '@/components/modules/produksi/loss-approval-panel'
import { compressImage } from '@/lib/compress-image'

const inp = "w-full px-4 py-3 text-sm bg-white/80 border border-gray-200/70 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400"

async function filesToBase64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => compressImage(f)))
}

// ════════════════════════════════════════════════════════════════════════════
// STANDARD SERAH-TERIMA MODAL — pola seragam mengikuti desain Peleburan.
// Dipakai untuk: Cutting, Pas Berat, Annealing, Siap Packing.
// Mode "serah" = penyerahan (input awal), mode "terima" = penerimaan (input hasil).
// Khusus Pas Berat: field tambahan "Sisa Serbuk" (showSerbuk=true).
// ════════════════════════════════════════════════════════════════════════════

type Tim = { id: number; nama: string; anggota?: { id: number; nama: string; aktif: boolean }[] }

interface SharedProps {
  judul: string          // cth: "Serahkan ke Cutting" / "Terima Cutting"
  kode: string           // kode produksi
  tims: Tim[]
  adminList: { id: number; nama: string }[]
  isPending: boolean
  error?: string
  onClose: () => void
  onSubmit: (fd: FormData) => void
}

// ─── Tim Picker: pilih tim → anggota auto tampil sbg chip, bisa hapus/tambah ────
export function TimPickerStd({ tims, prefix, initialTimId, initialAnggota }: { tims: Tim[]; prefix: string; initialTimId?: string; initialAnggota?: string[] }) {
  const [timId, setTimId] = useState(initialTimId ?? '')
  const [anggotaAktif, setAnggotaAktif] = useState<string[]>(() => {
    if (initialAnggota !== undefined) return initialAnggota
    // Auto-fill dari tim jika initialAnggota tidak ada (poin 8: anggota tidak hilang saat edit)
    if (initialTimId) {
      const t = tims.find(x => String(x.id) === initialTimId)
      return (t?.anggota ?? []).filter((a: any) => a.aktif).map((a: any) => a.nama)
    }
    return []
  })
  const [tambah, setTambah] = useState('')
  const selected = tims.find(t => String(t.id) === timId)

  function pilih(id: string) {
    setTimId(id)
    const t = tims.find(x => String(x.id) === id)
    setAnggotaAktif((t?.anggota ?? []).filter(a => a.aktif).map(a => a.nama))
  }
  function hapus(n: string) { setAnggotaAktif(anggotaAktif.filter(x => x !== n)) }
  function add() {
    const n = tambah.trim()
    if (!n || anggotaAktif.includes(n)) { setTambah(''); return }
    setAnggotaAktif([...anggotaAktif, n]); setTambah('')
  }

  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">Tim Pengerjaan</label>
      <select name={`${prefix}tim_id`} value={timId} onChange={e => pilih(e.target.value)} className={inp}>
        <option value="">Pilih tim…</option>
        {tims.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
      </select>
      {(selected || anggotaAktif.length > 0) && (
        <div className="mt-1.5 p-2.5 rounded-2xl" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' }}>
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mb-1.5">Anggota yang mengerjakan</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {anggotaAktif.length === 0 && <span className="text-[11px] text-gray-300 italic">Tidak ada anggota</span>}
            {anggotaAktif.map(n => (
              <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-700 bg-white border border-violet-100">
                {n}
                <button type="button" onClick={() => hapus(n)} className="text-gray-400 hover:text-red-500"><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input value={tambah} onChange={e => setTambah(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="Tambah anggota (cth: Pak Nendi)"
              className="flex-1 h-8 px-2.5 bg-white rounded-lg text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-300 border border-gray-200" />
            <button type="button" onClick={add} className="px-2.5 h-8 rounded-lg text-xs font-bold text-violet-600 bg-white border border-violet-200">+ Tambah</button>
          </div>
        </div>
      )}
      {selected && <input type="hidden" name={`${prefix}tim_nama`} value={selected.nama} />}
      <input type="hidden" name={`${prefix}tim_anggota_aktif`} value={anggotaAktif.join(', ')} />
      <input type="hidden" name={`${prefix}operator`} value={anggotaAktif.join(', ')} />
    </div>
  )
}

// ─── Admin Input Picker: dropdown + manual ──────────────────────────────────────
export function AdminPickerStd({ adminList, prefix, initialValue }: { adminList: { id: number; nama: string }[]; prefix: string; initialValue?: string }) {
  const knownNames = adminList.map(a => a.nama)
  const startManual = !!initialValue && !knownNames.includes(initialValue)
  const [manual, setManual] = useState(startManual)
  const [value, setValue] = useState(initialValue ?? '')
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">Admin Yang Input</label>
      {manual ? (
        <input name={`${prefix}admin_input`} value={value} onChange={e => setValue(e.target.value)} placeholder="Ketik nama admin" className={inp} autoFocus />
      ) : (
        <select name={`${prefix}admin_input`} value={value} onChange={e => {
          if (e.target.value === '__manual__') { setManual(true); setValue('') } else setValue(e.target.value)
        }} className={inp}>
          <option value="">Pilih admin…</option>
          {adminList.map(a => <option key={a.id} value={a.nama}>{a.nama}</option>)}
          <option value="__manual__">+ Ketik manual…</option>
        </select>
      )}
      {manual && <button type="button" onClick={() => { setManual(false); setValue('') }} className="text-[10px] text-violet-400 font-semibold mt-1">← Pilih dari daftar</button>}
    </div>
  )
}

// ─── Foto picker seragam (pola Peleburan) ───────────────────────────────────────
function FotoPickerStd({ fotos, setFotos, accent }: { fotos: File[]; setFotos: (f: File[]) => void; accent: 'violet' | 'green' }) {
  const border = accent === 'green' ? 'border-green-200' : 'border-violet-200'
  const hover = accent === 'green' ? 'hover:bg-green-50' : 'hover:bg-violet-50'
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">Foto Bukti (max 10)</label>
      <label className={`flex items-center gap-2 h-10 px-3 bg-[#F2F2F7] rounded-xl cursor-pointer ${hover} transition-colors`}>
        <Camera size={14} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto'}</span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => setFotos([...fotos, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
      </label>
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {fotos.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} alt="" className={`w-14 h-14 rounded-xl object-cover border ${border}`} />
              <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODE SERAH — Penyerahan ke proses berikutnya
// ════════════════════════════════════════════════════════════════════════════
export function SerahModalStd({ judul, kode, tims, adminList, isPending, error, onClose, onSubmit, serahGramDefault, initialData, isEdit }: SharedProps & { serahGramDefault?: number; initialData?: any; isEdit?: boolean }) {
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const d = initialData ?? {}
  const initTimId = d.tim_id != null ? String(d.tim_id) : ''
  const initAnggota = d.tim_anggota_aktif ? String(d.tim_anggota_aktif).split(',').map((x:string)=>x.trim()).filter(Boolean) : undefined

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    setUp(true)
    try {
      const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64))
      onSubmit(fd)
    } finally { setUp(false) }
  }

  return (
    <ModalShell judul={judul} kode={kode} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pb-6 space-y-4 overflow-y-auto flex-1">
        {/* Section box: Diserahkan (violet) */}
        <div className="rounded-2xl overflow-hidden border border-violet-100">
          <div className="px-4 py-2.5 text-xs font-bold text-violet-700 uppercase tracking-wide" style={{ background: 'rgba(139,92,246,0.06)' }}>
            📤 Diserahkan
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Berat Diserahkan (gr) *</label>
              <input name="serah_gram" type="number" step="0.001" defaultValue={d.serah_gram ?? serahGramDefault ?? ''} placeholder="cth: 100,000" className={inp} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tanggal Serah *</label>
                <input name="serah_tanggal" type="date" defaultValue={d.serah_tanggal ?? new Date().toISOString().split('T')[0]} className={inp} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Jam Serah *</label>
                <input name="serah_jam" type="time" defaultValue={d.serah_jam ? String(d.serah_jam).slice(0,5) : undefined} className={inp} required />
              </div>
            </div>
            <TimPickerStd tims={tims} prefix="serah_" initialTimId={initTimId} initialAnggota={initAnggota} />
            <AdminPickerStd adminList={adminList} prefix="serah_" initialValue={d.serah_admin_input ?? ''} />
            <FotoPickerStd fotos={fotos} setFotos={setFotos} accent="violet" />
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Catatan Penyerahan</label>
              <input name="serah_catatan" type="text" defaultValue={d.serah_catatan ?? ''} placeholder="Opsional" className={inp} />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-xl text-xs text-red-600">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
          <button type="submit" disabled={isPending || up} className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
            {up ? 'Upload foto…' : isPending ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Serahkan'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODE TERIMA — Penerimaan hasil proses
// ════════════════════════════════════════════════════════════════════════════
export function TerimaModalStd({
  judul, kode, tims, adminList, isPending, error, onClose, onSubmit,
  serahGram, toleransi = 0.05, showSerbuk = false, prosesLabel, initialData, isEdit,
}: SharedProps & { serahGram: number; toleransi?: number; showSerbuk?: boolean; prosesLabel: string; initialData?: any; isEdit?: boolean }) {
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const d = initialData ?? {}
  const initTimId = d.tim_id != null ? String(d.tim_id) : ''
  const initAnggota = d.tim_anggota_aktif ? String(d.tim_anggota_aktif).split(',').map((x:string)=>x.trim()).filter(Boolean) : undefined
  const [adaReject, setAdaReject] = useState(Number(d.reject_gram) > 0 || Number(d.reject_pcs) > 0)
  // Foto lama yang sudah keupload (mode edit) — bisa dihapus per item
  const [existingFotos, setExistingFotos] = useState<string[]>(
    Array.isArray(d.terima_fotos) ? d.terima_fotos : (Array.isArray(d.foto_diterima_cutting) ? d.foto_diterima_cutting : [])
  )

  // Loss realtime
  const [terimaVal, setTerimaVal] = useState(d.terima_gram != null ? String(d.terima_gram) : '')
  const [rejectVal, setRejectVal] = useState(d.reject_gram != null ? String(d.reject_gram) : '0')
  const [serbukVal, setSerbukVal] = useState(d.sisa_serbuk != null ? String(d.sisa_serbuk) : '0')
  const lossNow = Math.max(0, Number(serahGram) - (parseFloat(terimaVal) || 0) - (parseFloat(rejectVal) || 0) - (parseFloat(serbukVal) || 0))
  const overTol = terimaVal !== '' && lossNow > toleransi + 0.0001
  const [lossAlasan, setLossAlasan] = useState('')
  const [lossOpNama, setLossOpNama] = useState('')
  const [lossAdminNama, setLossAdminNama] = useState('')
  const [ttdOp, setTtdOp] = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    if (overTol) {
      if (!lossAlasan.trim()) { alert('Alasan loss wajib diisi'); return }
      if (!ttdOp) { alert('Tanda tangan operator wajib'); return }
      if (!ttdAdmin) { alert('Tanda tangan admin wajib'); return }
    }
    setUp(true)
    try {
      const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64))
      fd.set('existing_fotos', JSON.stringify(existingFotos))
      if (overTol) {
        fd.set('loss_alasan', lossAlasan)
        fd.set('loss_operator_nama', lossOpNama)
        fd.set('loss_admin_nama', lossAdminNama)
        if (ttdOp) fd.set('loss_ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
      }
      onSubmit(fd)
    } finally { setUp(false) }
  }

  return (
    <ModalShell judul={judul} kode={kode} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pb-6 space-y-4 overflow-y-auto flex-1">
        {/* Info chip serah gram */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(139,92,246,0.06)' }}>
          <span className="text-gray-500">Diserahkan:</span>
          <span className="font-bold text-violet-700">{Number(serahGram).toFixed(3)} gr</span>
        </div>

        {/* Section box: Diterima (green) */}
        <div className="rounded-2xl overflow-hidden border border-green-100">
          <div className="px-4 py-2.5 text-xs font-bold text-green-700 uppercase tracking-wide" style={{ background: 'rgba(16,185,129,0.06)' }}>
            📥 Diterima
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Berat Diterima (gr) *</label>
              <input name="terima_gram" type="number" step="0.001" placeholder={`Max ${Number(serahGram).toFixed(3)} gr`}
                value={terimaVal} onChange={e => setTerimaVal(e.target.value)} className={inp} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tanggal Terima *</label>
                <input name="terima_tanggal" type="date" defaultValue={d.terima_tanggal ?? new Date().toISOString().split('T')[0]} className={inp} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Jam Terima *</label>
                <input name="terima_jam" type="time" defaultValue={d.terima_jam ? String(d.terima_jam).slice(0,5) : undefined} className={inp} required />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jumlah PCS</label>
              <input name="terima_pcs" type="number" min="1" defaultValue={d.terima_pcs ?? ''} placeholder="Isi jika sudah dihitung" className={inp} />
            </div>

            {/* Khusus Pas Berat: Sisa Serbuk */}
            {showSerbuk && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Sisa Serbuk (gr)</label>
                <input name="sisa_serbuk" type="number" step="0.001" value={serbukVal} onChange={e => setSerbukVal(e.target.value)} className={inp} />
              </div>
            )}

            {/* Reject: Cutting WAJIB selalu tampil, proses lain pakai checkbox */}
            {prosesLabel === 'Cutting' ? (
              <div className="rounded-xl p-3 border border-red-100" style={{ background: 'rgba(239,68,68,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">⚠ Reject Cutting</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                  Reject cutting dilebur ulang → kembali jadi bahan baku batch. Isi 0 jika tidak ada reject.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">Berat Reject Cutting (gr)</label>
                    <input name="reject_gram" type="number" step="0.001" min="0"
                      value={rejectVal} onChange={e => setRejectVal(e.target.value)}
                      className={inp} placeholder="0.000" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">Reject (pcs)</label>
                    <input name="reject_pcs" type="number" min="0"
                      defaultValue={d.reject_pcs ?? 0} className={inp} placeholder="0" />
                  </div>
                </div>
              </div>
            ) : (
              /* Proses lain (Pas Berat, Annealing, Siap Packing): reject opsional */
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={adaReject} onChange={e => { setAdaReject(e.target.checked); if (!e.target.checked) setRejectVal('0') }}
                    className="w-4 h-4 rounded accent-red-500" />
                  <span className="text-xs font-semibold text-gray-500">Ada reject yang perlu dilebur ulang?</span>
                </label>
                {adaReject && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Reject (gr)</label>
                      <input name="reject_gram" type="number" step="0.001" value={rejectVal} onChange={e => setRejectVal(e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Reject (pcs)</label>
                      <input name="reject_pcs" type="number" min="0" defaultValue={d.reject_pcs ?? 0} className={inp} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <TimPickerStd tims={tims} prefix="terima_" initialTimId={initTimId} initialAnggota={initAnggota} />
            <AdminPickerStd adminList={adminList} prefix="terima_" initialValue={d.terima_admin_input ?? ''} />
            {existingFotos.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Foto Sebelumnya</label>
                <div className="flex flex-wrap gap-2">
                  {existingFotos.map((u, i) => (
                    <div key={i} className="relative">
                      <img src={u} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-green-100" />
                      <button type="button" onClick={() => setExistingFotos(existingFotos.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <FotoPickerStd fotos={fotos} setFotos={setFotos} accent="green" />
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Catatan Penerimaan</label>
              <input name="terima_catatan" type="text" defaultValue={d.terima_catatan ?? ''} placeholder="Opsional" className={inp} />
            </div>
          </div>
        </div>

        {/* Loss indicator realtime */}
        {terimaVal !== '' && (
          <div className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between"
            style={{ background: overTol ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: overTol ? '#DC2626' : '#16A34A' }}>
            <span>Loss: {lossNow.toFixed(3)} gr</span>
            <span className="text-[10px]">{overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
          </div>
        )}

        {overTol && (
          <LossApprovalPanel
            lossGram={lossNow} toleransiGram={toleransi} proses={prosesLabel}
            alasan={lossAlasan} setAlasan={setLossAlasan}
            operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
            adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
            setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
          />
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-xl text-xs text-red-600">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
          <button type="submit" disabled={isPending || up} className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
            {up ? 'Upload foto…' : isPending ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Terima'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ─── Shell modal seragam (bottom-sheet mobile / center desktop) ─────────────────
function ModalShell({ judul, kode, onClose, children }: { judul: string; kode: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{judul}</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">{kode}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}




