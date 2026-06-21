import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PengaturanClient from '@/components/modules/pengaturan/pengaturan-client'

export default async function PengaturanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: timList },
    { data: anggotaList },
    { data: pengaturanRows },
    { data: adminInputList },
    { data: cabangList },
    { data: userList },
    { data: produkList },
    { data: gramasiList },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('tim_produksi').select('*').is('voided_at', null).order('id'),
    supabase.from('tim_anggota').select('*').eq('aktif', true).order('id'),
    supabase.from('pengaturan').select('key, value, label'),
    supabase.from('admin_input').select('id, nama, aktif').is('voided_at', null).order('id'),
    supabase.from('cabang').select('*').is('voided_at', null).order('id'),
    supabase.from('users_profile').select('id, email, name, role, aktif, toko, cabang_kode, created_at').order('created_at'),
    supabase.from('produk_packaging').select('id, kode, nama, satuan, keterangan, aktif').order('id'),
    supabase.from('gramasi_option').select('id, nilai, urutan, aktif').order('urutan'),
  ])

  const tims = (timList ?? []).map((t: any) => ({
    ...t,
    anggota: (anggotaList ?? []).filter((a: any) => a.tim_id === t.id),
  }))

  const pengaturan: Record<string, string> = {}
  for (const p of pengaturanRows ?? []) pengaturan[p.key] = p.value

  return (
    <PengaturanClient
      tims={tims}
      pengaturan={pengaturan}
      userRole={profile?.role ?? 'operator_produksi'}
      adminInputList={adminInputList ?? []}
      cabangList={cabangList ?? []}
      userList={userList ?? []}
      currentUserId={user?.id ?? ''}
      produkList={produkList ?? []}
      gramasiList={gramasiList ?? []}
    />
  )
}
