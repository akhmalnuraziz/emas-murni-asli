import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryClient from '@/components/modules/inventory/inventory-client'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <InventoryClient />
}
