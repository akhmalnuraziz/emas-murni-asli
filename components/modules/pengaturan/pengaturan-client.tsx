'use client'

import { useState, useTransition } from 'react'
import {
  Users, Plus, Trash2, Edit2, X, Check, AlertTriangle,
  Sliders, UserCheck, Settings2, UserPlus,
} from 'lucide-react'
import {
  createTim, updateTim, toggleTimAktif, deleteTim,
  addAnggota, deleteAnggota,
  createAdminInput, updateAdminInput, toggleAdminInputAktif, deleteAdminInput,
  updateToleransi, updateBiayaPackaging,
} from '@/app/(dashboard)/pengaturan/actions'

const inp = 'w-full h-11 px-4 bg-gray-50 rounded-2xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200'
const WARNA = ['#8B5CF6','#3B82F6','#22C55E','#F59E0B','#EF4444','#EC4899','#14B8A6','#6366F1']

export default function PengaturanClient({
  tims, pengaturan, userRole, adminInputList,
}: {
  tims: any[]
  pengaturan: Record<string, string>
  userRole: string
  adminInputList: { id: number; nama: string; aktif: boolean }[]
}) {
  const [isPending, start] = useTransition()
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'tim' | 'admin' | 'umum' | 'packaging'>('tim')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const canManage = ['owner','admin_pusat','spv'].includes(userRole)

  const TABS = [
    { id: 'tim'       as const, label: 'Master Tim',        icon: Users     },
    { id: 'admin'     as const, label: 'Master Admin Input', icon: UserCheck },
    { id: 'umum'      as const, label: 'Pengaturan Umum',    icon: Settings2 },
    { id: 'packaging' as const, label: 'Biaya Packaging',    icon: Sliders   },
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>{toast}</div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
            style={tab === id
              ? { background: 'linear-gradient(135deg,#7F6DC6,#6857B1)', color: '#fff', boxShadow: '0 4px 14px rgba(103,87,177,0.3)' }
              : { background: 'rgba(255,255,255,0.9)', color: '#6B7280', border: '1px solid rgba(209,213,219,0.5)' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'tim'       && <TimSection tims={tims} isPending={isPending} start={start} showToast={showToast} />}
      {tab === 'admin'     && <AdminInputSection list={adminInputList} isPending={isPending} start={start} showToast={showToast} canManage={canManage} />}
      {tab === 'umum'      && <PengaturanUmumSection pengaturan={pengaturan} isPending={isPending} start={start} showToast={showToast} canManage={canManage} />}
      {tab === 'packaging' && <BiayaPackagingSection pengaturan={pengaturan} isPending={isPending} start={start} showToast={showToast} canManage={canManage} />}
    </div>
  )
}

// ═══ TIM SECTION ════════════════════════════════════════════════════════════
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Master Tim Produksi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tim yang mengerjakan — dinilai bintang KPI. Berbeda dari Admin Input.</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)', boxShadow: '0 4px 14px rgba(103,87,177,0.3)' }}>
            <Plus size={15} /> Tambah Tim
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-3xl p-4 space-y-3 bg-white border border-violet-100 shadow-sm">
          <input autoFocus value={newNama} onChange={e => setNewNama(e.target.value)}
            placeholder="Nama tim (cth: Tim A)" className={inp}
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
              style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>Simpan</button>
          </div>
        </div>
      )}

      {tims.length === 0 && !adding && (
        <div className="rounded-3xl py-14 text-center bg-white border border-slate-100">
          <Users size={28} className="mx-auto text-slate-200 mb-3" />
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

  return (
    <div className="rounded-3xl p-4 bg-white border border-slate-100 shadow-sm" style={{ opacity: tim.aktif ? 1 : 0.6 }}>
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
            <button onClick={() => {
              const fd = new FormData(); fd.set('nama', nama); fd.set('warna', warna)
              start(async () => {
                const r = await updateTim(tim.id, fd)
                if (r?.error) { showToast('❌ ' + r.error); return }
                showToast('✅ Tim diperbarui'); onCancelEdit()
              })
            }} disabled={isPending}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>Simpan</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0"
              style={{ background: tim.warna || WARNA[0] }}>{tim.nama?.slice(-2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">{tim.nama}{!tim.aktif && <span className="ml-2 text-[10px] text-gray-400">(nonaktif)</span>}</p>
              <p className="text-[11px] text-gray-400">{tim.anggota?.length ?? 0} anggota</p>
            </div>
            <button
              onClick={() => start(async () => {
                await toggleTimAktif(tim.id, !tim.aktif)
                showToast(tim.aktif ? 'Tim dinonaktifkan' : 'Tim diaktifkan')
              })}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
              style={{ color: tim.aktif ? '#22C55E' : '#9CA3AF', borderColor: tim.aktif ? 'rgba(34,197,94,0.25)' : 'rgba(156,163,175,0.25)' }}>
              {tim.aktif ? 'Aktif' : 'Nonaktif'}
            </button>
            <button onClick={onEdit} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 size={13} /></button>
            <button onClick={() => setConfirmDel(true)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tim.anggota?.map((a: any) => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 bg-violet-50">
                  {a.nama}
                  <button onClick={() => start(async () => {
                    const r = await deleteAnggota(a.id)
                    if (r?.error) { showToast('❌ ' + r.error); return }
                    showToast('✅ Anggota dihapus')
                  })} className="text-gray-400 hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
              {(!tim.anggota || tim.anggota.length === 0) && <span className="text-[11px] text-gray-300 italic">Belum ada anggota</span>}
            </div>
            <div className="flex gap-2">
              <input value={newAnggota} onChange={e => setNewAnggota(e.target.value)}
                placeholder="Nama anggota baru"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    start(async () => {
                      const r = await addAnggota(tim.id, newAnggota.trim())
                      if (r?.error) { showToast('❌ ' + r.error); return }
                      showToast('✅ Anggota ditambahkan'); setNewAnggota('')
                    })
                  }
                }}
                className="flex-1 h-9 px-3 bg-gray-50 rounded-xl text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200" />
              <button
                onClick={() => {
                  if (!newAnggota.trim()) return
                  start(async () => {
                    const r = await addAnggota(tim.id, newAnggota.trim())
                    if (r?.error) { showToast('❌ ' + r.error); return }
                    showToast('✅ Anggota ditambahkan'); setNewAnggota('')
                  })
                }}
                disabled={isPending || !newAnggota.trim()}
                className="flex items-center gap-1 px-3 h-9 rounded-xl text-xs font-bold text-violet-600 bg-violet-50 disabled:opacity-50">
                <UserPlus size={13} /> Tambah
              </button>
            </div>
          </div>

          {confirmDel && (
            <div className="mt-3 p-3 rounded-2xl flex items-center gap-3 bg-red-50 border border-red-100">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 flex-1">Hapus tim <b>{tim.nama}</b>? Jika sudah dipakai, hanya dinonaktifkan.</p>
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-gray-600">Batal</button>
              <button
                onClick={() => start(async () => {
                  const r = await deleteTim(tim.id)
                  if (r?.error) { showToast('❌ ' + r.error); return }
                  showToast(r?.softDeleted ? '✅ Tim dinonaktifkan' : '✅ Tim dihapus')
                  setConfirmDel(false)
                })}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 disabled:opacity-50">Hapus</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══ MASTER ADMIN INPUT ════════════════════════════════════════════════════
function AdminInputSection({ list, isPending, start, showToast, canManage }: any) {
  const [newNama, setNewNama] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNama, setEditNama] = useState('')
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)

  function handleCreate() {
    if (!newNama.trim()) return
    start(async () => {
      const r = await createAdminInput(newNama.trim())
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Admin input ditambahkan'); setNewNama('')
    })
  }

  function handleUpdate(id: number) {
    if (!editNama.trim()) return
    start(async () => {
      const r = await updateAdminInput(id, editNama.trim())
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Diperbarui'); setEditId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Master Admin Yang Input</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Daftar admin yang bisa dipilih saat mencatat serah-terima. Berbeda dari Tim
          (tim = yang mengerjakan, admin = yang input ke sistem).
        </p>
      </div>

      {canManage && (
        <div className="flex gap-2">
          <input value={newNama} onChange={e => setNewNama(e.target.value)}
            placeholder="Nama admin baru (cth: Admin Pusat, Pak Budi)"
            className={inp + ' flex-1'}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} disabled={isPending || !newNama.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white flex-shrink-0 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>
            <Plus size={15} /> Tambah
          </button>
        </div>
      )}

      {list.length === 0 && (
        <div className="rounded-3xl py-14 text-center bg-white border border-slate-100">
          <UserCheck size={28} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-gray-400">Belum ada admin input. Tambahkan dulu.</p>
          <p className="text-xs text-gray-300 mt-1">Dipakai sebagai dropdown "Admin Yang Input" di form produksi, packing, dll.</p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm" style={{ opacity: a.aktif ? 1 : 0.55 }}>
            {editId === a.id ? (
              <>
                <input value={editNama} onChange={e => setEditNama(e.target.value)}
                  autoFocus
                  className="flex-1 h-9 px-3 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  onKeyDown={e => e.key === 'Enter' && handleUpdate(a.id)} />
                <button onClick={() => handleUpdate(a.id)} className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Check size={13} /></button>
                <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center"><X size={13} /></button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                  {a.nama?.charAt(0)?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-semibold text-gray-800">{a.nama}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: a.aktif ? '#16a34a' : '#9ca3af', background: a.aktif ? 'rgba(22,163,74,0.08)' : 'rgba(156,163,175,0.1)' }}>
                  {a.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => start(async () => {
                        await toggleAdminInputAktif(a.id, !a.aktif)
                        showToast(a.aktif ? 'Dinonaktifkan' : 'Diaktifkan')
                      })}
                      className="px-2 py-1 rounded-lg text-[10px] border text-gray-400 hover:text-gray-600 border-gray-200">
                      {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onClick={() => { setEditId(a.id); setEditNama(a.nama) }}
                      className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 size={13} /></button>
                    {confirmDelId === a.id ? (
                      <>
                        <button
                          onClick={() => start(async () => {
                            const r = await deleteAdminInput(a.id)
                            if (r?.error) { showToast('❌ ' + r.error); return }
                            showToast('✅ Dihapus'); setConfirmDelId(null)
                          })}
                          disabled={isPending}
                          className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-red-500 disabled:opacity-50">Hapus</button>
                        <button onClick={() => setConfirmDelId(null)} className="px-2 py-1 rounded-lg text-xs text-gray-500 bg-gray-100">Batal</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelId(a.id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center"><Trash2 size={13} /></button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══ PENGATURAN UMUM ════════════════════════════════════════════════════════
function PengaturanUmumSection({ pengaturan, isPending, start, showToast, canManage }: any) {
  const [vals, setVals] = useState({
    toleransi_loss_peleburan:    pengaturan.toleransi_loss_peleburan    ?? '0.05',
    toleransi_loss_cutting:      pengaturan.toleransi_loss_cutting      ?? '0.05',
    toleransi_loss_pas_berat:    pengaturan.toleransi_loss_pas_berat    ?? '0.05',
    toleransi_loss_annealing:    pengaturan.toleransi_loss_annealing    ?? '0.05',
    toleransi_loss_siap_packing: pengaturan.toleransi_loss_siap_packing ?? '0.05',
    ambang_gain_wajar:           pengaturan.ambang_gain_wajar           ?? '0.30',
    ambang_loss_kumulatif:       pengaturan.ambang_loss_kumulatif       ?? '0.15',
  })
  const set = (k: string, v: string) => setVals(p => ({ ...p, [k]: v }))

  function handleSave() {
    const fd = new FormData()
    Object.entries(vals).forEach(([k, v]) => fd.set(k, v))
    start(async () => {
      const r = await updateToleransi(fd)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Pengaturan disimpan')
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Toleransi Loss per Proses</h2>
          <p className="text-xs text-gray-400 mt-0.5">Batas loss yang diizinkan (gram). Jika melebihi, sistem minta tanda tangan.</p>
        </div>
        <div className="rounded-3xl p-4 space-y-3 bg-white border border-slate-100 shadow-sm">
          {([
            ['toleransi_loss_peleburan',    'Peleburan',    '🔥'],
            ['toleransi_loss_cutting',      'Cutting',      '✂️'],
            ['toleransi_loss_pas_berat',    'Pas Berat',    '⚖️'],
            ['toleransi_loss_annealing',    'Annealing',    '🌡️'],
            ['toleransi_loss_siap_packing', 'Siap Packing', '📦'],
          ] as const).map(([key, label, icon]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-lg w-8 text-center">{icon}</span>
              <span className="flex-1 text-sm font-semibold text-gray-700">{label}</span>
              <div className="flex items-center gap-2">
                <input type="number" step="0.001" disabled={!canManage}
                  value={vals[key]} onChange={e => set(key, e.target.value)}
                  className="w-28 h-10 px-3 bg-gray-50 rounded-xl text-sm text-gray-700 text-right border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
                <span className="text-xs text-gray-400 w-6">gr</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Ambang Batas Sistem</h2>
          <p className="text-xs text-gray-400 mt-0.5">Nilai batas untuk trigger notif dan penentuan gain wajar.</p>
        </div>
        <div className="rounded-3xl p-4 space-y-4 bg-white border border-slate-100 shadow-sm">
          {([
            ['ambang_gain_wajar',     'Gain Wajar (max tanpa persetujuan)', '✨', 'Gain di bawah ini dianggap wajar, tidak menurunkan KPI'],
            ['ambang_loss_kumulatif', 'Loss Kumulatif Waspada per Batch',   '⚠️', 'Jika total loss batch melebihi ini, sistem kirim notif'],
          ] as const).map(([key, label, icon, desc]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-lg w-8 text-center">{icon}</span>
                <span className="flex-1 text-sm font-semibold text-gray-700">{label}</span>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.001" disabled={!canManage}
                    value={vals[key]} onChange={e => set(key, e.target.value)}
                    className="w-28 h-10 px-3 bg-gray-50 rounded-xl text-sm text-gray-700 text-right border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
                  <span className="text-xs text-gray-400 w-6">gr</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 pl-12">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)', boxShadow: '0 4px 14px rgba(103,87,177,0.3)' }}>
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Check size={15} /> Simpan Pengaturan
          </button>
        </div>
      )}
    </div>
  )
}

// ═══ BIAYA PACKAGING SECTION ════════════════════════════════════════════════
const GRAMASI_LIST = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

function BiayaPackagingSection({ pengaturan, isPending, start, showToast, canManage }: any) {
  const init: Record<string, string> = {}
  for (const g of GRAMASI_LIST) {
    init[g] = pengaturan[`biaya_packaging_${g}`] ?? '10000'
  }
  const [vals, setVals] = useState<Record<string, string>>(init)
  const set = (g: string, v: string) => setVals(p => ({ ...p, [g]: v }))

  function handleSave() {
    start(async () => {
      const r = await updateBiayaPackaging(GRAMASI_LIST, vals)
      if (r?.error) { showToast('❌ ' + r.error); return }
      showToast('✅ Biaya packaging disimpan')
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Biaya Packaging per Gramasi</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Digunakan untuk menghitung HPP per pcs saat registrasi Shieldtag.<br/>
          <span className="font-semibold text-violet-600">HPP/pcs = (HPP/gr × gramasi) + biaya packaging</span>
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Gramasi</span>
          <span className="text-right col-span-2">Biaya Packaging / pcs (Rp)</span>
        </div>
        <div className="divide-y divide-slate-50">
          {GRAMASI_LIST.map(g => (
            <div key={g} className="px-5 py-3 flex items-center gap-3">
              <span className="flex-1 text-sm font-semibold text-slate-700">{g} gr</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Rp</span>
                <input
                  type="number" min="0" step="500"
                  disabled={!canManage}
                  value={vals[g]}
                  onChange={e => set(g, e.target.value)}
                  className="w-32 h-10 px-3 bg-gray-50 rounded-xl text-sm text-gray-700 text-right border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl p-4 bg-violet-50 border border-violet-100">
        <p className="text-xs text-violet-700 font-semibold mb-1">Contoh perhitungan HPP</p>
        <p className="text-xs text-violet-600">
          Batch HPP/gr: <span className="font-mono">Rp 950.000</span> · Gramasi: <span className="font-mono">1 gr</span> · Biaya packaging: <span className="font-mono">Rp {Number(vals['1'] || 10000).toLocaleString('id-ID')}</span><br/>
          <span className="font-bold">HPP/pcs = Rp 950.000 × 1 + Rp {Number(vals['1'] || 10000).toLocaleString('id-ID')} = Rp {(950000 + Number(vals['1'] || 10000)).toLocaleString('id-ID')}</span>
        </p>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)', boxShadow: '0 4px 14px rgba(103,87,177,0.3)' }}>
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Check size={15} /> Simpan Biaya Packaging
          </button>
        </div>
      )}
    </div>
  )
}
