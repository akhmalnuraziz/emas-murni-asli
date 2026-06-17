'use client'

import { useState, useTransition } from 'react'
import { Users, Plus, Trash2, Edit2, X, Check, AlertTriangle, Sliders, UserPlus } from 'lucide-react'
import {
  createTim, updateTim, toggleTimAktif, deleteTim,
  addAnggota, deleteAnggota, updateToleransi,
} from '@/app/(dashboard)/pengaturan/actions'

const inp = 'w-full h-11 px-4 bg-gray-50 rounded-2xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200'
const WARNA = ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#6366F1']

export default function PengaturanClient({ tims, toleransi, userRole }: {
  tims: any[]; toleransi: Record<string, string>; userRole: string
}) {
  const [isPending, start] = useTransition()
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'tim' | 'toleransi'>('tim')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  return (
    <div className="space-y-5 max-w-3xl">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>{toast}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([['tim', 'Tim Produksi', Users], ['toleransi', 'Toleransi Loss', Sliders]] as const).map(([val, label, Icon]) => (
          <button key={val} onClick={() => setTab(val)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
            style={tab === val
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }
              : { background: 'rgba(255,255,255,0.8)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'tim'
        ? <TimSection tims={tims} isPending={isPending} start={start} showToast={showToast} />
        : <ToleransiSection toleransi={toleransi} isPending={isPending} start={start} showToast={showToast} />}
    </div>
  )
}

// ─── TIM SECTION ────────────────────────────────────────────────────────────
function TimSection({ tims, isPending, start, showToast }: any) {
  const [adding, setAdding] = useState(false)
  const [newNama, setNewNama] = useState('')
  const [newWarna, setNewWarna] = useState(WARNA[0])
  const [editId, setEditId] = useState<number | null>(null)

  function handleCreate() {
    if (!newNama.trim()) return
    const fd = new FormData(); fd.set('nama', newNama); fd.set('warna', newWarna)
    start(async () => {
      const r = await createTim(fd)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Tim ditambahkan'); setNewNama(''); setNewWarna(WARNA[0]); setAdding(false)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header + add */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Tim Produksi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kelola tim & anggota yang mengerjakan produksi</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}>
            <Plus size={15} /> Tambah Tim
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-3xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 8px 30px rgba(139,92,246,0.08)' }}>
          <input autoFocus value={newNama} onChange={e => setNewNama(e.target.value)} placeholder="Nama tim (cth: Tim A)" className={inp}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Warna:</span>
            {WARNA.map(w => (
              <button key={w} onClick={() => setNewWarna(w)} className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{ background: w, outline: newWarna === w ? '2px solid #1F2937' : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewNama('') }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">Batal</button>
            <button onClick={handleCreate} disabled={isPending || !newNama.trim()}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>Simpan</button>
          </div>
        </div>
      )}

      {/* Tim list */}
      {tims.length === 0 && !adding && (
        <div className="rounded-3xl py-16 text-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <Users size={28} className="mx-auto text-violet-200 mb-3" />
          <p className="text-sm text-gray-400">Belum ada tim. Tambahkan tim pertama.</p>
        </div>
      )}

      <div className="space-y-3">
        {tims.map((t: any) => (
          <TimCard key={t.id} tim={t} isPending={isPending} start={start} showToast={showToast}
            editing={editId === t.id} onEdit={() => setEditId(t.id)} onCancelEdit={() => setEditId(null)} />
        ))}
      </div>
    </div>
  )
}

function TimCard({ tim, isPending, start, showToast, editing, onEdit, onCancelEdit }: any) {
  const [nama, setNama] = useState(tim.nama)
  const [warna, setWarna] = useState(tim.warna || WARNA[0])
  const [newAnggota, setNewAnggota] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  function handleSave() {
    const fd = new FormData(); fd.set('nama', nama); fd.set('warna', warna)
    start(async () => {
      const r = await updateTim(tim.id, fd)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Tim diperbarui'); onCancelEdit()
    })
  }
  function handleDelete() {
    start(async () => {
      const r = await deleteTim(tim.id)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast(r.softDeleted ? '✅ Tim dinonaktifkan (sudah dipakai)' : '✅ Tim dihapus'); setConfirmDel(false)
    })
  }
  function handleAddAnggota() {
    if (!newAnggota.trim()) return
    start(async () => {
      const r = await addAnggota(tim.id, newAnggota)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Anggota ditambahkan'); setNewAnggota('')
    })
  }
  function handleDelAnggota(id: number) {
    start(async () => {
      const r = await deleteAnggota(id)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Anggota dihapus')
    })
  }

  return (
    <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(139,92,246,0.06)', opacity: tim.aktif ? 1 : 0.55 }}>
      {editing ? (
        <div className="space-y-3">
          <input value={nama} onChange={e => setNama(e.target.value)} className={inp} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Warna:</span>
            {WARNA.map(w => (
              <button key={w} onClick={() => setWarna(w)} className="w-6 h-6 rounded-full"
                style={{ background: w, outline: warna === w ? '2px solid #1F2937' : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelEdit} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">Batal</button>
            <button onClick={handleSave} disabled={isPending} className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>Simpan</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0"
              style={{ background: tim.warna || WARNA[0] }}>{tim.nama?.replace(/[^A-Za-z0-9]/g, '').slice(-2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">{tim.nama}{!tim.aktif && <span className="ml-2 text-[10px] text-gray-400 font-semibold">(nonaktif)</span>}</p>
              <p className="text-[11px] text-gray-400">{tim.anggota?.length ?? 0} anggota</p>
            </div>
            <button onClick={() => start(async () => { await toggleTimAktif(tim.id, !tim.aktif); showToast(tim.aktif ? 'Tim dinonaktifkan' : 'Tim diaktifkan') })}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border" style={{ color: tim.aktif ? '#22C55E' : '#9CA3AF', borderColor: tim.aktif ? 'rgba(34,197,94,0.25)' : 'rgba(156,163,175,0.25)' }}>
              {tim.aktif ? 'Aktif' : 'Nonaktif'}
            </button>
            <button onClick={onEdit} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:scale-105 transition-transform"><Edit2 size={13} /></button>
            <button onClick={() => setConfirmDel(true)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:scale-105 transition-transform"><Trash2 size={13} /></button>
          </div>

          {/* Anggota */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tim.anggota?.map((a: any) => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  {a.nama}
                  <button onClick={() => handleDelAnggota(a.id)} className="text-gray-400 hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
              {(!tim.anggota || tim.anggota.length === 0) && <span className="text-[11px] text-gray-300 italic">Belum ada anggota</span>}
            </div>
            <div className="flex gap-2">
              <input value={newAnggota} onChange={e => setNewAnggota(e.target.value)} placeholder="Nama anggota baru"
                onKeyDown={e => e.key === 'Enter' && handleAddAnggota()}
                className="flex-1 h-9 px-3 bg-gray-50 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200" />
              <button onClick={handleAddAnggota} disabled={isPending || !newAnggota.trim()}
                className="flex items-center gap-1 px-3 h-9 rounded-xl text-xs font-bold text-violet-600 disabled:opacity-50" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <UserPlus size={13} /> Tambah
              </button>
            </div>
          </div>

          {confirmDel && (
            <div className="mt-3 p-3 rounded-2xl flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 flex-1">Hapus tim <b>{tim.nama}</b>? Jika sudah dipakai produksi, tim hanya dinonaktifkan.</p>
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">Batal</button>
              <button onClick={handleDelete} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 disabled:opacity-50">Hapus</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── TOLERANSI SECTION ──────────────────────────────────────────────────────
function ToleransiSection({ toleransi, isPending, start, showToast }: any) {
  const [vals, setVals] = useState({
    toleransi_loss_peleburan: toleransi.toleransi_loss_peleburan ?? '0.05',
    toleransi_loss_cutting: toleransi.toleransi_loss_cutting ?? '0.05',
    toleransi_loss_pas_berat: toleransi.toleransi_loss_pas_berat ?? '0.05',
    toleransi_loss_annealing: toleransi.toleransi_loss_annealing ?? '0.05',
  })
  const set = (k: string, v: string) => setVals(p => ({ ...p, [k]: v }))

  function handleSave() {
    const fd = new FormData()
    Object.entries(vals).forEach(([k, v]) => fd.set(k, v))
    start(async () => {
      const r = await updateToleransi(fd)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Toleransi disimpan')
    })
  }

  const rows = [
    ['toleransi_loss_peleburan', 'Peleburan', '🔥'],
    ['toleransi_loss_cutting', 'Cutting', '✂️'],
    ['toleransi_loss_pas_berat', 'Pas Berat', '⚖️'],
    ['toleransi_loss_annealing', 'Annealing', '🌡️'],
  ] as const

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Toleransi Loss per Proses</h2>
        <p className="text-xs text-gray-400 mt-0.5">Batas loss yang diizinkan. Jika melebihi, sistem minta tanda tangan operator & admin.</p>
      </div>

      <div className="rounded-3xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(139,92,246,0.06)' }}>
        {rows.map(([key, label, icon]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-lg w-8 text-center">{icon}</span>
            <span className="flex-1 text-sm font-semibold text-gray-700">{label}</span>
            <div className="flex items-center gap-2">
              <input type="number" step="0.001" value={vals[key]} onChange={e => set(key, e.target.value)}
                className="w-28 h-10 px-3 bg-gray-50 rounded-xl text-sm text-gray-700 text-right focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200" />
              <span className="text-xs text-gray-400 font-medium w-6">gr</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}>
          {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <Check size={15} /> Simpan Toleransi
        </button>
      </div>
    </div>
  )
}

