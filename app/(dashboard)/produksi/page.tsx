import { createClient } from '@/lib/supabase/server'
import ProduksiClient from '@/components/modules/produksi/produksi-client'

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
      .select('*, produksi_event(*), packing!left(pcs_dipack, shieldtag_count, voided_at), batch!left(kode, nama_batch, timbangan_akhir, sisa_bahan_seharusnya, sisa_fisik, bahan_dari_pusat, tanggal)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('batch')
      .select('kode, nama_batch, status, tanggal, timbangan_akhir, sisa_bahan_seharusnya, sisa_fisik, bahan_dari_pusat')
      .eq('status', 'aktif')
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

