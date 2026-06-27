'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Edit2, X, Check, ShieldCheck, Mail, Trash2 } from 'lucide-react'
import {
  createCabang, updateCabang, toggleCabangAktif,
  updateUserRole, toggleUserAktif, inviteUser, deleteUser,
} from '@/app/(dashboard)/pengaturan/actions'

const inp = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all'

// ═══ CABANG SECTION ══════════════════════════════════════════════════════════
export function CabangSection({ list, canManage }: {
  list: any[]; canManage: boolean
}) {
  const [isPending, start] = useTransition()
  const [modal, setModal] = useState<'create' | number | null>(null)
  const [err, setErr] = useState('')

  async function handleSave(fd: FormData) {
    setErr('')
    const r = typeof modal === 'number'
      ? await updateCabang(modal, fd)
      : await createCabang(fd)
    if (r?.error) { setErr(r.error); return }
    toast.success(typeof modal === 'number' ? 'Cabang diperbarui' : 'Cabang ditambahkan')
    setModal(null)
  }

  const item = typeof modal === 'number' ? list.find((c: any) => c.id === modal) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-700">{list.length} cabang terdaftar</p>
        {canManage && (
          <button onClick={() => { setModal('create'); setErr('') }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>
            <Plus size={13} /> Tambah Cabang
          </button>
        )}
      </div>
      <div className="space-y-2">
        {list.map((c: any) => (
          <div key={c.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-slate-800">{c.nama}</p>
                <span className="text-[10px] font-mono text-slate-400">{c.kode}</span>
                {!c.aktif && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
              </div>
              {c.kepala && <p className="text-[11px] text-slate-400">Kepala: {c.kepala}</p>}
              {c.telp && <p className="text-[11px] text-slate-400">{c.telp}</p>}
              {c.alamat && <p className="text-[11px] text-slate-400 truncate max-w-xs">{c.alamat}</p>}
            </div>
            {canManage && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => { setModal(c.id); setErr('') }}
                  className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50"><Edit2 size={13}/></button>
                <button onClick={async () => {
                  const r = await toggleCabangAktif(c.id, !c.aktif)
                  if (r?.error) toast.error(r.error); else toast.success(c.aktif ? 'Cabang dinonaktifkan' : 'Cabang diaktifkan')
                }} className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${c.aktif ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {c.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="text-[13px] text-slate-400 text-center py-8">Belum ada cabang — klik Tambah Cabang</p>}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-[15px] font-semibold text-slate-900">{modal === 'create' ? 'Tambah Cabang' : 'Edit Cabang'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <form id="cabang-form" onSubmit={async e => { e.preventDefault(); start(async () => { await handleSave(new FormData(e.currentTarget)) }) }} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nama Cabang *</label>
                <input name="nama" defaultValue={item?.nama} required placeholder="mis. Cabang Surabaya" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Kepala Cabang</label>
                <input name="kepala" defaultValue={item?.kepala} placeholder="Nama kepala cabang" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Telepon</label>
                <input name="telp" defaultValue={item?.telp} placeholder="08xx-xxxx-xxxx" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Alamat</label>
                <input name="alamat" defaultValue={item?.alamat} placeholder="Alamat lengkap" className={inp}/></div>
              {err && <p className="text-[12px] text-red-500 font-semibold">{err}</p>}
            </form>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
              <button type="button" onClick={() => setModal(null)} className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button type="submit" form="cabang-form" disabled={isPending} className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ USERS SECTION ══════════════════════════════════════════════════════════
const ROLES = ['owner','manager','spv','admin_produksi','admin_gudang','admin_accounting']
const ROLE_LABEL: Record<string,string> = {
  owner:            'Owner',
  manager:          'Manager',
  spv:              'SPV',
  admin_produksi:   'Admin Produksi',
  admin_gudang:     'Admin Gudang & Distribusi',
  admin_accounting: 'Admin Accounting',
}
const ROLE_COLOR: Record<string,string> = {
  owner:            '#7C3AED',
  manager:          '#2563EB',
  spv:              '#D97706',
  admin_produksi:   '#16A34A',
  admin_gudang:     '#0891B2',
  admin_accounting: '#9333EA',
}

type Confirm = { type: 'aktif' | 'nonaktif' | 'hapus'; userId: string; userName: string }

export function UsersSection({ list, currentUserId, canManage }: {
  list: any[]; currentUserId: string; canManage: boolean
}) {
  const [isPending, start] = useTransition()
  const [inviteModal, setInviteModal] = useState(false)
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [err, setErr] = useState('')

  async function handleConfirm() {
    if (!confirm) return
    start(async () => {
      let r
      if (confirm.type === 'hapus') {
        r = await deleteUser(confirm.userId)
        if (!r?.error) toast.success('User dihapus')
      } else {
        const aktif = confirm.type === 'aktif'
        r = await toggleUserAktif(confirm.userId, aktif)
        if (!r?.error) toast.success(aktif ? 'User diaktifkan' : 'User dinonaktifkan')
      }
      if (r?.error) toast.error(r.error)
      setConfirm(null)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-700">{list.length} user terdaftar</p>
        {canManage && (
          <button onClick={() => { setInviteModal(true); setErr('') }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-xl"
            style={{ background: 'linear-gradient(135deg,#7F6DC6,#6857B1)' }}>
            <Mail size={13} /> Undang User
          </button>
        )}
      </div>
      <div className="space-y-2">
        {list.map((u: any) => (
          <div key={u.id} className="rounded-xl px-4 py-3 bg-white border border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-slate-800">{u.name}</p>
                  {u.id === currentUserId && <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">Anda</span>}
                  {!u.aktif && <span className="text-[10px] font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: ROLE_COLOR[u.role] ?? '#64748B' }}>
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
              </div>
              {canManage && u.id !== currentUserId && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setEditRoleId(u.id === editRoleId ? null : u.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors" title="Ubah role">
                    <ShieldCheck size={12}/> Ubah Role
                  </button>
                  <button onClick={() => setConfirm({ type: u.aktif ? 'nonaktif' : 'aktif', userId: u.id, userName: u.name })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${u.aktif ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => setConfirm({ type: 'hapus', userId: u.id, userName: u.name })}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Hapus user">
                    <Trash2 size={13}/>
                  </button>
                </div>
              )}
            </div>
            {editRoleId === u.id && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Ubah role</label>
                <div className="flex gap-2">
                  <select defaultValue={u.role} id={`role-${u.id}`}
                    className="flex-1 px-3 py-2 text-[12px] rounded-lg border border-violet-200 bg-violet-50 text-violet-700 font-semibold focus:outline-none">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                  </select>
                  <button onClick={async () => {
                    const sel = (document.getElementById(`role-${u.id}`) as HTMLSelectElement).value
                    const r = await updateUserRole(u.id, sel)
                    if (r?.error) toast.error(r.error); else { toast.success('Role diperbarui'); setEditRoleId(null) }
                  }} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors">
                    Simpan
                  </button>
                  <button onClick={() => setEditRoleId(null)} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-semibold transition-colors">
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="text-[13px] text-slate-400 text-center py-8">Belum ada user</p>}
      </div>

      {/* ── Confirm dialog ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${confirm.type === 'hapus' ? 'bg-red-100' : 'bg-amber-100'}`}>
                {confirm.type === 'hapus' ? <Trash2 size={16} className="text-red-500"/> : <ShieldCheck size={16} className="text-amber-500"/>}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-900">
                  {confirm.type === 'hapus' ? 'Hapus user?' : confirm.type === 'nonaktif' ? 'Nonaktifkan user?' : 'Aktifkan user?'}
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {confirm.type === 'hapus'
                    ? <>Akun <b>{confirm.userName}</b> akan dihapus permanen dan tidak bisa dipulihkan.</>
                    : confirm.type === 'nonaktif'
                    ? <><b>{confirm.userName}</b> tidak akan bisa login sampai diaktifkan kembali.</>
                    : <><b>{confirm.userName}</b> akan bisa login kembali ke sistem.</>
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirm(null)}
                className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">
                Batal
              </button>
              <button onClick={handleConfirm} disabled={isPending}
                className={`flex-1 h-9 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${confirm.type === 'hapus' ? 'bg-red-500 hover:bg-red-600' : confirm.type === 'nonaktif' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}>
                {isPending ? 'Memproses…' : confirm.type === 'hapus' ? 'Ya, hapus' : confirm.type === 'nonaktif' ? 'Ya, nonaktifkan' : 'Ya, aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-[15px] font-semibold text-slate-900">Undang User Baru</h2>
              <button onClick={() => setInviteModal(false)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14}/></button>
            </div>
            <form id="invite-form" onSubmit={async e => {
              e.preventDefault(); setErr('')
              start(async () => {
                const r = await inviteUser(new FormData(e.currentTarget))
                if (r?.error) { setErr(r.error); return }
                toast.success('Undangan terkirim ke email')
                setInviteModal(false)
              })
            }} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="rounded-lg px-3 py-2 text-[12px] bg-slate-50 border border-slate-200 text-slate-600">
                Email undangan akan dikirim. User klik link di email untuk set password.
              </div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Email *</label>
                <input name="email" type="email" required placeholder="user@email.com" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Nama Lengkap *</label>
                <input name="name" required placeholder="Nama user" className={inp}/></div>
              <div><label className="block text-[11px] font-medium text-slate-500 mb-1.5">Role *</label>
                <select name="role" required className={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                </select>
              </div>
              {err && <p className="text-[12px] text-red-500 font-semibold">{err}</p>}
            </form>
            <div className="px-5 py-4 flex gap-2.5 border-t border-slate-200 flex-shrink-0">
              <button type="button" onClick={() => setInviteModal(false)} className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-[13px] font-semibold text-slate-600 transition-colors">Batal</button>
              <button type="submit" form="invite-form" disabled={isPending} className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
                {isPending ? 'Mengirim…' : 'Kirim Undangan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
