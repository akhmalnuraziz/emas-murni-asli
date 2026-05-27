import { createClient } from '@/lib/supabase/server'
import PackingLogClient from '@/components/modules/packing-log/packing-log-client'

export default async function PackingLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: profile }, { data: packingList }, { data: siapPackingItems }] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('packing')
      .select('*, produksi_item(kode, nama_item, gramasi, pcs, pcs_good, pcs_packed, total_gram, batch_kode)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('produksi_item')
      .select('id, kode, nama_item, gramasi, pcs, pcs_good, pcs_packed, total_gram, batch_kode, current_status')
      .eq('current_status', 'Siap Packing')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
  ])
  return (
    <PackingLogClient
      packingList={packingList ?? []}
      siapPackingItems={(siapPackingItems ?? []).filter(item => {
        const remaining = (item.pcs_good ?? item.pcs ?? 0) - (item.pcs_packed ?? 0)
        return remaining > 0
      })}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
