import { createClient } from '@/lib/supabase/server'
import MutasiClient from '@/components/modules/mutasi/mutasi-client'

export default async function MutasiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: mutasiList },
    { data: cabang },
    { data: settingGudang },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name, cabang_kode').eq('id', user.id).single(),
    supabase.from('mutasi')
      .select('*')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('cabang').select('kode, nama, aktif').eq('aktif', true).order('kode'),
    supabase.from('pengaturan').select('value').eq('key', 'nama_gudang').single(),
  ])

  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  // Hitung pending ACC (transit)
  const pendingACC = (mutasiList ?? []).filter(m => m.status === 'transit').length

  return (
    <MutasiClient
      mutasiList={mutasiList ?? []}
      cabang={cabang ?? []}
      namaGudang={namaGudang}
      userRole={profile?.role ?? 'operator_produksi'}
      userCabangKode={profile?.cabang_kode ?? null}
      pendingACC={pendingACC}
    />
  )
}
