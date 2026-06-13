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
import LossApprovalPanel from '@/components/modules/produksi/loss-approval-panel'

interface Props { produksiList: any[]; batches: any[]; peleburanByBatch: Record<string, any[]>; tims: any[]; toleransi: Record<string, number>; userRole: UserRole; userName: string }

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

function getDurasiJam(mulai: string | null, selesai: string | null): string {
  if (!mulai || !selesai) return ''
  const [h1, m1] = String(mulai).slice(0,5).split(':').map(Number)
  const [h2, m2] = String(selesai).slice(0,5).split(':').map(Number)
  if ([h1,m1,h2,m2].some(isNaN)) return ''
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (diff < 0) diff += 24 * 60 // lewat tengah malam
  if (diff <= 0) return ''
  const jam = Math.floor(diff / 60); const mnt = diff % 60
  return jam > 0 ? `${jam}j ${mnt}mnt` : `${mnt}mnt`
}

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const STATUS_FLOW     = ['Cutting','Pas Berat','Annealing','Siap Packing']
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

// ─── Tim Picker (dropdown tim + anggota PIC) ────────────────────────────────────
function TimPicker({ tims, timId, setTimId, anggota, setAnggota, label = 'Tim Pengerjaan', req = false, namePrefix = '' }: {
  tims: any[]; timId: string; setTimId: (v: string) => void
  anggota: string; setAnggota: (v: string) => void
  label?: string; req?: boolean; namePrefix?: string
}) {
  const selectedTim = tims.find(t => String(t.id) === timId)
  const anggotaList = selectedTim?.anggota?.filter((a: any) => a.aktif) ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
      <div className="grid grid-cols-2 gap-2">
        <select name={`${namePrefix}tim_id`} value={timId} onChange={e => { setTimId(e.target.value); setAnggota('') }} className={inp} required={req}>
          <option value="">Pilih tim…</option>
          {tims.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
        </select>
        <select name={`${namePrefix}operator`} value={anggota} onChange={e => setAnggota(e.target.value)} className={inp} disabled={!selectedTim}>
          <option value="">{selectedTim ? 'Pilih PIC…' : 'Pilih tim dulu'}</option>
          {anggotaList.map((a: any) => <option key={a.id} value={a.nama}>{a.nama}</option>)}
        </select>
      </div>
      {selectedTim && <input type="hidden" name={`${namePrefix}tim_nama`} value={selectedTim.nama} />}
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
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Filter: sembunyikan event Cutting awal (tanpa jam_mulai = event create, bukan proses)
  const filtered = sortEvents(events).filter((ev: any) => {
    if (ev.status === 'Cutting' && !ev.jam_mulai && (!ev.catatan || !ev.catatan.includes('Serah:'))) return false
    return true
  })

  return (
    <div className="space-y-2">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {filtered.length === 0 && <p className="text-xs text-gray-400 italic">Belum ada riwayat proses</p>}
      {filtered.map((ev: any, i: number) => {
        const c = STATUS_CFG[ev.status] ?? { dot: '#94A3B8', bg: 'rgba(148,163,184,0.1)', text: '#64748B' }
        const fotos  = Array.isArray(ev.fotos) ? ev.fotos : []
        const serbuk = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
        // Cutting: sisa_serbuk field is actually reject (see selesaiCutting action)
        const isCuttingTerima = ev.status === 'Cutting' && ev.jam_mulai
        const serbukLabel = isCuttingTerima ? 'reject' : 'serbuk'
        const serbukColor = isCuttingTerima ? 'text-red-500' : 'text-violet-500'
        // Parse catatan for clean display
        const hasCatatanBreakdown = ev.catatan?.includes('Serah:')
        return (
          <div key={ev.id ?? i} className="rounded-2xl overflow-hidden"
            style={{background:'rgba(255,255,255,0.6)',border:'1px solid rgba(0,0,0,0.05)'}}>
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{borderColor:'rgba(0,0,0,0.04)',background:c.bg+'66'}}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c.dot}}/>
              <Sbadge s={ev.status} />
              <span className="text-[11px] text-gray-400 font-medium">{formatDate(ev.tanggal)}</span>
              {ev.jam_mulai && (
                <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                  ⏱ {fmtTime(ev.jam_mulai)}
                  {ev.created_at && ` → ${new Date(ev.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`}
                  {getDurasi(ev.jam_mulai, ev.created_at) && <span className="text-gray-300 ml-1">({getDurasi(ev.jam_mulai, ev.created_at)})</span>}
                </span>
              )}
              {ev.user_name && <span className="text-[10px] text-gray-400 ml-auto bg-white/80 px-2 py-0.5 rounded-full border border-gray-100">👤 {ev.user_name}</span>}
            </div>
            {/* Data row */}
            <div className="px-3 py-2 flex flex-wrap gap-3 items-center text-xs">
              <div><span className="text-gray-400">Berat: </span><span className="font-bold text-gray-700">{ev.total_gram} gr</span></div>
              {Number(ev.sisa_serbuk) > 0 && <div><span className="text-gray-400">{serbukLabel}: </span><span className={`font-semibold ${serbukColor}`}>{fgr(Number(ev.sisa_serbuk))} gr</span></div>}
              {Number(ev.losses) > 0 && <div><span className="text-gray-400">losses: </span><span className="font-semibold text-orange-500">{fgr(Number(ev.losses))} gr</span></div>}
              {ev.kategori_losses && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:'rgba(249,115,22,0.10)',color:'#EA580C'}}>⚠ {ev.kategori_losses}</span>}
            </div>
            {/* Catatan — only show if it's not the auto-generated breakdown from selesaiCutting */}
            {ev.catatan && !hasCatatanBreakdown && (
              <div className="px-3 pb-2">
                <p className="text-[11px] text-gray-400 italic">{ev.catatan}</p>
              </div>
            )}
            {/* Fotos */}
            {(fotos.length > 0 || serbuk.length > 0) && (
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {fotos.map((u: string, fi: number) => (
                  <img key={fi} src={u} onClick={() => setLightbox(u)} className="w-12 h-12 rounded-xl object-cover cursor-pointer border border-gray-100 hover:scale-110 transition-transform shadow-sm" />
                ))}
                {serbuk.map((u: string, fi: number) => (
                  <div key={`s${fi}`} className="relative">
                    <img src={u} onClick={() => setLightbox(u)} className="w-12 h-12 rounded-xl object-cover cursor-pointer border-2 border-violet-200 hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">S</div>
                  </div>
                ))}
              </div>
            )}
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
    <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase leading-tight min-h-[28px] flex items-end">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ batches, peleburanByBatch, tims, onClose, onSubmit, isPending, error }: {
  batches: any[]; peleburanByBatch: Record<string, any[]>; tims: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const nowTime = new Date().toTimeString().slice(0,5)
  const firstBatch = batches[0]?.kode ?? ''
  const firstPlb = (peleburanByBatch[firstBatch] ?? [])[0]
  const [f, setF] = useState({ batch_kode: firstBatch, peleburan_id: firstPlb ? String(firstPlb.id) : '', gramasi: '1', pcs: '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, jam_mulai: nowTime, operator: '', target_selesai: '' })
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const [timId, setTimId] = useState('')
  const [timAnggota, setTimAnggota] = useState('')
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const plbList = peleburanByBatch[f.batch_kode] ?? []
  const selectedPlb = plbList.find(p => String(p.id) === f.peleburan_id)

  // Saat ganti batch, set peleburan ke yang pertama (langsung, tanpa fetch)
  useEffect(() => {
    const list = peleburanByBatch[f.batch_kode] ?? []
    setF(p => ({ ...p, peleburan_id: list[0] ? String(list[0].id) : '' }))
  }, [f.batch_kode])

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
              {batches.map(b => <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} (Siap cetak: {(b.bahan_siap_cetak ?? 0).toFixed(2)} gr)</option>)}
            </select>
          </F>
          <F label="Peleburan Asal (Bahan)" req>
            {plbList.length === 0 ? (
              <div className="text-xs text-amber-600 px-3 py-2.5 rounded-xl" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
                Belum ada hasil lebur siap cetak di batch ini. Lebur bahan dulu di halaman Bahan Baku.
              </div>
            ) : (
              <>
                <select name="peleburan_id" value={f.peleburan_id} onChange={e => s('peleburan_id', e.target.value)} className={inp} required>
                  {plbList.map(p => <option key={p.id} value={p.id}>{p.kode} — sisa {p.sisa.toFixed(3)} gr</option>)}
                </select>
                {selectedPlb && <p className="text-[11px] text-violet-500 font-semibold mt-1 px-1">Tersedia dari peleburan ini: {selectedPlb.sisa.toFixed(3)} gr</p>}
              </>
            )}
          </F>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Pilih Gramasi yang ingin di cetak" req>
              <select name="gramasi" value={f.gramasi} onChange={e => s('gramasi', e.target.value)} className={inp} required>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
              </select>
            </F>
            <F label="Jumlah PCS"><input name="pcs" type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} placeholder="50 — opsional" className={inp} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Total bahan yang di serahkan" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} placeholder="500.15" className={inp} required /></F>
            <F label="Status Awal" req>
              <select name="status_awal" value={f.status_awal} onChange={e => s('status_awal', e.target.value)} className={inp} required>
                {['Cutting','Pas Berat','Annealing','Siap Packing'].map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <F label="Tanggal Mulai" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} required /></F>
            <F label="Jam Mulai" req><input name="jam_mulai" type="time" value={f.jam_mulai ?? ''} onChange={e => s('jam_mulai', e.target.value)} className={inp} required /></F>
            <F label="Target Selesai"><input name="target_selesai" type="date" value={f.target_selesai} onChange={e => s('target_selesai', e.target.value)} className={inp} /></F>
          </div>
          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={v => { setTimAnggota(v); if (v) s('operator', v) }} label="Tim Pengerjaan" />
          <F label="Operator / PIC (manual)"><input name="operator" value={f.operator} onChange={e => s('operator', e.target.value)} placeholder="Atau ketik manual" className={inp} /></F>
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

// ─── Tambah Produksi Modal (lanjut cetak dari batch yang sama) ──────────────────
function TambahProduksiModal({ item, peleburanByBatch, tims, onClose, onSubmit, isPending, error }: {
  item: any; peleburanByBatch: Record<string, any[]>; tims: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const nowTime = new Date().toTimeString().slice(0,5)
  const batchKode = item.batch_kode
  const plbList = peleburanByBatch[batchKode] ?? []
  const [f, setF] = useState({ peleburan_id: plbList[0] ? String(plbList[0].id) : '', gramasi: '1', pcs: '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, jam_mulai: nowTime, operator: '', target_selesai: '' })
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const [timId, setTimId] = useState('')
  const [timAnggota, setTimAnggota] = useState('')
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const selectedPlb = plbList.find(p => String(p.id) === f.peleburan_id)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    setUp(true); const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []; setUp(false)
    const fd = new FormData(el)
    fd.set('batch_kode', batchKode)
    fd.set('fotos_b64', JSON.stringify(b64))
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Tambah Produksi</h2>
            <p className="text-xs text-violet-500 font-semibold mt-0.5">Batch {batchKode} — lanjut cetak gramasi</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-140px)]">
          <F label="Nama / Label" req><input name="nama_item" value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder={`cth: LM REI ${f.gramasi}GR`} className={inp} required /></F>

          <F label="Pilih Bahan dari Peleburan" req>
            {plbList.length === 0 ? (
              <div className="text-xs text-amber-600 px-3 py-2.5 rounded-xl" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
                Belum ada bahan siap cetak. Jika ada reject, lebur dulu di halaman Bahan Baku — setelah dilebur baru bisa dipakai cetak.
              </div>
            ) : (
              <>
                <select name="peleburan_id" value={f.peleburan_id} onChange={e => s('peleburan_id', e.target.value)} className={inp} required>
                  {plbList.map(p => <option key={p.id} value={p.id}>{p.kode} — sisa {p.sisa.toFixed(3)} gr</option>)}
                </select>
                {selectedPlb && <p className="text-[11px] text-violet-500 font-semibold mt-1 px-1">Tersedia: {selectedPlb.sisa.toFixed(3)} gr</p>}
              </>
            )}
          </F>

          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Gramasi" req>
              <select name="gramasi" value={f.gramasi} onChange={e => { s('gramasi', e.target.value); s('nama_item', `LM REI ${e.target.value}GR`) }} className={inp} required>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}
              </select>
            </F>
            <F label="Jumlah PCS"><input name="pcs" type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} placeholder="opsional" className={inp} /></F>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Total Bahan Diserahkan" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} placeholder="100.00" className={inp} required /></F>
            <F label="Status Awal" req>
              <select name="status_awal" value={f.status_awal} onChange={e => s('status_awal', e.target.value)} className={inp} required>
                {['Cutting','Pas Berat','Annealing','Siap Packing'].map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </F>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <F label="Tanggal Mulai" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} required /></F>
            <F label="Jam Mulai" req><input name="jam_mulai" type="time" value={f.jam_mulai} onChange={e => s('jam_mulai', e.target.value)} className={inp} required /></F>
            <F label="Target Selesai"><input name="target_selesai" type="date" value={f.target_selesai} onChange={e => s('target_selesai', e.target.value)} className={inp} /></F>
          </div>

          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={v => { setTimAnggota(v); if (v) s('operator', v) }} label="Tim Pengerjaan" />
          <F label="Operator / PIC (manual)"><input name="operator" value={f.operator} onChange={e => s('operator', e.target.value)} placeholder="Atau ketik manual" className={inp} /></F>
          <F label="Foto Proses (opsional, max 10)">
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Tambah foto" />
          </F>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14} />{error}</div>}
          <div className="flex gap-3 justify-end pt-1 pb-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || up || plbList.length === 0} className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
              {(isPending || up) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {up ? 'Kompres foto…' : isPending ? 'Menyimpan…' : 'Tambah Produksi'}
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
  const [fotos, setFotos] = useState<File[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>(
    Array.isArray(item.foto_serahkan_cutting) ? item.foto_serahkan_cutting : []
  )
  const [uploading, setUploading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.set(k, v))
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      fd.set('foto_serahkan_b64', JSON.stringify(b64s))
      fd.set('existing_fotos_serah', JSON.stringify(existingFotos))
      onSubmit(fd)
    } finally { setUploading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 32px 64px rgba(139,92,246,0.18)' }}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100/80 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900">Edit Diserahkan</h2><p className="text-xs text-violet-500 font-medium mt-0.5">{item.kode}</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[calc(100dvh-140px)]">
          <F label="Nama / Label Batch"><input value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp} /></F>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Pilih Gramasi" req><select value={f.gramasi} onChange={e => { s('gramasi', e.target.value); s('nama_item', `LM REI ${e.target.value}GR`) }} className={inp}>{GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} Gram</option>)}</select></F>
            <F label="Jumlah PCS"><input type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} className={inp} /></F>
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
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto Diserahkan</label>
            {existingFotos.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {existingFotos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-blue-200" />
                    <button type="button" onClick={() => setExistingFotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            )}
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 5))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label={existingFotos.length > 0 ? 'Tambah foto lagi' : 'Tambah foto (opsional)'} />
          </div>
          {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"><AlertTriangle size={14} />{error}</div>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isPending || uploading} className="px-6 py-2.5 text-sm font-bold text-white rounded-2xl flex items-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>
              {(isPending || uploading) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {uploading ? 'Upload…' : isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ─── Selesai Cutting Modal ────────────────────────────────────────────────────
function SelesaiCuttingModal({ item, toleransi, onClose, onSubmit, isPending, error, isEdit }: {
  item: any; toleransi: number; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string; isEdit?: boolean
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>(
    isEdit && Array.isArray(item.foto_diterima_cutting) ? item.foto_diterima_cutting : []
  )
  const [uploading, setUploading] = useState(false)
  const serahGram = Number(item.serah_gram ?? item.berat_awal ?? 0)

  // Loss tracking realtime
  const [terimaVal, setTerimaVal] = useState(isEdit && item.terima_gram ? String(item.terima_gram) : '')
  const [rejectVal, setRejectVal] = useState(isEdit && item.reject_cutting_gram ? String(item.reject_cutting_gram) : '')
  const lossNow = Math.max(0, serahGram - (parseFloat(terimaVal) || 0) - (parseFloat(rejectVal) || 0))
  const overTol = lossNow > toleransi + 0.0001
  const [lossAlasan, setLossAlasan] = useState('')
  const [lossOpNama, setLossOpNama] = useState(item.operator ?? '')
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
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64s))
      fd.set('existing_fotos', JSON.stringify(existingFotos))
      if (overTol) {
        fd.set('loss_alasan', lossAlasan)
        fd.set('loss_operator_nama', lossOpNama)
        fd.set('loss_admin_nama', lossAdminNama)
        if (ttdOp) fd.set('loss_ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
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
            <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Diterima' : '✓ Konfirmasi Terima Cutting'}</h2>
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
              <input name="tanggal_selesai" type="date" defaultValue={isEdit&&item.tanggal_selesai?item.tanggal_selesai:new Date().toISOString().split('T')[0]}
                className={inp} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Selesai *</label>
              <input name="jam_selesai" type="time" defaultValue={isEdit&&item.jam_selesai?String(item.jam_selesai).slice(0,5):undefined} className={inp} required />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Berat Diterima (gr) *</label>
            <input name="terima_gram" type="number" step="0.001"
              value={terimaVal} onChange={e => setTerimaVal(e.target.value)}
              placeholder={`Max ${fgr(serahGram)} gr`}
              className={inp} required />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Reject Cutting (gr)</label>
            <input name="reject_cutting_gram" type="number" step="0.001"
              value={rejectVal} onChange={e => setRejectVal(e.target.value)} className={inp} />
          </div>

          {/* Loss indicator realtime */}
          {(terimaVal !== '') && (
            <div className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between"
              style={{ background: overTol ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: overTol ? '#DC2626' : '#16A34A' }}>
              <span>Loss: {lossNow.toFixed(3)} gr</span>
              <span className="text-[10px]">{overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
            </div>
          )}

          {overTol && (
            <LossApprovalPanel
              lossGram={lossNow} toleransiGram={toleransi} proses="Cutting"
              alasan={lossAlasan} setAlasan={setLossAlasan}
              operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
              adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
              setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
            />
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              PCS Berhasil <span className="text-gray-400 font-normal">(opsional, isi jika sudah tahu)</span>
            </label>
            <input name="pcs_good" type="number" min="1"
              defaultValue={isEdit&&item.pcs_good?Number(item.pcs_good):undefined}
              placeholder="Isi jika sudah dihitung" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Catatan <span className="text-gray-400 font-normal">(alasan losses, kondisi bahan, dll)</span>
            </label>
            <input name="catatan" type="text" placeholder="Misal: losses karena serbuk tercecer..."
              defaultValue={isEdit ? (item.catatan ?? '') : ''}
              className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto Bukti Terima</label>
            {existingFotos.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {existingFotos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-green-200" />
                    <button type="button" onClick={() => setExistingFotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 h-11 px-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-violet-50 transition-colors border border-gray-200">
              <Camera size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto baru` : (existingFotos.length > 0 ? 'Tambah foto lagi' : 'Tambah foto (opsional)')}</span>
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
function SerahStageModal({ item, tahap, tims, onClose, onSubmit, isPending, error }: {
  item: any; tahap: string; tims: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [timId, setTimId] = useState('')
  const [timAnggota, setTimAnggota] = useState('')
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
          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={setTimAnggota} label="Tim Pengerjaan" namePrefix="serah_" />
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Operator (manual)</label>
            <input name="serah_operator_manual" type="text" placeholder="Atau ketik manual" className={inp}/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Catatan</label>
            <input name="serah_catatan" type="text" placeholder="Opsional" className={inp}/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Foto</label>
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 5))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Tambah foto (opsional)" />
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
function TerimaStageModal({ item, tahap, tims, toleransi, handoverId, onClose, onSubmit, isPending, error, initialData }: {
  item: any; tahap: string; tims: any[]; toleransi: number; handoverId: number; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string; initialData?: any
}) {
  const [fotos, setFotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [adaReject, setAdaReject] = useState(false)
  const [timId, setTimId] = useState('')
  const [timAnggota, setTimAnggota] = useState('')
  const tahapLabel: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  const label = tahapLabel[tahap] ?? tahap
  const isPasBerat = tahap === 'pas_berat'

  // Ambil berat serah dari handover
  const handovers: any[] = Array.isArray(item.stage_handover) ? item.stage_handover.filter((h:any)=>!h.voided_at) : []
  const currentH = handovers.find((h:any) => h.tahap === tahap)
  const serahGram = currentH?.serah_gram ?? (tahap==='pas_berat' ? item.terima_gram : item.total_gram) ?? 0

  // Loss tracking realtime
  const [terimaVal, setTerimaVal] = useState(initialData?.terima_gram ? String(initialData.terima_gram) : '')
  const [rejectVal, setRejectVal] = useState(initialData?.reject_gram ? String(initialData.reject_gram) : '0')
  const [serbukVal, setSerbukVal] = useState(initialData?.sisa_serbuk ? String(initialData.sisa_serbuk) : '0')
  const lossNow = Math.max(0, Number(serahGram) - (parseFloat(terimaVal) || 0) - (parseFloat(rejectVal) || 0) - (parseFloat(serbukVal) || 0))
  const overTol = lossNow > toleransi + 0.0001
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
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('fotos_b64', JSON.stringify(b64s))
      if (handoverId === 0) {
        fd.set('create_serah_first', '1')
        fd.set('serah_gram', String(serahGram))
        fd.set('serah_pcs', String(item.pcs_good ?? item.pcs ?? 0))
      }
      if (overTol) {
        fd.set('loss_alasan', lossAlasan)
        fd.set('loss_operator_nama', lossOpNama)
        fd.set('loss_admin_nama', lossAdminNama)
        if (ttdOp) fd.set('loss_ttd_operator', ttdOp)
        if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
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
            <input name="terima_gram" type="number" step="0.001" placeholder={`Max ${Number(serahGram).toFixed(3)} gr`} value={terimaVal} onChange={e=>setTerimaVal(e.target.value)} className={inp} required/>
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
              <input name="sisa_serbuk" type="number" step="0.001" value={serbukVal} onChange={e=>setSerbukVal(e.target.value)} className={inp}/>
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
                  <input name="reject_gram" type="number" step="0.001" value={rejectVal} onChange={e=>setRejectVal(e.target.value)} className={inp}/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">PCS Reject</label>
                  <input name="reject_pcs" type="number" min="0" defaultValue="0" className={inp}/>
                </div>
              </div>
            )}
          </div>

          {/* Loss indicator realtime */}
          {(terimaVal !== '') && (
            <div className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between"
              style={{ background: overTol ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: overTol ? '#DC2626' : '#16A34A' }}>
              <span>Loss: {lossNow.toFixed(3)} gr</span>
              <span className="text-[10px]">{overTol ? `⚠️ melebihi toleransi ${toleransi} gr` : `✓ dalam toleransi (${toleransi} gr)`}</span>
            </div>
          )}

          {overTol && (
            <LossApprovalPanel
              lossGram={lossNow} toleransiGram={toleransi} proses={label}
              alasan={lossAlasan} setAlasan={setLossAlasan}
              operatorNama={lossOpNama} setOperatorNama={setLossOpNama}
              adminNama={lossAdminNama} setAdminNama={setLossAdminNama}
              setTtdOperator={setTtdOp} setTtdAdmin={setTtdAdmin}
            />
          )}

          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={setTimAnggota} label="Tim Pengerjaan" namePrefix="terima_" />

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
              <span className="text-xs text-gray-400">{fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto (opsional, max 5)'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFotos(p=>[...p,...Array.from(e.target.files??[])].slice(0,5))}/>
            </label>
            {fotos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-200 shadow-sm"/>
                    <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-md hover:bg-red-600 transition-colors">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
export default function ProduksiClient({ produksiList, batches, peleburanByBatch, tims, toleransi, userRole, userName }: Props) {
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilter] = useState<string>('Semua')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [modal, setModal]       = useState<'create'|'tambahProduksi'|'edit'|'update'|'delete'|'cuttingTerima'|'editCutting'|'serahStage'|'terimaStage'|'editHandover'|null>(null)
  const [active, setActive]     = useState<any>(null)
  const [activeTahap, setActiveTahap]   = useState<string>('')
  const [activeHandoverId, setActiveHandoverId] = useState<number|null>(null)
  const [activeHandoverData, setActiveHandoverData] = useState<any>(null)
  const [err, setErr]           = useState('')
  const [toast, setToast]       = useState<{msg:string;ok:boolean}|null>(null)
  const [isPending, start]      = useTransition()

  const canEdit   = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete = ['owner','admin_pusat','spv'].includes(userRole)

  function showToast(msg: string, ok = true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3200) }
  function openModal(type: typeof modal, item?: any) { setActive(item??null); setErr(''); setModal(type) }
  function openTambahProduksi(item: any) { setActive(item); setErr(''); setModal('tambahProduksi') }
  function openSerahStage(item: any, tahap: string)  { setActive(item); setActiveTahap(tahap); setErr(''); setModal('serahStage') }
  function openTerimaStage(item: any, tahap: string, hid: number) { setActive(item); setActiveTahap(tahap); setActiveHandoverId(hid); setErr(''); setModal('terimaStage') }
  function openEditHandover(item: any, h: any) { setActive(item); setActiveTahap(h.tahap); setActiveHandoverId(h.id); setActiveHandoverData(h); setErr(''); setModal('editHandover') }
  function toggleExp(id: number) { setExpanded(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n }) }

  function handleCreate(fd: FormData) { setErr(''); start(async()=>{ const r=await createProduksi(fd); if(r?.error){setErr(r.error);return}; showToast(`✅ ${r.kode} dibuat`); setModal(null) }) }
  function handleTambahProduksi(fd: FormData) { setErr(''); start(async()=>{ const r=await createProduksi(fd); if(r?.error){setErr(r.error);return}; showToast(`✅ ${r.kode} ditambahkan`); setModal(null) }) }
  function handleEdit(fd: FormData)   { if(!active)return; setErr(''); start(async()=>{ const r=await editProduksi(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Diperbarui'); setModal(null) }) }
  function handleUpdate(fd: FormData) { if(!active)return; setErr(''); start(async()=>{ const r=await updateStatusProduksi(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Status diperbarui'); setModal(null) }) }
  function handleDelete()             { if(!active)return; start(async()=>{ await deleteProduksi(active.id,active.kode); showToast('🗑️ Dihapus'); setModal(null) }) }
  function handleSelesaiCutting(fd: FormData) { if(!active)return; setErr(''); start(async()=>{ const r=await selesaiCutting(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting diterima'); setModal(null) }) }
  function handleEditCutting(fd: FormData) { if(!active)return; setErr(''); fd.set('is_edit','1'); start(async()=>{ const r=await selesaiCutting(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting diperbarui'); setModal(null) }) }
  function handleSerahStage(fd: FormData)  { if(!active)return; setErr(''); start(async()=>{ const r=await serahStageProduksi(active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast(`✅ Diserahkan ke ${activeTahap.replace('_',' ')}`); setModal(null) }) }
  function handleTerimaStage(fd: FormData) { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await terimaStageProduksi(activeHandoverId,active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast(`✅ Terima berhasil`); setModal(null) }) }
  function handleEditHandover(fd: FormData) { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await terimaStageProduksi(activeHandoverId,active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Data diperbarui'); setModal(null) }) }

  // ── Filter ────────────────────────────────────────────────────────────────
  const STATUS_TABS = ['Semua','Cutting','Pas Berat','Annealing','Siap Packing','Sudah Packing','Reject']
  const filtered = produksiList.filter(i=>{
    if(filterStatus!=='Semua' && i.current_status!==filterStatus) return false
    if(!search) return true
    const q=search.toLowerCase()
    return i.kode?.toLowerCase().includes(q)||i.nama_item?.toLowerCase().includes(q)||i.batch_kode?.toLowerCase().includes(q)||i.gramasi?.toString().includes(q)
  })

  const STATUS_COLOR: Record<string,{bg:string;text:string;dot:string}> = {
    'Cutting':      {bg:'rgba(59,130,246,0.1)',   text:'#2563EB', dot:'#3B82F6'},
    'Pas Berat':    {bg:'rgba(249,115,22,0.1)',   text:'#EA580C', dot:'#F97316'},
    'Annealing':    {bg:'rgba(234,179,8,0.1)',    text:'#CA8A04', dot:'#EAB308'},
    'Siap Packing': {bg:'rgba(139,92,246,0.12)',  text:'#7C3AED', dot:'#8B5CF6'},
    'Sudah Packing':{bg:'rgba(34,197,94,0.1)',    text:'#15803D', dot:'#22C55E'},
    'Reject':       {bg:'rgba(239,68,68,0.1)',    text:'#DC2626', dot:'#EF4444'},
  }

  return (
    <div className="min-h-screen pb-24" style={{background:'linear-gradient(160deg,#F5F5F7 0%,#EFEFF4 60%,#F5F5F7 100%)'}}>

      {/* Toast */}
      {toast&&(
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl transition-all ${toast.ok?'bg-gradient-to-r from-emerald-500 to-green-600':'bg-gradient-to-r from-red-500 to-rose-600'}`}>
          {toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Produksi</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{produksiList.length} item total</p>
          </div>
          {canEdit&&(
            <button onClick={()=>openModal('create')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl hover:-translate-y-0.5 transition-all"
              style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',boxShadow:'0 4px 20px rgba(139,92,246,0.4)'}}>
              <Plus size={15}/> Cetak Baru
            </button>
          )}
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari kode, nama item, gramasi, batch..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',border:'1px solid rgba(209,213,219,0.5)'}}/>
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map(tab=>{
            const count = tab==='Semua' ? produksiList.length : produksiList.filter(i=>i.current_status===tab).length
            const active = filterStatus===tab
            return (
              <button key={tab} onClick={()=>setFilter(tab)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={active
                  ? {background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',boxShadow:'0 4px 12px rgba(139,92,246,0.35)'}
                  : {background:'rgba(255,255,255,0.8)',color:'#6B7280',border:'1px solid rgba(209,213,219,0.5)'}}>
                {tab} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active?'bg-white/20':'bg-gray-100'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── Item cards ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length===0?(
            <div className="text-center py-16 rounded-3xl"
              style={{background:'rgba(255,255,255,0.6)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.5)'}}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{background:'rgba(139,92,246,0.08)'}}>
                <Package size={28} className="text-violet-300"/>
              </div>
              <p className="text-sm font-medium text-gray-400">
                {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada item produksi'}
              </p>
            </div>
          ):(()=>{
            // Kelompokkan per peleburan asal — produksi nyambung di bawah peleburan-nya
            const groups = new Map<string, any[]>()
            for (const it of filtered) {
              const key = it.peleburan_kode || '__no_plb__'
              if (!groups.has(key)) groups.set(key, [])
              groups.get(key)!.push(it)
            }
            const groupKeys = [...groups.keys()]
            return groupKeys.map(gk => {
              const gItems = groups.get(gk)!
              const plbTotal = gItems.reduce((a,i)=>a+Number(i.berat_awal||0),0)
              return (
                <div key={gk} className="space-y-3">
                  {gk!=='__no_plb__' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mt-1"
                      style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.12)'}}>
                      <span className="text-[11px] font-bold text-violet-700">🔥 {gk}</span>
                      <span className="text-[10px] text-violet-400 font-semibold">{gItems.length} produksi · {plbTotal.toFixed(2)} gr dipakai</span>
                    </div>
                  )}
                  {gItems.map(item=>{
            const isExp     = expanded.has(item.id)
            const sc        = STATUS_COLOR[item.current_status] ?? {bg:'rgba(156,163,175,0.1)',text:'#6B7280',dot:'#9CA3AF'}
            const events: any[] = Array.isArray(item.produksi_event)?item.produksi_event.filter((e:any)=>!e.voided_at):[]
            const handovers: any[] = Array.isArray(item.stage_handover)?item.stage_handover.filter((h:any)=>!h.voided_at).sort((a:any,b:any)=>['pas_berat','annealing','siap_packing'].indexOf(a.tahap)-['pas_berat','annealing','siap_packing'].indexOf(b.tahap)):[]
            const pbH  = handovers.find((h:any)=>h.tahap==='pas_berat')
            const annH = handovers.find((h:any)=>h.tahap==='annealing')
            const spH  = handovers.find((h:any)=>h.tahap==='siap_packing')
            const s    = item.current_status
            const isVoided = !!item.voided_at



            return (
              <div key={item.id}
                className="rounded-3xl overflow-hidden transition-all"
                style={{
                  background:'rgba(255,255,255,0.75)',
                  backdropFilter:'blur(20px)',
                  border:`1px solid rgba(255,255,255,0.6)`,
                  boxShadow:`0 4px 24px rgba(139,92,246,0.06),0 1px 8px rgba(0,0,0,0.04)`,
                  borderLeft:`3px solid ${sc.dot}`,
                }}>

                {/* ── Card Header ─────────────────────────────────────────── */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-xs flex-shrink-0"
                    style={{background:`linear-gradient(135deg,${sc.dot}22,${sc.dot}10)`,color:sc.dot}}>
                    {item.gramasi ? `${item.gramasi}gr` : '?'}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">{item.nama_item ?? item.kode}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{background:sc.bg,color:sc.text}}>
                        {item.current_status}
                      </span>
                      {item.status_cutting==='proses'&&<span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">proses</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                      {item.kode} · {item.batch_kode}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-bold">{item.gramasi}gr</span>
                      <span className="text-gray-300 mx-1">×</span>
                      <span className="font-semibold">{item.pcs_good??item.pcs??'?'} pcs</span>
                      <span className="text-gray-300 mx-1">=</span>
                      <span className="font-bold text-gray-700">{fgr(item.total_gram)} gr</span>
                    </p>
                  </div>

                  {/* Action buttons */}
                  {canEdit&&!isVoided&&(()=>{
                    if(s==='Cutting'&&item.status_cutting==='proses')
                      return <button onClick={()=>openModal('cuttingTerima',item)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Cutting'&&item.status_cutting==='selesai'&&!pbH)
                      return <button onClick={()=>openSerahStage(item,'pas_berat')}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(249,115,22,0.12)',color:'#EA580C'}}>
                        <Plus size={11}/> Pas Berat
                      </button>
                    if(s==='Pas Berat'&&pbH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'pas_berat',pbH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Pas Berat'&&!pbH)
                      return <button onClick={()=>openTerimaStage(item,'pas_berat',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Terima
                      </button>
                    if(s==='Pas Berat'&&pbH?.status==='selesai'&&!annH)
                      return <button onClick={()=>openSerahStage(item,'annealing')}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(234,179,8,0.12)',color:'#CA8A04'}}>
                        <Plus size={11}/> Annealing
                      </button>
                    if(s==='Annealing'&&annH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'annealing',annH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Annealing'&&!annH)
                      return <button onClick={()=>openTerimaStage(item,'annealing',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Terima
                      </button>
                    if(s==='Annealing'&&annH?.status==='selesai'&&!spH)
                      return <button onClick={()=>openSerahStage(item,'siap_packing')}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(139,92,246,0.12)',color:'#7C3AED'}}>
                        <Plus size={11}/> Siap Packing
                      </button>
                    if(s==='Siap Packing'&&spH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'siap_packing',spH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Siap Packing'&&!spH)
                      return <button onClick={()=>openTerimaStage(item,'siap_packing',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all"
                        style={{background:'rgba(34,197,94,0.12)',color:'#16A34A'}}>
                        <Check size={11}/> Terima
                      </button>
                    return null
                  })()}

                  {/* Edit / Delete / Expand */}
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    {canEdit&&!isVoided&&<button onClick={()=>openModal('edit',item)}
                      className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center hover:scale-110 transition-all">
                      <Edit2 size={12} className="text-blue-400"/>
                    </button>}
                    {canDelete&&!isVoided&&<button onClick={()=>openModal('delete',item)}
                      className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center hover:scale-110 transition-all">
                      <Trash2 size={12} className="text-red-400"/>
                    </button>}
                    <button onClick={()=>toggleExp(item.id)}
                      className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 hover:scale-110 transition-all">
                      {isExp?<ChevronUp size={13} className="text-gray-500"/>:<ChevronDown size={13} className="text-gray-500"/>}
                    </button>
                  </div>
                </div>

                {/* ── Expanded ────────────────────────────────────────────── */}
                {isExp&&(
                  <div className="px-4 pb-5 pt-4 border-t space-y-3"
                    style={{borderColor:'rgba(139,92,246,0.08)',background:'rgba(248,246,255,0.6)'}}>

                    {/* ④ Stage handover + Cutting */}
                    {(item.serah_gram||item.terima_gram||handovers.length>0)&&(
                      <div className="rounded-2xl overflow-hidden"
                        style={{border:'1px solid rgba(139,92,246,0.15)',background:'rgba(255,255,255,0.8)'}}>
                        <div className="px-4 py-2 text-[10px] font-bold text-violet-600 uppercase tracking-wide"
                          style={{background:'rgba(139,92,246,0.05)'}}>
                          ⛓ Alur Serah-Terima
                        </div>

                        {/* Cutting card */}
                        {(item.serah_gram||item.terima_gram)&&(()=>{
                          const serahFotosC: string[] = Array.isArray(item.foto_serahkan_cutting) ? item.foto_serahkan_cutting : []
                          const terimaFotosC: string[] = Array.isArray(item.foto_diterima_cutting) ? item.foto_diterima_cutting : []
                          const tglMulai = item.tanggal_mulai || item.tanggal_produksi
                          const durasiC = getDurasiJam(item.jam_mulai_cutting, item.jam_selesai)
                          return (
                          <div className="px-4 py-3.5 border-t" style={{borderColor:'rgba(139,92,246,0.07)'}}>
                            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white" style={{background:'#3B82F6'}}>Cutting</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.status_cutting==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                {item.status_cutting==='selesai'?'✓ Selesai':'⏳ Proses'}
                              </span>
                              {canEdit&&!isVoided&&(
                                <div className="ml-auto flex items-center gap-1.5">
                                  <button onClick={()=>openModal('edit',item)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold text-blue-500 hover:bg-blue-50 transition-colors border border-blue-100">
                                    <Edit2 size={9}/> Edit Diserahkan
                                  </button>
                                  {item.terima_gram&&(
                                    <button onClick={()=>openModal('editCutting',item)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold text-green-600 hover:bg-green-50 transition-colors border border-green-100">
                                      <Edit2 size={9}/> Edit Diterima
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Jam & tanggal detail */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px]">
                              {item.jam_mulai_cutting&&(
                                <span className="text-gray-500">⏱ <span className="font-semibold text-gray-700">{String(item.jam_mulai_cutting).slice(0,5)}{item.jam_selesai?` – ${String(item.jam_selesai).slice(0,5)}`:''}</span>{durasiC&&<span className="text-violet-500 font-semibold ml-1">({durasiC})</span>}</span>
                              )}
                              {tglMulai&&(
                                <span className="text-gray-500">📅 <span className="font-semibold text-gray-700">{new Date(tglMulai).toLocaleDateString('id-ID')}{item.tanggal_selesai&&item.tanggal_selesai!==tglMulai?` – ${new Date(item.tanggal_selesai).toLocaleDateString('id-ID')}`:''}</span></span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Diserahkan */}
                              <div className="rounded-xl p-3 space-y-1.5" style={{background:'rgba(59,130,246,0.04)',border:'1px solid rgba(59,130,246,0.1)'}}>
                                <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">📤 Diserahkan</p>
                                <p className="font-bold text-gray-800">{item.serah_gram?`${parseFloat(item.serah_gram).toFixed(3)} gr`:'—'}</p>
                                {item.operator&&<p className="text-[11px] text-gray-400">👤 {item.operator}</p>}
                                {serahFotosC.length>0&&<div className="flex gap-1.5 flex-wrap pt-1">{serahFotosC.map((u,fi)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border-2 border-blue-100 hover:opacity-80"/></a>)}</div>}
                              </div>
                              {/* Diterima */}
                              <div className="rounded-xl p-3 space-y-1.5" style={{background:item.terima_gram?'rgba(34,197,94,0.04)':'rgba(0,0,0,0.02)',border:`1px solid ${item.terima_gram?'rgba(34,197,94,0.15)':'rgba(0,0,0,0.06)'}`}}>
                                <p className="text-[9px] font-bold text-green-500 uppercase tracking-wide">📥 Diterima</p>
                                {item.terima_gram?(<>
                                  <p className="font-bold text-gray-800">{parseFloat(item.terima_gram).toFixed(3)} gr{item.terima_pcs?` · ${item.terima_pcs} PCS`:''}</p>
                                  {Number(item.reject_cutting_gram)>0&&<p className="text-[11px] font-semibold text-red-500">Reject Cutting: {parseFloat(item.reject_cutting_gram).toFixed(3)} gr</p>}
                                  {Number(item.losses_cutting)>0&&<p className="text-[11px] font-semibold text-orange-500">Losses: {parseFloat(item.losses_cutting).toFixed(3)} gr</p>}
                                  {terimaFotosC.length>0&&<div className="flex gap-1.5 flex-wrap pt-1">{terimaFotosC.map((u,fi)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border-2 border-green-100 hover:opacity-80"/></a>)}</div>}
                                </>):<p className="text-[11px] text-gray-400 italic">Belum diterima</p>}
                              </div>
                            </div>
                            {/* Catatan */}
                            {item.catatan&&(
                              <div className="mt-2 px-3 py-2 rounded-xl text-[11px] text-gray-500 italic" style={{background:'rgba(139,92,246,0.04)'}}>
                                📝 {item.catatan}
                              </div>
                            )}
                          </div>
                          )
                        })()}
                        {handovers.map((h:any)=>{
                          const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                          const tc:Record<string,string>={pas_berat:'#F97316',annealing:'#EAB308',siap_packing:'#8B5CF6'}
                          const serahFotos:string[]=Array.isArray(h.serah_fotos)?h.serah_fotos:[]
                          const terimaFotos:string[]=Array.isArray(h.terima_fotos)?h.terima_fotos:[]
                          return (
                            <div key={h.id} className="px-4 py-3.5 border-t"
                              style={{borderColor:'rgba(139,92,246,0.07)'}}>
                              {/* Badge row */}
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                                  style={{background:tc[h.tahap]}}>{tl[h.tahap]}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.status==='selesai'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                                  {h.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                </span>
                                {canEdit&&(
                                  <button onClick={()=>openEditHandover(item,h)}
                                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold text-blue-500 hover:bg-blue-50 transition-colors border border-blue-100">
                                    <Edit2 size={9}/> Edit
                                  </button>
                                )}
                              </div>
                              {/* Serah / Terima cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="rounded-xl p-3 space-y-1"
                                  style={{background:'rgba(59,130,246,0.04)',border:'1px solid rgba(59,130,246,0.1)'}}>
                                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">📤 Diserahkan</p>
                                  <p className="font-bold text-gray-800">{h.serah_gram?`${parseFloat(h.serah_gram).toFixed(3)} gr`:'—'}{h.serah_pcs?` · ${h.serah_pcs} PCS`:''}</p>
                                  {h.serah_tanggal&&<p className="text-[11px] text-gray-400">{new Date(h.serah_tanggal).toLocaleDateString('id-ID')}{h.serah_jam?` · ${String(h.serah_jam).slice(0,5)}`:''}</p>}
                                  {h.serah_operator&&<p className="text-[11px] text-gray-400">👤 {h.serah_operator}</p>}
                                  {h.serah_catatan&&<p className="text-[11px] text-gray-400 italic">{h.serah_catatan}</p>}
                                  {serahFotos.length>0&&<div className="flex gap-1.5 flex-wrap pt-1">{serahFotos.map((u:string,fi:number)=><img key={fi} src={u} className="w-14 h-14 rounded-xl object-cover border-2 border-blue-100 hover:scale-110 transition-transform shadow-sm cursor-pointer"/>)}</div>}
                                </div>
                                <div className="rounded-xl p-3 space-y-1"
                                  style={{background:h.terima_gram?'rgba(34,197,94,0.04)':'rgba(0,0,0,0.02)',border:`1px solid ${h.terima_gram?'rgba(34,197,94,0.15)':'rgba(0,0,0,0.06)'}`}}>
                                  <p className="text-[9px] font-bold text-green-500 uppercase tracking-wide">📥 Diterima</p>
                                  {h.terima_gram?(<>
                                    <p className="font-bold text-gray-800">{parseFloat(h.terima_gram).toFixed(3)} gr{h.terima_pcs?` · ${h.terima_pcs} PCS`:''}</p>
                                    {h.terima_tanggal&&<p className="text-[11px] text-gray-400">{new Date(h.terima_tanggal).toLocaleDateString('id-ID')}{h.terima_jam?` · ${String(h.terima_jam).slice(0,5)}`:''}</p>}
                                    {h.terima_operator&&<p className="text-[11px] text-gray-400">👤 {h.terima_operator}</p>}
                                    {Number(h.sisa_serbuk)>0&&<p className="text-[11px] font-semibold text-violet-600">Serbuk: {parseFloat(h.sisa_serbuk).toFixed(3)} gr</p>}
                                    {Number(h.reject_gram)>0&&<p className="text-[11px] font-semibold text-red-500">Reject: {parseFloat(h.reject_gram).toFixed(3)} gr{h.reject_pcs?` · ${h.reject_pcs} PCS`:''}</p>}
                                    {Number(h.losses_gram)>0&&<p className="text-[11px] font-semibold text-orange-500">Losses: {parseFloat(h.losses_gram).toFixed(3)} gr</p>}
                                    {h.terima_catatan&&<p className="text-[11px] text-gray-400 italic">{h.terima_catatan}</p>}
                                    {terimaFotos.length>0&&<div className="flex gap-1.5 flex-wrap pt-1">{terimaFotos.map((u:string,fi:number)=><img key={fi} src={u} className="w-14 h-14 rounded-xl object-cover border-2 border-green-100 hover:scale-110 transition-transform shadow-sm cursor-pointer"/>)}</div>}
                                  </>):<p className="text-[11px] text-gray-400 italic">Belum diterima</p>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* + Cetak Gramasi / Tambah Produksi — lanjut cetak dari batch ini */}
                    {canEdit&&!isVoided&&(
                      <button onClick={()=>openTambahProduksi(item)}
                        className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold text-violet-600 border border-dashed transition-all hover:bg-violet-50"
                        style={{borderColor:'rgba(139,92,246,0.35)'}}>
                        <Plus size={14}/> Cetak Gramasi / Tambah Produksi
                      </button>
                    )}

                  </div>
                )}
              </div>
                )
              })}
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal==='create'        && batches.length>0 && <CreateModal batches={batches} peleburanByBatch={peleburanByBatch} tims={tims} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='tambahProduksi'&& active            && <TambahProduksiModal item={active} peleburanByBatch={peleburanByBatch} tims={tims} onClose={()=>setModal(null)} onSubmit={handleTambahProduksi} isPending={isPending} error={err}/>}
      {modal==='edit'          && active            && <EditModal item={active} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='update'        && active            && <UpdateModal item={active} onClose={()=>setModal(null)} onSubmit={handleUpdate} isPending={isPending} error={err}/>}
      {modal==='cuttingTerima' && active            && <SelesaiCuttingModal item={active} toleransi={toleransi.cutting??0.05} onClose={()=>setModal(null)} onSubmit={handleSelesaiCutting} isPending={isPending} error={err}/>}
      {modal==='editCutting'   && active            && <SelesaiCuttingModal item={active} isEdit toleransi={toleransi.cutting??0.05} onClose={()=>setModal(null)} onSubmit={handleEditCutting} isPending={isPending} error={err}/>}
      {modal==='serahStage'    && active            && <SerahStageModal item={active} tahap={activeTahap} tims={tims} onClose={()=>setModal(null)} onSubmit={handleSerahStage} isPending={isPending} error={err}/>}
      {modal==='terimaStage'   && active            && <TerimaStageModal item={active} tahap={activeTahap} tims={tims} toleransi={toleransi[activeTahap]??0.05} handoverId={activeHandoverId??0} onClose={()=>setModal(null)} onSubmit={handleTerimaStage} isPending={isPending} error={err}/>}
      {modal==='delete'        && active            && <DelModal item={active} onClose={()=>setModal(null)} onConfirm={handleDelete} isPending={isPending}/>}
      {modal==='editHandover'  && active&&activeHandoverData && <TerimaStageModal item={active} tahap={activeTahap} tims={tims} toleransi={toleransi[activeTahap]??0.05} handoverId={activeHandoverId??0} initialData={activeHandoverData} onClose={()=>setModal(null)} onSubmit={handleEditHandover} isPending={isPending} error={err}/>}
    </div>
  )
}










