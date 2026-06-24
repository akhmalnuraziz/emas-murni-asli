import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BuybackClient from '@/components/modules/buyback/buyback-client'
import { getBuybackList } from './actions'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function BuybackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users_profile')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  const { data: list } = await getBuybackList()

  return (
    <BuybackClient
      initialList={list}
      userRole={(profile?.role ?? 'operator_produksi') as UserRole}
      userName={profile?.name ?? user?.email ?? 'Unknown'}
    />
  )
}
