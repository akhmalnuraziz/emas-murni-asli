import { createClient } from '@/lib/supabase/server'
import StockOpnameClient from '@/components/modules/stock-opname/stock-opname-client'
import { getStockOpnameList, getCabangList } from './actions'
import type { UserRole } from '@/lib/types/database'

export default async function StockOpnamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users_profile')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  const [{ data: list }, cabangList] = await Promise.all([
    getStockOpnameList(),
    getCabangList(),
  ])

  return (
    <StockOpnameClient
      initialList={list}
      cabangList={cabangList}
      userRole={(profile?.role ?? 'operator_produksi') as UserRole}
      userName={profile?.name ?? user?.email ?? 'Unknown'}
    />
  )
}
