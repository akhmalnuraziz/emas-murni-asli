'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  serahStageProduksi, terimaStageProduksi, voidStageHandover, editSerahStage, resetCutting,
  terimaCuttingSesi, terimaCuttingItem, serahSesiStage, terimaSesiStage,
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'
import LossApprovalPanel from '@/components/modules/produksi/loss-approval-panel'
import { SerahModalStd, TerimaModalStd, AdminPickerStd, TimPickerStd } from '@/components/modules/produksi/serah-terima-modal'

interface Props { produksiList: any[]; batches: any[]; peleburanByBatch: Record<string, any[]>; tims: any[]; toleransi: Record<string, number>; adminList: any[]; userRole: UserRole; userName: string; lossApprovals?: any[]; total?: number; page?: number; pageSize?: number; currentQ?: string; currentStatus?: string }

function fgr(n: number | null | undefined, dec = 2): string {
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
      <img src={url} alt="" className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
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
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-[12px] font-semibold text-white"
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
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-violet-200 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 bg-white/40 transition-all">
        <Camera size={13} className="text-violet-400 flex-shrink-0" />
        <span className={`text-slate-400 ${small ? 'text-[11px]' : 'text-[12px]'}`}>{files.length > 0 ? `${files.length} foto — klik tambah` : label}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(Array.from(e.target.files ?? [])); e.currentTarget.value = '' }} />
      </label>
      {files.length > 0 && <button type="button" onClick={() => onRemove(-1)} className="text-[11px] text-red-400 hover:underline">Hapus semua foto</button>}
    </div>
  )
}

// ─── Tim Picker (dropdown tim + anggota PIC) ────────────────────────────────────
function TimPicker({ tims, timId, setTimId, anggota, setAnggota, label = 'Tim Yang Mengerjakan', req = false, namePrefix = '' }: {
  tims: any[]; timId: string; setTimId: (v: string) => void
  anggota: string; setAnggota: (v: string) => void
  label?: string; req?: boolean; namePrefix?: string
}) {
  const selectedTim = tims.find(t => String(t.id) === timId)
  const anggotaList = selectedTim?.anggota?.filter((a: any) => a.aktif) ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-slate-500">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
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
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
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
          <div key={`e${i}`} className="w-3 h-3 rounded-full bg-slate-200/80 border-2 border-white shadow-sm flex-shrink-0" />
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
          <div className="rounded-xl p-3" style={{ background: 'rgba(22,22,26,0.94)', backdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hover.dot }} />
              <span className="text-[12px] font-semibold text-white tracking-tight">{hover.ev.status}</span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <p className="text-slate-400">{formatDate(hover.ev.tanggal)}</p>
              <p className="font-semibold text-slate-100">{hover.ev.total_gram} gr</p>
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
        val !== null ? 'text-slate-700 hover:bg-slate-100' : 'text-violet-500 hover:bg-violet-50'
      )}>
      {val !== null ? `${fgr(val)}gr` : '+ Isi fisik'}
      <Pencil size={9} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </button>
  )
}

// ─── Event History ─────────────────────────────────────────────────────────────
function EventHistory({ events, item, stageHandovers = [], lossApprovals = [] }: {
  events: any[]; item?: any; stageHandovers?: any[]; lossApprovals?: any[]
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Build lookup: proses → loss_approval (untuk item ini saja)
  // Cutting: ref_table='produksi_item', ref_id=item.id
  // Stages: ref_table='stage_handover', ref_id dalam stageHandovers[tahap]
  const cuttingLoss = item ? (lossApprovals as any[]).find(
    la => la.ref_table === 'produksi_item' && la.ref_id === item.id
  ) : null

  const TAHAP_MAP: Record<string,string> = {
    'Pas Berat': 'pas_berat', 'Annealing': 'annealing', 'Siap Packing': 'siap_packing'
  }
  const stageLossMap: Record<string, any> = {}
  for (const sh of stageHandovers as any[]) {
    const la = (lossApprovals as any[]).find(l => l.ref_table === 'stage_handover' && l.ref_id === sh.id)
    if (la) stageLossMap[sh.tahap] = la
  }

  // Filter: sembunyikan event Cutting awal (tanpa jam_mulai = event create, bukan proses)
  const filtered = sortEvents(events).filter((ev: any) => {
    if (ev.status === 'Cutting' && !ev.jam_mulai && (!ev.catatan || !ev.catatan.includes('Serah:'))) return false
    return true
  })

  return (
    <div className="space-y-2">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {filtered.length === 0 && <p className="text-[12px] text-slate-400 italic">Belum ada riwayat proses</p>}
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
          <div key={ev.id ?? i} className="rounded-xl overflow-hidden bg-white border border-slate-200">
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200" style={{background:c.bg+'66'}}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c.dot}}/>
              <Sbadge s={ev.status} />
              <span className="text-[11px] text-slate-400 font-medium">{formatDate(ev.tanggal)}</span>
              {ev.jam_mulai && (
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                  ⏱ {fmtTime(ev.jam_mulai)}
                  {ev.created_at && ` → ${new Date(ev.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`}
                  {getDurasi(ev.jam_mulai, ev.created_at) && <span className="text-slate-300 ml-1">({getDurasi(ev.jam_mulai, ev.created_at)})</span>}
                </span>
              )}
              {ev.user_name && <span className="text-[10px] text-slate-400 ml-auto bg-white/80 px-2 py-0.5 rounded-full border border-slate-100">👤 {ev.user_name}</span>}
            </div>
            {/* Data row */}
            <div className="px-3 py-2 flex flex-wrap gap-3 items-center text-[12px]">
              <div><span className="text-slate-400">Berat: </span><span className="font-semibold text-slate-700">{ev.total_gram} gr</span></div>
              {Number(ev.sisa_serbuk) > 0 && <div><span className="text-slate-400">{serbukLabel}: </span><span className={`font-semibold ${serbukColor}`}>{fgr(Number(ev.sisa_serbuk))} gr</span></div>}
              {Number(ev.losses) > 0 && <div><span className="text-slate-400">losses: </span><span className="font-semibold text-orange-500">{fgr(Number(ev.losses))} gr</span></div>}
              {ev.kategori_losses && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ {ev.kategori_losses}</span>}
            </div>
            {/* Catatan — only show if it's not the auto-generated breakdown from selesaiCutting */}
            {ev.catatan && !hasCatatanBreakdown && (
              <div className="px-3 pb-2">
                <p className="text-[11px] text-slate-400 italic">{ev.catatan}</p>
              </div>
            )}
            {/* Fotos */}
            {(fotos.length > 0 || serbuk.length > 0) && (
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {fotos.map((u: string, fi: number) => (
                  <img key={fi} src={u} onClick={() => setLightbox(u)} className="w-12 h-12 rounded-xl object-cover cursor-pointer border border-slate-100 hover:scale-110 transition-transform shadow-sm" />
                ))}
                {serbuk.map((u: string, fi: number) => (
                  <div key={`s${fi}`} className="relative">
                    <img src={u} onClick={() => setLightbox(u)} className="w-12 h-12 rounded-xl object-cover cursor-pointer border-2 border-violet-200 hover:scale-110 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[8px] text-white flex items-center justify-center font-semibold">S</div>
                  </div>
                ))}
              </div>
            )}
            {/* TTD Loss — tampil per event kalau ada loss melebihi toleransi */}
            {(()=>{
              const tahapKey = TAHAP_MAP[ev.status]
              const la = ev.status === 'Cutting' ? cuttingLoss
                       : tahapKey ? stageLossMap[tahapKey]
                       : null
              if (!la) return null
              return (
                <div className="mx-3 mb-2 rounded-xl overflow-hidden border border-red-100">
                  <div className="px-3 py-1.5 flex items-center gap-2 bg-red-50">
                    <span className="text-[10px] font-semibold text-red-600">⚠ TTD loss {ev.status}</span>
                    <span className="text-[10px] text-red-400 ml-auto">{la.loss_gram ? `${Number(la.loss_gram).toFixed(2)} gr` : ''}</span>
                  </div>
                  <div className="px-3 py-2 space-y-1.5">
                    {la.alasan && <p className="text-[11px] text-slate-600"><span className="font-semibold">Alasan:</span> {la.alasan}</p>}
                    <div className="flex gap-3 text-[10px] text-slate-500">
                      {la.operator_nama && <span>👷 <b>{la.operator_nama}</b></span>}
                      {la.admin_nama && <span>✍️ <b>{la.admin_nama}</b></span>}
                    </div>
                    {(la.ttd_operator_url || la.ttd_admin_url) && (
                      <div className="flex gap-2 pt-1">
                        {la.ttd_operator_url && (
                          <div>
                            <p className="text-[9px] text-slate-400 mb-1">TTD Operator</p>
                            <a href={la.ttd_operator_url} target="_blank" rel="noopener noreferrer">
                              <img src={la.ttd_operator_url} alt="TTD Operator"
                                className="h-12 w-24 object-contain rounded-xl border border-red-100 bg-white"/>
                            </a>
                          </div>
                        )}
                        {la.ttd_admin_url && (
                          <div>
                            <p className="text-[9px] text-slate-400 mb-1">TTD Admin</p>
                            <a href={la.ttd_admin_url} target="_blank" rel="noopener noreferrer">
                              <img src={la.ttd_admin_url} alt="TTD Admin"
                                className="h-12 w-24 object-contain rounded-xl border border-red-100 bg-white"/>
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

// ─── Form helpers ──────────────────────────────────────────────────────────────
const inp = "w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"
const F = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="block text-[11px] font-medium text-slate-500 mb-1.5">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>
    {children}
  </div>
)

// ─── Create Modal (tanpa gramasi — gramasi dipilih saat Diterima Cutting) ─────
function CreateModal({ batches, peleburanByBatch, tims, adminList, onClose, onSubmit, isPending, error }: {
  batches: any[]; peleburanByBatch: Record<string, any[]>; tims: any[]; adminList: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const nowTime = new Date().toTimeString().slice(0,5)
  const firstBatch = batches[0]?.kode ?? ''
  const firstPlb = (peleburanByBatch[firstBatch] ?? [])[0]
  const [f, setF] = useState({ batch_kode: firstBatch, peleburan_id: firstPlb ? String(firstPlb.id) : '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, jam_mulai: nowTime })
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const plbList = peleburanByBatch[f.batch_kode] ?? []
  const selectedPlb = plbList.find(p => String(p.id) === f.peleburan_id)

  useEffect(() => {
    const list = peleburanByBatch[f.batch_kode] ?? []
    setF(p => ({ ...p, peleburan_id: list[0] ? String(list[0].id) : '' }))
  }, [f.batch_kode])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    setUp(true); const b64 = fotos.length > 0 ? await filesToBase64(fotos) : []; setUp(false)
    const fd = new FormData(el)
    fd.set('fotos_b64', JSON.stringify(b64))
    onSubmit(fd)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Permintaan Cetak Baru</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Gramasi akan dipilih saat diterima Cutting</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <F label="Nama / Label Item" req><input name="nama_item" value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="cth: Cetakan LM Tipe A" className={inp} required /></F>
          <F label="Batch Bahan Baku" req>
            <select name="batch_kode" value={f.batch_kode} onChange={e => s('batch_kode', e.target.value)} className={inp} required>
              {batches.map(b => <option key={b.kode} value={b.kode}>{b.kode} — {b.nama_batch} (Siap cetak: {(b.bahan_siap_cetak ?? 0).toFixed(2)} gr)</option>)}
            </select>
          </F>
          <F label="Peleburan Asal (Bahan)" req>
            {plbList.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-[12px] bg-amber-50 border border-amber-100 text-amber-700">
                Belum ada hasil lebur siap cetak di batch ini. Lebur bahan dulu di halaman Bahan Baku.
              </div>
            ) : (
              <>
                <select name="peleburan_id" value={f.peleburan_id} onChange={e => s('peleburan_id', e.target.value)} className={inp} required>
                  {plbList.map(p => <option key={p.id} value={p.id}>{p.kode} — sisa {p.sisa.toFixed(2)} gr</option>)}
                </select>
                {selectedPlb && <p className="text-[11px] text-violet-500 font-semibold mt-1 px-1">Tersedia dari peleburan ini: {selectedPlb.sisa.toFixed(2)} gr</p>}
              </>
            )}
          </F>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Total bahan yang diserahkan" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} placeholder="500.15" className={inp} required /></F>
            <F label="Status Awal" req>
              <select name="status_awal" value={f.status_awal} onChange={e => s('status_awal', e.target.value)} className={inp} required>
                {['Cutting','Pas Berat','Annealing','Siap Packing'].map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Mulai" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} required /></F>
            <F label="Jam Mulai" req><input name="jam_mulai" type="time" value={f.jam_mulai ?? ''} onChange={e => s('jam_mulai', e.target.value)} className={inp} required /></F>
          </div>
          <AdminPickerStd adminList={adminList} prefix="" label="Admin Yang Menyerahkan" />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan (opsional)</label>
            <input name="catatan" placeholder="Catatan serah" className={inp} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto serah (opsional)</label>
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0,5))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_,j) => j !== i))} label="Foto serah" small />
          </div>

          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/>{error}</div>}
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending || up} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
function TambahProduksiModal({ item, peleburanByBatch, tims, adminList, onClose, onSubmit, isPending, error }: {
  item: any; peleburanByBatch: Record<string, any[]>; tims: any[]; adminList: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const nowTime = new Date().toTimeString().slice(0,5)
  const batchKode = item.batch_kode
  const plbList = peleburanByBatch[batchKode] ?? []
  const [f, setF] = useState({ peleburan_id: plbList[0] ? String(plbList[0].id) : '', gramasi: '1', pcs: '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, jam_mulai: nowTime })
  const [fotos, setFotos] = useState<File[]>([])
  const [up, setUp] = useState(false)
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Tambah Produksi</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Batch {batchKode} — lanjut cetak gramasi</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <F label="Nama / Label" req><input name="nama_item" value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder={`cth: LM REI ${f.gramasi}GR`} className={inp} required /></F>

          <F label="Pilih Bahan dari Peleburan" req>
            {plbList.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-[12px] bg-amber-50 border border-amber-100 text-amber-700">
                Belum ada bahan siap cetak. Jika ada reject, lebur dulu di halaman Bahan Baku — setelah dilebur baru bisa dipakai cetak.
              </div>
            ) : (
              <>
                <select name="peleburan_id" value={f.peleburan_id} onChange={e => s('peleburan_id', e.target.value)} className={inp} required>
                  {plbList.map(p => <option key={p.id} value={p.id}>{p.kode} — sisa {p.sisa.toFixed(2)} gr</option>)}
                </select>
                {selectedPlb && <p className="text-[11px] text-violet-500 font-semibold mt-1 px-1">Tersedia: {selectedPlb.sisa.toFixed(2)} gr</p>}
              </>
            )}
          </F>

          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Gramasi" req>
              <select name="gramasi" value={f.gramasi} onChange={e => { s('gramasi', e.target.value); s('nama_item', `LM REI ${e.target.value}GR`) }} className={inp} required>
                {GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}
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
  
          </div>

          <AdminPickerStd adminList={adminList} prefix="" label="Admin Yang Menyerahkan" />
          <F label="Foto Bahan Diserahkan (Max 10 Foto)">
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Tambah foto" />
          </F>
          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/>{error}</div>}
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending || up || plbList.length === 0} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
function EditModal({ item, tims, adminList, onClose, onSubmit, isPending, error }: {
  item: any; tims: any[]; adminList: any[]; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const [f, setF] = useState({
    nama_item: item.nama_item ?? `LM REI ${item.gramasi ?? ''}GR`, gramasi: item.gramasi ?? '',
    pcs: String(item.pcs ?? ''), berat_awal: String(item.berat_awal ?? item.total_gram ?? ''),
    catatan: item.catatan ?? '',
    tanggal_produksi: item.tanggal_produksi ?? item.tanggal ?? today,
  })
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const [fotos, setFotos] = useState<File[]>([])
  const [existingFotos, setExistingFotos] = useState<string[]>(
    Array.isArray(item.foto_serahkan_cutting) ? item.foto_serahkan_cutting : []
  )
  const [uploading, setUploading] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget as HTMLFormElement
    setUploading(true)
    try {
      const b64s = fotos.length > 0 ? await filesToBase64(fotos) : []
      const fd = new FormData(formEl)
      fd.set('foto_serahkan_b64', JSON.stringify(b64s))
      fd.set('existing_fotos_serah', JSON.stringify(existingFotos))
      onSubmit(fd)
    } finally { setUploading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Edit Diserahkan</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.kode}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <F label="Nama / Label Batch"><input name="nama_item" value={f.nama_item} onChange={e => s('nama_item', e.target.value)} placeholder="cth: LM REI 10GR BATCH 26" className={inp} /></F>
          <div className="grid grid-cols-2 gap-3 items-end">
            <F label="Pilih Gramasi" req><select name="gramasi" value={f.gramasi} onChange={e => { s('gramasi', e.target.value); s('nama_item', `LM REI ${e.target.value}GR`) }} className={inp}>{GRAMASI_OPTIONS.map(g => <option key={g} value={g}>{g} gr</option>)}</select></F>
            <F label="Jumlah PCS (opsional saat diserahkan)"><input name="pcs" type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} placeholder="Isi saat sudah diterima" className={inp} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gr)" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} className={inp} /></F>
            <F label="Tanggal"><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} /></F>
          </div>

          <AdminPickerStd adminList={adminList} prefix="" initialValue={item.admin_input ?? item.operator ?? ''} label="Admin Yang Menyerahkan" />
          <F label="Catatan"><input name="catatan" value={f.catatan} onChange={e => s('catatan', e.target.value)} placeholder="Catatan tambahan…" className={inp} /></F>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto Bahan Diserahkan (Max 10 Foto)</label>
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
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label={existingFotos.length > 0 ? 'Tambah foto lagi' : 'Tambah foto (opsional)'} />
          </div>
          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/>{error}</div>}
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending || uploading} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">{isEdit ? 'Edit Diterima' : 'Konfirmasi Terima Cutting'}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Info Diserahkan */}
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
            <span className="text-slate-400">Diserahkan: </span>
            <span className="font-semibold text-violet-700">{fgr(serahGram)} gr</span>
            <span className="text-slate-400 mx-1">·</span>
            <span className="font-semibold text-slate-600">{item.gramasi}gr</span>
            {item.pcs ? <><span className="text-slate-400 mx-1">·</span><span className="font-semibold text-slate-600">{item.pcs} PCS</span></> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Selesai *</label>
              <input name="tanggal_selesai" type="date" defaultValue={isEdit&&item.tanggal_selesai?item.tanggal_selesai:new Date().toISOString().split('T')[0]}
                className={inp} required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jam Selesai *</label>
              <input name="jam_selesai" type="time" defaultValue={isEdit&&item.jam_selesai?String(item.jam_selesai).slice(0,5):undefined} className={inp} required />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat Diterima (gr) *</label>
            <input name="terima_gram" type="number" step="0.001"
              value={terimaVal} onChange={e => setTerimaVal(e.target.value)}
              placeholder={`Max ${fgr(serahGram)} gr`}
              className={inp} required />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Reject Cutting (gr)</label>
            <input name="reject_cutting_gram" type="number" step="0.001"
              value={rejectVal} onChange={e => setRejectVal(e.target.value)} className={inp} />
          </div>

          {/* Loss indicator realtime */}
          {(terimaVal !== '') && (
            <div className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-between', overTol ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
              <span>Loss: {lossNow.toFixed(2)} gr</span>
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
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
              PCS Berhasil <span className="text-slate-400 font-normal normal-case">(opsional, isi jika sudah tahu)</span>
            </label>
            <input name="pcs_good" type="number" min="1"
              defaultValue={isEdit&&item.pcs_good?Number(item.pcs_good):undefined}
              placeholder="Isi jika sudah dihitung" className={inp} />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
              Catatan <span className="text-slate-400 font-normal normal-case">(alasan losses, kondisi bahan, dll)</span>
            </label>
            <input name="catatan" type="text" placeholder="Misal: losses karena serbuk tercecer..."
              defaultValue={isEdit ? (item.catatan ?? '') : ''}
              className={inp} />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto Bahan Diterima (Max 10 Foto)</label>
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
            <label className="flex items-center gap-2 h-11 px-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-violet-50 transition-colors border border-slate-200">
              <Camera size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-[12px] text-slate-400">{fotos.length > 0 ? `${fotos.length} foto baru` : (existingFotos.length > 0 ? 'Tambah foto lagi' : 'Tambah foto (opsional)')}</span>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => setFotos(p => [...p, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
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
            <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2">
              <AlertTriangle size={13} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending || uploading}
              className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Serah ke {label}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Info dari tahap sebelumnya */}
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
            <p className="text-[9px] font-medium text-violet-500 mb-2">Data yang akan diserahkan</p>
            <div className="flex flex-wrap gap-3">
              <div><p className="text-slate-400 text-[10px]">Total Berat</p><p className="font-semibold text-violet-700">{serahGram.toFixed(2)} gr</p></div>
              <div><p className="text-slate-400 text-[10px]">Gramasi</p><p className="font-semibold text-slate-700">{item.gramasi} gr</p></div>
              <div><p className="text-slate-400 text-[10px]">Jumlah PCS</p><p className="font-semibold text-slate-700">{serahPcs > 0 ? `${serahPcs} PCS` : '—'}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Serah *</label>
              <input name="serah_tanggal" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inp} required/>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jam Serah *</label>
              <input name="serah_jam" type="time" className={inp} required/>
            </div>
          </div>
          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={setTimAnggota} label="Tim Yang Mengerjakan" namePrefix="serah_" />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Operator (manual)</label>
            <input name="serah_operator_manual" type="text" placeholder="Atau ketik manual" className={inp}/>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Catatan</label>
            <input name="serah_catatan" type="text" placeholder="Opsional" className={inp}/>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto Bahan Diserahkan (Max 10 Foto)</label>
            <FotoPicker files={fotos} onAdd={ff => setFotos(p => [...p, ...ff].slice(0, 10))} onRemove={i => i === -1 ? setFotos([]) : setFotos(p => p.filter((_, j) => j !== i))} label="Tambah foto (opsional)" />
          </div>
          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/><span>{error}</span></div>}
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Konfirmasi Terima {label}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.kode} — {item.nama_item}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Info diserahkan */}
          <div className="rounded-lg px-3 py-2 text-[12px] bg-violet-50 border border-violet-100 text-violet-700">
            <p className="text-[9px] font-medium text-violet-500 mb-2">Diserahkan</p>
            <div className="flex flex-wrap gap-3">
              <div><p className="text-slate-400 text-[10px]">Total Berat</p><p className="font-semibold text-violet-700">{Number(serahGram).toFixed(2)} gr</p></div>
              <div><p className="text-slate-400 text-[10px]">Gramasi</p><p className="font-semibold text-slate-700">{item.gramasi} gr</p></div>
              {(currentH?.serah_pcs ?? item.pcs_good ?? item.pcs) ? <div><p className="text-slate-400 text-[10px]">Jumlah PCS</p><p className="font-semibold text-slate-700">{currentH?.serah_pcs ?? item.pcs_good ?? item.pcs} PCS</p></div> : null}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Total Berat Setelah Diproses (gr) *</label>
            <input name="terima_gram" type="number" step="0.001" placeholder={`Max ${Number(serahGram).toFixed(2)} gr`} value={terimaVal} onChange={e=>setTerimaVal(e.target.value)} className={inp} required/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Tanggal Terima *</label>
              <input name="terima_tanggal" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inp} required/>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Jam Terima *</label>
              <input name="terima_jam" type="time" className={inp} required/>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
              PCS Berhasil <span className="text-slate-400 font-normal normal-case">(opsional)</span>
            </label>
            <input name="terima_pcs" type="number" min="1" placeholder="Isi jika sudah dihitung" className={inp}/>
          </div>

          {/* Sisa Serbuk — hanya Pas Berat */}
          {isPasBerat && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Sisa Serbuk (gr)</label>
              <input name="sisa_serbuk" type="number" step="0.001" value={serbukVal} onChange={e=>setSerbukVal(e.target.value)} className={inp}/>
            </div>
          )}

          {/* Reject toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={adaReject} onChange={e=>setAdaReject(e.target.checked)} className="w-4 h-4 rounded accent-red-500"/>
              <span className="text-[12px] font-semibold text-slate-600">Ada Reject</span>
            </label>
            {adaReject && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Berat Reject (gr)</label>
                  <input name="reject_gram" type="number" step="0.001" value={rejectVal} onChange={e=>setRejectVal(e.target.value)} className={inp}/>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">PCS Reject</label>
                  <input name="reject_pcs" type="number" min="0" defaultValue="0" className={inp}/>
                </div>
              </div>
            )}
          </div>

          {/* Loss indicator realtime */}
          {(terimaVal !== '') && (
            <div className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-between', overTol ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
              <span>Loss: {lossNow.toFixed(2)} gr</span>
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

          <TimPicker tims={tims} timId={timId} setTimId={setTimId} anggota={timAnggota} setAnggota={setTimAnggota} label="Tim Yang Mengerjakan" namePrefix="terima_" />

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
              Catatan <span className="text-slate-400 font-normal normal-case">(alasan losses, kondisi, dll)</span>
            </label>
            <input name="terima_catatan" type="text" placeholder="Opsional" className={inp}/>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Foto Bahan Diserahkan (Max 10 Foto)</label>
            <label className="flex items-center gap-2 h-11 px-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-violet-50 transition-colors border border-slate-200">
              <Camera size={14} className="text-slate-400 flex-shrink-0"/>
              <span className="text-[12px] text-slate-400">{fotos.length > 0 ? `${fotos.length} foto dipilih` : 'Tambah foto (opsional, max 5)'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFotos(p=>[...p,...Array.from(e.target.files??[])].slice(0,10))}/>
            </label>
            {fotos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-200 shadow-sm"/>
                    <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-semibold shadow-md hover:bg-red-600 transition-colors">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/><span>{error}</span></div>}

          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending||uploading}
              className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Update Status Produksi</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.kode} — {item.nama_item || `${item.gramasi}gr × ${item.pcs} PCS`}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><X size={14} className="text-slate-500"/></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
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
            <F label="Jam Mulai" req><input name="jam_mulai" type="time" className={inp} required /></F>
          </div>
          {status !== 'Reject' && (
            <>
              <F label="Foto Bahan Diserahkan (Max 10 Foto)">
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
          <F label="Catatan"><input name="catatan" className={inp} placeholder="Catatan…" /></F>
          {error && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-center gap-2"><AlertTriangle size={13}/>{error}</div>}
          <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0 -mx-5 -mb-4 mt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
            <button type="submit" disabled={isPending || up} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {(isPending || up) && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {up ? 'Kompres…' : isPending ? 'Menyimpan…' : 'Simpan Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DelModal({ item, onClose, onConfirm, isPending, error }: { item: any; onClose: () => void; onConfirm: () => void; isPending: boolean; error?: string }) {
  const [confirm, setConfirm] = useState('')
  const canConfirm = confirm.trim() === item.kode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden p-6">
        <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
        <h2 className="text-[16px] font-bold text-slate-900 text-center">Hapus Batch Produksi?</h2>
        <p className="text-[13px] text-slate-500 mt-2 text-center"><span className="font-semibold text-slate-700">{item.kode}</span> akan dihapus permanen beserta semua event-nya.</p>
        {error && (
          <div className="mt-4 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600 flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div className="mt-5 mb-4">
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Ketik kode batch untuk konfirmasi</label>
          <input
            value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder={item.kode}
            className="w-full h-9 rounded-lg border border-red-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-300/40 font-mono transition-all"
          />
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
          <button onClick={onConfirm} disabled={!canConfirm || isPending}
            className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
  const accentMap: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-700',
    orange: 'bg-orange-50 text-orange-700',
    green:  'bg-emerald-50 text-emerald-700',
    red:    'bg-red-50 text-red-600',
    blue:   'bg-blue-50 text-blue-700',
  }
  const cls = accent ? (accentMap[accent] ?? 'bg-slate-50 text-slate-700') : 'bg-slate-50 text-slate-700'
  return (
    <div className={`rounded-xl px-3 py-2 overflow-hidden min-w-0 ${cls}`}>
      <p className="text-[9.5px] font-medium mb-0.5 truncate opacity-70">{label}</p>
      <div className="text-[13px] font-semibold leading-tight min-w-0">{value}</div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ProduksiClient({ produksiList, batches, peleburanByBatch, tims, toleransi, adminList, userRole, userName, lossApprovals = [], total = 0, page = 1, pageSize = 20, currentQ = '', currentStatus = 'Semua' }: Props) {
  const router = useRouter()
  const [search, setSearch]     = useState(currentQ)
  const filterStatus = currentStatus
  const totalPages = Math.ceil(total / pageSize)

  function navigateProd(params: Record<string, string>) {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (filterStatus !== 'Semua') sp.set('status', filterStatus)
    sp.set('page', String(page))
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k) })
    router.push(`/produksi?${sp.toString()}`)
  }

  function setFilter(tab: string) { navigateProd({ status: tab === 'Semua' ? '' : tab, page: '1' }) }
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [modal, setModal]       = useState<'create'|'tambahProduksi'|'edit'|'update'|'delete'|'cuttingTerima'|'editCutting'|'serahStage'|'terimaStage'|'editHandover'|'editSerahStage'|'deleteHandover'|'deleteCutting'|'sesiCuttingTerima'|'sesiSerahStage'|'sesiTerimaStage'|'terimaCuttingItem'|null>(null)
  const [activeSesi, setActiveSesi] = useState<{sesiId: string; items: any[]; tahap?: string} | null>(null)
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
  function openEditSerahStage(item: any, h: any) { setActive(item); setActiveTahap(h.tahap); setActiveHandoverId(h.id); setActiveHandoverData(h); setErr(''); setModal('editSerahStage') }
  function openDeleteHandover(item: any, h: any) { setActive(item); setActiveTahap(h.tahap); setActiveHandoverId(h.id); setActiveHandoverData(h); setErr(''); setModal('deleteHandover') }
  function toggleExp(id: number) { setExpanded(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n }) }

  function handleCreate(fd: FormData) { setErr(''); start(async()=>{ const r=await createProduksi(fd); if(r?.error){setErr(r.error);return}; showToast(r.count && r.count > 1 ? `✅ ${r.count} item produksi dibuat (${r.kode} dst)` : `✅ ${r.kode} dibuat`); setModal(null) }) }
  function handleTambahProduksi(fd: FormData) { setErr(''); start(async()=>{ const r=await createProduksi(fd); if(r?.error){setErr(r.error);return}; showToast(`✅ ${r.kode} ditambahkan`); setModal(null) }) }
  function handleEdit(fd: FormData)   { if(!active)return; setErr(''); start(async()=>{ const r=await editProduksi(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Diperbarui'); setModal(null) }) }
  function handleUpdate(fd: FormData) { if(!active)return; setErr(''); start(async()=>{ const r=await updateStatusProduksi(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Status diperbarui'); setModal(null) }) }
  function handleDelete()             { if(!active)return; setErr(''); start(async()=>{ const r=await deleteProduksi(active.id,active.kode); if(r?.error){setErr(r.error); showToast(r.error,false); return}; showToast('🗑️ Dihapus'); setModal(null) }) }
  function mapStdToCutting(fd: FormData): FormData {
    // Terjemahkan nama field standar → nama field yang dibaca selesaiCutting
    if (fd.get('reject_gram') != null && fd.get('reject_cutting_gram') == null) fd.set('reject_cutting_gram', String(fd.get('reject_gram')))
    if (fd.get('terima_pcs') != null) fd.set('pcs_good', String(fd.get('terima_pcs')))
    if (fd.get('reject_pcs') != null) fd.set('pcs_reject', String(fd.get('reject_pcs')))
    if (fd.get('terima_jam') != null) fd.set('jam_selesai', String(fd.get('terima_jam')))
    if (fd.get('terima_tanggal') != null) fd.set('tanggal_selesai', String(fd.get('terima_tanggal')))
    if (fd.get('terima_catatan') != null) fd.set('catatan', String(fd.get('terima_catatan')))
    return fd
  }
  function handleSelesaiCutting(fd: FormData) { if(!active)return; setErr(''); mapStdToCutting(fd); start(async()=>{ const r=await selesaiCutting(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting diterima'); setModal(null) }) }
  function handleEditCutting(fd: FormData) { if(!active)return; setErr(''); fd.set('is_edit','1'); mapStdToCutting(fd); start(async()=>{ const r=await selesaiCutting(active.id,active.kode,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting diperbarui'); setModal(null) }) }
  function handleSerahStage(fd: FormData)  { if(!active)return; setErr(''); start(async()=>{ const r=await serahStageProduksi(active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast(`✅ Diserahkan ke ${activeTahap.replace('_',' ')}`); setModal(null) }) }
  function handleTerimaStage(fd: FormData) { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await terimaStageProduksi(activeHandoverId,active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast(`✅ Terima berhasil`); setModal(null); router.refresh() }) }
  function handleEditHandover(fd: FormData) { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await terimaStageProduksi(activeHandoverId,active.id,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Data diperbarui'); setModal(null); router.refresh() }) }
  function handleEditSerahStage(fd: FormData) { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await editSerahStage(activeHandoverId,active.kode,activeTahap,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Data penyerahan diperbarui'); setModal(null); router.refresh() }) }
  function handleDeleteHandover() { if(!active||!activeHandoverId)return; setErr(''); start(async()=>{ const r=await voidStageHandover(activeHandoverId,active.id,activeTahap,'Dihapus manual'); if(r?.error){setErr(r.error);return}; showToast('🗑️ Proses dihapus'); setModal(null); router.refresh() }) }
  function handleDeleteCutting() { if(!active)return; setErr(''); start(async()=>{ const r=await resetCutting(active.id,active.kode); if(r?.error){setErr(r.error);return}; showToast('🗑️ Data terima Cutting dihapus'); setModal(null); router.refresh() }) }
  function openSesiModal(type: 'sesiCuttingTerima'|'sesiSerahStage'|'sesiTerimaStage', sesiId: string, items: any[], tahap?: string) { setActiveSesi({sesiId, items, tahap}); setErr(''); setModal(type) }
  function handleSesiCuttingTerima(fd: FormData) { if(!activeSesi)return; setErr(''); start(async()=>{ const r=await terimaCuttingSesi(activeSesi.sesiId,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting sesi diterima'); setModal(null) }) }
  function handleSesiSerahStage(fd: FormData) { if(!activeSesi)return; setErr(''); start(async()=>{ const r=await serahSesiStage(activeSesi.sesiId,activeSesi.tahap!,fd); if(r?.error){setErr(r.error);return}; showToast(`✅ Diserahkan ke ${activeSesi.tahap?.replace('_',' ')}`); setModal(null) }) }
  function handleSesiTerimaStage(fd: FormData) { if(!activeSesi)return; setErr(''); start(async()=>{ const r=await terimaSesiStage(activeSesi.sesiId,activeSesi.tahap!,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Terima sesi berhasil'); setModal(null); router.refresh() }) }
  function handleTerimaCuttingItem(fd: FormData) { if(!active)return; setErr(''); start(async()=>{ const r=await terimaCuttingItem(active.id,fd); if(r?.error){setErr(r.error);return}; showToast('✅ Cutting diterima, gramasi ditetapkan'); setModal(null) }) }

  // ── Filter ────────────────────────────────────────────────────────────────
  const STATUS_TABS = ['Semua','Cutting','Pas Berat','Annealing','Siap Packing','Sudah Packing','Reject']
  // Data already filtered server-side
  const filtered = produksiList

  const STATUS_COLOR: Record<string,{bg:string;text:string;dot:string}> = {
    'Cutting':      {bg:'rgba(59,130,246,0.1)',   text:'#2563EB', dot:'#3B82F6'},
    'Pas Berat':    {bg:'rgba(249,115,22,0.1)',   text:'#EA580C', dot:'#F97316'},
    'Annealing':    {bg:'rgba(234,179,8,0.1)',    text:'#CA8A04', dot:'#EAB308'},
    'Siap Packing': {bg:'rgba(139,92,246,0.12)',  text:'#7C3AED', dot:'#8B5CF6'},
    'Sudah Packing':{bg:'rgba(34,197,94,0.1)',    text:'#15803D', dot:'#22C55E'},
    'Reject':       {bg:'rgba(239,68,68,0.1)',    text:'#DC2626', dot:'#EF4444'},
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Toast */}
      {toast&&(
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold text-white shadow-2xl transition-all ${toast.ok?'bg-emerald-600':'bg-red-600'}`}>
          {toast.ok?<Check size={15}/>:<AlertTriangle size={15}/>}{toast.msg}
        </div>
      )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-slate-900 tracking-tight">Produksi</h1>
          </div>
          {canEdit&&(
            <button onClick={()=>openModal('create')}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors">
              <Plus size={14}/> Cetak Baru
            </button>
          )}
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <form onSubmit={e=>{e.preventDefault();navigateProd({q:search,page:'1'})}} className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari kode, nama item, gramasi, batch… (Enter)"
            className="w-full pl-9 pr-3 h-8 text-[12px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all"/>
        </form>

        {/* ── Filter tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map(tab=>{
            const isActive = filterStatus===tab
            return (
              <button key={tab} onClick={()=>setFilter(tab)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${isActive?'bg-violet-600 text-white':'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                {tab}
              </button>
            )
          })}
          <span className="text-[11px] text-slate-400 self-center ml-2">{total} item</span>
        </div>

        {/* ── Item cards ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length===0?(
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                <Package size={24} className="text-violet-400"/>
              </div>
              <p className="text-[13px] font-medium text-slate-400">
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-1 bg-violet-50 border border-violet-100">
                      <span className="text-[11px] font-semibold text-violet-700">🔥 {gk}</span>
                      <span className="text-[10px] text-violet-400 font-semibold">{gItems.length} produksi · {plbTotal.toFixed(2)} gr dipakai</span>
                    </div>
                  )}
                  {(()=>{
                    // Group by sesi_id — multi-gramasi tampil sebagai SesiCard
                    const sesiMap = new Map<string, any[]>()
                    for (const it of gItems) {
                      const key = it.sesi_id ?? `__solo__${it.id}`
                      if (!sesiMap.has(key)) sesiMap.set(key, [])
                      sesiMap.get(key)!.push(it)
                    }
                    // Multi-gramasi (SESI) dirender SAMA seperti single: tiap gramasi = 1 card standar
                    return [...sesiMap.entries()].flatMap(([, sItems]) => sItems.map((item: any) => {
            const isExp     = expanded.has(item.id)
            const sc        = STATUS_COLOR[item.current_status] ?? {bg:'rgba(156,163,175,0.1)',text:'#6B7280',dot:'#9CA3AF'}
            const events: any[] = Array.isArray(item.produksi_event)?item.produksi_event.filter((e:any)=>!e.voided_at):[]
            const handovers: any[] = Array.isArray(item.stage_handover)?item.stage_handover.filter((h:any)=>!h.voided_at).sort((a:any,b:any)=>['pas_berat','annealing','siap_packing'].indexOf(a.tahap)-['pas_berat','annealing','siap_packing'].indexOf(b.tahap)):[]
            const pbH  = handovers.find((h:any)=>h.tahap==='pas_berat')
            const annH = handovers.find((h:any)=>h.tahap==='annealing')
            const spH  = handovers.find((h:any)=>h.tahap==='siap_packing')
            const s    = item.current_status
            const isVoided = !!item.voided_at
            // Status packing dinamis: hitung total PCS dipack vs total PCS produksi
            const pkRows: any[] = Array.isArray(item.packing) ? item.packing.filter((p:any)=>!p.voided_at) : []
            const totalDipack = pkRows.reduce((a:number,p:any)=>a+(p.pcs_dipack||0),0)
            const totalPcsItem = item.pcs_good ?? item.pcs ?? 0
            let statusLabel = item.current_status
            if ((s === 'Siap Packing' || s === 'Sudah Packing') && totalPcsItem > 0) {
              if (totalDipack <= 0)              statusLabel = 'Siap Packing'
              else if (totalDipack < totalPcsItem) statusLabel = `Sebagian Dipacking (${totalDipack}/${totalPcsItem})`
              else                                 statusLabel = `Semua Dipacking (${totalDipack}/${totalPcsItem})`
            }



            return (
              <div key={item.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all"
                style={{borderLeft:`3px solid ${sc.dot}`}}>

                {/* ── Card Header ─────────────────────────────────────────── */}
                <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                  {/* Main info — avatar dihapus, border-left strip warna sudah indicator status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.gramasi ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">{item.gramasi}gr</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">?gr</span>
                      )}
                      <span className="text-[13px] font-semibold text-slate-800 truncate">{item.nama_item ?? item.kode}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{background:sc.bg,color:sc.text}}>
                        {statusLabel}
                      </span>
                      {item.status_cutting==='proses'&&<span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">proses</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      {item.kode} · {item.batch_kode}
                    </p>
                    <p className="text-[12px] text-slate-600 mt-0.5 tabular-nums">
                      {item.gramasi ? <>{item.gramasi}gr <span className="text-slate-300 mx-0.5">×</span> {item.pcs_good??item.pcs??'?'} pcs <span className="text-slate-300 mx-0.5">=</span></> : null}
                      <span className="font-semibold text-slate-800 ml-0.5">{fgr(item.total_gram)} gr</span>
                      {!item.gramasi && <span className="text-[11px] text-amber-600 ml-2">(gramasi belum dipilih)</span>}
                    </p>
                  </div>

                  {/* Action buttons */}
                  {canEdit&&!isVoided&&(()=>{
                    if(s==='Cutting' && !item.gramasi && item.status_cutting!=='selesai')
                      return <button onClick={()=>openModal('terimaCuttingItem',item)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-violet-600 text-white">
                        Terima Cutting <span className="text-[9px] opacity-70">(pilih gramasi)</span>
                      </button>
                    if(s==='Cutting'&&item.status_cutting==='proses')
                      return <button onClick={()=>openModal('cuttingTerima',item)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Cutting'&&item.status_cutting==='selesai'&&!pbH&&!annH&&!spH)
                      return <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={()=>openSerahStage(item,'pas_berat')}
                          className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 hover:scale-105 transition-all bg-amber-50 text-amber-700"
                          title="Lanjut ke Pas Berat">
                          <Plus size={11}/> Pas Berat
                        </button>
                        <button onClick={()=>openSerahStage(item,'annealing')}
                          className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 hover:scale-105 transition-all bg-yellow-50 text-yellow-700"
                          title="Lanjut ke Annealing (skip Pas Berat)">
                          <Plus size={11}/> Annealing
                        </button>
                        <button onClick={()=>openSerahStage(item,'siap_packing')}
                          className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 hover:scale-105 transition-all bg-violet-50 text-violet-700"
                          title="Langsung Siap Packing">
                          <Plus size={11}/> Siap Packing
                        </button>
                      </div>
                    if(s==='Pas Berat'&&pbH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'pas_berat',pbH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Pas Berat'&&!pbH)
                      return <button onClick={()=>openTerimaStage(item,'pas_berat',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Terima
                      </button>
                    if(s==='Pas Berat'&&pbH?.status==='selesai'&&!annH&&!spH)
                      return <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={()=>openSerahStage(item,'annealing')}
                          className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 hover:scale-105 transition-all bg-amber-50 text-amber-700"
                          title="Lanjut ke Annealing">
                          <Plus size={11}/> Annealing
                        </button>
                        <button onClick={()=>openSerahStage(item,'siap_packing')}
                          className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 hover:scale-105 transition-all bg-violet-50 text-violet-700"
                          title="Skip Annealing → langsung Siap Packing">
                          <Plus size={11}/> Siap Packing
                        </button>
                      </div>
                    if(s==='Annealing'&&annH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'annealing',annH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Annealing'&&!annH)
                      return <button onClick={()=>openTerimaStage(item,'annealing',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Terima
                      </button>
                    if(s==='Annealing'&&annH?.status==='selesai'&&!spH)
                      return <button onClick={()=>openSerahStage(item,'siap_packing')}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-violet-50 text-violet-700">
                        <Plus size={11}/> Siap Packing
                      </button>
                    if(s==='Siap Packing'&&spH?.status==='proses')
                      return <button onClick={()=>openTerimaStage(item,'siap_packing',spH.id)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
                        <Check size={11}/> Diterima
                      </button>
                    if(s==='Siap Packing'&&!spH)
                      return <button onClick={()=>openTerimaStage(item,'siap_packing',0)}
                        className="h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0 hover:scale-105 transition-all bg-emerald-50 text-emerald-700">
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
                      className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 hover:scale-110 transition-all">
                      {isExp?<ChevronUp size={13} className="text-slate-500"/>:<ChevronDown size={13} className="text-slate-500"/>}
                    </button>
                  </div>
                </div>

                {/* ── Expanded ────────────────────────────────────────────── */}
                {isExp&&(
                  <div className="px-4 pb-5 pt-4 border-t border-slate-200 space-y-3 bg-slate-50/40">

                    {/* ④ Stage handover + Cutting */}
                    {(item.serah_gram||item.terima_gram||handovers.length>0)&&(
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <p className="text-[11px] font-medium text-slate-500">📋 Riwayat Serah-Terima</p>
                        </div>

                        {/* Cutting card — Peleburan-style: single card, inline gram row, foto row */}
                        {(item.serah_gram||item.terima_gram)&&(()=>{
                          const serahFotosC: string[] = Array.isArray(item.foto_serahkan_cutting) ? item.foto_serahkan_cutting : []
                          const terimaFotosC: string[] = Array.isArray(item.foto_diterima_cutting) ? item.foto_diterima_cutting : []
                          const durasiC = getDurasiJam(item.jam_mulai_cutting, item.jam_selesai)
                          const rejGram = Number(item.reject_cutting_gram ?? 0)
                          const lossCutting = Number(item.losses_cutting ?? 0)
                          return (
                            <div className="px-4 py-3 border-t border-slate-200">
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Cutting</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.status_cutting==='selesai'?'bg-green-50 text-green-700 border border-green-100':'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                      {item.status_cutting==='selesai'?'✓ Selesai':'⏳ Proses'}
                                    </span>
                                    {durasiC&&<span className="text-[10px] text-slate-400">⏱ {durasiC}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                                    {(item.tanggal_mulai||item.tanggal_produksi)&&<span>{new Date(item.tanggal_mulai||item.tanggal_produksi).toLocaleDateString('id-ID')}{item.jam_mulai_cutting?` · ${String(item.jam_mulai_cutting).slice(0,5)}`:''}{item.jam_selesai?` → ${String(item.jam_selesai).slice(0,5)}`:''}</span>}
                                    {(item.tim_nama||item.operator)&&<span>· 👥 {item.tim_nama||item.operator}{item.tim_anggota_aktif?`: ${item.tim_anggota_aktif}`:''}</span>}
                                    {item.admin_input&&<span>· ✍️ {item.admin_input}</span>}
                                  </div>
                                </div>
                                {canEdit&&!isVoided&&(
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={()=>openModal('edit',item)}
                                      className="flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold text-blue-500 hover:bg-blue-50 transition-colors border border-blue-100">
                                      <Edit2 size={10}/> Serah
                                    </button>
                                    {item.terima_gram&&(
                                      <button onClick={()=>openModal('editCutting',item)}
                                        className="flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold text-green-600 hover:bg-green-50 transition-colors border border-green-100">
                                        <Edit2 size={10}/> Terima
                                      </button>
                                    )}
                                    {canDelete&&(
                                      <button onClick={()=>openModal('deleteCutting',item)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors border border-red-100">
                                        <Trash2 size={11}/>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Gram row — inline like Peleburan */}
                              <div className="grid grid-cols-3 gap-3 mb-2">
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Diserahkan</p>
                                  <p className="text-[13px] font-semibold text-slate-800 tabular-nums mt-0.5">{item.serah_gram?`${parseFloat(item.serah_gram).toFixed(2)} gr`:'—'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Diterima</p>
                                  <p className="text-[13px] font-semibold text-slate-800 tabular-nums mt-0.5">{item.terima_gram?`${parseFloat(item.terima_gram).toFixed(2)} gr`:'—'}{item.terima_pcs?` · ${item.terima_pcs} pcs`:''}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Reject Cutting</p>
                                  <p className={`text-[13px] font-semibold tabular-nums mt-0.5 ${(rejGram>0||lossCutting>0)?'text-red-500':'text-slate-400'}`}>
                                    {rejGram>0?`${rejGram.toFixed(2)} gr`:(lossCutting>0?`${lossCutting.toFixed(2)} gr`:'—')}
                                  </p>
                                </div>
                              </div>
                              {(item.catatan||item.catatan_terima)&&<p className="text-[11px] text-slate-400 italic mb-2">{[item.catatan,item.catatan_terima].filter(Boolean).join(' · ')}</p>}
                              {/* Foto row — aligned to gram columns (Diserahkan | Diterima | -) */}
                              {(serahFotosC.length>0||terimaFotosC.length>0)&&(
                                <div className="grid grid-cols-3 gap-3 mt-2">
                                  <div>
                                    {serahFotosC.length>0&&<div className="flex flex-wrap gap-1.5">{serahFotosC.map((u,fi)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border border-slate-200 hover:scale-110 transition-transform cursor-pointer"/></a>)}</div>}
                                  </div>
                                  <div>
                                    {terimaFotosC.length>0&&<div className="flex flex-wrap gap-1.5">{terimaFotosC.map((u,fi)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border border-slate-200 hover:scale-110 transition-transform cursor-pointer"/></a>)}</div>}
                                  </div>
                                  <div/>
                                </div>
                              )}
                          {(()=>{const _la=(lossApprovals as any[]).find((l:any)=>l.ref_table==='produksi_item'&&l.ref_id===item.id&&l.proses==='cutting');if(!_la)return null;return(<div className="mt-2 rounded-xl overflow-hidden border border-red-100"><div className="px-3 py-2 flex items-center gap-2 bg-red-50"><span className="text-[10px] font-semibold text-red-600">⚠ TTD loss cutting</span>{_la.loss_gram&&<span className="text-[10px] text-red-400 ml-1">{parseFloat(_la.loss_gram).toFixed(2)} gr</span>}</div><div className="px-3 py-2 space-y-1.5">{_la.alasan&&<p className="text-[12px] text-slate-600"><span className="font-semibold">Alasan:</span> {_la.alasan}</p>}<div className="flex gap-4 text-[12px] text-slate-500">{_la.operator_nama&&<span>👷 {_la.operator_nama}</span>}{_la.admin_nama&&<span>✍️ {_la.admin_nama}</span>}</div>{(_la.ttd_operator_url||_la.ttd_admin_url)&&<div className="flex gap-3 pt-1 flex-wrap">{_la.ttd_operator_url&&<div><p className="text-[10px] text-slate-400 mb-1">TTD Operator</p><a href={_la.ttd_operator_url} target="_blank" rel="noopener noreferrer"><img src={_la.ttd_operator_url} alt="TTD" className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/></a></div>}{_la.ttd_admin_url&&<div><p className="text-[10px] text-slate-400 mb-1">TTD Admin</p><a href={_la.ttd_admin_url} target="_blank" rel="noopener noreferrer"><img src={_la.ttd_admin_url} alt="TTD" className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/></a></div>}</div>}</div></div>)})()}
                            </div>
                          )
                        })()}
                        {handovers.map((h:any)=>{
                          const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
                          const serahFotos:string[]=Array.isArray(h.serah_fotos)?h.serah_fotos:[]
                          const terimaFotos:string[]=Array.isArray(h.terima_fotos)?h.terima_fotos:[]
                          const durasiH = getDurasiJam(h.serah_jam, h.terima_jam)
                          const hReject = Number(h.reject_gram ?? 0)
                          const hLosses = Number(h.losses_gram ?? 0)
                          const hSerbuk = Number(h.sisa_serbuk ?? 0)
                          return (
                            <div key={h.id} className="px-4 py-3 border-t border-slate-200">
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{tl[h.tahap]}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.status==='selesai'?'bg-green-50 text-green-700 border border-green-100':'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                      {h.status==='selesai'?'✓ Selesai':'⏳ Proses'}
                                    </span>
                                    {durasiH&&<span className="text-[10px] text-slate-400">⏱ {durasiH}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                                    {h.serah_tanggal&&<span>{new Date(h.serah_tanggal).toLocaleDateString('id-ID')}{h.serah_jam?` · ${String(h.serah_jam).slice(0,5)}`:''}{h.terima_jam?` → ${String(h.terima_jam).slice(0,5)}`:''}</span>}
                                    {(h.tim_nama||h.serah_operator||h.terima_operator)&&<span>· 👥 {h.tim_nama||h.terima_operator||h.serah_operator}{h.tim_anggota_aktif?`: ${h.tim_anggota_aktif}`:''}</span>}
                                    {(h.serah_admin_input||h.terima_admin_input)&&<span>· ✍️ {h.terima_admin_input||h.serah_admin_input}</span>}
                                  </div>
                                </div>
                                {canEdit&&(
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={()=>openEditSerahStage(item,h)}
                                      className="flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold text-blue-500 hover:bg-blue-50 transition-colors border border-blue-100">
                                      <Edit2 size={10}/> Serah
                                    </button>
                                    {h.terima_gram!=null&&(
                                      <button onClick={()=>openEditHandover(item,h)}
                                        className="flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold text-green-600 hover:bg-green-50 transition-colors border border-green-100">
                                        <Edit2 size={10}/> Terima
                                      </button>
                                    )}
                                    {canDelete&&(
                                      <button onClick={()=>openDeleteHandover(item,h)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors border border-red-100">
                                        <Trash2 size={11}/>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Gram row — Sisa Serbuk sebagai sub-info di bawah Diterima */}
                              <div className="grid grid-cols-3 gap-3 mb-2">
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Diserahkan</p>
                                  <p className="text-[13px] font-semibold text-slate-800 tabular-nums mt-0.5">{h.serah_gram?`${parseFloat(h.serah_gram).toFixed(2)} gr`:'—'}{h.serah_pcs?` · ${h.serah_pcs} pcs`:''}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Diterima</p>
                                  <p className="text-[13px] font-semibold text-slate-800 tabular-nums mt-0.5">{h.terima_gram?`${parseFloat(h.terima_gram).toFixed(2)} gr`:'—'}{h.terima_pcs?` · ${h.terima_pcs} pcs`:''}</p>
                                  {hSerbuk>0&&<p className="text-[10px] text-slate-500 mt-0.5">Sisa Serbuk: <span className="font-semibold text-slate-700 tabular-nums">{hSerbuk.toFixed(2)} gr</span></p>}
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-slate-400">Reject {tl[h.tahap]??h.tahap}</p>
                                  <p className={`text-[13px] font-semibold tabular-nums mt-0.5 ${(hReject>0||hLosses>0)?'text-red-500':'text-slate-400'}`}>
                                    {hReject>0?`${hReject.toFixed(2)} gr${h.reject_pcs?` · ${h.reject_pcs} pcs`:''}`:(hLosses>0?`${hLosses.toFixed(2)} gr`:'—')}
                                  </p>
                                </div>
                              </div>
                              {(h.serah_catatan||h.terima_catatan)&&<p className="text-[11px] text-slate-400 italic mb-2">{[h.serah_catatan,h.terima_catatan].filter(Boolean).join(' · ')}</p>}
                              {/* Foto row — aligned to gram columns (Diserahkan | Diterima | -) */}
                              {(serahFotos.length>0||terimaFotos.length>0)&&(
                                <div className="grid grid-cols-3 gap-3 mt-2">
                                  <div>
                                    {serahFotos.length>0&&<div className="flex flex-wrap gap-1.5">{serahFotos.map((u:string,fi:number)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border border-slate-200 hover:scale-110 transition-transform cursor-pointer"/></a>)}</div>}
                                  </div>
                                  <div>
                                    {terimaFotos.length>0&&<div className="flex flex-wrap gap-1.5">{terimaFotos.map((u:string,fi:number)=><a key={fi} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="w-12 h-12 rounded-lg object-cover border border-slate-200 hover:scale-110 transition-transform cursor-pointer"/></a>)}</div>}
                                  </div>
                                  <div/>
                                </div>
                              )}
                          {(()=>{const _la=(lossApprovals as any[]).find((l:any)=>l.ref_table==='stage_handover'&&l.ref_id===h.id);if(!_la)return null;return(<div className="mt-2 rounded-xl overflow-hidden border border-red-100"><div className="px-3 py-2 flex items-center gap-2 bg-red-50"><span className="text-[10px] font-semibold text-red-600">⚠ TTD loss {(h.tahap as string).replace(/_/g,' ')}</span>{_la.loss_gram&&<span className="text-[10px] text-red-400 ml-1">{parseFloat(_la.loss_gram).toFixed(2)} gr</span>}</div><div className="px-3 py-2 space-y-1.5">{_la.alasan&&<p className="text-[12px] text-slate-600"><span className="font-semibold">Alasan:</span> {_la.alasan}</p>}<div className="flex gap-4 text-[12px] text-slate-500">{_la.operator_nama&&<span>👷 {_la.operator_nama}</span>}{_la.admin_nama&&<span>✍️ {_la.admin_nama}</span>}</div>{(_la.ttd_operator_url||_la.ttd_admin_url)&&<div className="flex gap-3 pt-1 flex-wrap">{_la.ttd_operator_url&&<div><p className="text-[10px] text-slate-400 mb-1">TTD Operator</p><a href={_la.ttd_operator_url} target="_blank" rel="noopener noreferrer"><img src={_la.ttd_operator_url} alt="TTD" className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/></a></div>}{_la.ttd_admin_url&&<div><p className="text-[10px] text-slate-400 mb-1">TTD Admin</p><a href={_la.ttd_admin_url} target="_blank" rel="noopener noreferrer"><img src={_la.ttd_admin_url} alt="TTD" className="h-14 w-28 object-contain rounded-xl border border-red-100 bg-white"/></a></div>}</div>}</div></div>)})()}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* + Cetak Gramasi / Tambah Produksi — lanjut cetak dari batch ini */}
                    {canEdit&&!isVoided&&(
                      <button onClick={()=>openTambahProduksi(item)}
                        className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold text-violet-600 border border-dashed border-violet-300 transition-all hover:bg-violet-50">
                        <Plus size={14}/> Cetak Gramasi / Tambah Produksi
                      </button>
                    )}

                  </div>
                )}
              </div>
                )
              }))
            })()}
                </div>
              )
            })
          })()}
        </div>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 pt-2">
            <span className="text-[12px] text-slate-400">Hal {page} dari {totalPages} · {total} item</span>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>navigateProd({page:String(page-1)})}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <button disabled={page>=totalPages} onClick={()=>navigateProd({page:String(page+1)})}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal==='create'        && batches.length>0 && <CreateModal batches={batches} peleburanByBatch={peleburanByBatch} tims={tims} adminList={adminList} onClose={()=>setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err}/>}
      {modal==='tambahProduksi'&& active            && <TambahProduksiModal item={active} peleburanByBatch={peleburanByBatch} tims={tims} adminList={adminList} onClose={()=>setModal(null)} onSubmit={handleTambahProduksi} isPending={isPending} error={err}/>}
      {modal==='edit'          && active            && <EditModal item={active} tims={tims} adminList={adminList} onClose={()=>setModal(null)} onSubmit={handleEdit} isPending={isPending} error={err}/>}
      {modal==='update'        && active            && <UpdateModal item={active} onClose={()=>setModal(null)} onSubmit={handleUpdate} isPending={isPending} error={err}/>}
      {modal==='cuttingTerima' && active            && (()=>{
        const serahG = Number(active.serah_gram ?? active.berat_awal ?? 0)
        return <TerimaModalStd judul="Terima Cutting" kode={active.kode} tims={tims} adminList={adminList} serahGram={serahG} toleransi={toleransi.cutting??0.05} prosesLabel="Cutting" isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleSelesaiCutting}/>
      })()}
      {modal==='editCutting'   && active            && (()=>{
        const serahG = Number(active.serah_gram ?? active.berat_awal ?? 0)
        const initData = {
          terima_gram: active.terima_gram, terima_pcs: active.pcs_good ?? active.terima_pcs,
          terima_tanggal: active.tanggal_selesai, terima_jam: active.jam_selesai,
          reject_gram: active.reject_cutting_gram, reject_pcs: active.pcs_reject,
          terima_catatan: active.catatan_terima,
          tim_id: active.tim_id, tim_nama: active.tim_nama, tim_anggota_aktif: active.tim_anggota_aktif,
          terima_admin_input: active.admin_input,
          foto_diterima_cutting: active.foto_diterima_cutting,
        }
        return <TerimaModalStd judul="Edit Terima — Cutting" kode={active.kode} tims={tims} adminList={adminList} serahGram={serahG} toleransi={toleransi.cutting??0.05} prosesLabel="Cutting" initialData={initData} isEdit isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleEditCutting}/>
      })()}
      {modal==='serahStage'    && active            && (()=>{
        const tahapJudul: Record<string,string> = { pas_berat:'Serahkan ke Pas Berat', annealing:'Serahkan ke Annealing', siap_packing:'Serahkan ke Siap Packing' }
        return <SerahModalStd judul={tahapJudul[activeTahap]??'Serahkan'} kode={active.kode} tims={tims} adminList={adminList} isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleSerahStage}/>
      })()}
      {modal==='terimaStage'   && active            && (()=>{
        const hs:any[] = Array.isArray(active.stage_handover)?active.stage_handover.filter((h:any)=>!h.voided_at):[]
        const curH = hs.find((h:any)=>h.tahap===activeTahap)
        const serahG = Number(curH?.serah_gram ?? (activeTahap==='pas_berat'?active.terima_gram:active.total_gram) ?? 0)
        const tahapJudul: Record<string,string> = { pas_berat:'Terima Pas Berat', annealing:'Terima Annealing', siap_packing:'Terima Siap Packing' }
        const tahapLabel: Record<string,string> = { pas_berat:'Pas Berat', annealing:'Annealing', siap_packing:'Siap Packing' }
        return <TerimaModalStd judul={tahapJudul[activeTahap]??'Terima'} kode={active.kode} tims={tims} adminList={adminList} serahGram={serahG} toleransi={toleransi[activeTahap]??0.05} showSerbuk={activeTahap==='pas_berat'} prosesLabel={tahapLabel[activeTahap]??activeTahap} isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleTerimaStage}/>
      })()}
      {modal==='delete'        && active            && <DelModal item={active} onClose={()=>setModal(null)} onConfirm={handleDelete} isPending={isPending} error={err}/>}
      {modal==='editSerahStage'&& active&&activeHandoverData && (()=>{
        const tahapJudul: Record<string,string> = { pas_berat:'Edit Serah — Pas Berat', annealing:'Edit Serah — Annealing', siap_packing:'Edit Serah — Siap Packing' }
        return <SerahModalStd judul={tahapJudul[activeTahap]??'Edit Serah'} kode={active.kode} tims={tims} adminList={adminList} initialData={activeHandoverData} isEdit isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleEditSerahStage}/>
      })()}
      {modal==='editHandover'  && active&&activeHandoverData && (()=>{
        const serahG = Number(activeHandoverData?.serah_gram ?? 0)
        const tahapJudul: Record<string,string> = { pas_berat:'Edit Terima — Pas Berat', annealing:'Edit Terima — Annealing', siap_packing:'Edit Terima — Siap Packing' }
        const tahapLabel: Record<string,string> = { pas_berat:'Pas Berat', annealing:'Annealing', siap_packing:'Siap Packing' }
        return <TerimaModalStd judul={tahapJudul[activeTahap]??'Edit Terima'} kode={active.kode} tims={tims} adminList={adminList} serahGram={serahG} toleransi={toleransi[activeTahap]??0.05} showSerbuk={activeTahap==='pas_berat'} prosesLabel={tahapLabel[activeTahap]??activeTahap} initialData={activeHandoverData} isEdit isPending={isPending} error={err} onClose={()=>setModal(null)} onSubmit={handleEditHandover}/>
      })()}
      {modal==='deleteHandover'&& active&&activeHandoverData && (()=>{
        const tl:Record<string,string>={pas_berat:'Pas Berat',annealing:'Annealing',siap_packing:'Siap Packing'}
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden p-6 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500"/></div>
              <h2 className="text-[16px] font-bold text-slate-900">Hapus Proses {tl[activeTahap]}?</h2>
              <p className="text-[13px] text-slate-500 mt-2 mb-1">Data serah-terima <b>{tl[activeTahap]}</b> untuk {active.kode} akan dihapus.</p>
              <p className="text-[12px] text-slate-400 mb-5">Status produksi kembali ke tahap sebelumnya.</p>
              {err&&<div className="mb-3 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
              <div className="flex gap-2.5">
                <button onClick={()=>setModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
                <button onClick={handleDeleteHandover} disabled={isPending} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                  {isPending?'Menghapus…':'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {modal==='deleteCutting' && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500"/></div>
            <h2 className="text-[16px] font-bold text-slate-900">Hapus Proses Cutting?</h2>
            <p className="text-[13px] text-slate-500 mt-2 mb-1">Data <b>terima Cutting</b> untuk {active.kode} akan dihapus.</p>
            <p className="text-[12px] text-slate-400 mb-5">Status kembali ke Cutting (proses). Data penyerahan tetap.</p>
            {err&&<div className="mb-3 rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
            <div className="flex gap-2.5">
              <button onClick={()=>setModal(null)} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button onClick={handleDeleteCutting} disabled={isPending} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {isPending?'Menghapus…':'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Sesi modals ─────────────────────────────────────────────────── */}
      {modal==='sesiCuttingTerima' && activeSesi && (()=>{
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              <SesiCuttingTerimaForm
                items={activeSesi.items}
                tims={tims}
                adminList={adminList}
                err={err}
                isPending={isPending}
                onCancel={()=>setModal(null)}
                onSubmit={handleSesiCuttingTerima}
              />
            </div>
          </div>
        )
      })()}
      {modal==='sesiSerahStage' && activeSesi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <SesiSerahForm items={activeSesi.items} tahap={activeSesi.tahap!} tims={tims} adminList={adminList}
              err={err} isPending={isPending} onCancel={()=>setModal(null)} onSubmit={handleSesiSerahStage} />
          </div>
        </div>
      )}
      {modal==='sesiTerimaStage' && activeSesi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <SesiTerimaForm items={activeSesi.items} tahap={activeSesi.tahap!} tims={tims} adminList={adminList}
              err={err} isPending={isPending} onCancel={()=>setModal(null)} onSubmit={handleSesiTerimaStage} />
          </div>
        </div>
      )}
      {modal==='terimaCuttingItem' && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <TerimaCuttingForm item={active} tims={tims} adminList={adminList}
              toleransi={toleransi.cutting ?? 0.05}
              err={err} isPending={isPending}
              onCancel={()=>setModal(null)}
              onSubmit={handleTerimaCuttingItem} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SesiCuttingTerimaForm — per-gramasi: ACC, PCS, Catatan, Foto ──────────────
function SesiCuttingTerimaForm({ items, tims, adminList, err, isPending, onCancel, onSubmit }: {
  items: any[]; tims: any[]; adminList: any[]; err: string; isPending: boolean;
  onCancel: () => void; onSubmit: (fd: FormData) => void
}) {
  const sorted = [...items].sort((a,b) => Number(a.gramasi) - Number(b.gramasi))
  const [perItem, setPerItem] = useState<Record<number, { catatan: string; fotos: File[] }>>(() => {
    const init: Record<number, { catatan: string; fotos: File[] }> = {}
    items.forEach(it => { init[it.id] = { catatan: '', fotos: [] } })
    return init
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const el = e.currentTarget as HTMLFormElement
    const fd = new FormData(el)
    // Convert per-item fotos to base64
    const fotosMap: Record<string, string[]> = {}
    for (let i = 0; i < sorted.length; i++) {
      const it = sorted[i]
      const fotos = perItem[it.id]?.fotos ?? []
      fotosMap[i] = fotos.length > 0 ? await filesToBase64(fotos) : []
    }
    fd.set('fotos_b64', JSON.stringify(fotosMap))
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Terima Cutting Sesi</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{items.length} gramasi · sesi bersama</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={16}/></button>
      </div>
      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {items[0]?.berat_serah_batch && (
          <div className="rounded-lg px-3 py-2 bg-blue-50 border border-blue-100 text-blue-700 text-[12px] font-medium">
            Berat serah batch: <span className="font-bold">{fgr(items[0].berat_serah_batch)} gr</span> — Total ACC + Reject harus sama
          </div>
        )}
        {sorted.map(it => (
          <div key={it.id} className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-2">
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{it.gramasi}gr · serah {fgr(it.serah_gram ?? it.berat_awal)} gr</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Berat ACC (gr)</label>
                <input name={`acc_gram_${it.id}`} type="number" step="0.001" required min="0.001"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" placeholder={fgr(it.berat_awal)} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">PCS good</label>
                <input name={`pcs_${it.id}`} type="number" min="0" placeholder={String(it.pcs ?? '')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
              </div>
            </div>
            <input type="text" value={perItem[it.id]?.catatan ?? ''}
              onChange={e => setPerItem(p => ({ ...p, [it.id]: { ...p[it.id], catatan: e.target.value } }))}
              placeholder={`Catatan ${it.gramasi}gr (opsional)`}
              className="w-full h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
            <div>
              <label className="text-[10px] font-medium text-slate-400 mb-1 block">Foto {it.gramasi}gr</label>
              <FotoPicker files={perItem[it.id]?.fotos ?? []}
                onAdd={ff => setPerItem(p => ({ ...p, [it.id]: { ...p[it.id], fotos: [...(p[it.id]?.fotos ?? []), ...ff].slice(0, 5) } }))}
                onRemove={i => i === -1 ? setPerItem(p => ({ ...p, [it.id]: { ...p[it.id], fotos: [] } })) : setPerItem(p => ({ ...p, [it.id]: { ...p[it.id], fotos: (p[it.id]?.fotos ?? []).filter((_, j) => j !== i) } }))}
                label={`Foto ${it.gramasi}gr`} small />
            </div>
          </div>
        ))}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Total reject (gr) — dibagi proporsional</label>
          <input name="reject_cutting_gram" type="number" step="0.001" min="0" defaultValue="0"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal selesai</label>
            <input name="tanggal_selesai" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Jam</label>
            <input name="jam_selesai" type="time"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Tim</label>
          <select name="terima_tim_id" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:outline-none focus:border-violet-500 transition-all">
            <option value="">— pilih tim —</option>
            {tims.map((t: any) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
        </div>
        <AdminPickerStd adminList={adminList} prefix="terima_" label="Admin Penerima" />
        {err && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
        <button type="submit" disabled={isPending} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">{isPending ? 'Menyimpan…' : 'Simpan Terima Cutting'}</button>
      </div>
    </form>
  )
}

// ─── SesiSerahForm — serah sesi (multi-gramasi) ke tahap berikutnya ─────────────
function SesiSerahForm({ items, tahap, tims, adminList, err, isPending, onCancel, onSubmit }: {
  items: any[]; tahap: string; tims: any[]; adminList: any[]; err: string; isPending: boolean;
  onCancel: () => void; onSubmit: (fd: FormData) => void
}) {
  const TL: Record<string,string> = { pas_berat:'Pas Berat', annealing:'Annealing', siap_packing:'Siap Packing' }
  const sorted = [...items].sort((a,b)=>Number(a.gramasi)-Number(b.gramasi))
  const [fotos, setFotos] = useState<File[]>([])

  function serahWeight(it:any) {
    if (tahap==='pas_berat') return it.terima_gram ?? it.total_gram ?? it.berat_awal
    const prevMap: Record<string,string> = { annealing:'pas_berat', siap_packing:'annealing' }
    const ph = (it.stage_handover??[]).filter((h:any)=>!h.voided_at).find((h:any)=>h.tahap===prevMap[tahap] && h.status==='selesai')
    return ph?.terima_gram ?? it.total_gram ?? it.berat_awal
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    fd.set('fotos_b64', JSON.stringify(fotos.length>0 ? await filesToBase64(fotos) : []))
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Serahkan ke {TL[tahap]??tahap}</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{items.length} gramasi · sesi bersama</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={16}/></button>
      </div>
      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {sorted.map(it=>(
            <span key={it.id} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 tabular-nums">
              {it.gramasi}gr · {fgr(serahWeight(it))} gr
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal serah</label>
            <input name="serah_tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Jam</label>
            <input name="serah_jam" type="time" className={inp}/>
          </div>
        </div>
        <TimPickerStd tims={tims} prefix="serah_" />
        <AdminPickerStd adminList={adminList} prefix="serah_" label="Admin Yang Menyerahkan" />
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Catatan</label>
          <input name="serah_catatan" type="text" placeholder="Opsional" className={inp}/>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Foto Serah (opsional)</label>
          <FotoPicker files={fotos}
            onAdd={ff=>setFotos(p=>[...p,...ff].slice(0,10))}
            onRemove={i=>i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))}
            label="Tambah foto" small />
        </div>
        {err&&<div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
        <button type="submit" disabled={isPending} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">{isPending?'Menyimpan…':`Serahkan ke ${TL[tahap]??tahap}`}</button>
      </div>
    </form>
  )
}

// ─── SesiTerimaForm — terima sesi (multi-gramasi) per tahap ─────────────────────
function SesiTerimaForm({ items, tahap, tims, adminList, err, isPending, onCancel, onSubmit }: {
  items: any[]; tahap: string; tims: any[]; adminList: any[]; err: string; isPending: boolean;
  onCancel: () => void; onSubmit: (fd: FormData) => void
}) {
  const TL: Record<string,string> = { pas_berat:'Pas Berat', annealing:'Annealing', siap_packing:'Siap Packing' }
  const isPb = tahap==='pas_berat'
  const sorted = [...items].sort((a,b)=>Number(a.gramasi)-Number(b.gramasi))
  const [fotos, setFotos] = useState<File[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    fd.set('fotos_b64', JSON.stringify(fotos.length>0 ? await filesToBase64(fotos) : []))
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Terima {TL[tahap]??tahap} Sesi</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{items.length} gramasi · sesi bersama</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={16}/></button>
      </div>
      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {sorted.map(it=>{
          const sh = (it.stage_handover??[]).filter((h:any)=>!h.voided_at).find((h:any)=>h.tahap===tahap)
          return (
            <div key={it.id} className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-2">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 tabular-nums">{it.gramasi}gr · diserahkan {fgr(sh?.serah_gram ?? it.total_gram)} gr</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Berat terima (gr)</label>
                  <input name={`terima_gram_${it.id}`} type="number" step="0.001" required min="0.001"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">PCS</label>
                  <input name={`terima_pcs_${it.id}`} type="number" min="0" placeholder={String(it.pcs_good ?? it.pcs ?? '')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
                </div>
                {isPb && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Sisa serbuk (gr)</label>
                    <input name={`sisa_serbuk_${it.id}`} type="number" step="0.001" min="0" defaultValue="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Reject (gr)</label>
                  <input name={`reject_gram_${it.id}`} type="number" step="0.001" min="0" defaultValue="0"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all"/>
                </div>
              </div>
            </div>
          )
        })}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal terima</label>
            <input name="terima_tanggal" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={inp}/>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Jam</label>
            <input name="terima_jam" type="time" className={inp}/>
          </div>
        </div>
        <TimPickerStd tims={tims} prefix="terima_" />
        <AdminPickerStd adminList={adminList} prefix="terima_" label="Admin Yang Menerima" />
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Catatan</label>
          <input name="terima_catatan" type="text" placeholder="Opsional" className={inp}/>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-1 block">Foto Terima (opsional)</label>
          <FotoPicker files={fotos}
            onAdd={ff=>setFotos(p=>[...p,...ff].slice(0,10))}
            onRemove={i=>i===-1?setFotos([]):setFotos(p=>p.filter((_,j)=>j!==i))}
            label="Tambah foto" small />
        </div>
        {err&&<div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
        <button type="submit" disabled={isPending} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">{isPending?'Menyimpan…':`Terima ${TL[tahap]??tahap}`}</button>
      </div>
    </form>
  )
}

// ─── TerimaCuttingForm — untuk item tanpa gramasi (pilih gramasi & ACC) ────────
function TerimaCuttingForm({ item, tims, adminList, toleransi, err, isPending, onCancel, onSubmit }: {
  item: any; tims: any[]; adminList: any[]; toleransi: number; err: string; isPending: boolean;
  onCancel: () => void; onSubmit: (fd: FormData) => void
}) {
  type GramasiRow = { gramasi: string; pcs: string; acc_gram: string; catatan: string; fotos: File[] }
  const [gramasiRows, setGramasiRows] = useState<GramasiRow[]>([])
  const [reject, setReject] = useState('0')
  const [up, setUp] = useState(false)
  const updateRow = (idx: number, patch: Partial<GramasiRow>) => setGramasiRows(r => r.map((x, i) => i === idx ? { ...x, ...patch } : x))

  // Loss approval state (muncul saat loss > toleransi)
  const [lossAlasan, setLossAlasan] = useState('')
  const [lossOpNama, setLossOpNama] = useState('')
  const [lossAdminNama, setLossAdminNama] = useState('')
  const [ttdOp, setTtdOp] = useState<string | null>(null)
  const [ttdAdmin, setTtdAdmin] = useState<string | null>(null)

  const totalAcc = gramasiRows.reduce((s, r) => s + (parseFloat(r.acc_gram) || 0), 0)
  const lossNow = Math.max(0, Number(item.berat_awal ?? 0) - totalAcc - (parseFloat(reject) || 0))
  const overTol = gramasiRows.length > 0 && lossNow > toleransi + 0.0001

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); const el = e.currentTarget as HTMLFormElement
    if (overTol) {
      if (!lossAlasan.trim()) { alert('Alasan loss wajib diisi'); return }
      if (!ttdOp) { alert('Tanda tangan operator wajib'); return }
      if (!ttdAdmin) { alert('Tanda tangan admin wajib'); return }
    }
    setUp(true)
    const allFotosB64: Record<string, string[]> = {}
    for (let i = 0; i < gramasiRows.length; i++) {
      const fotos = gramasiRows[i].fotos
      allFotosB64[i] = fotos.length > 0 ? await filesToBase64(fotos) : []
    }
    const fd = new FormData(el)
    fd.set('fotos_b64', JSON.stringify(allFotosB64))
    fd.set('gramasi_list', JSON.stringify(gramasiRows.map((r, i) => ({
      gramasi: r.gramasi, pcs: parseInt(r.pcs) || 0,
      acc_gram: parseFloat(r.acc_gram) || 0, catatan: r.catatan || null,
    }))))
    if (overTol) {
      fd.set('loss_alasan', lossAlasan)
      fd.set('loss_operator_nama', lossOpNama)
      fd.set('loss_admin_nama', lossAdminNama)
      if (ttdOp) fd.set('loss_ttd_operator', ttdOp)
      if (ttdAdmin) fd.set('loss_ttd_admin', ttdAdmin)
    }
    setUp(false)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Terima Cutting</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">{item.kode} — tentukan gramasi sekarang</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X size={16}/></button>
      </div>
      <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="rounded-lg px-3 py-2 bg-blue-50 border border-blue-100 text-blue-700 text-[12px] font-medium">
          Berat bahan: <span className="font-bold">{fgr(item.berat_awal)} gr</span> — Total ACC + Reject harus sama
        </div>
        {/* Gramasi pills */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-2">Pilih Gramasi <span className="text-red-400">*</span></label>
          <div className="flex flex-wrap gap-1.5">
            {GRAMASI_OPTIONS.map(g => {
              const isSelected = gramasiRows.some(r => r.gramasi === g)
              return (
                <button key={g} type="button"
                  onClick={() => setGramasiRows(r => isSelected ? r.filter(x => x.gramasi !== g) : [...r, { gramasi: g, pcs: '', acc_gram: '', catatan: '', fotos: [] }])}
                  className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition-all ${
                    isSelected
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                  }`}>
                  {g} gr
                </button>
              )
            })}
          </div>
          {gramasiRows.length > 0 && (
            <p className="text-[11px] text-violet-500 font-medium mt-1">{gramasiRows.length} gramasi dipilih</p>
          )}
        </div>
        {/* Per-gramasi detail */}
        {gramasiRows.map((row, idx) => (
          <div key={row.gramasi} className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-violet-700">{row.gramasi} gr</span>
              <div className="flex-1">
                <input type="number" min="1" value={row.pcs}
                  onChange={e => updateRow(idx, { pcs: e.target.value })}
                  placeholder="Jml PCS (opsional)"
                  className="w-full h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
              </div>
              <button type="button"
                onClick={() => setGramasiRows(r => r.filter((_, i) => i !== idx))}
                className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={13}/></button>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Berat ACC (gr)</label>
              <input type="number" step="0.001" min="0.001" required value={row.acc_gram}
                onChange={e => updateRow(idx, { acc_gram: e.target.value })}
                placeholder={fgr(item.berat_awal)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            <input type="text" value={row.catatan}
              onChange={e => updateRow(idx, { catatan: e.target.value })}
              placeholder={`Catatan ${row.gramasi}gr (opsional)`}
              className="w-full h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all" />
            <div>
              <label className="text-[10px] font-medium text-slate-400 mb-1 block">Foto {row.gramasi}gr</label>
              <FotoPicker files={row.fotos}
                onAdd={ff => updateRow(idx, { fotos: [...row.fotos, ...ff].slice(0, 5) })}
                onRemove={i => i === -1 ? updateRow(idx, { fotos: [] }) : updateRow(idx, { fotos: row.fotos.filter((_, j) => j !== i) })}
                label={`Foto ${row.gramasi}gr`} small />
            </div>
          </div>
        ))}
        {gramasiRows.length === 0 && (
          <p className="text-[11px] text-amber-600 font-medium">Pilih minimal 1 gramasi di atas</p>
        )}
        {gramasiRows.length > 0 && (
          <p className="text-[11px] text-violet-500 font-medium">Total ACC: <span className="font-semibold">{totalAcc.toFixed(2)} gr</span></p>
        )}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Total reject (gr) — akumulasi</label>
          <input name="reject_cutting_gram" type="number" step="0.001" min="0" value={reject}
            onChange={e => setReject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
        </div>

        {/* Indikator loss realtime + panel approval (sama seperti form Cutting/Peleburan) */}
        {gramasiRows.length > 0 && (
          <div className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-between', overTol ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
            <span>Loss: {lossNow.toFixed(2)} gr</span>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tanggal selesai</label>
            <input name="tanggal_selesai" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Jam</label>
            <input name="jam_selesai" type="time"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all" />
          </div>
        </div>
        <TimPickerStd tims={tims} prefix="terima_" />
        <AdminPickerStd adminList={adminList} prefix="terima_" label="Admin Penerima" />
        {err && <div className="rounded-lg px-3 py-2 text-[12px] bg-red-50 border border-red-100 text-red-600">{err}</div>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
        <button type="submit" disabled={isPending || up || gramasiRows.length === 0} className="flex-1 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
          {(isPending || up) ? 'Menyimpan…' : 'Simpan Terima Cutting'}
        </button>
      </div>
    </form>
  )
}

// ─── SesiCard ──────────────────────────────────────────────────────────────────
function SesiCard({ sesiId, items, canEdit, canDelete, expanded, toggleExp, onCuttingTerima, onSerahStage, onTerimaStage, onEditItem, onDeleteItem }: {
  sesiId: string; items: any[]; canEdit: boolean; canDelete: boolean;
  expanded: Set<number>; toggleExp: (id: number) => void;
  onCuttingTerima: (items: any[]) => void;
  onSerahStage: (items: any[], tahap: string) => void;
  onTerimaStage: (items: any[], tahap: string) => void;
  onEditItem: (item: any) => void; onDeleteItem: (item: any) => void;
}) {
  const first = items[0]
  const expKey: number = first.id
  const isExp = expanded.has(expKey)
  const s = first.current_status
  const sc = STATUS_CFG[s] ?? { dot:'#9CA3AF', bg:'rgba(156,163,175,0.1)', text:'#6B7280' }
  const isVoided = items.every(it => !!it.voided_at)
  const sorted = [...items].sort((a,b) => Number(a.gramasi) - Number(b.gramasi))
  const gramasiStr = sorted.map(it => it.gramasi).join(' & ')

  const allAt = (st: string) => items.every(it => it.current_status === st)
  const allCuttingProses = items.every(it => it.current_status === 'Cutting' && it.status_cutting === 'proses')
  const allCuttingSelesai = items.every(it => it.status_cutting === 'selesai')
  const hasAllSerah = (tahap: string) => items.every(it => (it.stage_handover ?? []).some((h: any) => h.tahap === tahap && !h.voided_at))
  const hasAllTerima = (tahap: string) => items.every(it => (it.stage_handover ?? []).some((h: any) => h.tahap === tahap && h.status === 'selesai' && !h.voided_at))

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all" style={{borderLeft:`3px solid ${sc.dot}`}}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 flex-shrink-0">SESI {items.length}×</span>
            <span className="text-[13px] font-semibold text-slate-800">{first.nama_item ?? first.kode}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{background:sc.bg,color:sc.text}}>{s}</span>
            {isVoided && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">Void</span>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">{first.batch_kode} · Gramasi {gramasiStr} gr</p>
          <div className="flex gap-3 mt-1 flex-wrap">
            {sorted.map(it => (
              <span key={it.id} className="text-[12px] text-slate-600 tabular-nums">
                <span className="text-[10px] font-semibold px-1 rounded bg-slate-100 text-slate-600 mr-0.5">{it.gramasi}gr</span>
                {fgr(it.total_gram ?? it.berat_awal)} gr
              </span>
            ))}
          </div>
        </div>
        {canEdit && !isVoided && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            {allCuttingProses && (
              <button onClick={() => onCuttingTerima(items)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors whitespace-nowrap">
                Terima Cutting
              </button>
            )}
            {allCuttingSelesai && allAt('Cutting') && !hasAllSerah('pas_berat') && (
              <>
                <button onClick={() => onSerahStage(items, 'pas_berat')}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors whitespace-nowrap">
                  Serah Pas Berat
                </button>
                <button onClick={() => onSerahStage(items, 'annealing')}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors whitespace-nowrap">
                  Serah Annealing
                </button>
                <button onClick={() => onSerahStage(items, 'siap_packing')}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap">
                  Serah Siap Packing
                </button>
              </>
            )}
            {allAt('Pas Berat') && hasAllSerah('pas_berat') && !hasAllTerima('pas_berat') && (
              <button onClick={() => onTerimaStage(items, 'pas_berat')}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors whitespace-nowrap">
                Terima Pas Berat
              </button>
            )}
            {allAt('Pas Berat') && hasAllTerima('pas_berat') && !hasAllSerah('annealing') && !hasAllSerah('siap_packing') && (
              <>
                <button onClick={() => onSerahStage(items, 'annealing')}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors whitespace-nowrap">
                  Serah Annealing
                </button>
                <button onClick={() => onSerahStage(items, 'siap_packing')}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap">
                  Serah Siap Packing
                </button>
              </>
            )}
            {allAt('Annealing') && hasAllSerah('annealing') && !hasAllTerima('annealing') && (
              <button onClick={() => onTerimaStage(items, 'annealing')}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors whitespace-nowrap">
                Terima Annealing
              </button>
            )}
            {allAt('Annealing') && hasAllTerima('annealing') && !hasAllSerah('siap_packing') && (
              <button onClick={() => onSerahStage(items, 'siap_packing')}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap">
                Serah Siap Packing
              </button>
            )}
            {allAt('Siap Packing') && hasAllSerah('siap_packing') && !hasAllTerima('siap_packing') && (
              <button onClick={() => onTerimaStage(items, 'siap_packing')}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap">
                Terima Siap Packing
              </button>
            )}
          </div>
        )}
        <button onClick={() => toggleExp(expKey)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0">
          {isExp ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
        </button>
      </div>
      {isExp && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {sorted.map(it => {
            const hs = (it.stage_handover ?? []).filter((h: any) => !h.voided_at)
            return (
              <div key={it.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{it.gramasi}gr</span>
                    <span className="text-[12px] font-semibold text-slate-700">{it.kode}</span>
                    <span className="text-[11px] text-slate-500">{it.pcs_good ?? it.pcs ?? '?'} pcs</span>
                  </div>
                  {canEdit && !it.voided_at && (
                    <div className="flex gap-1">
                      <button onClick={() => onEditItem(it)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"><Edit2 size={12}/></button>
                      {canDelete && <button onClick={() => onDeleteItem(it)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={12}/></button>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div><span className="text-slate-400">Serah:</span> <span className="font-semibold tabular-nums text-slate-700">{fgr(it.serah_gram ?? it.berat_awal)} gr</span></div>
                  <div><span className="text-slate-400">Terima:</span> <span className="font-semibold tabular-nums text-slate-700">{fgr(it.terima_gram ?? it.total_gram)} gr</span></div>
                  <div><span className="text-slate-400">Reject:</span> <span className={`font-semibold tabular-nums ${Number(it.reject_cutting_gram)>0?'text-red-500':'text-slate-400'}`}>{fgr(it.reject_cutting_gram)} gr</span></div>
                </div>
                {hs.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {hs.map((h: any) => {
                      const fotos = [...(Array.isArray(h.serah_fotos)?h.serah_fotos:[]), ...(Array.isArray(h.terima_fotos)?h.terima_fotos:[])]
                      return (
                      <div key={h.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-600 flex-wrap">
                          <span className="font-semibold capitalize">{h.tahap.replace(/_/g,' ')}</span>
                          <span className="tabular-nums">{fgr(h.serah_gram)}→{fgr(h.terima_gram)} gr</span>
                          {h.status==='proses'&&<span className="text-[10px] font-semibold text-blue-500">proses</span>}
                          {h.status==='selesai'&&<span className="text-[10px] font-semibold text-green-500">✓</span>}
                          {(h.serah_jam||h.terima_jam)&&<span className="text-[10px] text-slate-400">🕒 {h.serah_jam?String(h.serah_jam).slice(0,5):'—'}{h.terima_jam?` → ${String(h.terima_jam).slice(0,5)}`:''}</span>}
                        </div>
                        {(h.tim_nama||h.serah_operator||h.terima_operator)&&(
                          <div className="text-[10px] text-slate-400 mt-0.5">👥 {h.tim_nama||h.serah_operator||h.terima_operator}{h.tim_anggota_aktif?`: ${h.tim_anggota_aktif}`:''}</div>
                        )}
                        {(h.serah_admin_input||h.terima_admin_input)&&(
                          <div className="text-[10px] text-slate-400 mt-0.5">✍️ {[h.serah_admin_input,h.terima_admin_input].filter(Boolean).join(' · ')}</div>
                        )}
                        {fotos.length>0&&(
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {fotos.map((u:string,i:number)=>(
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer" title="Klik untuk perbesar">
                                <img src={u} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:scale-110 transition-transform"/>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}












