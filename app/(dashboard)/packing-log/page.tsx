import { createClient } from '@/lib/supabase/server'
import PackingLogClient from '@/components/modules/packing-log/packing-log-client'

export default async function PackingLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: packingList },
    { data: siapPacking },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('packing')
      .select('*, produksi_item(kode, nama_item, gramasi, pcs_good, pcs, current_status)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('produksi_item')
      .select('id, kode, nama_item, gramasi, pcs_good, pcs, batch_kode, current_status, packing!left(pcs_dipack, voided_at)')
      .eq('current_status', 'Siap Packing')
      .is('voided_at', null),
  ])

  // Hitung pcs_tersisa untuk setiap item siap packing
  const siapPackingItems = (siapPacking ?? []).map((item: any) => {
    const activePacking = (item.packing ?? []).filter((p: any) => !p.voided_at)
    const totalPacked = activePacking.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
    const pcsTersisa = (item.pcs_good ?? item.pcs) - totalPacked
    return { ...item, pcs_tersisa: pcsTersisa }
  }).filter((item: any) => item.pcs_tersisa > 0)

  return (
    <PackingLogClient
      packingList={packingList ?? []}
      siapPackingItems={siapPackingItems}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
