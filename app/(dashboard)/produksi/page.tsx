import { createClient } from '@/lib/supabase/server'
import ProduksiClient from '@/components/modules/produksi/produksi-client'

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
      .select(`*, produksi_event(*), packing!left(pcs_dipack, shieldtag_count, voided_at), batch!left(sisa_bahan_seharusnya, sisa_fisik, timbangan_akhir, bahan_dari_pusat), stage_handover(*)`)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('batch')
      .select('kode, nama_batch, sisa_bahan_seharusnya, timbangan_akhir, bahan_siap_cetak')
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

