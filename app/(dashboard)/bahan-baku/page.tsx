import { createClient } from '@/lib/supabase/server'
import BahanBakuClient from '@/components/modules/bahan-baku/bahan-baku-client'

export default async function BahanBakuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: batches }, { data: profile }] = await Promise.all([
    supabase.from('batch').select('*').order('created_at', { ascending: false }),
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
  ])

  return (
    <BahanBakuClient
      batches={batches ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}