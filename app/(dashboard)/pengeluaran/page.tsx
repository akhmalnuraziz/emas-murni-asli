import { createClient } from '@/lib/supabase/server'
import PengeluaranClient from '@/components/modules/pengeluaran/pengeluaran-client'

export default async function PengeluaranPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: pengeluaranList },
    { data: kategoriList },
    { data: cabangList },
    { data: settingGudang },
  ] = await Promise.all([
    supabase.from('users_profile').select('role,name').eq('id', user?.id ?? '').single(),
    supabase.from('pengeluaran')
      .select('*, kategori:kategori_id(id, nama, warna)')
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('kategori_pengeluaran').select('*').order('nama'),
    supabase.from('cabang').select('kode, nama').eq('aktif', true).order('kode'),
    supabase.from('pengaturan').select('value').eq('key', 'nama_gudang').single(),
  ])

  return (
    <PengeluaranClient
      pengeluaranList={pengeluaranList ?? []}
      kategoriList={kategoriList ?? []}
      cabangList={cabangList ?? []}
      namaGudang={settingGudang?.value ?? 'Gudang CJ'}
      userRole={profile?.role ?? 'operator_produksi'}
    />
  )
}
