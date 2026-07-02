'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Users, Plus, Trash2, Edit2, X, Check, AlertTriangle,
  Sliders, UserCheck, Settings2, UserPlus, Building2, Scale, Sparkles, LucideIcon,
  Flame, Scissors, Thermometer, Package,
} from 'lucide-react'
import {
  createTim, updateTim, toggleTimAktif, deleteTim,
  addAnggota, deleteAnggota,
  createAdminInput, updateAdminInput, toggleAdminInputAktif, deleteAdminInput,
  updateToleransi, updateBiayaPackaging, updateTargetProduksi, updateKpiTargetTim,
  createGramasi, updateGramasi, toggleGramasiAktif, deleteGramasi,
  updateSafetyStockGlobal,
} from '@/app/(dashboard)/pengaturan/actions'
import { CabangSection, UsersSection } from './cabang-users-sections'

const inp = 'w-full h-11 px-4 bg-slate-50 rounded-xl text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-slate-200'
const WARNA = ['#8B5CF6','#3B82F6','#22C55E','#F59E0B','#EF4444','#EC4899','#14B8A6','#6366F1']

export default function PengaturanClient({
  tims, pengaturan, userRole, adminInputList, cabangList, userList, currentUserId,
  gramasiList,
}: {
  tims: any[]
  pengaturan: Record<string, string>
  userRole: string
  adminInputList: { id: number; nama: string; aktif: boolean }[]
  cabangList: any[]
  userList: any[]
  currentUserId: string
  gramasiList: any[]
}) {
  const [isPending, start] = useTransition()
  const [tab, setTab] = useState<'tim' | 'admin' | 'umum' | 'cabang' | 'users' | 'gramasi'>('tim')
  const canManage = userRole === 'owner'
  const isOwnerAdmin = userRole === 'owner'

  const TABS = [
    { id: 'tim'       as const, label: 'Master Tim',        icon: Users     },
    { id: 'admin'     as const, label: 'Master Admin Input', icon: UserCheck },
    { id: 'gramasi'   as const, label: 'Master Gramasi',     icon: Scale     },
    { id: 'cabang'    as const, label: 'Cabang',             icon: Building2 },
    { id: 'users'     as const, label: 'Manajemen User',     icon: UserPlus  },
    { id: 'umum'      as const, label: 'Pengaturan Umum',    icon: Settings2 },
    // { id: 'packaging' as const, label: 'Biaya Packaging', icon: Sliders }, // nonaktif — penjualan pakai Accurate
  ]

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${tab === id ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-white/90 text-slate-500 border border-slate-200'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'tim'       && <TimSection tims={tims} isPending={isPending} start={start} />}
      {tab === 'admin'     && <AdminInputSection list={adminInputList} isPending={isPending} start={start} canManage={canManage} />}
      {tab === 'cabang'    && <CabangSection list={cabangList} canManage={isOwnerAdmin} />}
      {tab === 'users'     && <UsersSection list={userList} currentUserId={currentUserId} canManage={isOwnerAdmin} />}
      {tab === 'gramasi'   && <MasterGramasiSection list={gramasiList} isPending={isPending} start={start} canManage={canManage} />}
      {tab === 'umum'      && <PengaturanUmumSection pengaturan={pengaturan} tims={tims} isPending={isPending} start={start} canManage={canManage} />}
    </div>
  )
}

// ═══ TIM SECTION ════════════════════════════════════════════════════════════
function TimSection({ tims, isPending, start }: any) {
  const [adding, setAdding] = useState(false)
  const [newNama, setNewNama] = useState('')
  const [newWarna, setNewWarna] = useState(WARNA[0])
  const [editId, setEditId] = useState<number | null>(null)

  function handleCreate() {
    if (!newNama.trim()) return
    const fd = new FormData(); fd.set('nama', newNama); fd.set('warna', newWarna)
    start(async () => {
      const r = await createTim(fd)
      if (r?.error) { toast.error(r.error); return }
      toast.success('Tim ditambahkan'); setNewNama(''); setNewWarna(WARNA[0]); setAdding(false)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Master Tim Produksi</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Tim yang mengerjakan — dinilai bintang KPI. Berbeda dari Admin Input.</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700">
            <Plus size={15} /> Tambah Tim
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl p-4 space-y-3 bg-white border border-violet-100 shadow-sm">
          <input autoFocus value={newNama} onChange={e => setNewNama(e.target.value)}
            placeholder="Nama tim (cth: Tim A)" className={inp}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400 font-medium">Warna:</span>
            {WARNA.map(w => (
              <button key={w} onClick={() => setNewWarna(w)} className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{ background: w, outline: newWarna === w ? '2px solid #1F2937' : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewNama('') }} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-slate-100 text-slate-600">Batal</button>
            <button onClick={handleCreate} disabled={isPending || !newNama.trim()}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 bg-violet-600 hover:bg-violet-700">Simpan</button>
          </div>
        </div>
      )}

      {tims.length === 0 && !adding && (
        <div className="rounded-xl py-14 text-center bg-white border border-slate-200">
          <Users size={28} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[13px] text-slate-400">Belum ada tim. Tambahkan tim pertama.</p>
        </div>
      )}

      <div className="space-y-3">
        {tims.map((t: any) => (
          <TimCard key={t.id} tim={t} isPending={isPending} start={start}
            editing={editId === t.id} onEdit={() => setEditId(t.id)} onCancelEdit={() => setEditId(null)} />
        ))}
      </div>
    </div>
  )
}

function TimCard({ tim, isPending, start, editing, onEdit, onCancelEdit }: any) {
  const [nama, setNama] = useState(tim.nama)
  const [warna, setWarna] = useState(tim.warna || WARNA[0])
  const [newAnggota, setNewAnggota] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm" style={{ opacity: tim.aktif ? 1 : 0.6 }}>
      {editing ? (
        <div className="space-y-3">
          <input value={nama} onChange={e => setNama(e.target.value)} className={inp} />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400 font-medium">Warna:</span>
            {WARNA.map(w => (
              <button key={w} onClick={() => setWarna(w)} className="w-6 h-6 rounded-full"
                style={{ background: w, outline: warna === w ? '2px solid #1F2937' : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelEdit} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-slate-100 text-slate-600">Batal</button>
            <button onClick={() => {
              const fd = new FormData(); fd.set('nama', nama); fd.set('warna', warna)
              start(async () => {
                const r = await updateTim(tim.id, fd)
                if (r?.error) { toast.error(r.error); return }
                toast.success('Tim diperbarui'); onCancelEdit()
              })
            }} disabled={isPending}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 bg-violet-600 hover:bg-violet-700">Simpan</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-white text-[13px] flex-shrink-0"
              style={{ background: tim.warna || WARNA[0] }}>{tim.nama?.slice(-2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-[13px]">{tim.nama}{!tim.aktif && <span className="ml-2 text-[10px] text-slate-400">(nonaktif)</span>}</p>
              <p className="text-[11px] text-slate-400">{tim.anggota?.length ?? 0} anggota</p>
            </div>
            <button
              onClick={() => start(async () => {
                await toggleTimAktif(tim.id, !tim.aktif)
                toast.info(tim.aktif ? 'Tim dinonaktifkan' : 'Tim diaktifkan')
              })}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${tim.aktif ? 'text-emerald-500 border-emerald-200' : 'text-slate-400 border-slate-200'}`}>
              {tim.aktif ? 'Aktif' : 'Nonaktif'}
            </button>
            <button onClick={onEdit} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 size={13} /></button>
            <button onClick={() => setConfirmDel(true)} className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tim.anggota?.map((a: any) => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium text-slate-600 bg-violet-50">
                  {a.nama}
                  <button onClick={() => start(async () => {
                    const r = await deleteAnggota(a.id)
                    if (r?.error) { toast.error(r.error); return }
                    toast.success('Anggota dihapus')
                  })} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
              {(!tim.anggota || tim.anggota.length === 0) && <span className="text-[11px] text-slate-300 italic">Belum ada anggota</span>}
            </div>
            <div className="flex gap-2">
              <input value={newAnggota} onChange={e => setNewAnggota(e.target.value)}
                placeholder="Nama anggota baru"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    start(async () => {
                      const r = await addAnggota(tim.id, newAnggota.trim())
                      if (r?.error) { toast.error(r.error); return }
                      toast.success('Anggota ditambahkan'); setNewAnggota('')
                    })
                  }
                }}
                className="flex-1 h-9 px-3 bg-slate-50 rounded-xl text-[12px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200" />
              <button
                onClick={() => {
                  if (!newAnggota.trim()) return
                  start(async () => {
                    const r = await addAnggota(tim.id, newAnggota.trim())
                    if (r?.error) { toast.error(r.error); return }
                    toast.success('Anggota ditambahkan'); setNewAnggota('')
                  })
                }}
                disabled={isPending || !newAnggota.trim()}
                className="flex items-center gap-1 px-3 h-9 rounded-xl text-[12px] font-semibold text-violet-600 bg-violet-50 disabled:opacity-50">
                <UserPlus size={13} /> Tambah
              </button>
            </div>
          </div>

          {confirmDel && (
            <div className="mt-3 p-3 rounded-xl flex items-center gap-3 bg-red-50 border border-red-100">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-600 flex-1">Hapus tim <b>{tim.nama}</b>? Jika sudah dipakai, hanya dinonaktifkan.</p>
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white text-slate-600">Batal</button>
              <button
                onClick={() => start(async () => {
                  const r = await deleteTim(tim.id)
                  if (r?.error) { toast.error(r.error); return }
                  toast.success(r?.softDeleted ? 'Tim dinonaktifkan' : 'Tim dihapus')
                  setConfirmDel(false)
                })}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 disabled:opacity-50">Hapus</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══ MASTER ADMIN INPUT ════════════════════════════════════════════════════
function AdminInputSection({ list, isPending, start, canManage }: any) {
  const [newNama, setNewNama] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNama, setEditNama] = useState('')
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)

  function handleCreate() {
    if (!newNama.trim()) return
    start(async () => {
      const r = await createAdminInput(newNama.trim())
      if (r?.error) { toast.error(r.error); return }
      toast.success('Admin input ditambahkan'); setNewNama('')
    })
  }

  function handleUpdate(id: number) {
    if (!editNama.trim()) return
    start(async () => {
      const r = await updateAdminInput(id, editNama.trim())
      if (r?.error) { toast.error(r.error); return }
      toast.success('Diperbarui'); setEditId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[14px] font-semibold text-slate-900">Master Admin Yang Input</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">
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
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white flex-shrink-0 disabled:opacity-50 bg-violet-600 hover:bg-violet-700">
            <Plus size={15} /> Tambah
          </button>
        </div>
      )}

      {list.length === 0 && (
        <div className="rounded-xl py-14 text-center bg-white border border-slate-200">
          <UserCheck size={28} className="mx-auto text-slate-200 mb-3" />
          <p className="text-[13px] text-slate-400">Belum ada admin input. Tambahkan dulu.</p>
          <p className="text-[12px] text-slate-300 mt-1">Dipakai sebagai dropdown "Admin Yang Input" di form produksi, packing, dll.</p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm" style={{ opacity: a.aktif ? 1 : 0.55 }}>
            {editId === a.id ? (
              <>
                <input value={editNama} onChange={e => setEditNama(e.target.value)}
                  autoFocus
                  className="flex-1 h-9 px-3 bg-slate-50 rounded-xl text-[13px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  onKeyDown={e => e.key === 'Enter' && handleUpdate(a.id)} />
                <button onClick={() => handleUpdate(a.id)} className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Check size={13} /></button>
                <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><X size={13} /></button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 font-semibold text-[12px]">
                  {a.nama?.charAt(0)?.toUpperCase()}
                </div>
                <span className="flex-1 text-[13px] font-semibold text-slate-800">{a.nama}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.aktif ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                  {a.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => start(async () => {
                        await toggleAdminInputAktif(a.id, !a.aktif)
                        toast.info(a.aktif ? 'Dinonaktifkan' : 'Diaktifkan')
                      })}
                      className="px-2 py-1 rounded-lg text-[10px] border text-slate-400 hover:text-slate-600 border-slate-200">
                      {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onClick={() => { setEditId(a.id); setEditNama(a.nama) }}
                      className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 size={13} /></button>
                    {confirmDelId === a.id ? (
                      <>
                        <button
                          onClick={() => start(async () => {
                            const r = await deleteAdminInput(a.id)
                            if (r?.error) { toast.error(r.error); return }
                            toast.success('Dihapus'); setConfirmDelId(null)
                          })}
                          disabled={isPending}
                          className="px-2 py-1 rounded-lg text-[12px] font-semibold text-white bg-red-500 disabled:opacity-50">Hapus</button>
                        <button onClick={() => setConfirmDelId(null)} className="px-2 py-1 rounded-lg text-[12px] text-slate-500 bg-slate-100">Batal</button>
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
function PengaturanUmumSection({ pengaturan, tims, isPending, start, canManage }: any) {
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
  const [targetPacking, setTargetPacking] = useState(pengaturan.target_packing_harian ?? '0')
  const [safetyStockGlobal, setSafetyStockGlobal] = useState(pengaturan.safety_stock_global ?? '10')

  function handleSave() {
    const fd = new FormData()
    Object.entries(vals).forEach(([k, v]) => fd.set(k, v))
    start(async () => {
      const r = await updateToleransi(fd)
      if (r?.error) { toast.error(r.error); return }
      await updateTargetProduksi(Number(targetPacking) || 0)
      await updateSafetyStockGlobal(Number(safetyStockGlobal) || 10)
      toast.success('Pengaturan disimpan')
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Toleransi Loss per Proses</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Batas loss yang diizinkan (gram). Jika melebihi, sistem minta tanda tangan.</p>
        </div>
        <div className="rounded-xl p-4 space-y-3 bg-white border border-slate-200 shadow-sm">
          {([
            ['toleransi_loss_peleburan',    'Peleburan',    Flame],
            ['toleransi_loss_cutting',      'Cutting',      Scissors],
            ['toleransi_loss_pas_berat',    'Pas Berat',    Scale],
            ['toleransi_loss_annealing',    'Annealing',    Thermometer],
            ['toleransi_loss_siap_packing', 'Siap Packing', Package],
          ] as [keyof typeof vals, string, LucideIcon][]).map(([key, label, Icon]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-8 flex justify-center"><Icon size={16} className="text-slate-400"/></span>
              <span className="flex-1 text-[13px] font-semibold text-slate-700">{label}</span>
              <div className="flex items-center gap-2">
                <input type="number" step="0.001" disabled={!canManage}
                  value={vals[key]} onChange={e => set(key, e.target.value)}
                  className="w-28 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
                <span className="text-[12px] text-slate-400 w-6">gr</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Ambang Batas Sistem</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Nilai batas untuk trigger notif dan penentuan gain wajar.</p>
        </div>
        <div className="rounded-xl p-4 space-y-4 bg-white border border-slate-200 shadow-sm">
          {([
            ['ambang_gain_wajar',     'Gain Wajar (max tanpa persetujuan)', Sparkles,       'Gain di bawah ini dianggap wajar, tidak menurunkan KPI'],
            ['ambang_loss_kumulatif', 'Loss Kumulatif Waspada per Batch',   AlertTriangle,  'Jika total loss batch melebihi ini, sistem kirim notif'],
          ] as [keyof typeof vals, string, LucideIcon, string][]).map(([key, label, Icon, desc]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-1">
                <span className="w-8 flex justify-center"><Icon size={16} className="text-slate-400"/></span>
                <span className="flex-1 text-[13px] font-semibold text-slate-700">{label}</span>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.001" disabled={!canManage}
                    value={vals[key]} onChange={e => set(key, e.target.value)}
                    className="w-28 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
                  <span className="text-[12px] text-slate-400 w-6">gr</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pl-12">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Target Produksi Harian</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Target packing per hari. Ditampilkan sebagai progress bar di dashboard.</p>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[16px] w-8 text-center">🎯</span>
            <span className="flex-1 text-[13px] font-semibold text-slate-700">Target Packing Harian</span>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="1" disabled={!canManage}
                value={targetPacking} onChange={e => setTargetPacking(e.target.value)}
                className="w-28 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
              <span className="text-[12px] text-slate-400 w-6">pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Stock */}
      <div className="space-y-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Safety Stock Stok Minimum</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Batas stok minimum per gramasi. Jika di bawah ini, item masuk Prioritas Produksi P2.</p>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[16px] w-8 text-center">🛡️</span>
            <span className="flex-1 text-[13px] font-semibold text-slate-700">Safety Stock Default (semua gramasi)</span>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="1" disabled={!canManage}
                value={safetyStockGlobal} onChange={e => setSafetyStockGlobal(e.target.value)}
                className="w-28 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
              <span className="text-[12px] text-slate-400 w-6">pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Target per Tim */}
      {tims && tims.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">Target KPI per Tim</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Target gram serah per bulan per tim. Digunakan untuk menghitung achievement rate di KPI Tim.</p>
          </div>
          <div className="rounded-xl p-4 space-y-3 bg-white border border-slate-200 shadow-sm">
            {tims.filter((t: any) => t.aktif).map((tim: any) => {
              const key = `kpi_target_tim_${tim.id}`
              return (
                <div key={tim.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tim.warna ?? '#7F6DC6' }} />
                  <span className="flex-1 text-[13px] font-semibold text-slate-700">{tim.nama}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="10" disabled={!canManage}
                      defaultValue={pengaturan[key] ?? '0'}
                      onBlur={e => {
                        if (!canManage) return
                        const val = Number(e.target.value) || 0
                        start(async () => {
                          await updateKpiTargetTim(tim.id, val)
                          toast.success(`Target ${tim.nama} disimpan`)
                        })
                      }}
                      className="w-28 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60" />
                    <span className="text-[12px] text-slate-400 w-10">gr/bln</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 bg-violet-600 hover:bg-violet-700">
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

function BiayaPackagingSection({ pengaturan, isPending, start, canManage }: any) {
  const init: Record<string, string> = {}
  for (const g of GRAMASI_LIST) {
    init[g] = pengaturan[`biaya_packaging_${g}`] ?? '10000'
  }
  const [vals, setVals] = useState<Record<string, string>>(init)
  const set = (g: string, v: string) => setVals(p => ({ ...p, [g]: v }))

  function handleSave() {
    start(async () => {
      const r = await updateBiayaPackaging(GRAMASI_LIST, vals)
      if (r?.error) { toast.error(r.error); return }
      toast.success('Biaya packaging disimpan')
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[14px] font-semibold text-slate-900">Biaya Packaging per Gramasi</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Digunakan untuk menghitung HPP per pcs saat registrasi Shieldtag.<br/>
          <span className="font-semibold text-violet-600">HPP/pcs = (HPP/gr × gramasi) + biaya packaging</span>
        </p>
      </div>

      <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 grid grid-cols-3 text-[10px] font-medium text-slate-400">
          <span>Gramasi</span>
          <span className="text-right col-span-2">Biaya Packaging / pcs (Rp)</span>
        </div>
        <div className="divide-y divide-slate-50">
          {GRAMASI_LIST.map(g => (
            <div key={g} className="px-5 py-3 flex items-center gap-3">
              <span className="flex-1 text-[13px] font-semibold text-slate-700">{g} gr</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-400">Rp</span>
                <input
                  type="number" min="0" step="500"
                  disabled={!canManage}
                  value={vals[g]}
                  onChange={e => set(g, e.target.value)}
                  className="w-32 h-10 px-3 bg-slate-50 rounded-xl text-[13px] text-slate-700 text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 bg-violet-50 border border-violet-100">
        <p className="text-[12px] text-violet-700 font-semibold mb-1">Contoh perhitungan HPP</p>
        <p className="text-[12px] text-violet-600">
          Batch HPP/gr: <span className="font-mono">Rp 950.000</span> · Gramasi: <span className="font-mono">1 gr</span> · Biaya packaging: <span className="font-mono">Rp {Number(vals['1'] || 10000).toLocaleString('id-ID')}</span><br/>
          <span className="font-semibold">HPP/pcs = Rp 950.000 × 1 + Rp {Number(vals['1'] || 10000).toLocaleString('id-ID')} = Rp {(950000 + Number(vals['1'] || 10000)).toLocaleString('id-ID')}</span>
        </p>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 bg-violet-600 hover:bg-violet-700">
            {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Check size={15} /> Simpan Biaya Packaging
          </button>
        </div>
      )}
    </div>
  )
}

// === MASTER GRAMASI =========================================================
function MasterGramasiSection({ list, isPending, start, canManage }: any) {
  const [newVal, setNewVal] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)

  function handleCreate() {
    if (!newVal.trim()) return
    start(async () => {
      const r = await createGramasi(newVal.trim())
      if (r?.error) { toast.error(r.error); return }
      toast.success('Gramasi ditambahkan'); setNewVal('')
    })
  }

  function handleUpdate(id: number) {
    start(async () => {
      const r = await updateGramasi(id, editVal)
      if (r?.error) { toast.error(r.error); return }
      toast.success('Diperbarui'); setEditId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[14px] font-semibold text-slate-900">Master Gramasi</h2>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Daftar pilihan gramasi emas — dipakai di form produksi, packing, shieldtag, dan PO.
        </p>
      </div>

      {canManage && (
        <div className="flex gap-2">
          <input value={newVal} onChange={e => setNewVal(e.target.value)}
            placeholder="Nilai gramasi baru (cth: 3, 7.5, 15)"
            type="number" step="any" min="0"
            className={inp + ' flex-1'}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <div className="flex-shrink-0 flex items-center px-3 bg-slate-50 rounded-xl border border-slate-200 text-[13px] text-slate-500 font-medium">gr</div>
          <button onClick={handleCreate} disabled={isPending || !newVal.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white flex-shrink-0 disabled:opacity-50 bg-violet-600 hover:bg-violet-700">
            <Plus size={15} /> Tambah
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 flex text-[10px] font-medium text-slate-400">
          <span className="flex-1">Gramasi</span>
          <span className="w-24 text-center">Status</span>
          {canManage && <span className="w-36 text-right">Aksi</span>}
        </div>
        {list.length === 0 && (
          <div className="py-12 text-center text-[13px] text-slate-400">Belum ada data gramasi.</div>
        )}
        <div className="divide-y divide-slate-50">
          {list.map((g: any) => (
            <div key={g.id} className="px-5 py-3 flex items-center gap-3" style={{ opacity: g.aktif ? 1 : 0.5 }}>
              {editId === g.id ? (
                <>
                  <input value={editVal} onChange={e => setEditVal(e.target.value)}
                    autoFocus type="number" step="any"
                    className="flex-1 h-9 px-3 bg-slate-50 rounded-xl text-[13px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(g.id) }} />
                  <span className="text-[12px] text-slate-400">gr</span>
                  <button onClick={() => handleUpdate(g.id)}
                    className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Check size={13} /></button>
                  <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13px] font-semibold text-slate-800">{g.nilai} gr</span>
                  <span className={`w-24 text-center text-[10px] font-semibold ${g.aktif ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {g.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                  {canManage && (
                    <div className="w-36 flex items-center justify-end gap-1.5">
                      <button onClick={() => start(async () => {
                        await toggleGramasiAktif(g.id, !g.aktif)
                        toast.info(g.aktif ? 'Dinonaktifkan' : 'Diaktifkan')
                      })} className="px-2 py-1 rounded-lg text-[10px] border text-slate-400 hover:text-slate-600 border-slate-200">
                        {g.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button onClick={() => { setEditId(g.id); setEditVal(g.nilai) }}
                        className="w-7 h-7 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Edit2 size={12} /></button>
                      {confirmDelId === g.id ? (
                        <>
                          <button onClick={() => start(async () => {
                            const r = await deleteGramasi(g.id)
                            if (r?.error) { toast.error(r.error); return }
                            toast.success('Dihapus'); setConfirmDelId(null)
                          })} disabled={isPending}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white bg-red-500 disabled:opacity-50">Hapus</button>
                          <button onClick={() => setConfirmDelId(null)} className="px-2 py-1 rounded-lg text-[10px] text-slate-500 bg-slate-100">Batal</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelId(g.id)}
                          className="w-7 h-7 rounded-xl bg-red-50 text-red-400 flex items-center justify-center"><Trash2 size={12} /></button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
        <p className="text-[12px] font-semibold text-amber-700">Perhatian</p>
        <p className="text-[12px] text-amber-600 mt-0.5">
          Menghapus gramasi yang sudah dipakai di transaksi akan menyebabkan inkonsistensi data.
          Lebih aman gunakan <b>Nonaktifkan</b> agar tidak muncul di dropdown, tapi data lama tetap valid.
        </p>
      </div>
    </div>
  )
}


