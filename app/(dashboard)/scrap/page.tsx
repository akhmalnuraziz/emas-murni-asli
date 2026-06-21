import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScrapClient from '@/components/modules/scrap/scrap-client'

export default async function ScrapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single()

  const [
    { data: scrapList },
    { data: timList },
    { data: adminList },
  ] = await Promise.all([
    supabase.from('scrap_inventory').select('*').is('voided_at', null).order('created_at', { ascending: false }),
    supabase.from('tim_produksi').select('id, nama').eq('aktif', true),
    supabase.from('admin_input').select('id, nama').eq('aktif', true).is('voided_at', null),
  ])

  const canManage = ['owner', 'admin_pusat', 'spv', 'gudang'].includes(profile?.role ?? '')

  return (
    <ScrapClient
      scrapList={scrapList ?? []}
      timList={timList ?? []}
      adminList={adminList ?? []}
      userRole={profile?.role ?? ''}
      userName={profile?.name ?? ''}
      canManage={canManage}
    />
  )
}
