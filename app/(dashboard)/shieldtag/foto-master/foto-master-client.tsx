'use client'

import { useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Upload, Trash2, ImagePlus, CheckCircle2, Loader2, X } from 'lucide-react'
import { uploadFotoMaster, deleteFotoMaster } from './actions'

interface MasterEntry {
  foto_urls: string[]
  keterangan: string | null
  updated_at: string | null
  updated_by: string | null
}

interface Props {
  masterMap: Record<string, MasterEntry>
  gramasiList: string[]
  userRole: string
}

function gramasiLabel(g: string) {
  const n = parseFloat(g)
  return n >= 1000 ? `${n/1000} kg` : n >= 1 ? `${n} gram` : `${n*1000} mg`
}

export default function FotoMasterClient({ masterMap, gramasiList }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [localMap, setLocalMap] = useState(masterMap)
  const [uploading, startUpload] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const current = selected ? localMap[selected] : null

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.length) return
    const fd = new FormData()
    Array.from(e.target.files).forEach(f => fd.append('foto', f))
    startUpload(async () => {
      const res = await uploadFotoMaster(selected, fd)
      if (res.error) { toast.error(res.error); return }
      toast.success(`${res.count} foto berhasil diupload`)
      // optimistic: refresh page
      window.location.reload()
    })
    e.target.value = ''
  }

  async function handleDelete(url: string) {
    if (!selected) return
    if (!confirm('Hapus foto ini?')) return
    startDelete(async () => {
      const res = await deleteFotoMaster(selected, url)
      if (res.error) { toast.error(res.error); return }
      setLocalMap(prev => ({
        ...prev,
        [selected]: { ...prev[selected], foto_urls: prev[selected].foto_urls.filter(u => u !== url) },
      }))
      toast.success('Foto dihapus')
    })
  }

  return (
    <div className="space-y-5 pb-12 max-w-5xl">

      {/* Header */}
      <div>
        <Link href="/shieldtag" className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-violet-600 transition-colors mb-3">
          <ArrowLeft size={12} /> Kembali ke Shieldtag
        </Link>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Master Foto Produk</h1>
        <p className="text-[13px] text-slate-400 mt-1">
          Upload foto per gramasi — otomatis muncul di halaman verifikasi QR (<code className="text-violet-600">/cek/[kode]</code>) untuk semua shieldtag dengan gramasi yang sama.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Gramasi picker */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-[12px] font-semibold text-slate-600">Pilih Gramasi</p>
          </div>
          <div className="divide-y divide-slate-50">
            {gramasiList.map(g => {
              const entry = localMap[g]
              const hasFoto = entry.foto_urls.length > 0
              return (
                <button key={g} onClick={() => setSelected(g)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all ${
                    selected === g ? 'bg-violet-50 border-l-2 border-violet-500' : 'hover:bg-slate-50 border-l-2 border-transparent'
                  }`}>
                  <div>
                    <p className={`text-[13px] font-semibold ${selected === g ? 'text-violet-700' : 'text-slate-800'}`}>
                      {g} gr
                    </p>
                    <p className="text-[10px] text-slate-400">{gramasiLabel(g)}</p>
                  </div>
                  {hasFoto
                    ? <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={9}/> {entry.foto_urls.length} foto
                      </span>
                    : <span className="text-[10px] text-slate-300 font-medium">Belum ada</span>
                  }
                </button>
              )
            })}
          </div>
        </div>

        {/* Foto manager */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 bg-white rounded-2xl border border-dashed border-slate-200">
              <ImagePlus size={36} className="mb-3 opacity-40" />
              <p className="text-[13px] font-medium">Pilih gramasi untuk kelola foto</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-bold text-slate-900">Foto Produk — {selected} gram</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {current?.foto_urls.length ?? 0} foto terdaftar
                    {current?.updated_by && ` · Diupdate oleh ${current.updated_by}`}
                  </p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Upload Foto
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              </div>

              <div className="p-5">
                {(current?.foto_urls.length ?? 0) === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                    <ImagePlus size={28} className="mb-2 opacity-40" />
                    <p className="text-[12px] font-medium">Belum ada foto untuk {selected} gram</p>
                    <p className="text-[11px] text-slate-300 mt-1">Klik "Upload Foto" untuk menambah</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {current!.foto_urls.map((url, i) => (
                      <div key={url} className="relative group rounded-xl overflow-hidden border border-slate-100 aspect-square">
                        <Image
                          src={url} alt={`Foto ${i + 1}`} fill className="object-cover"
                          onClick={() => setLightbox(url)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                        <button
                          onClick={() => handleDelete(url)}
                          disabled={deleting}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex">
                          <Trash2 size={11} />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                          #{i + 1}
                        </span>
                      </div>
                    ))}
                    {/* Add more */}
                    <button onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-violet-300 hover:bg-violet-50 transition-all text-slate-300 hover:text-violet-400">
                      <Upload size={16} />
                      <span className="text-[10px] font-medium">Tambah</span>
                    </button>
                  </div>
                )}

                {current?.foto_urls[0] && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400 mb-1.5">Foto utama (tampil di halaman verifikasi QR):</p>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={current.foto_urls[0]} alt="Foto utama" fill className="object-cover" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700">Foto #1 — tampil di /cek/[kode]</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-xs">{current.foto_urls[0]}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl max-h-[90vh] w-full">
            <Image src={lightbox} alt="Preview" width={600} height={800} className="object-contain rounded-2xl" />
            <button className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
