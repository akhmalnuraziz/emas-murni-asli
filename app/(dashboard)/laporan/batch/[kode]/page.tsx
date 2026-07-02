import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LaporanBatchDetail from '@/components/modules/laporan/laporan-batch-detail'

export const dynamic = 'force-dynamic'

export default async function LaporanBatchPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode: rawKode } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  // ROLE_CHECK_DISABLED: const allowedRoles = ['owner', 'manager', 'admin_pusat', 'spv', 'accounting']
  // ROLE_CHECK_DISABLED: if (!allowedRoles.includes(role)) redirect('/dashboard')

  const kode = decodeURIComponent(rawKode)

  const [{ data: batch }, { data: peleburans }, { data: shieldtags }] = await Promise.all([
    supabase.from('batch').select('*').eq('kode', kode).is('voided_at', null).single(),
    supabase.from('peleburan')
      .select('id, kode, tanggal, dikasih_gram, diterima_gram, status, tim_nama, operator, sumber_batch_gram')
      .eq('batch_kode', kode).is('voided_at', null).order('tanggal'),
    supabase.from('shieldtag')
      .select('kode, gramasi, status')
      .eq('batch_kode', kode).is('voided_at', null),
  ])

  if (!batch) notFound()

  const ITEM_COLS = 'id, kode, gramasi, pcs, pcs_good, total_gram, current_status, peleburan_id, sisa_serbuk, berat_reject, berat_reject_dilebur'

  // Kumpulkan produksi_items: gabung semua sumber agar tidak ada yang terlewat
  const peleburanIds = (peleburans ?? []).map((p: any) => p.id)

  const [{ data: byBatch }, { data: byPlb }] = await Promise.all([
    supabase.from('produksi_item').select(ITEM_COLS)
      .eq('batch_kode', kode).is('voided_at', null),
    peleburanIds.length > 0
      ? supabase.from('produksi_item').select(ITEM_COLS)
          .in('peleburan_id', peleburanIds).is('voided_at', null)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Gabung unik by id
  const itemMap = new Map<number, any>()
  for (const it of [...(byBatch ?? []), ...(byPlb ?? [])]) itemMap.set(it.id, it)
  const produksiItems = [...itemMap.values()]

  // Kumpulkan packings: dari batch_kode DAN dari produksi_item_id
  const produksiItemIds = produksiItems.map(it => it.id)

  const [{ data: packByBatch }, { data: packByItem }] = await Promise.all([
    supabase.from('packing')
      .select('id, kode, gramasi, pcs, total_gram, tanggal, pic, produksi_item_id')
      .eq('batch_kode', kode).is('voided_at', null).order('tanggal'),
    produksiItemIds.length > 0
      ? supabase.from('packing')
          .select('id, kode, gramasi, pcs, total_gram, tanggal, pic, produksi_item_id')
          .in('produksi_item_id', produksiItemIds).is('voided_at', null).order('tanggal')
      : Promise.resolve({ data: [] as any[] }),
  ])

  const packMap = new Map<number, any>()
  for (const pk of [...(packByBatch ?? []), ...(packByItem ?? [])]) packMap.set(pk.id, pk)
  const packings = [...packMap.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  return (
    <LaporanBatchDetail
      batch={batch as any}
      peleburans={(peleburans ?? []) as any}
      produksiItems={produksiItems as any}
      packings={packings as any}
      shieldtags={(shieldtags ?? []) as any}
      userRole={role}
    />
  )
}
