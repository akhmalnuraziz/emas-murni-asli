import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScrapClient from '@/components/modules/scrap/scrap-client'

export const dynamic = 'force-dynamic'

export default async function ScrapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single()

  const [
    { data: scrapList },
    { data: adminList },
    { data: usageList },
  ] = await Promise.all([
    supabase.from('scrap_inventory').select('*').is('voided_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('admin_input').select('id, nama').eq('aktif', true).is('voided_at', null),
    supabase.from('scrap_usage').select('scrap_id, peleburan_kode, gram, created_at').order('created_at', { ascending: false }).limit(2000),
  ])

  const canManage = true // ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv', 'gudang'].includes(profile?.role ?? '')

  return (
    <ScrapClient
      scrapList={scrapList ?? []}
      adminList={adminList ?? []}
      usageList={usageList ?? []}
      userRole={profile?.role ?? ''}
      userName={profile?.name ?? ''}
      canManage={canManage}
    />
  )
}
