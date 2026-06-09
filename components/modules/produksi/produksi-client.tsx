'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, Edit2, Trash2, Check, AlertTriangle,
  X, Camera, ChevronDown, ChevronUp, Package, Pencil, WifiOff,
  Clock, Archive,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi, editProduksi, selesaiCutting,
  inputReject, leburReject, deleteProduksi, updateSisaFisikBatch,
  serahStageProduksi, terimaStageProduksi, voidStageHandover
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

interface Props { produksiList: any[]; batches: any[]; userRole: UserRole; userName: string }

function fgr(n: number | null | undefined, dec = 3): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return parseFloat(Number(n).toFixed(dec)).toLocaleString('id-ID', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  })
}

/** Format "HH:MM:SS" → "HH:MM" */
function fmtTime(t: string | null): string {
  if (!t) return ''
  return t.substring(0, 5)
}

/** Compute duration string "Xj Ymnt" from jam_mulai (time) and created_at (timestamptz) */
function getDurasi(jamMulai: string | null, createdAt: string | null): string {
  if (!jamMulai || !createdAt) return ''
  const [h, m] = jamMulai.split(':').map(Number)
  const end = new Date(createdAt)
  const startMin = h * 60 + m
  const endMin   = end.getHours() * 60 + end.getMinutes()
  const diff = endMin - startMin
  if (diff <= 0) return ''
  const jam = Math.floor(diff / 60)
  const mnt = diff % 60
  return jam > 0 ? `${jam}j ${mnt}mnt` : `${mnt}mnt`
}

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const STATUS_FLOW     = ['Cutting','Pas Berat','Annealing','Press Stamp','Siap Packing']
const STATUS_NEXT: Record<string,string> = {
  'Cutting':'Pas Berat','Pas Berat':'Annealing','Annealing':'Siap Packing',
}
const KATEGORI_LOSSES_OPTIONS = [
  'Oksidasi / Terbakar',
  'Serbuk Tercecer',
  'Pemotongan Berlebih',
  'Kikisan Mesin',
  'Lainnya',
]
const STATUS_CFG: Record<string,{dot:string;bg:string;text:string}> = {
  'Cutting':       {dot:'#3B82F6',bg:'rgba(59,130,246,0.10)',  text:'#2563EB'},
  'Pas Berat':     {dot:'#F97316',bg:'rgba(249,115,22,0.10)', text:'#EA580C'},
  'Annealing':     {dot:'#EAB308',bg:'rgba(234,179,8,0.10)',  text:'#CA8A04'},
  'Press Stamp':   {dot:'#06B6D4',bg:'rgba(6,182,212,0.10)',  text:'#0891B2'},
  'Siap Packing':  {dot:'#22C55E',bg:'rgba(34,197,94,0.10)',  text:'#16A34A'},
  'Sudah Packing': {dot:'#8B5CF6',bg:'rgba(139,92,246,0.10)', text:'#7C3AED'},
  'Reject':        {dot:'#EF4444',bg:'rgba(239,68,68,0.10)',  text:'#DC2626'},
}
const today = new Date().toISOString().split('T')[0]

async function filesToBase64(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files.slice(0, 10)) {
    const b64 = await new Promise<string>(resolve => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        let { width: w, height: h } = img
        const max = 1200
        if (w > max || h > max) { const r = Math.min(max/w,max/h); w=Math.floor(w*r); h=Math.floor(h*r) }
        c.width=w; c.height=h; c.getContext('2d')!.drawImage(img,0,0,w,h)
        let q=0.8
        const tryQ=()=>c.toBlob(blob=>{
          if(!blob){resolve('');return}
          if(blob.size<=250*1024||q<=0.3){const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(blob)}
          else{q-=0.1;tryQ()}
        },'image/jpeg',q)
        tryQ()
      }
      img.onerror=()=>resolve('')
      img.src=URL.createObjectURL(file)
    })
    if (b64) results.push(b64)
  }
  return results
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85" onClick={onClose}>
      <img src={url} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all">
        <X size={18} />
      </button>
    </div>
  )
}

// ─── Offline Indicator ────────────────────────────────────────────────────────
function OfflineIndicator() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const goOnline  = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-white"
      style={{ background: 'linear-gradient(90deg,#F97316,#EF4444)' }}>
      <WifiOff size={13} /> Tidak ada koneksi — data belum tersimpan
    </div>
  )
}

// ─── FotoPicker ────────────────────────────────────────────────────────────────
function FotoPicker({ files, onAdd, onRemove, label='Tambah foto', small=false }: {
  files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void; label?: string; small?: boolean
}) {
  const [prev, setPrev] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  useEffect(() => {
    const u = files.map(f => URL.createObjectURL(f))
    setPrev(u)
    return () => u.forEach(u => URL.revokeObjectURL(u))
  }, [files])
  const s = small ? 'w-12 h-12' : 'w-16 h-16'
  return (
    <div className="space-y-2">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {prev.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {prev.map((u, i) => (
            <div key={i} className={`relative ${s}`}>
              <img src={u} onClick={() => setLightbox(u)} className="w-full h-full object-cover rounded-xl border-2 border-violet-300 cursor-pointer hover:scale-105 transition-transform" />
              <button type="button" onClick={() => onRemove(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={9} /></button>
              <div className="absolute bottom-0 inset-x-0 bg-violet-500/70 text-white text-[7px] text-center py-0.5 rounded-b-xl">BARU</div>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40 transition-all">
        <Camera size={13} className="text-violet-400 flex-shrink-0" />
        <span className={`text-gray-400 ${small ? 'text-[11px]' : 'text-xs'}`}>{files.length > 0 ? `${files.length} foto — klik tambah` : label}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.currentTarget.value = '' }} />
      </label>
      {files.length > 0 && <button type="button" onClick={() => onRemove(-1)} className="text-[11px] text-red-400 hover:underline">Hapus semua foto</button>}
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function Sbadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] ?? { bg: 'rgba(148,163,184,0.12)', text: '#64748B' }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {s}
    </span>
  )
}

// ─── sort helper — prefers created_at (has time) over tanggal (date-only, same-day ties) ────
function sortEvents(events: any[]) {
  return [...events].sort((a, b) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : new Date(a.tanggal).getTime()
    const bT = b.created_at ? new Date(b.created_at).getTime() : new Date(b.tanggal).getTime()
    return aT - bT   // ascending: earliest event first
  })
}

// ─── Timeline Dots — smooth portal tooltip ────────────────────────────────────
function TLine({ events }: { events: any[] }) {
  const [hover, setHover]     = useState<{ ev: any; x: number; y: number; dot: string } | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sorted = sortEvents(events)
  const dots   = sorted.slice(-5)

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (fadeTimer.current)  clearTimeout(fadeTimer.current)
  }, [])

  function enterDot(ev: any, el: HTMLElement, dotColor: string) {
    // Cancel any pending hide
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (fadeTimer.current)  clearTimeout(fadeTimer.current)

    const r = el.getBoundingClientRect()
    setHover({ ev, x: r.left + r.width / 2, y: r.top, dot: dotColor })
    // Show immediately on next tick (state batch)
    setTimeout(() => setTipVisible(true), 0)
  }

  function leaveDot() {
    leaveTimer.current = setTimeout(() => {
      setTipVisible(false)                          // CSS fade-out starts
      fadeTimer.current = setTimeout(() => setHover(null), 160) // remove from DOM after fade
    }, 80)
  }

  const vw      = typeof window !== 'undefined' ? window.innerWidth : 1280
  const tipLeft = hover ? Math.min(Math.max(hover.x, 112), vw - 112) : 0

  return (
    <>
      <div className="flex items-center gap-1.5">
        {dots.map((ev, i) => {
          const cfg = STATUS_CFG[ev.status] ?? { dot: '#94A3B8' }
          return (
            <div key={i} className="relative flex-shrink-0">
              <button
                type="button"
                onMouseEnter={e => enterDot(ev, e.currentTarget, cfg.dot)}
                onMouseLeave={leaveDot}
                onPointerEnter={e => enterDot(ev, e.currentTarget as HTMLElement, cfg.dot)}
                onPointerLeave={leaveDot}
                className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm block"
                style={{
                  background: cfg.dot,
                  boxShadow: `0 0 0 2px ${cfg.dot}35`,
                  transition: 'transform 120ms ease',
                }}
                onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.5)')}
                onMouseOut={e  => (e.currentTarget.style.transform = 'scale(1)')}
              />
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, 5 - dots.length) }).map((_, i) => (
          <div key={`e${i}`} className="w-3 h-3 rounded-full bg-gray-200/80 border-2 border-white shadow-sm flex-shrink-0" />
        ))}
      </div>

      {/* Portal tooltip — bypasses any backdrop-filter containing block */}
      {hover && createPortal(
        <div
          className="fixed z-[9999] w-52 pointer-events-none select-none"
          style={{
            left: tipLeft,
            top: hover.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
            opacity: tipVisible ? 1 : 0,
            transition: 'opacity 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Dark iOS-style tooltip */}
          <div className="rounded-2xl p-3" style={{ background: 'rgba(22,22,26,0.94)', backdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hover.dot }} />
              <span className="text-xs font-semibold text-white tracking-tight">{hover.ev.status}</span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <p className="text-gray-400">{formatDate(hover.ev.tanggal)}</p>
              <p className="font-semibold text-gray-100">{hover.ev.total_gram} gr</p>
              {Number(hover.ev.sisa_serbuk) > 0 && <p style={{ color: '#A78BFA' }}>Serbuk: {hover.ev.sisa_serbuk} gr</p>}
              {Number(hover.ev.losses)      > 0 && <p style={{ color: '#FB923C' }}>Losses: {hover.ev.losses} gr</p>}
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45" style={{ background: 'rgba(22,22,26,0.94)', boxShadow: '1px 1px 0 rgba(255,255,255,0.06)' }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Sisa Fisik Inline Edit ────────────────────────────────────────────────────
function SisaFisikInput({ batchKode, initialValue }: { batchKode: string; initialValue: number | null }) {
  const [val,     setVal]     = useState<number | null>(initialValue)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) { setDraft(val !== null ? String(val) : ''); setTimeout(() => ref.current?.select(), 10) }
  }, [editing])

  async function save() {
    const parsed = draft.trim() === '' ? null : parseFloat(draft)
    setSaving(true)
    await updateSisaFisikBatch(batchKode, parsed)
    setVal(parsed)
    setSaving(false)
    setEditing(false)
  }

  if (saving) return <span className="text-[11px] text-violet-500 font-medium">Menyimpan…</span>

  if (editing) return (
    <input
      ref={ref}
      type="number" step="0.001" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') setEditing(false) }}
      className="w-20 text-[11px] font-semibold px-2 py-1 rounded-lg border border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"
      placeholder="0.000"
    />
  )

  return (
    <button type="button" onClick={() => setEditing(true)}
      className={cn('flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors group',
        val !== null ? 'text-gray-700 hover:bg-gray-100' : 'text-violet-500 hover:bg-violet-50'
      )}>
      {val !== null ? `${fgr(val)}gr` : '+ Isi fisik'}
      <Pencil size={9} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </button>
  )
}

// ─── Event History ─────────────────────────────────────────────────────────────
function EventHistory({ events, item }: { events: any[]; item?: any }) {
  const sorted = sortEvents(events)
  const [lightbox, setLightbox] = useState<string | null>(null)
  return (
    <div className="space-y-1">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {sorted.map((ev, i) => {
        const c = STATUS_CFG[ev.status] ?? { dot: '#94A3B8', bg: 'rgba(148,163,184,0.1)', text: '#64748B' }
        const fotos  = Array.isArray(ev.fotos) ? ev.fotos : []
        const serbuk = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
        return (
          <div key={ev.id ?? i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
              {i < sorted.length - 1 && <div className="w-px flex-1 mt-1 opacity-20" style={{ background: c.dot }} />}
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Sbadge s={ev.status} />
                <span className="text-xs text-gray-400">{formatDate(ev.tanggal)}</span>
                {ev.jam_mulai && (
                  <span className="text-xs text-gray-400">
                    🕐{fmtTime(ev.jam_mulai)}
                    {ev.created_at && ` → ${new Date(ev.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`}
                    {getDurasi(ev.jam_mulai, ev.created_at) && ` (${getDurasi(ev.jam_mulai, ev.created_at)})`}
                  </span>
                )}
                <span className="text-xs font-semibold text-gray-700">{ev.total_gram} gr</span>
                {Number(ev.sisa_serbuk) > 0 && <span className="text-xs text-violet-500">serbuk {ev.sisa_serbuk} gr</span>}
                {Number(ev.losses)      > 0 && <span className="text-xs text-orange-500">losses {ev.losses} gr</span>}
                {ev.user_name && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">· {ev.user_name}</span>}
              </div>
              {ev.kategori_losses && (
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5" style={{ background: 'rgba(249,115,22,0.10)', color: '#EA580C' }}>
                  ⚠ {ev.kategori_losses}
                </span>
              )}
              {ev.catatan && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{ev.catatan}</p>}
              {(fotos.length > 0 || serbuk.length > 0) && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {fotos.map((u: string, fi: number) => (
                    <img key={fi} src={u} onClick={() => setLightbox(u)} className="w-10 h-10 rounded-xl object-cover cursor-pointer border border-gray-100 hover:scale-110 transition-transform" />
                  ))}
                  {serbuk.map((u: string, fi: number) => (
                    <div key={`s${fi}`} className="relative">
                      <img src={u} onClick={() => setLightbox(u)} className="w-10 h-10 rounded-xl object-cover cursor-pointer border-2 border-violet-300 hover:scale-110 transition-transform" />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">S</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Form helpers ──────────────────────────────────────────────────────────────
const inp = "w-full px-4 py-3 text-sm bg-white/80 border border-gray-200/70 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-300 transition-all placeholder:text-gray-400"
const F = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ batches, onClose, onSubmit, isPending, error }: {
  batches: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const nowTime = new Date().toTimeString().slice(0,5)
  const [f, setF] = useState({ batch_kode: batches[0]?.kode ?? '', gramasi: '1', pcs: '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, jam_mulai: nowTime, operator: '', target_selesai: '' })
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    setUp(true); const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []; setUp(false)
    const fd = new FormData(el); fd.set('fotos_b64', JSON.stringify(b64)); onSubmit(fd)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Permintaan Cetak Baru</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-140px)]">
          <F label="Nama / Label Batch" req><input name="nama_item" value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp} required /></F>
          <F label="Batch Bahan Baku" req>
            <select name="batch_kode" value={f.batch_kode} onChange={e => s('batch_kode', e.target.value)} className={inp} required>
              {batches.map(b => <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} (Sisa: {(b.sisa_bahan_seharusnya ?? b.timbangan_akhir ?? 0).toFixed(2)} gr)</option>)}
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Gramasi Target" req>
              <select name="gramasi" value={f.gramasi} onChange={e => s('gramasi', e.target.value)} className={inp} required>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
              </select>
            </F>
            <F label="Jumlah PCS"><input name="pcs" type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} placeholder="50 — opsional, isi saat terima cutting" className={inp} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gram)" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} placeholder="500.15" className={inp} required /></F>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm" style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
              <span className="text-xs font-bold text-violet-700">🔪 Status Awal</span>
              <span className="ml-auto text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Cutting</span>
              <input type="hidden" name="status_awal" value="Cutting" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Mulai" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} required /></F>
            <F label="Jam Mulai" req><input name="jam_mulai" type="time" value={f.jam_mulai ?? ''} onChange={e => s('jam_mulai', e.target.value)} className={inp} required /></F>
          </div>
            <F label="Target Selesai"><input name="target_selesai" type="date" value={f.target_selesai} onChange={e => s('target_selesai', e.target.value)} className={inp} /></F>
          </div>
          <F label="Operator / PIC"><input name="operator" value={f.operator} onChange={e => s('operator', e.target.value)} placeholder="Nama operator" className={inp} /></F>
          <F label="Catatan"><input name="catatan" placeholder="Keterangan tambahan..." className={inp} /></F>
          <F label="Foto Proses (opsional, max 10)">
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Tambah foto proses awal" />
          </F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14} />{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || up} className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
              {(isPending || up) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {up ? 'Kompres foto…' : isPending ? 'Menyimpan…' : 'Mulai Alur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [f, setF] = useState({
    nama_item: item.nama_item ?? `LM REI ${item.gramasi ?? ''}GR`, gramasi: item.gramasi ?? '',
    pcs: String(item.pcs ?? ''), berat_awal: String(item.berat_awal ?? item.total_gram ?? ''),
    operator: item.operator ?? '', catatan: item.catatan ?? '',
    tanggal_produksi: item.tanggal_produksi ?? item.tanggal ?? today,
    target_selesai: item.target_selesai ?? '',
  })
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  function submit(e: React.FormEvent) {
    e.preventDefault(); const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.set(k, v)); onSubmit(fd)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900">Edit Batch Produksi</h2><p className="text-xs text-violet-500 font-medium mt-0.5">{item.kode}</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-140px)]">
          <F label="Nama / Label Batch"><input value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Item"><input value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="Nama produk (auto-generate dari gramasi)" className={inp} name="nama_item"/></F>
            <F label="Pilih Gramasi Yang Ingin Di Produksi" req><select value={f.gramasi} onChange={e => { s('gramasi', e.target.value); s('nama_item', `LM REI ${e.target.value}GR`) }} className={inp}>{GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}</select></F>
            <F label="PCS" req><input type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} className={inp} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gr)" req><input type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} className={inp} /></F>
            <F label="Tanggal"><input type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Operator / PIC"><input value={f.operator} onChange={e => s('operator', e.target.value)} placeholder="Nama operator" className={inp} /></F>
            <F label="Target Selesai"><input type="date" value={f.target_selesai} onChange={e => s('target_selesai', e.target.value)} className={inp} /></F>
          </div>
          <F label="Catatan"><input value={f.catatan} onChange={e => s('catatan', e.target.value)} placeholder="Catatan tambahan…" className={inp} /></F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14} />{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending} className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ─── Selesai Cutting Modal ────────────────────────────────────────────────────
function SelesaiCuttingModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const serahGram = Number(item.serah_gram ?? item.berat_awal ?? 0)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64s))
      onSubmit(fd)
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">✓ Konfirmasi Terima Cutting</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={14} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {/* Info Diserahkan */}
          <div className="px-4 py-3 rounded-2xl text-xs"
            style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <span className="text-gray-400">Diserahkan: </span>
            <span className="font-bold text-violet-700">{fgr(serahGram)} gr</span>
            <span className="text-gray-400 mx-1">·</span>
            <span className="font-semibold text-gray-600">{item.gramasi}gr</span>
            {item.pcs ? <><span className="text-gray-400 mx-1">·</span><span className="font-semibold text-gray-600">{item.pcs} PCS</span></> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tanggal Selesai *</label>
              <input name="tanggal_selesai" type="date" defaultValue={new Date().toISOString().split('T')[0]}
                className={inp} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Selesai *</label>
              <input name="jam_selesai" type="time" className={inp} required />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Berat Diterima (gr) *</label>
            <input name="terima_gram" type="number" step="0.001"
              placeholder={`Max ${fgr(serahGram)} gr`}
              className={inp} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Reject Cutting (gr)</label>
              <input name="reject_cutting_gram" type="number" step="0.001"
                defaultValue="0" className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">PCS Reject</label>
              <input name="pcs_reject" type="number" min="0" defaultValue="0" className={inp} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              PCS Berhasil <span className="text-gray-400 font-normal">(opsional, isi jika sudah tahu)</span>
            </label>
            <input name="pcs_good" type="number" min="1"
              placeholder="Isi jika sudah dihitung" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Catatan <span className="text-gray-400 font-normal">(alasan losses, kondisi bahan, dll)</span>
            </label>
            <input name="catatan" type="text" placeholder="Misal: losses karena serbuk tercecer..."
              className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto Bukti Terima</label>
            <label className="flex items-center gap-2 h-11 px-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-violet-50 transition-colors border border-gray-200">
              <Camera size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto` : 'Tambah foto (opsional)'}</span>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => setFotos(p => [...p, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
            </label>
            {fotos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-xl object-cover border border-violet-200" />
                    <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-2xl text-xs text-red-600 border border-red-100">
              <AlertTriangle size={13} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Batal
            </button>
            <button type="submit" disabled={isPending || uploading}
              className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
              {(isPending || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {uploading ? 'Upload...' : isPending ? 'Menyimpan...' : 'Konfirmasi Diterima'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ─── Serah Stage Modal ────────────────────────────────────────────────────────
function SerahStageModal({ item, tahap, onClose, onSubmit, isPending, error }: {
  item: any; tahap: string; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const tahapLabel: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  const label = tahapLabel[tahap] ?? tahap

  // Data serah from previous stage
  const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
  const prevTahapMap: Record<string,string> = { annealing: 'pas_berat', siap_packing: 'annealing' }
  let serahGram = 0, serahPcs = item.pcs_good ?? item.pcs ?? 0
  if (tahap === 'pas_berat') {
    serahGram = Number(item.terima_gram ?? item.total_gram ?? 0)
    serahPcs  = item.pcs_good ?? item.pcs ?? 0
  } else {
    const prevH = handovers.find((h:any) => h.tahap === prevTahapMap[tahap] && h.status === 'selesai')
    serahGram = Number(prevH?.terima_gram ?? item.total_gram ?? 0)
    serahPcs  = prevH?.terima_pcs ?? item.pcs_good ?? item.pcs ?? 0
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64s))
      onSubmit(fd)
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">→ Serah ke {label}</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={14}/></button>
        </div>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {/* Info dari tahap sebelumnya */}
          <div className="px-4 py-3 rounded-2xl text-xs" style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
            <p className="text-[9px] font-bold text-violet-500 uppercase mb-2">Data yang akan diserahkan</p>
            <div className="flex flex-wrap gap-3">
              <div><p className="text-gray-400 text-[10px]">Total Berat</p><p className="font-bold text-violet-700">{serahGram.toFixed(3)} gr</p></div>
              <div><p className="text-gray-400 text-[10px]">Gramasi</p><p className="font-bold text-gray-700">{item.gramasi} gr</p></div>
              <div><p className="text-gray-400 text-[10px]">Jumlah PCS</p><p className="font-bold text-gray-700">{serahPcs > 0 ? `${serahPcs} PCS` : '—'}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tanggal Serah *</label>
              <input name="serah_tanggal" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inp} required/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Serah</label>
              <input name="serah_jam" type="time" className={inp}/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Operator</label>
            <input name="serah_operator" type="text" placeholder="Nama operator (opsional)" className={inp}/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Catatan</label>
            <input name="serah_catatan" type="text" placeholder="Opsional" className={inp}/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto</label>
            <label className="flex items-center gap-2 h-11 px-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-violet-50 transition-colors border border-gray-200">
              <Camera size={14} className="text-gray-400 flex-shrink-0"/>
              <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto` : 'Tambah foto (opsional)'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFotos(p=>[...p,...Array.from(e.target.files??[])].slice(0,5))}/>
            </label>
          </div>
          {error && <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-2xl text-xs text-red-600 border border-red-100"><AlertTriangle size={13}/><span>{error}</span></div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
              {(isPending||uploading)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading?'Upload...':isPending?'Menyimpan...':'Konfirmasi Serah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Terima Stage Modal ───────────────────────────────────────────────────────
function TerimaStageModal({ item, tahap, handoverId, onClose, onSubmit, isPending, error }: {
  item: any; tahap: string; handoverId: number; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [adaReject, setAdaReject] = useState(false)
  const tahapLabel: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  const label = tahapLabel[tahap] ?? tahap
  const isPasBerat = tahap === 'pas_berat'

  // Ambil berat serah dari handover
  const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
  const currentH = handovers.find((h:any) => h.tahap === tahap)
  const serahGram = currentH?.serah_gram ?? (tahap==='pas_berat' ? item.terima_gram : item.total_gram) ?? 0

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64s))
      // If handoverId is 0 (old item without serah), create serah+terima in one call
      // by adding serah data to the form
      if (handoverId === 0) {
        fd.set('create_serah_first', '1')
        fd.set('serah_gram', String(serahGram))
        fd.set('serah_pcs', String(item.pcs_good ?? item.pcs ?? 0))
      }
      onSubmit(fd)
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">✓ Konfirmasi Terima {label}</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><X size={14}/></button>
        </div>
        <form onSubmit={submit} className="px-5 pb-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {/* Info diserahkan */}
          <div className="px-4 py-3 rounded-2xl text-xs" style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.15)'}}>
            <p className="text-[9px] font-bold text-violet-500 uppercase mb-2">Diserahkan</p>
            <div className="flex flex-wrap gap-3">
              <div><p className="text-gray-400 text-[10px]">Total Berat</p><p className="font-bold text-violet-700">{Number(serahGram).toFixed(3)} gr</p></div>
              <div><p className="text-gray-400 text-[10px]">Gramasi</p><p className="font-bold text-gray-700">{item.gramasi} gr</p></div>
              {(currentH?.serah_pcs ?? item.pcs_good ?? item.pcs) ? <div><p className="text-gray-400 text-[10px]">Jumlah PCS</p><p className="font-bold text-gray-700">{currentH?.serah_pcs ?? item.pcs_good ?? item.pcs} PCS</p></div> : null}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Total Berat Setelah Diproses (gr) *</label>
            <input name="terima_gram" type="number" step="0.001" placeholder={`Max ${Number(serahGram).toFixed(3)} gr`} className={inp} required/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tanggal Terima *</label>
              <input name="terima_tanggal" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inp} required/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Terima *</label>
              <input name="terima_jam" type="time" className={inp} required/>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              PCS Berhasil <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input name="terima_pcs" type="number" min="1" placeholder="Isi jika sudah dihitung" className={inp}/>
          </div>

          {/* Sisa Serbuk — hanya Pas Berat */}
          {isPasBerat && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Sisa Serbuk (gr)</label>
              <input name="sisa_serbuk" type="number" step="0.001" defaultValue="0" className={inp}/>
            </div>
          )}

          {/* Reject toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={adaReject} onChange={e=>setAdaReject(e.target.checked)} className="w-4 h-4 rounded accent-red-500"/>
              <span className="text-xs font-semibold text-gray-600">Ada Reject</span>
            </label>
            {adaReject && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Berat Reject (gr)</label>
                  <input name="reject_gram" type="number" step="0.001" defaultValue="0" className={inp}/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">PCS Reject</label>
                  <input name="reject_pcs" type="number" min="0" defaultValue="0" className={inp}/>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Catatan <span className="text-gray-400 font-normal">(alasan losses, kondisi, dll)</span>
            </label>
            <input name="terima_catatan" type="text" placeholder="Opsional" className={inp}/>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto Bukti</label>
            <label className="flex items-center gap-2 h-11 px-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-violet-50 transition-colors border border-gray-200">
              <Camera size={14} className="text-gray-400 flex-shrink-0"/>
              <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto` : 'Tambah foto (opsional)'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFotos(p=>[...p,...Array.from(e.target.files??[])].slice(0,5))}/>
            </label>
          </div>

          {error && <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-2xl text-xs text-red-600 border border-red-100"><AlertTriangle size={13}/><span>{error}</span></div>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="flex-1 h-11 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:'linear-gradient(135deg,#059669,#047857)'}}>
              {(isPending||uploading)&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {uploading?'Upload...':isPending?'Menyimpan...':'Konfirmasi Diterima'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Update Status Modal ───────────────────────────────────────────────────────
function UpdateModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const next = STATUS_NEXT[item.current_status] ?? 'Siap Packing'
  const [status, setStatus] = useState(next)
  const [fotos,  setFotos]  = useState<File[]>([])
  const [serbuk, setSerbuk] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const isPB = status === 'Pas Berat'
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    setUp(true)
    const fb64 = fotos.length  > 0 ? await filesToBase64(fotos)  : []
    const sb64 = isPB && serbuk.length > 0 ? await filesToBase64(serbuk) : []
    setUp(false)
    const fd = new FormData(el)
    fd.set('fotos_b64',       JSON.stringify(fb64))
    fd.set('fotos_serbuk_b64',JSON.stringify(sb64))
    fd.set('is_reject', status === 'Reject' ? '1' : '0')
    onSubmit(fd)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Update Status Produksi</h2>
            <p className="text-xs font-semibold text-violet-500 mt-0.5">{item.kode} — {item.nama_item || `${item.gramasi}gr × ${item.pcs} PCS`}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-140px)]">
          <F label="Status Baru" req>
            <select name="status" value={status} onChange={e => setStatus(e.target.value)} className={inp} required>
              {STATUS_FLOW.map(st => <option key={st} value={st}>{st}</option>)}
              <option value="Reject">Reject</option>
            </select>
          </F>
          {status === 'Reject' ? (
            <div className="grid grid-cols-2 gap-3">
              <F label="PCS Reject" req><input name="pcs_reject" type="number" min="1" max={item.pcs_good ?? item.pcs} className={inp} placeholder={`Max: ${item.pcs_good ?? item.pcs} PCS`} required /></F>
              <F label="Berat Reject (gr)" req><input name="berat_reject" type="number" step="0.001" className={inp} placeholder="Berat total reject" required /></F>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <F label="Total Berat Sekarang (gr)" req><input name="total_gram" type="number" step="0.001" className={inp} placeholder={`Sblm: ${item.total_gram} gr`} required /></F>
              {isPB && <F label="Sisa Serbuk (gr)"><input name="sisa_serbuk" type="number" step="0.001" className={inp} placeholder="0.000" defaultValue="0" /></F>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal" req><input name="tanggal" type="date" defaultValue={today} className={inp} required /></F>
            <F label="Jam Mulai (opsional)"><input name="jam_mulai" type="time" className={inp} /></F>
          </div>
          {status !== 'Reject' && (
            <>
              <F label="Foto Proses (opsional)">
                <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Foto proses di status ini" small />
              </F>
              {isPB && (
                <F label="Foto Sisa Serbuk (opsional)">
                  <FotoPicker files={serbuk} onAdd={ff => setSerbuk(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setSerbuk([]) : setSerbuk(p => p.filter((_, j) => j !== i))} label="Foto sisa serbuk emas" small />
                </F>
              )}
            </>
          )}
          {status !== 'Reject' && (
            <F label="Kategori Losses (opsional)">
              <select name="kategori_losses" className={inp} defaultValue="">
                <option value="">— Pilih kategori —</option>
                {KATEGORI_LOSSES_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </F>
          )}
          <F label="Catatan"><input name="catatan" className={inp} placeholder="Keterangan…" /></F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14} />{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || up} className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}>
              {(isPending || up) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {up ? 'Kompres…' : isPending ? 'Menyimpan…' : 'Simpan Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DelModal({ item, onClose, onConfirm, isPending }: { item: any; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  const [confirm, setConfirm] = useState('')
  const canConfirm = confirm.trim() === item.kode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', boxShadow: '0 32px 64px rgba(239,68,68,0.15)' }}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
        <h2 className="text-lg font-bold text-gray-900 text-center">Hapus Batch Produksi?</h2>
        <p className="text-sm text-gray-500 mt-2 text-center"><span className="font-semibold text-gray-700">{item.kode}</span> akan dihapus permanen beserta semua event-nya.</p>
        <div className="mt-5 mb-4">
          <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Ketik kode batch untuk konfirmasi</label>
          <input
            value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder={item.kode}
            className="mt-1.5 w-full px-4 py-3 text-sm bg-white border border-red-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-300/40 font-mono"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={onConfirm} disabled={!canConfirm || isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isPending ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat mini chip ────────────────────────────────────────────────────────────
function StatChip({ label, value, accent }: { label: string; value: React.ReactNode; accent?: 'violet'|'orange'|'green'|'red'|'blue' }) {
  const accentMap = {
    violet: { bg: 'rgba(139,92,246,0.08)', text: '#7C3AED' },
    orange: { bg: 'rgba(249,115,22,0.08)', text: '#EA580C' },
    green:  { bg: 'rgba(34,197,94,0.08)',  text: '#16A34A' },
    red:    { bg: 'rgba(239,68,68,0.08)',  text: '#DC2626' },
    blue:   { bg: 'rgba(59,130,246,0.08)', text: '#2563EB' },
  }
  const style = accent ? accentMap[accent] : { bg: 'rgba(0,0,0,0.03)', text: '#374151' }
  return (
    <div className="rounded-2xl px-3 py-2 overflow-hidden min-w-0" style={{ background: style.bg }}>
      <p className="text-[9.5px] font-bold tracking-widest uppercase mb-0.5 truncate" style={{ color: style.text, opacity: 0.7 }}>{label}</p>
      <div className="text-[13px] font-bold leading-tight min-w-0" style={{ color: style.text }}>{value}</div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ProduksiClient({ produksiList, batches, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search,       setSearch]    = useState('')
  const [tab,          setTab]       = useState('Semua')
  const [exp,          setExp]       = useState<number | null>(null)
  const [modal,        setModal]     = useState<'create'|'edit'|'update'|'delete'|'cuttingTerima'|'serahStage'|'terimaStage'|null>(null)
  const [activeTahap,  setActiveTahap]  = useState<string>('')
  const [activeHandoverId, setActiveHandoverId] = useState<number|null>(null)
  const [active,       setActive]    = useState<any | null>(null)
  const [err,          setErr]       = useState('')
  const [toast,        setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [visibleCount, setVisible]   = useState(20)

  // Restore last active tab from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('produksi_tab')
      if (saved) setTab(saved)
    } catch {}
  }, [])

  function changeTab(t: string) {
    setTab(t)
    setVisible(20)
    try { localStorage.setItem('produksi_tab', t) } catch {}
  }

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }
  const canEdit   = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete = ['owner','admin_pusat'].includes(userRole)

  // 'Semua' hides archived (Sudah Packing) items — only shown when that tab is active
  const filtered = produksiList.filter(item => {
    if (tab === 'Semua' && item.current_status === 'Sudah Packing') return false
    if (tab !== 'Semua' && item.current_status !== tab) return false
    const q = search.toLowerCase()
    return !q || item.kode?.toLowerCase().includes(q) || item.batch_kode?.toLowerCase().includes(q) || item.gramasi?.includes(q) || item.nama_item?.toLowerCase().includes(q)
  })

  // Reset pagination when filter changes
  useEffect(() => { setVisible(20) }, [tab, search])

  const counts = produksiList.reduce((a, i) => { a[i.current_status] = (a[i.current_status] ?? 0) + 1; return a }, {} as Record<string,number>)
  const activeCount = produksiList.filter(i => i.current_status !== 'Sudah Packing' && i.current_status !== 'Reject').length
  const overdueCount = produksiList.filter(i => {
    if (!i.target_selesai) return false
    if (i.current_status === 'Sudah Packing') return false
    return new Date(i.target_selesai) < new Date(today)
  }).length
  const totalLoses = produksiList.reduce((s, item) => {
    const evs = Array.isArray(item.produksi_event) ? item.produksi_event : []
    return s + evs.reduce((es: number, ev: any) => es + (Number(ev.losses) || 0), 0)
  }, 0)

  const tabs = ['Semua', ...STATUS_FLOW, 'Sudah Packing', 'Reject']
  const visible = filtered.slice(0, visibleCount)

  function openModal(type: 'create'|'edit'|'update'|'delete'|'cuttingTerima'|'serahStage'|'terimaStage', item?: any) { setActive(item ?? null); setErr(''); setModal(type) }
  function handleCreate(fd: FormData) { setErr(''); startTransition(async () => { const r = await createProduksi(fd); if (r?.error) { setErr(r.error); return }; showToast(`✅ ${r?.kode} berhasil dibuat`); setModal(null) }) }
  function handleEdit(fd: FormData)   { if (!active) return; setErr(''); startTransition(async () => { const r = await editProduksi(active.id, active.kode, fd); if (r?.error) { setErr(r.error); return }; showToast('✅ Data diperbarui'); setModal(null) }) }
  function handleSelesaiCutting(fd: FormData) { if (!active) return; setErr(''); startTransition(async () => { const r = await selesaiCutting(active.id, active.kode, fd); if (r?.error) { setErr(r.error); return }; showToast('✅ Cutting diterima'); setModal(null) }) }
  function handleSerahStage(fd: FormData) { if (!active) return; setErr(''); startTransition(async () => { const r = await serahStageProduksi(active.id, active.kode, activeTahap, fd); if (r?.error) { setErr(r.error); return }; showToast(`✅ Diserahkan ke ${activeTahap.replace('_',' ')}`); setModal(null) }) }
  function handleTerimaStage(fd: FormData) { if (!active || !activeHandoverId) return; setErr(''); startTransition(async () => { const r = await terimaStageProduksi(activeHandoverId, active.id, active.kode, activeTahap, fd); if (r?.error) { setErr(r.error); return }; showToast(`✅ Terima ${activeTahap.replace('_',' ')} berhasil`); setModal(null) }) }
  function openSerahStage(item: any, tahap: string) { setActive(item); setActiveTahap(tahap); setErr(''); setModal('serahStage') }
  function openTerimaStage(item: any, tahap: string, handoverId: number) { setActive(item); setActiveTahap(tahap); setActiveHandoverId(handoverId); setErr(''); setModal('terimaStage') }
  function handleUpdate(fd: FormData) {
    if (!active) return; setErr('')
    const isReject = fd.get('is_reject') === '1'
    startTransition(async () => {
      const r = isReject ? await inputReject(active.id, active.kode, fd) : await updateStatusProduksi(active.id, active.kode, fd)
      if (r?.error) { setErr(r.error); return }
      showToast(isReject ? '✅ Reject dicatat' : '✅ Status diperbarui'); setModal(null)
    })
  }
  function handleDelete() { if (!active) return; startTransition(async () => { const r = await deleteProduksi(active.id, active.kode); if (r?.error) { showToast(r.error, false); return }; showToast('🗑️ Batch dihapus'); setModal(null) }) }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(160deg,#F2F2F7 0%,#EBEBF0 50%,#F2F2F7 100%)' }}>

      {/* Offline Banner */}
      <OfflineIndicator />

      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-4 right-4 left-4 sm:left-auto z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl', toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}{toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900" style={{ fontFamily: "'SF Pro Display','Inter',sans-serif" }}>Produksi</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{activeCount} batch aktif</p>
          </div>
          {canEdit && (
            <button onClick={() => openModal('create')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.38)' }}>
              <Plus size={15} /> Cetak Baru
            </button>
          )}
        </div>

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip label="Batch Aktif"   value={activeCount}                              accent="violet" />
          <StatChip label="Siap Packing"  value={counts['Siap Packing']  ?? 0}             accent="green"  />
          <StatChip label="Total Losses"  value={totalLoses > 0 ? `${fgr(totalLoses)} gr` : '0'} accent={totalLoses > 0 ? 'orange' : undefined} />
          <StatChip label="Terlambat"
            value={<span className="flex items-center gap-1">{overdueCount > 0 && <Clock size={11} />}{overdueCount}</span>}
            accent={overdueCount > 0 ? 'red' : undefined}
          />
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode batch, gramasi, nama…"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.07)' }} />
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const isAct = tab === t
            const cfg   = STATUS_CFG[t]
            // 'Semua' shows active count (excl. Sudah Packing), others show exact count
            const cnt = t === 'Semua' ? activeCount : (counts[t] ?? 0)
            return (
              <button key={t} onClick={() => changeTab(t)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
                style={isAct
                  ? { background: cfg?.dot ?? 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: `0 4px 12px ${cfg?.dot ?? '#8B5CF6'}40` }
                  : { background: 'rgba(255,255,255,0.85)', color: '#6B7280', border: '1px solid rgba(0,0,0,0.07)' }}>
                {t === 'Sudah Packing' && <Archive size={10} className="flex-shrink-0" />}
                {t}{cnt > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(107,114,128,0.12)' }}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Cards ── */}
        {visible.length === 0 ? (
          <div className="rounded-3xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(139,92,246,0.07)' }}>
              <Package size={28} className="text-violet-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">Tidak ada batch produksi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(item => {
              const events     = Array.isArray(item.produksi_event) ? item.produksi_event : []
              const packings   = Array.isArray(item.packing) ? (item.packing as any[]).filter((p: any) => !p.voided_at) : []
              const sortedEvs  = sortEvents(events)
              const lastEv     = sortedEvs.length > 0 ? sortedEvs[sortedEvs.length - 1] : null
              const isExp      = exp === item.id
              const pcsGood    = item.pcs_good ?? item.pcs ?? 0
              const totalPacked = packings.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
              const totalST    = packings.reduce((s: number, p: any) => s + (p.shieldtag_count || 0), 0)
              const totalSerbuk = events.reduce((s: number, ev: any) => s + (Number(ev.sisa_serbuk) || 0), 0)
              const totalLoses  = events.reduce((s: number, ev: any) => s + (Number(ev.losses)      || 0), 0)

              // Bahan baku data
              const b          = item.batch ? (Array.isArray(item.batch) ? item.batch[0] : item.batch) : null
              const bahanAwal  = b ? Number(b.timbangan_akhir || 0) : 0
              const sisaS      = b ? Number(b.sisa_bahan_seharusnya || 0) : 0
              const terpakai   = bahanAwal - sisaS
              const sisaF      = b && b.sisa_fisik !== null && b.sisa_fisik !== undefined ? Number(b.sisa_fisik) : null
              const losesBahan = sisaF !== null ? sisaS - sisaF : null   // positif = ada kehilangan

              return (
                <div key={item.id} className="rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                  style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', backdropFilter: 'blur(20px)' }}>

                  {/* ── Card Header ── */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Overdue badge */}
                        {item.target_selesai && item.current_status !== 'Sudah Packing' && new Date(item.target_selesai) < new Date(today) && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5 mb-1.5 w-fit">
                            <Clock size={9} /> Terlambat — target {formatDate(item.target_selesai)}
                          </div>
                        )}
                        {item.target_selesai && item.current_status !== 'Sudah Packing' && new Date(item.target_selesai) >= new Date(today) && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 mb-1.5 w-fit">
                            <Clock size={9} /> Target {formatDate(item.target_selesai)}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Sbadge s={item.current_status} />
                          {item.operator && (
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              👤 {item.operator}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold text-gray-900 leading-snug break-words">{item.nama_item || item.kode}</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{item.kode} · {item.batch_kode}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                        {/* Stage-aware action buttons */}
                        {canEdit && (() => {
                          const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any) => !h.voided_at) : []
                          const pbH = handovers.find((h:any) => h.tahap === 'pas_berat')
                          const annH = handovers.find((h:any) => h.tahap === 'annealing')
                          const spH = handovers.find((h:any) => h.tahap === 'siap_packing')
                          const s = item.current_status
                          
                          // Cutting: Diterima button
                          if (s === 'Cutting' && item.status_cutting === 'proses')
                            return <button onClick={() => openModal('cuttingTerima', item)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Diterima
                            </button>

                          // Cutting selesai → Serah Pas Berat
                          if (s === 'Cutting' && item.status_cutting === 'selesai' && !pbH)
                            return <button onClick={() => openSerahStage(item, 'pas_berat')}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>
                              <Plus size={11} /> Pas Berat
                            </button>

                          // Pas Berat: Diterima
                          if (s === 'Pas Berat' && pbH?.status === 'proses')
                            return <button onClick={() => openTerimaStage(item, 'pas_berat', pbH.id)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Diterima
                            </button>

                          // Pas Berat tidak ada handover (item lama) → bisa input terima
                          if (s === 'Pas Berat' && !pbH)
                            return <button onClick={() => openTerimaStage(item, 'pas_berat', 0)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Input Terima
                            </button>

                          // Pas Berat selesai → Serah Annealing
                          if (s === 'Pas Berat' && pbH?.status === 'selesai' && !annH)
                            return <button onClick={() => openSerahStage(item, 'annealing')}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(234,179,8,0.12)', color: '#CA8A04' }}>
                              <Plus size={11} /> Annealing
                            </button>

                          // Annealing: Diterima
                          if (s === 'Annealing' && annH?.status === 'proses')
                            return <button onClick={() => openTerimaStage(item, 'annealing', annH.id)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Diterima
                            </button>

                          // Annealing tidak ada handover (item lama) → input terima
                          if (s === 'Annealing' && !annH)
                            return <button onClick={() => openTerimaStage(item, 'annealing', 0)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Input Terima
                            </button>

                          // Annealing selesai → Serah Siap Packing
                          if (s === 'Annealing' && annH?.status === 'selesai' && !spH)
                            return <button onClick={() => openSerahStage(item, 'siap_packing')}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }}>
                              <Plus size={11} /> Siap Packing
                            </button>

                          // Siap Packing: Diterima
                          if (s === 'Siap Packing' && spH?.status === 'proses')
                            return <button onClick={() => openTerimaStage(item, 'siap_packing', spH.id)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Diterima
                            </button>

                          // Siap Packing tidak ada handover (item lama) → input terima
                          if (s === 'Siap Packing' && !spH)
                            return <button onClick={() => openTerimaStage(item, 'siap_packing', 0)}
                              className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:scale-105 transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                              <Check size={11} /> Input Terima
                            </button>

                          return null
                        })()}
                        {canEdit && (
                          <button onClick={() => openModal('edit', item)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }} title="Edit">
                            <Edit2 size={12} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => openModal('delete', item)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }} title="Hapus">
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button onClick={() => setExp(isExp ? null : item.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                          style={{ background: 'rgba(0,0,0,0.05)', color: '#6B7280' }}>
                          {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Stats Row ── */}
                  <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatChip label="Gramasi × PCS" value={`${item.gramasi}gr × ${pcsGood}`} />
                    <StatChip label="Total Berat" value={`${item.total_gram}gr`} />
                    <StatChip label="Serbuk / Loses" value={
                      <span>
                        <span style={{ color: totalSerbuk > 0 ? '#7C3AED' : '#9CA3AF' }}>
                          {totalSerbuk > 0 ? `${fgr(totalSerbuk)}gr` : '—'}
                        </span>
                        <span className="text-gray-300 mx-1">·</span>
                        <span style={{ color: totalLoses > 0 ? '#EA580C' : '#9CA3AF' }}>
                          {totalLoses > 0 ? `${fgr(totalLoses)}gr` : '0'}
                        </span>
                      </span>
                    } />
                    <StatChip label="Packing / Shield"
                      value={<span style={{ color: totalPacked > 0 ? (totalPacked >= pcsGood ? '#7C3AED' : '#3B82F6') : '#9CA3AF' }}>
                        {totalPacked}/{pcsGood} · 🏷{totalST}
                      </span>}
                    />
                  </div>

                  {/* ── Bahan Baku Section ── */}
                  {b && (
                    <div className="mx-5 mb-3 rounded-2xl overflow-hidden" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.10)' }}>
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[9.5px] font-bold tracking-widest uppercase" style={{ color: '#8B5CF6', opacity: 0.8 }}>Bahan Baku Batch</p>
                      </div>
                      <div className="px-2 pb-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {/* Bahan Awal */}
                        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Bahan Awal</p>
                          <p className="text-[12px] font-bold text-gray-700 mt-0.5">{fgr(bahanAwal)} gr</p>
                        </div>
                        {/* Terpakai */}
                        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(59,130,246,0.06)' }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#3B82F6', opacity: 0.8 }}>Terpakai</p>
                          <p className="text-[12px] font-bold mt-0.5" style={{ color: '#2563EB' }}>{fgr(terpakai)} gr</p>
                        </div>
                        {/* Sisa Seharusnya */}
                        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Sisa (Seharusnya)</p>
                          <p className="text-[12px] font-bold text-gray-700 mt-0.5">{fgr(sisaS)} gr</p>
                        </div>
                        {/* Sisa Fisik — editable */}
                        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Sisa Fisik</p>
                          <div className="mt-0.5">
                            <SisaFisikInput batchKode={item.batch_kode} initialValue={sisaF} />
                          </div>
                        </div>
                        {/* Loses Bahan */}
                        <div className="rounded-xl px-3 py-2" style={{ background: losesBahan !== null && losesBahan > 0 ? 'rgba(239,68,68,0.06)' : losesBahan === 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.7)' }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: losesBahan !== null && losesBahan > 0 ? '#DC2626' : losesBahan === 0 ? '#16A34A' : '#9CA3AF', opacity: 0.9 }}>Loses Bahan</p>
                          <p className="text-[12px] font-bold mt-0.5"
                            style={{ color: losesBahan === null ? '#9CA3AF' : losesBahan > 0 ? '#DC2626' : losesBahan < 0 ? '#F97316' : '#16A34A' }}>
                            {losesBahan === null ? '—' : losesBahan === 0 ? 'Sesuai' : (losesBahan > 0 ? `${fgr(losesBahan)} gr` : `+${fgr(Math.abs(losesBahan))} gr`)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Timeline ── */}
                  <div className="px-5 pb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[9.5px] font-bold text-gray-400 tracking-widest uppercase">Timeline</span>
                      <TLine events={events} />
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">
                      {lastEv ? formatDate(lastEv.tanggal) : formatDate(item.tanggal_produksi ?? item.tanggal)}
                    </span>
                  </div>

                  {/* ── Expanded: Event History ── */}
                  {isExp && (
                    <div className="border-t px-5 pb-5 pt-4 space-y-3" style={{ borderColor: 'rgba(139,92,246,0.08)', background: 'rgba(139,92,246,0.015)' }}>
                      {/* Losses table per item */}
                      {(() => {
                        const lCutting = Number(item.losses_cutting ?? 0)
                        const lReject  = Number(item.reject_cutting_gram ?? 0)
                        const lPasBerat = (item.produksi_event ?? []).filter((e:any)=>!e.voided_at&&e.status==='Pas Berat')
                          .reduce((s:number,e:any)=>{const r=(e.berat_sebelumnya??0)-(e.total_gram??0)-(e.sisa_serbuk??0);return s+(r>0?r:0)},0)
                        const totalL = lCutting + lPasBerat
                        if (totalL < 0.001 && lReject < 0.001) return null
                        return (
                          <div className="rounded-xl overflow-hidden border border-red-100">
                            <div className="px-3 py-1.5 text-[9px] font-bold text-red-500 uppercase tracking-wide" style={{background:'rgba(239,68,68,0.04)'}}>
                              📉 Losses Item
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y" style={{borderColor:'rgba(239,68,68,0.07)'}}>
                              {[
                                {label:'Losses Cutting',   val:lCutting>0.001?lCutting.toFixed(3)+' gr':'—',   color:'text-orange-500'},
                                {label:'Reject Cutting',   val:lReject>0.001?lReject.toFixed(3)+' gr':'—',     color:'text-red-500'},
                                {label:'Losses Pas Berat', val:lPasBerat>0.001?lPasBerat.toFixed(3)+' gr':'—', color:'text-amber-500'},
                                {label:'Total Losses',     val:totalL>0.001?totalL.toFixed(3)+' gr':'—',       color:'text-red-600 font-extrabold'},
                              ].map(col=>(
                                <div key={col.label} className="px-2 py-2 text-center">
                                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{col.label}</p>
                                  <p className={`text-[11px] font-bold ${col.color}`}>{col.val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Stage Handover Timeline */}
                      {(() => {
                        const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at).sort((a:any,b:any)=>['pas_berat','annealing','siap_packing'].indexOf(a.tahap)-['pas_berat','annealing','siap_packing'].indexOf(b.tahap)) : []
                        if (handovers.length === 0) return null
                        const tahapLabel: Record<string,string> = {pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                        const tahapColor: Record<string,string> = {pas_berat:'#F97316',annealing:'#EAB308',siap_packing:'#8B5CF6'}
                        return (
                          <div className="rounded-xl overflow-hidden border border-violet-100">
                            <div className="px-3 py-2 text-[9px] font-bold text-violet-600 uppercase tracking-wide" style={{background:'rgba(139,92,246,0.05)'}}>
                              ⛓ Alur Serah-Terima
                            </div>
                            {handovers.map((h:any) => (
                              <div key={h.id} className="px-3 py-3 border-t" style={{borderColor:'rgba(139,92,246,0.07)'}}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{background:tahapColor[h.tahap]}}>{tahapLabel[h.tahap]}</span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${h.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{h.status==='selesai'?'✓ Selesai':'⏳ Proses'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-lg p-2 text-xs" style={{background:'rgba(59,130,246,0.05)'}}>
                                    <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">📤 Diserahkan</p>
                                    <p className="font-semibold text-gray-700">{h.serah_gram ? `${parseFloat(h.serah_gram).toFixed(3)} gr` : '—'} · {h.serah_pcs ?? '—'} PCS</p>
                                    {h.serah_tanggal && <p className="text-gray-400 mt-0.5">{new Date(h.serah_tanggal).toLocaleDateString('id-ID')}{h.serah_jam ? ` ${String(h.serah_jam).slice(0,5)}` : ''}</p>}
                                    {h.serah_catatan && <p className="text-gray-400 italic text-[10px]">{h.serah_catatan}</p>}
                                  </div>
                                  <div className="rounded-lg p-2 text-xs" style={{background:'rgba(34,197,94,0.05)'}}>
                                    <p className="text-[9px] font-bold text-green-500 uppercase mb-1">📥 Diterima</p>
                                    {h.terima_gram ? <>
                                      <p className="font-semibold text-gray-700">{parseFloat(h.terima_gram).toFixed(3)} gr · {h.terima_pcs ?? '—'} PCS</p>
                                      {h.terima_tanggal && <p className="text-gray-400 mt-0.5">{new Date(h.terima_tanggal).toLocaleDateString('id-ID')}{h.terima_jam ? ` ${String(h.terima_jam).slice(0,5)}` : ''}</p>}
                                      {h.sisa_serbuk > 0 && <p className="text-violet-500">Serbuk: {parseFloat(h.sisa_serbuk).toFixed(3)} gr</p>}
                                      {h.reject_gram > 0 && <p className="text-red-500 font-semibold">Reject: {parseFloat(h.reject_gram).toFixed(3)} gr · {h.reject_pcs} PCS</p>}
                                      {h.losses_gram > 0 && <p className="text-orange-500 font-semibold">Losses: {parseFloat(h.losses_gram).toFixed(3)} gr</p>}
                                      {h.terima_catatan && <p className="text-gray-400 italic text-[10px]">{h.terima_catatan}</p>}
                                    </> : <p className="text-gray-400 italic text-[10px]">Belum diterima</p>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                      <p className="text-[9.5px] font-bold text-gray-400 tracking-widest uppercase">Riwayat Proses</p>
                      {events.length === 0
                        ? <p className="text-xs text-gray-400 italic">Belum ada event tercatat</p>
                        : <EventHistory events={events} item={item} />
                      }
                    </div>
                  )}
                </div>
              )
            })}
            {/* Load More */}
            {filtered.length > visibleCount && (
              <button
                onClick={() => setVisible(v => v + 20)}
                className="w-full py-3 text-sm font-semibold text-violet-600 rounded-3xl transition-all hover:bg-violet-50"
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px dashed rgba(139,92,246,0.25)' }}>
                Tampilkan {Math.min(20, filtered.length - visibleCount)} batch lagi ({filtered.length - visibleCount} tersisa)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === 'create' && batches.length > 0 && <CreateModal batches={batches} onClose={() => setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err} />}
      {modal === 'edit'   && active           && <EditModal   item={active}      onClose={() => setModal(null)} onSubmit={handleEdit}   isPending={isPending} error={err} />}
      {modal === 'update' && active           && <UpdateModal item={active}      onClose={() => setModal(null)} onSubmit={handleUpdate} isPending={isPending} error={err} />}
      {modal === 'cuttingTerima' && active   && <SelesaiCuttingModal item={active} onClose={() => setModal(null)} onSubmit={handleSelesaiCutting} isPending={isPending} error={err} />}
      {modal === 'serahStage'    && active   && <SerahStageModal item={active} tahap={activeTahap} onClose={() => setModal(null)} onSubmit={handleSerahStage} isPending={isPending} error={err} />}
      {modal === 'terimaStage'   && active   && <TerimaStageModal item={active} tahap={activeTahap} handoverId={activeHandoverId ?? 0} onClose={() => setModal(null)} onSubmit={handleTerimaStage} isPending={isPending} error={err} />}
      {modal === 'delete' && active           && <DelModal    item={active}      onClose={() => setModal(null)} onConfirm={handleDelete} isPending={isPending} />}
    </div>
  )
}
