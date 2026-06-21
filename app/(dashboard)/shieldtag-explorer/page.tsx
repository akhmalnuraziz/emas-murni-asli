import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShieldtagExplorerClient from '@/components/modules/shieldtag-explorer/shieldtag-explorer-client'

export default async function ShieldtagExplorerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users_profile')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  return <ShieldtagExplorerClient />
}
