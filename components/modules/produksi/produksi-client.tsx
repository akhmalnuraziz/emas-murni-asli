'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, Edit2, Trash2, Check, AlertTriangle,
  X, Camera, ChevronDown, ChevronUp, Package, Pencil, ZoomIn, Flame
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  createProduksi, updateStatusProduksi, editProduksi,
  inputReject, leburReject, batalLeburReject, deleteProduksi, editEvent, deleteEvent
} from '@/app/(dashboard)/produksi/actions'
import type { UserRole } from '@/lib/types/database'

interface Props { produksiList: any[]; batches: any[]; userRole: UserRole; userName: string }

function fgr(n: number | null | undefined, dec = 3): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return parseFloat(Number(n).toFixed(dec)).toLocaleString('id-ID', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  })
}

const GRAMASI_OPTIONS = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
const STATUS_FLOW     = ['Cutting','Pas Berat','Annealing','Siap Packing']
const STATUS_NEXT: Record<string,string> = {
  'Cutting':'Pas Berat','Pas Berat':'Annealing','Annealing':'Siap Packing',
}
const STATUS_CFG: Record<string,{dot:string;bg:string;text:string}> = {
  'Cutting':       {dot:'#3B82F6',bg:'rgba(59,130,246,0.10)',  text:'#2563EB'},
  'Pas Berat':     {dot:'#F97316',bg:'rgba(249,115,22,0.10)', text:'#EA580C'},
  'Annealing':     {dot:'#EAB308',bg:'rgba(234,179,8,0.10)',  text:'#CA8A04'},
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

// ─── Timeline Dots — smooth portal tooltip ────────────────────────────────────
function TLine({ events }: { events: any[] }) {
  const [hover, setHover]     = useState<{ ev: any; x: number; y: number; dot: string } | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sorted = [...events].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
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

// ─── Event History (read-only, edit via modal) ────────────────────────────────
function EventHistory({ events, fallbackPcs }: { events: any[]; fallbackPcs?: number }) {
  const sorted = [...events].sort((a,b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
  const [lightbox, setLightbox] = useState<string|null>(null)
  return (
    <div className="space-y-1">
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {sorted.map((ev, i) => {
        const cfg   = STATUS_CFG[ev.status] ?? { dot: '#94A3B8' }
        const fotos:string[]  = Array.isArray(ev.fotos) ? ev.fotos : []
        const serbuk:string[] = Array.isArray(ev.fotos_sisa_serbuk) ? ev.fotos_sisa_serbuk : []
        // Losses atau Lebih (timbangan naik = lebih)
        const rawDiff = (ev.berat_sebelumnya ?? 0) - (ev.total_gram ?? 0) - (ev.sisa_serbuk ?? 0)
        const isLebih = ev.status !== 'Reject' && rawDiff < -0.001
        const diffVal = Math.abs(rawDiff)
        return (
          <div key={ev.id ?? i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
              {i < sorted.length - 1 && <div className="w-px flex-1 mt-1 opacity-20" style={{ background: cfg.dot }} />}
            </div>
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Sbadge s={ev.status} />
                <span className="text-xs text-gray-400">{formatDate(ev.tanggal)}</span>
                {ev.status !== 'Reject'
                  ? <span className="text-xs font-semibold text-gray-700">{ev.total_gram} gr</span>
                  : <span className="text-xs font-semibold text-red-500">−{fgr((ev.berat_sebelumnya ?? 0) - (ev.total_gram ?? 0))} gr</span>
                }
                {(()=>{
                  if (ev.status === 'Reject') {
                    const r = ev.pcs_reject_snapshot
                    return r != null ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md text-red-600 bg-red-50">−{r} pcs</span> : null
                  }
                  const pcs = ev.pcs_good_snapshot ?? fallbackPcs
                  return pcs != null ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md text-gray-500 bg-gray-100">{pcs} pcs</span> : null
                })()}
                {Number(ev.sisa_serbuk) > 0 && <span className="text-xs text-violet-500">serbuk {ev.sisa_serbuk} gr</span>}
                {ev.status !== 'Reject' && diffVal > 0.001 && (
                  isLebih
                    ? <span className="text-xs font-semibold text-emerald-600">lebih +{fgr(diffVal)} gr</span>
                    : <span className="text-xs text-orange-500">losses {fgr(diffVal)} gr</span>
                )}
              </div>
              {ev.catatan && <p className="text-xs text-gray-400 mt-0.5 italic">{ev.catatan}</p>}
              {(fotos.length > 0 || serbuk.length > 0) && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {fotos.map((u:string, fi:number) => (
                    <img key={fi} src={u} onClick={() => setLightbox(u)}
                      className="w-10 h-10 rounded-xl object-cover cursor-pointer border border-gray-100 hover:scale-110 transition-transform" />
                  ))}
                  {serbuk.map((u:string, fi:number) => (
                    <div key={'s'+fi} className="relative">
                      <img src={u} onClick={() => setLightbox(u)}
                        className="w-10 h-10 rounded-xl object-cover cursor-pointer border-2 border-violet-300 hover:scale-110 transition-transform" />
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
  const [f, setF] = useState({ batch_kode: batches[0]?.kode ?? '', gramasi: '1', pcs: '', berat_awal: '', nama_item: '', status_awal: 'Cutting', tanggal_produksi: today, operator: '' })
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
        <form onSubmit={submit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[72vh]">
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
            <F label="Jumlah PCS" req><input name="pcs" type="number" min="1" value={f.pcs} onChange={e => s('pcs', e.target.value)} placeholder="50" className={inp} required /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Total Berat (gram)" req><input name="berat_awal" type="number" step="0.01" value={f.berat_awal} onChange={e => s('berat_awal', e.target.value)} placeholder="500.15" className={inp} required /></F>
            <F label="Status Awal" req>
              <select name="status_awal" value={f.status_awal} onChange={e => s('status_awal', e.target.value)} className={inp} required>
                {STATUS_FLOW.slice(0, 3).map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tanggal Produksi" req><input name="tanggal_produksi" type="date" value={f.tanggal_produksi} onChange={e => s('tanggal_produksi', e.target.value)} className={inp} required /></F>
            <F label="Operator / PIC"><input name="operator" value={f.operator} onChange={e => s('operator', e.target.value)} placeholder="Nama operator" className={inp} /></F>
          </div>
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

// ─── Edit Modal — Riwayat Proses langsung, 1 tombol edit ─────────────────────
function EditModal({ item, onClose, onSubmit, isPending, error }: {
  item: any; onClose: () => void; onSubmit: (fd: FormData) => void; isPending: boolean; error: string
}) {
  const evs = Array.isArray(item.produksi_event)
    ? [...item.produksi_event].filter((e:any)=>!e.voided_at)
        .sort((a:any,b:any)=>new Date(a.tanggal).getTime()-new Date(b.tanggal).getTime())
    : []
  const latestEvId  = evs.length > 0 ? evs[evs.length-1].id : null
  const [evEditId,  setEvEditId]  = useState<number|null>(null)
  const [evDraft,   setEvDraft]   = useState<Record<string,any>>({})
  const [evDelConf, setEvDelConf] = useState<number|null>(null)
  const [evPend,    startEvPend]  = useTransition()
  const [evMsg,     setEvMsg]     = useState<{text:string;ok:boolean}|null>(null)
  const [newFotos,  setNewFotos]  = useState<File[]>([])
  const [lightbox,  setLightbox]  = useState<string|null>(null)
  const [operator,  setOperator]  = useState(item.operator ?? '')
  const [gramasi,   setGramasi]   = useState(item.gramasi ?? '')

  function openEvEdit(ev:any){
    setEvEditId(ev.id); setNewFotos([])
    setEvDraft({
      total_gram:        ev.total_gram,
      pcs_good_snapshot: ev.pcs_good_snapshot ?? item.pcs_good ?? item.pcs ?? '',
      sisa_serbuk:       ev.sisa_serbuk ?? 0,
      catatan:           ev.catatan ?? '',
      tanggal:           ev.tanggal,
      existing_fotos:    Array.isArray(ev.fotos) ? ev.fotos : [],
    })
  }

  function saveEv(evId:number){
    startEvPend(async()=>{
      const b64s = newFotos.length > 0 ? await filesToBase64(newFotos) : []
      const fd=new FormData()
      fd.set('total_gram',        String(evDraft.total_gram))
      fd.set('pcs_good_snapshot', String(evDraft.pcs_good_snapshot ?? ''))
      fd.set('sisa_serbuk',       String(evDraft.sisa_serbuk ?? 0))
      fd.set('catatan',           evDraft.catatan ?? '')
      fd.set('tanggal',           evDraft.tanggal)
      fd.set('existing_fotos',    JSON.stringify(evDraft.existing_fotos ?? []))
      fd.set('new_fotos_b64',     JSON.stringify(b64s))
      const r=await editEvent(evId, item.id, item.kode, fd)
      if(r?.error){setEvMsg({text:r.error,ok:false});return}
      setEvMsg({text:'✅ Disimpan',ok:true}); setEvEditId(null); setNewFotos([])
      setTimeout(()=>setEvMsg(null),3000)
    })
  }

  function saveBase(){
    startEvPend(async()=>{
      const fd=new FormData()
      fd.set('gramasi',gramasi); fd.set('operator',operator)
      fd.set('pcs',String(item.pcs??'')); fd.set('berat_awal',String(item.berat_awal??item.total_gram??''))
      fd.set('tanggal_produksi',item.tanggal_produksi??item.tanggal??today)
      fd.set('catatan',item.catatan??''); fd.set('nama_item',item.nama_item??'')
      onSubmit(fd)
    })
  }

  function delEv(evId:number){
    startEvPend(async()=>{
      const r=await deleteEvent(evId, item.id, item.kode)
      if(r?.error){setEvMsg({text:r.error,ok:false});return}
      setEvMsg({text:'🗑️ Event dihapus',ok:true}); setEvDelConf(null)
      setTimeout(()=>setEvMsg(null),3000)
    })
  }

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)'}}>
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{background:'rgba(255,255,255,0.97)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 32px 64px rgba(139,92,246,0.2)'}}>

        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Produksi</h2>
            <p className="text-xs text-violet-500 font-medium">{item.kode} — {item.nama_item||item.gramasi}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 flex-shrink-0"><X size={14}/></button>
        </div>

        {/* Gramasi + Operator */}
        <div className="px-5 py-3 flex gap-2 items-end border-b border-gray-100" style={{background:'rgba(139,92,246,0.03)'}}>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Gramasi</p>
            <select value={gramasi} onChange={e=>setGramasi(e.target.value)}
              className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30">
              {GRAMASI_OPTIONS.map(g=><option key={g} value={g}>{g} Gram</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Operator</p>
            <input value={operator} onChange={e=>setOperator(e.target.value)} placeholder="Nama operator"
              className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"/>
          </div>
          <button onClick={saveBase} disabled={isPending||evPend}
            className="px-3 py-1.5 text-[10px] font-bold text-white rounded-xl disabled:opacity-50 whitespace-nowrap"
            style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
            {isPending?'...':'Simpan'}
          </button>
        </div>

        {/* Event list */}
        <div className="px-5 py-3 overflow-y-auto max-h-[60vh] space-y-2">
          {evMsg&&<div className={`px-3 py-2 rounded-xl text-xs font-semibold ${evMsg.ok?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{evMsg.text}</div>}
          {evs.length===0
            ?<p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat proses</p>
            :evs.map((ev:any)=>{
              const cfg=STATUS_CFG[ev.status]??{dot:'#94A3B8'}
              const isLast=ev.id===latestEvId
              const isEditing=evEditId===ev.id
              const hasSerbuk=ev.status==='Pas Berat'||ev.status==='Annealing'
              const evFotos:string[]=Array.isArray(ev.fotos)?ev.fotos:[]
              return(
                <div key={ev.id} className="rounded-2xl border overflow-hidden" style={{borderColor:'rgba(0,0,0,0.07)'}}>
                  <div className="flex items-center justify-between px-3 py-2.5"
                    style={{background:isEditing?'rgba(139,92,246,0.05)':'rgba(0,0,0,0.02)'}}>
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:cfg.dot}}/>
                      <Sbadge s={ev.status}/>
                      <span className="text-[11px] text-gray-400">{formatDate(ev.tanggal)}</span>
                      <span className="text-xs font-bold text-gray-700">
                        {ev.status==='Reject'?`−${fgr((ev.berat_sebelumnya??0)-(ev.total_gram??0))}gr`:`${ev.total_gram}gr`}
                      </span>
                      {ev.pcs_good_snapshot!=null&&(
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          {ev.status==='Reject'?`−${ev.pcs_reject_snapshot??'?'}pcs`:`${ev.pcs_good_snapshot}pcs`}
                        </span>
                      )}
                      {evFotos.length>0&&<span className="text-[10px] text-gray-300 ml-0.5">📷{evFotos.length}</span>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {ev.status!=='Reject'&&!isEditing&&(
                        <button onClick={()=>openEvEdit(ev)} disabled={evPend}
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                          <Pencil size={12}/>
                        </button>
                      )}
                      {isLast&&!isEditing&&(
                        evDelConf===ev.id?(
                          <div className="flex gap-1">
                            <button onClick={()=>delEv(ev.id)} disabled={evPend}
                              className="px-2 h-7 text-[10px] font-bold rounded-xl bg-red-500 text-white disabled:opacity-50">{evPend?'...':'Hapus'}</button>
                            <button onClick={()=>setEvDelConf(null)} className="px-2 h-7 text-[10px] font-semibold rounded-xl bg-gray-100 text-gray-600">Batal</button>
                          </div>
                        ):(
                          <button onClick={()=>setEvDelConf(ev.id)} disabled={evPend}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={12}/>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {isEditing&&(
                    <div className="px-3 pb-3 pt-2 space-y-2.5" style={{background:'rgba(139,92,246,0.02)'}}>
                      <div className={`grid gap-2 ${hasSerbuk?'grid-cols-3':'grid-cols-2'}`}>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Berat (gr)</p>
                          <input type="number" step="0.001" value={evDraft.total_gram}
                            onChange={e=>setEvDraft(d=>({...d,total_gram:e.target.value}))}
                            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"/>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">PCS Good</p>
                          <input type="number" min="1" value={evDraft.pcs_good_snapshot}
                            onChange={e=>setEvDraft(d=>({...d,pcs_good_snapshot:e.target.value}))}
                            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"/>
                        </div>
                        {hasSerbuk&&(
                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Serbuk (gr)</p>
                            <input type="number" step="0.001" value={evDraft.sisa_serbuk}
                              onChange={e=>setEvDraft(d=>({...d,sisa_serbuk:e.target.value}))}
                              className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"/>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Tanggal</p>
                          <input type="date" value={evDraft.tanggal}
                            onChange={e=>setEvDraft(d=>({...d,tanggal:e.target.value}))}
                            className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"/>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Catatan</p>
                          <input type="text" value={evDraft.catatan} onChange={e=>setEvDraft(d=>({...d,catatan:e.target.value}))}
                            placeholder="Opsional…"
                            className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400/40 bg-white"/>
                        </div>
                      </div>
                      {/* Foto */}
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Foto ({(evDraft.existing_fotos??[]).length+newFotos.length}/10)</p>
                        <div className="flex flex-wrap gap-2">
                          {(evDraft.existing_fotos??[]).map((url:string,fi:number)=>(
                            <div key={fi} className="relative">
                              <img src={url} onClick={()=>setLightbox(url)}
                                className="w-12 h-12 rounded-xl object-cover cursor-pointer border border-gray-100 hover:scale-105 transition-transform"/>
                              <button onClick={()=>setEvDraft(d=>({...d,existing_fotos:d.existing_fotos.filter((_:any,i:number)=>i!==fi)}))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                            </div>
                          ))}
                          {newFotos.map((f,fi)=>(
                            <div key={`n${fi}`} className="relative">
                              <img src={URL.createObjectURL(f)} className="w-12 h-12 rounded-xl object-cover border-2 border-violet-300"/>
                              <button onClick={()=>setNewFotos(p=>p.filter((_,i)=>i!==fi))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center">×</button>
                            </div>
                          ))}
                          {(evDraft.existing_fotos??[]).length+newFotos.length<10&&(
                            <label className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                              <Camera size={16} className="text-gray-400"/>
                              <input type="file" accept="image/*" multiple className="hidden"
                                onChange={e=>{
                                  const files=Array.from(e.target.files??[])
                                  const rem=10-((evDraft.existing_fotos??[]).length+newFotos.length)
                                  setNewFotos(p=>[...p,...files.slice(0,rem)])
                                  e.target.value=''
                                }}/>
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-0.5">
                        <button onClick={()=>saveEv(ev.id)} disabled={evPend}
                          className="flex-1 py-2 text-xs font-bold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
                          style={{background:'linear-gradient(135deg,#8B5CF6,#7C3AED)'}}>
                          {evPend&&<span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                          {evPend?'Menyimpan...':'Simpan'}
                        </button>
                        <button onClick={()=>setEvEditId(null)}
                          className="px-4 py-2 text-xs font-semibold bg-gray-100 text-gray-600 rounded-xl">Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          {error&&<div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 mt-2"><AlertTriangle size={12}/>{error}</div>}
          <p className="text-[10px] text-gray-300 text-center py-1">Hanya event terakhir yang bisa dihapus • Reject tidak bisa diedit</p>
        </div>
      </div>
    </div>
  )
}

function DelModal({ item, onClose, onConfirm, isPending }: { item: any; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(24px)', boxShadow: '0 32px 64px rgba(239,68,68,0.15)' }}>
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
        <h2 className="text-lg font-bold text-gray-900">Hapus Batch Produksi?</h2>
        <p className="text-sm text-gray-500 mt-2 mb-6"><span className="font-semibold text-gray-700">{item.kode}</span> akan dihapus permanen.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 rounded-2xl hover:bg-gray-200">Batal</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
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
    <div className="rounded-2xl px-3 py-2" style={{ background: style.bg }}>
      <p className="text-[9.5px] font-bold tracking-widest uppercase mb-0.5" style={{ color: style.text, opacity: 0.7 }}>{label}</p>
      <div className="text-[13px] font-bold leading-tight" style={{ color: style.text }}>{value}</div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ProduksiClient({ produksiList, batches, userRole, userName }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search,    setSearch]       = useState('')
  const [tab,       setTab]          = useState('Semua')
  const [exp,       setExp]          = useState<number | null>(null)
  const [modal,     setModal]        = useState<'create'|'edit'|'update'|'delete'|null>(null)
  const [active,    setActive]       = useState<any | null>(null)
  const [err,       setErr]          = useState('')
  const [toast,     setToast]        = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }
  const canEdit   = ['owner','admin_pusat','spv','operator_produksi'].includes(userRole)
  const canDelete = ['owner','admin_pusat'].includes(userRole)

  const filtered = produksiList.filter(item => {
    if (tab !== 'Semua' && item.current_status !== tab) return false
    const q = search.toLowerCase()
    return !q || item.kode?.toLowerCase().includes(q) || item.batch_kode?.toLowerCase().includes(q) || item.gramasi?.includes(q) || item.nama_item?.toLowerCase().includes(q)
  })
  const counts = produksiList.reduce((a, i) => { a[i.current_status] = (a[i.current_status] ?? 0) + 1; return a }, {} as Record<string,number>)
  const tabs = ['Semua', ...STATUS_FLOW, 'Sudah Packing', 'Reject']

  function openModal(type: 'create'|'edit'|'update'|'delete', item?: any) { setActive(item ?? null); setErr(''); setModal(type) }
  function handleCreate(fd: FormData) { setErr(''); startTransition(async () => { const r = await createProduksi(fd); if (r?.error) { setErr(r.error); return }; showToast(`✅ ${r?.kode} berhasil dibuat`); setModal(null) }) }
  function handleEdit(fd: FormData)   { if (!active) return; setErr(''); startTransition(async () => { const r = await editProduksi(active.id, active.kode, fd); if (r?.error) { setErr(r.error); return }; showToast('✅ Data diperbarui'); setModal(null) }) }
  const [confirmLosses, setConfirmLosses] = useState<{lossesPercent:number;totalLosses:number;beratAwal:number;pendingFd:FormData}|null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  function handleUpdate(fd: FormData) {
    if (!active) return; setErr('')
    const isReject = fd.get('is_reject') === '1'
    startTransition(async () => {
      const r = isReject ? await inputReject(active.id, active.kode, fd) : await updateStatusProduksi(active.id, active.kode, fd)
      if ((r as any)?.requiresConfirmation) {
        setConfirmLosses({lossesPercent:(r as any).lossesPercent,totalLosses:(r as any).totalLosses,beratAwal:(r as any).beratAwal,pendingFd:fd})
        setOverrideReason(''); return
      }
      if (r?.error) { setErr(r.error); return }
      showToast(isReject ? '✅ Reject dicatat' : '✅ Status diperbarui'); setModal(null)
    })
  }

  function handleConfirmLosses() {
    if (!active || !confirmLosses) return
    const fd = confirmLosses.pendingFd
    fd.set('override_reason', overrideReason.trim() || 'Dikonfirmasi')
    startTransition(async () => {
      const r = await updateStatusProduksi(active.id, active.kode, fd)
      if (r?.error) { showToast(r.error, false); return }
      showToast('✅ Status diupdate — override losses dikonfirmasi & dicatat')
      setConfirmLosses(null); setOverrideReason(''); setModal(null)
    })
  }
  function handleDelete() { if (!active) return; startTransition(async () => { const r = await deleteProduksi(active.id, active.kode); if (r?.error) { showToast(r.error, false); return }; showToast('🗑️ Batch dihapus'); setModal(null) }) }

  function handleLebur(item: any) {
    startTransition(async () => {
      const r = await leburReject(item.id, item.kode, item.batch_kode)
      if (r?.error) { showToast(r.error, false); return }
      const berat = (r as any)?.berat_kembali ?? item.berat_reject ?? 0
      showToast(`🔥 ${berat}gr reject dilebur — kembali ke pool batch ${item.batch_kode}`)
    })
  }

  function handleBatalLebur(item: any) {
    startTransition(async () => {
      const r = await batalLeburReject(item.id, item.kode, item.batch_kode)
      if (r?.error) { showToast(r.error, false); return }
      showToast(`↩ Lebur dibatalkan — ${item.berat_reject ?? 0}gr dikembalikan ke status belum dilebur`)
    })
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(160deg,#F2F2F7 0%,#EBEBF0 50%,#F2F2F7 100%)' }}>

      {/* Toast */}
      {toast && (
        <div className={cn('fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl', toast.ok ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600')}>
          {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}{toast.msg}
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900" style={{ fontFamily: "'SF Pro Display','Inter',sans-serif" }}>Produksi</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">{produksiList.length} batch aktif</p>
          </div>
          {canEdit && (
            <button onClick={() => openModal('create')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.38)' }}>
              <Plus size={15} /> Cetak Baru
            </button>
          )}
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode batch, gramasi, nama…"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.07)' }} />
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => {
            const isAct = tab === t; const cfg = STATUS_CFG[t]; const cnt = t === 'Semua' ? produksiList.length : (counts[t] ?? 0)
            return (
              <button key={t} onClick={() => setTab(t)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={isAct
                  ? { background: cfg?.dot ?? 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: `0 4px 12px ${cfg?.dot ?? '#8B5CF6'}40` }
                  : { background: 'rgba(255,255,255,0.85)', color: '#6B7280', border: '1px solid rgba(0,0,0,0.07)' }}>
                {t}{cnt > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(107,114,128,0.12)' }}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Cards ── */}
        {filtered.length === 0 ? (
          <div className="rounded-3xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(139,92,246,0.07)' }}>
              <Package size={28} className="text-violet-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">Tidak ada batch produksi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const events     = Array.isArray(item.produksi_event) ? item.produksi_event : []
              const packings   = Array.isArray(item.packing) ? (item.packing as any[]).filter((p: any) => !p.voided_at) : []
              const lastEv     = events.length > 0 ? [...events].sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())[0] : null
              const isExp      = exp === item.id
              const pcsGood    = item.pcs_good ?? item.pcs ?? 0
              const totalPacked = packings.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
              const totalST    = packings.reduce((s: number, p: any) => s + (p.shieldtag_count || 0), 0)
              const totalSerbuk = events.reduce((s: number, ev: any) => s + (Number(ev.sisa_serbuk) || 0), 0)
              const totalLoses  = events.reduce((s: number, ev: any) => ev.status === 'Reject' ? s : s + (Number(ev.losses) || 0), 0)  // reject ≠ losses

              // Bahan baku data
              const b          = item.batch ? (Array.isArray(item.batch) ? item.batch[0] : item.batch) : null
              const bahanAwal  = b ? Number(b.timbangan_akhir || 0) : 0
              const sisaS        = b ? Number(b.sisa_bahan_seharusnya || 0) : 0
              const terpakai     = bahanAwal - sisaS
              const sisaF        = b && b.sisa_fisik !== null && b.sisa_fisik !== undefined ? Number(b.sisa_fisik) : null
              const totalDilebur = b ? Number(b.total_berat_dilebur || 0) : 0
              // losesBahan: (sisa seharusnya + reject yg sudah dilebur) vs sisa fisik actual
              const losesBahan   = sisaF !== null ? (sisaS + totalDilebur) - sisaF : null

              return (
                <div key={item.id} className="rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                  style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', backdropFilter: 'blur(20px)' }}>

                  {/* ── Card Header ── */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Sbadge s={item.current_status} />
                          {item.operator && (
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              👤 {item.operator}
                            </span>
                          )}
                          {item.status_reject === 'belum_dilebur' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                              style={{background:'rgba(239,68,68,0.1)',color:'#DC2626'}}>
                              🔥 Reject Belum Dilebur
                            </span>
                          )}
                          {item.status_reject === 'sudah_dilebur' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{background:'rgba(34,197,94,0.1)',color:'#16A34A'}}>
                              ✓ Reject Sudah Dilebur
                            </span>
                          )}
                          {item.status_reject === 'sudah_dilebur' && ['owner','admin_pusat','spv'].includes(userRole) && (
                            <button onClick={() => handleBatalLebur(item)} disabled={isPending}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all hover:bg-gray-50 disabled:opacity-40"
                              style={{borderColor:'rgba(107,114,128,0.3)',color:'#6B7280'}}
                              title="Batalkan lebur — kembalikan ke status belum dilebur">
                              ↩ Batal Lebur
                            </button>
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold text-gray-900 leading-snug break-words">{item.nama_item || item.kode}</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{item.kode} · {item.batch_kode}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                        {canEdit && item.current_status !== 'Sudah Packing' && (
                          <button onClick={() => openModal('update', item)}
                            className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all hover:scale-105"
                            style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>
                            <Plus size={11} /> Update
                          </button>
                        )}
                        {item.status_reject === 'belum_dilebur' && ['owner','admin_pusat','spv'].includes(userRole) && (
                          <button onClick={() => handleLebur(item)} disabled={isPending}
                            className="h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all hover:scale-105 disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}
                            title={`Lebur ${item.berat_reject ?? 0}gr → kembali ke sisa fisik batch`}>
                            <Flame size={11} /> Lebur
                          </button>
                        )}
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
                                                <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Sisa Fisik</p>
                          <p className="text-[12px] font-bold text-gray-700 mt-0.5">
                            {sisaF !== null ? `${fgr(sisaF)} gr` : <span className="text-[10px] text-gray-300 italic">— input di Bahan Baku</span>}
                          </p>
                          {totalDilebur > 0 && (
                            <p className="text-[9px] text-emerald-600 font-semibold mt-0.5" title="Hasil lebur reject sudah kembali ke pool bahan">
                              +{fgr(totalDilebur)} gr dilebur
                            </p>
                          )}
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
                    <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: 'rgba(139,92,246,0.08)', background: 'rgba(139,92,246,0.015)' }}>
                      <p className="text-[9.5px] font-bold text-gray-400 tracking-widest uppercase mb-3">Riwayat Proses</p>
                      {events.length === 0
                        ? <p className="text-xs text-gray-400 italic">Belum ada event tercatat</p>
                        : <EventHistory events={events} fallbackPcs={item.pcs_good ?? item.pcs} />
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === 'create' && batches.length > 0 && <CreateModal batches={batches} onClose={() => setModal(null)} onSubmit={handleCreate} isPending={isPending} error={err} />}
      {modal === 'edit'   && active           && <EditModal   item={active}      onClose={() => setModal(null)} onSubmit={handleEdit}   isPending={isPending} error={err} />}
      {modal === 'update' && active           && <UpdateModal item={active}      onClose={() => setModal(null)} onSubmit={handleUpdate} isPending={isPending} error={err} />}
      {modal === 'delete' && active           && <DelModal    item={active}      onClose={() => setModal(null)} onConfirm={handleDelete} isPending={isPending} />}

      {/* ─── 3% Losses Confirmation Overlay ─── */}
      {confirmLosses && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.55)'}}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3" style={{background:'rgba(239,68,68,0.05)'}}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{background:'rgba(239,68,68,0.1)'}}>
                  <AlertTriangle size={18} className="text-red-500"/>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-600">Losses &gt; 3% Bahan Awal</p>
                  <p className="text-[11px] text-gray-400">Butuh konfirmasi Owner / Manager</p>
                </div>
              </div>
              <div className="rounded-2xl p-3 text-xs space-y-1.5 bg-white border border-red-100">
                <div className="flex justify-between"><span className="text-gray-500">Total losses</span><span className="font-bold text-red-600">{confirmLosses.totalLosses} gr</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bahan awal</span><span className="font-semibold">{confirmLosses.beratAwal} gr</span></div>
                <div className="flex justify-between pt-1 border-t"><span className="font-bold text-gray-600">Persentase losses</span><span className="font-bold text-red-600 text-sm">{confirmLosses.lossesPercent}%</span></div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Alasan Konfirmasi <span className="text-red-500">*</span></p>
                <textarea value={overrideReason} onChange={e=>setOverrideReason(e.target.value)}
                  placeholder="Contoh: Losses tinggi karena bahan kadar rendah — sudah dicek supervisor..."
                  rows={3} className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"/>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{setConfirmLosses(null);setOverrideReason('')}} className="flex-1 py-2 text-xs font-semibold bg-gray-100 text-gray-600 rounded-2xl">Batalkan</button>
                <button onClick={handleConfirmLosses} disabled={!overrideReason.trim()||isPending}
                  className="flex-1 py-2 text-xs font-bold text-white rounded-2xl disabled:opacity-40"
                  style={{background:'linear-gradient(135deg,#DC2626,#B91C1C)'}}>
                  {isPending?'Menyimpan...':'Konfirmasi & Simpan'}
                </button>
              </div>
              <p className="text-[9px] text-center text-gray-400">Override dicatat di audit log beserta nama konfirmator</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}













