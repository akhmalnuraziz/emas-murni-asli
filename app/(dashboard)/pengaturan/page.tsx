import { createClient } from '@/lib/supabase/server'
import PengaturanClient from '@/components/modules/pengaturan/pengaturan-client'

export default async function PengaturanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: timList },
    { data: anggotaList },
    { data: pengaturan },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('tim_produksi').select('*').is('voided_at', null).order('id'),
    supabase.from('tim_anggota').select('*').eq('aktif', true).order('id'),
    supabase.from('pengaturan').select('key, value, label').like('key', 'toleransi_loss%'),
  ])

  // Gabung anggota ke tim
  const tims = (timList ?? []).map(t => ({
    ...t,
    anggota: (anggotaList ?? []).filter(a => a.tim_id === t.id),
  }))

  const toleransi: Record<string, string> = {}
  for (const p of pengaturan ?? []) toleransi[p.key] = p.value

  return (
    <PengaturanClient
      tims={tims}
      toleransi={toleransi}
      userRole={profile?.role ?? 'operator_produksi'}
    />
  )
}
