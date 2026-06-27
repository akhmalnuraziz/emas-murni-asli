'use client'

import { useState } from 'react'
import { X, Camera, AlertTriangle } from 'lucide-react'
import LossApprovalPanel from '@/components/modules/produksi/loss-approval-panel'
import { compressImage } from '@/lib/compress-image'

const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"

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
      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tim Yang Mengerjakan</label>
      <select name={`${prefix}tim_id`} value={timId} onChange={e => pilih(e.target.value)} className={inp}>
        <option value="">Pilih tim…</option>
        {tims.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
      </select>
      {(selected || anggotaAktif.length > 0) && (
        <div className="mt-1.5 p-2.5 rounded-lg bg-violet-50 border border-violet-100">
          <p className="text-[10px] font-medium text-violet-400 mb-1.5">Anggota yang mengerjakan</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {anggotaAktif.length === 0 && <span className="text-[11px] text-slate-300 italic">Tidak ada anggota</span>}
            {anggotaAktif.map(n => (
              <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium text-slate-700 bg-white border border-violet-100">
                {n}
                <button type="button" onClick={() => hapus(n)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input value={tambah} onChange={e => setTambah(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="Tambah anggota (cth: Pak Nendi)"
              className="flex-1 h-8 px-2.5 bg-white rounded-lg text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-300 border border-slate-200" />
            <button type="button" onClick={add} className="px-2.5 h-8 rounded-lg text-[12px] font-semibold text-violet-600 bg-white border border-violet-200">+ Tambah</button>
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
export function AdminPickerStd({ adminList, prefix, initialValue, label, placeholder }: { adminList: { id: number; nama: string }[]; prefix: string; initialValue?: string; label?: string; placeholder?: string }) {
  const knownNames = adminList.map(a => a.nama)
  const startManual = !!initialValue && !knownNames.includes(initialValue)
  const [manual, setManual] = useState(startManual)
  const [value, setValue] = useState(initialValue ?? '')
  const resolvedLabel = label ?? 'Admin Yang Menyerahkan'
  const resolvedPlaceholder = placeholder ?? `Pilih ${resolvedLabel}…`
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{resolvedLabel}</label>
      {manual ? (
        <input name={`${prefix}admin_input`} value={value} onChange={e => setValue(e.target.value)} placeholder="Ketik nama admin" className={inp} autoFocus />
      ) : (
        <select name={`${prefix}admin_input`} value={value} onChange={e => {
          if (e.target.value === '__manual__') { setManual(true); setValue('') } else setValue(e.target.value)
        }} className={inp}>
          <option value="">{resolvedPlaceholder}</option>
          {adminList.map(a => <option key={a.id} value={a.nama}>{a.nama}</option>)}
          <option value="__manual__">+ Ketik manual…</option>
        </select>
      )}
      {manual && <button type="button" onClick={() => { setManual(false); setValue('') }} className="text-[10px] text-violet-400 font-semibold mt-1">← Pilih dari daftar</button>}
    </div>
  )
}

// ─── Foto picker seragam (pola Peleburan) ───────────────────────────────────────
function FotoPickerStd({ fotos, setFotos, label = 'Foto Bahan Diterima (Max 10 Foto)' }: { fotos: File[]; setFotos: (f: File[]) => void; label?: string }) {
  const [lb, setLb] = useState<string | null>(null)
  return (
    <div>
      {lb && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4" onClick={() => setLb(null)}>
          <img src={lb} className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLb(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm"><X size={18} /></button>
        </div>
      )}
      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{label}</label>
      <label className="flex items-center gap-2 h-10 px-3 bg-white rounded-lg border border-dashed border-violet-200 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-colors">
        <Camera size={14} className="text-slate-400 flex-shrink-0" />
        <span className="text-[13px] text-slate-400">{fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto'}</span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => setFotos([...fotos, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
      </label>
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {fotos.map((f, i) => {
            const url = URL.createObjectURL(f)
            return (
              <div key={i} className="relative">
                <img src={url} alt="" onClick={() => setLb(url)}
                  className="w-14 h-14 rounded-lg object-cover border-2 border-violet-300 cursor-zoom-in hover:scale-110 transition-transform" />
                <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
              </div>
            )
          })}
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
      <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Section box: Diserahkan (violet) */}
          <div className="rounded-lg overflow-hidden border border-violet-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border-b border-violet-100">
              <span className="text-[11px] font-medium text-violet-700">📤 Diserahkan</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat Diserahkan (gr) *</label>
                <input name="serah_gram" type="number" step="0.001" defaultValue={d.serah_gram ?? serahGramDefault ?? ''} placeholder="cth: 100,000" className={inp} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Serah *</label>
                  <input name="serah_tanggal" type="date" defaultValue={d.serah_tanggal ?? new Date().toISOString().split('T')[0]} className={inp} required />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jam Serah *</label>
                  <input name="serah_jam" type="time" defaultValue={d.serah_jam ? String(d.serah_jam).slice(0,5) : undefined} className={inp} required />
                </div>
              </div>
              <AdminPickerStd adminList={adminList} prefix="serah_" initialValue={d.serah_admin_input ?? ''} label="Admin Yang Menyerahkan" />
              <FotoPickerStd fotos={fotos} setFotos={setFotos} label="Foto Bahan Diserahkan (Max 10 Foto)" />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan Penyerahan</label>
                <input name="serah_catatan" type="text" defaultValue={d.serah_catatan ?? ''} placeholder="Opsional" className={inp} />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-600">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button type="submit" disabled={isPending || up} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
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
  // Gain (timbangan naik): total keluar > serah → emas bertambah, wajib disetujui juga
  const gainNow = Math.max(0, ((parseFloat(terimaVal) || 0) + (parseFloat(rejectVal) || 0) + (parseFloat(serbukVal) || 0)) - Number(serahGram))
  const overGain = terimaVal !== '' && gainNow > toleransi + 0.0001
  const [lossAlasan, setLossAlasan] = useState('')
  const [lossOpNama, setLossOpNama] = useState('')
  const [lossAdminNama, setLossAdminNama] = useState('')
  const [ttdOp, setTtdOp] = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    if (overTol || overGain) {
      if (!lossAlasan.trim()) { alert(overGain ? 'Alasan timbangan naik wajib diisi' : 'Alasan loss wajib diisi'); return }
      if (!ttdOp) { alert('Tanda tangan operator wajib'); return }
      if (!ttdAdmin) { alert('Tanda tangan admin wajib'); return }
    }
    setUp(true)
    try {
      const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64))
      fd.set('existing_fotos', JSON.stringify(existingFotos))
      if (overTol || overGain) {
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
      <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Info chip serah gram */}
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
            <span>Diserahkan: </span>
            <span className="font-semibold">{Number(serahGram).toFixed(3)} gr</span>
          </div>

          {/* Section box: Diterima (green) */}
          <div className="rounded-lg overflow-hidden border border-green-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-green-100">
              <span className="text-[11px] font-medium text-green-700">📥 Diterima</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat Diterima (gr) *</label>
                <input name="terima_gram" type="number" step="0.001" placeholder={`Max ${Number(serahGram).toFixed(3)} gr`}
                  value={terimaVal} onChange={e => setTerimaVal(e.target.value)} className={inp} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Terima *</label>
                  <input name="terima_tanggal" type="date" defaultValue={d.terima_tanggal ?? new Date().toISOString().split('T')[0]} className={inp} required />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jam Terima *</label>
                  <input name="terima_jam" type="time" defaultValue={d.terima_jam ? String(d.terima_jam).slice(0,5) : undefined} className={inp} required />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jumlah PCS {prosesLabel === 'Cutting' ? '(ACC)' : ''}</label>
                <input name="terima_pcs" type="number" min="1" defaultValue={d.terima_pcs ?? ''} placeholder="Isi jika sudah dihitung" className={inp} />
              </div>

              {/* Khusus Pas Berat: Sisa Serbuk */}
              {showSerbuk && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Sisa Serbuk (gr)</label>
                  <input name="sisa_serbuk" type="number" step="0.001" value={serbukVal} onChange={e => setSerbukVal(e.target.value)} className={inp} />
                </div>
              )}

              {/* Reject: Cutting WAJIB selalu tampil, proses lain pakai checkbox */}
              {prosesLabel === 'Cutting' ? (
                <div className="rounded-lg p-3 bg-red-50 border border-red-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-medium text-red-500">⚠ Reject cutting</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                    Reject cutting dilebur ulang → kembali jadi bahan baku batch. Isi 0 jika tidak ada reject.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat Reject Cutting (gr)</label>
                    <input name="reject_gram" type="number" step="0.001" min="0"
                      value={rejectVal} onChange={e => setRejectVal(e.target.value)}
                      className={inp} placeholder="0.000" />
                    <input type="hidden" name="reject_pcs" value="0" />
                  </div>
                </div>
              ) : (
                /* Proses lain (Pas Berat, Annealing, Siap Packing): reject opsional */
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={adaReject} onChange={e => { setAdaReject(e.target.checked); if (!e.target.checked) setRejectVal('0') }}
                      className="w-4 h-4 rounded accent-red-500" />
                    <span className="text-[13px] font-semibold text-slate-500">Ada reject yang perlu dilebur ulang?</span>
                  </label>
                  {adaReject && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Reject (gr)</label>
                        <input name="reject_gram" type="number" step="0.001" value={rejectVal} onChange={e => setRejectVal(e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Reject (pcs)</label>
                        <input name="reject_pcs" type="number" min="0" defaultValue={d.reject_pcs ?? 0} className={inp} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <TimPickerStd tims={tims} prefix="terima_" initialTimId={initTimId} initialAnggota={initAnggota} />
              <AdminPickerStd adminList={adminList} prefix="terima_" initialValue={d.terima_admin_input ?? ''} label="Admin Yang Menerima" />
              {existingFotos.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto Sebelumnya</label>
                  <div className="flex flex-wrap gap-2">
                    {existingFotos.map((u, i) => (
                      <div key={i} className="relative">
                        <a href={u} target="_blank" rel="noopener noreferrer" title="Klik untuk lihat ukuran penuh">
                          <img src={u} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-green-100 cursor-zoom-in hover:scale-110 transition-transform" />
                        </a>
                        <button type="button" onClick={() => setExistingFotos(existingFotos.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[12px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <FotoPickerStd fotos={fotos} setFotos={setFotos} label="Foto Bahan Diterima (Max 10 Foto)" />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan Penerimaan</label>
                <input name="terima_catatan" type="text" defaultValue={d.terima_catatan ?? ''} placeholder="Opsional" className={inp} />
              </div>
            </div>
          </div>

          {/* Loss/Gain indicator realtime */}
          {terimaVal !== '' && (
            <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold flex items-center justify-between border ${(overTol || overGain) ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-700'}`}>
              <span>{overGain ? `Gain: ${gainNow.toFixed(3)} gr` : `Loss: ${lossNow.toFixed(3)} gr`}</span>
              <span className="text-[10px]">{overGain ? `⚠️ timbangan naik melebihi toleransi ${toleransi} gr` : overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
            </div>
          )}

          {(overTol || overGain) && (
            <LossApprovalPanel
              gain={overGain}
              lossGram={overGain ? gainNow : lossNow} toleransiGram={toleransi} proses={prosesLabel}
              alasan={lossAlasan} setAlasan={setLossAlasan}
              operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
              adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
              setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-[12px] text-red-600">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button type="submit" disabled={isPending || up} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{judul}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
