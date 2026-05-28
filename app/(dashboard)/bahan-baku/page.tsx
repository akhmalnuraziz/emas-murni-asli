import { createClient } from '@/lib/supabase/server'
import BahanBakuClient from '@/components/modules/bahan-baku/bahan-baku-client'

export default async function BahanBakuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: batches }, { data: profile }, { data: pendingRejects }] = await Promise.all([
    supabase.from('batch').select('*').order('created_at', { ascending: false }),
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    // Count reject belum_dilebur per batch_kode
    supabase.from('produksi_item')
      .select('batch_kode')
      .eq('status_reject', 'belum_dilebur')
      .is('voided_at', null),
  ])

  // Build a map: batch_kode → count of pending rejects
  const rejectCountMap: Record<string, number> = {}
  for (const row of pendingRejects ?? []) {
    const k = row.batch_kode
    if (k) rejectCountMap[k] = (rejectCountMap[k] ?? 0) + 1
  }

  return (
    <BahanBakuClient
      batches={batches ?? []}
      rejectCountMap={rejectCountMap}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
