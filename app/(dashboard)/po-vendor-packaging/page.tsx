import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import POVendorClient from '@/components/modules/po-packaging/po-vendor-client'

export const dynamic = 'force-dynamic'

const PO_PAGE_SIZE = 20
const BATCH_PAGE_SIZE = 20

export default async function POVendorPage({
  searchParams,
}: {
  searchParams: Promise<{ po_page?: string; batch_page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const poPage = Math.max(1, parseInt(sp.po_page ?? '1', 10))
  const batchPage = Math.max(1, parseInt(sp.batch_page ?? '1', 10))
  const poFrom = (poPage - 1) * PO_PAGE_SIZE
  const batchFrom = (batchPage - 1) * BATCH_PAGE_SIZE

  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user.id).single()

  // Fetch paginated lists first, then filter related items to match current page only
  const [
    { data: poListRaw, count: poTotal },
    { data: batchListRaw, count: batchTotal },
  ] = await Promise.all([
    supabase.from('po_packaging').select('*', { count: 'exact' }).is('voided_at', null).order('created_at', { ascending: false }).range(poFrom, poFrom + PO_PAGE_SIZE - 1),
    supabase.from('po_batch_penerimaan').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(batchFrom, batchFrom + BATCH_PAGE_SIZE - 1),
  ])

  const poIds = (poListRaw ?? []).map((p: any) => p.id)
  const batchIds = (batchListRaw ?? []).map((b: any) => b.id)

  const [
    { data: vendors },
    { data: produkList },
    { data: kategoriRejectList },
    { data: poItems },
    { data: batchItemsList },
    { data: rejectList },
    { data: sjList },
    { data: stokList },
    { data: monitoring },
    { data: timAnggotaList },
    { data: adminInputList },
  ] = await Promise.all([
    supabase.from('vendor_packaging').select('*').is('voided_at', null).order('nama'),
    supabase.from('produk_packaging').select('*').eq('aktif', true).order('nama'),
    supabase.from('reject_kategori_packaging').select('*').is('voided_at', null).order('nama'),
    poIds.length > 0
      ? supabase.from('po_packaging_items').select('*').in('po_id', poIds).order('po_id')
      : Promise.resolve({ data: [] }),
    batchIds.length > 0
      ? supabase.from('po_batch_items').select('*').in('batch_id', batchIds).order('batch_id')
      : Promise.resolve({ data: [] }),
    supabase.from('po_packaging_reject').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('sj_retur_packaging').select('*, items:sj_retur_packaging_items(id, produk_id, produk_nama, qty_retur, qty_diganti, jenis, kategori_nama, alasan_manual, po_nomor, nomor_batch)').order('created_at', { ascending: false }).limit(100),
    supabase.from('stok_packaging').select('*').order('produk_id'),
    supabase.from('po_packaging_monitoring').select('*').order('created_at', { ascending: false }),
    supabase.from('tim_anggota').select('id, nama').eq('aktif', true).order('nama'),
    supabase.from('admin_input').select('id, nama').eq('aktif', true).is('voided_at', null).order('nama'),
  ])

  const canManage = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  return (
    <POVendorClient
      vendors={vendors ?? []}
      produkList={produkList ?? []}
      kategoriRejectList={kategoriRejectList ?? []}
      poList={poListRaw ?? []}
      poItems={poItems ?? []}
      batchList={batchListRaw ?? []}
      batchItemsList={batchItemsList ?? []}
      rejectList={rejectList ?? []}
      sjList={sjList ?? []}
      stokList={stokList ?? []}
      monitoring={monitoring ?? []}
      timAnggotaList={timAnggotaList ?? []}
      adminInputList={adminInputList ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      canManage={canManage}
      poPage={poPage}
      poTotal={poTotal ?? 0}
      poPageSize={PO_PAGE_SIZE}
      batchPage={batchPage}
      batchTotal={batchTotal ?? 0}
      batchPageSize={BATCH_PAGE_SIZE}
    />
  )
}
