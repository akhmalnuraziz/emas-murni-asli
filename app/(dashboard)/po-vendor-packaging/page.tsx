import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import POVendorClient from '@/components/modules/po-packaging/po-vendor-client'

export const dynamic = 'force-dynamic'

export default async function POVendorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user.id).single()

  const [
    { data: vendors },
    { data: produkList },
    { data: kategoriRejectList },
    { data: poList },
    { data: poItems },
    { data: batchList },
    { data: rejectList },
    { data: sjList },
    { data: stokList },
    { data: monitoring },
  ] = await Promise.all([
    supabase.from('vendor_packaging').select('*').is('voided_at', null).order('nama'),
    supabase.from('produk_packaging').select('*').eq('aktif', true).order('nama'),
    supabase.from('reject_kategori_packaging').select('*').is('voided_at', null).order('urutan').order('nama'),
    supabase.from('po_packaging').select('*').is('voided_at', null).order('created_at', { ascending: false }).limit(200),
    supabase.from('po_packaging_items').select('*').order('po_id').limit(2000),
    supabase.from('po_batch_penerimaan').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('po_packaging_reject').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('sj_retur_packaging').select('*, items:sj_retur_packaging_items(id, produk_id, produk_nama, qty_retur, qty_diganti, jenis, kategori_nama, alasan_manual, po_nomor, nomor_batch)').order('created_at', { ascending: false }).limit(200),
    supabase.from('stok_packaging').select('*').order('produk_id'),
    supabase.from('po_packaging_monitoring').select('*').order('created_at', { ascending: false }),
  ])

  const canManage = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  return (
    <POVendorClient
      vendors={vendors ?? []}
      produkList={produkList ?? []}
      kategoriRejectList={kategoriRejectList ?? []}
      poList={poList ?? []}
      poItems={poItems ?? []}
      batchList={batchList ?? []}
      rejectList={rejectList ?? []}
      sjList={sjList ?? []}
      stokList={stokList ?? []}
      monitoring={monitoring ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      canManage={canManage}
    />
  )
}
