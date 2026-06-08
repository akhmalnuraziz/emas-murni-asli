import { createClient } from '@/lib/supabase/server'
import ProduksiClient from '@/components/modules/produksi/produksi-client'

// Never cache — must always reflect latest mutations from server actions
export const dynamic = 'force-dynamic'

export default async function ProduksiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: produksiList },
    { data: batches },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('produksi_item')
      .select(`*, produksi_event(*), packing!left(pcs_dipack, shieldtag_count, voided_at), batch!left(sisa_bahan_seharusnya, sisa_fisik, timbangan_akhir, bahan_dari_pusat)`)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('batch')
      .select('kode, nama_batch, sisa_bahan_seharusnya, timbangan_akhir')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
  ])

  return (
    <ProduksiClient
      produksiList={produksiList ?? []}
      batches={batches ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
