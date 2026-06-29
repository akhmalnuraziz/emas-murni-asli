import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BarangKeluarClient from '@/components/modules/barang-keluar/barang-keluar-client'
import { getBarangKeluarList, getShieldtagAktifGudang } from './actions'

export const dynamic = 'force-dynamic'

export default async function BarangKeluarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  const allowed = ['owner', 'manager', 'admin_pusat', 'spv', 'accounting']
  if (!allowed.includes(profile?.role ?? '')) redirect('/dashboard')

  const [{ data: list }, { data: shieldtags }] = await Promise.all([
    getBarangKeluarList(),
    getShieldtagAktifGudang(),
  ])

  return (
    <BarangKeluarClient
      initialList={list}
      shieldtagAktif={shieldtags}
      userRole={profile?.role ?? ''}
      userName={profile?.name ?? ''}
    />
  )
}
