import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReturClient from '@/components/modules/retur-penjualan/retur-client'

export const dynamic = 'force-dynamic'

export default async function ReturPenjualanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user.id).single()

  const { data: returList } = await supabase
    .from('retur_penjualan')
    .select('*')
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const canManage = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')
  const canSeeRp  = ['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')

  return (
    <ReturClient
      returList={returList ?? []}
      userRole={profile?.role ?? ''}
      canManage={canManage}
      canSeeRp={canSeeRp}
    />
  )
}
