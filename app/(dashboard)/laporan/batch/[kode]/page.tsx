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
  const allowedRoles = ['owner', 'manager', 'admin_pusat', 'spv', 'accounting']
  if (!allowedRoles.includes(role)) redirect('/dashboard')

  const kode = decodeURIComponent(rawKode)

  const [
    { data: batch },
    { data: peleburans },
    { data: packings },
    { data: shieldtags },
  ] = await Promise.all([
    supabase.from('batch').select('*').eq('kode', kode).is('voided_at', null).single(),
    supabase.from('peleburan')
      .select('id, kode, tanggal, dikasih_gram, diterima_gram, status, tim_nama, operator, sumber_batch_gram')
      .eq('batch_kode', kode)
      .is('voided_at', null)
      .order('tanggal'),
    supabase.from('packing')
      .select('id, kode, gramasi, pcs, total_gram, tanggal, pic')
      .eq('batch_kode', kode)
      .is('voided_at', null)
      .order('tanggal'),
    supabase.from('shieldtag')
      .select('kode, gramasi, status')
      .eq('batch_kode', kode)
      .is('voided_at', null),
  ])

  if (!batch) notFound()

  // Query produksi_items: coba batch_kode dulu, fallback ke peleburan_id
  const peleburanIds = (peleburans ?? []).map(p => p.id)
  let produksiItems: any[] = []

  const { data: byBatch } = await supabase
    .from('produksi_item')
    .select('id, kode, gramasi, pcs, total_gram, current_status, peleburan_id, sisa_serbuk, berat_reject, berat_reject_dilebur')
    .eq('batch_kode', kode)
    .is('voided_at', null)
    .order('gramasi')

  if (byBatch && byBatch.length > 0) {
    produksiItems = byBatch
  } else if (peleburanIds.length > 0) {
    // fallback: ambil via peleburan_id
    const { data: byPeleburan } = await supabase
      .from('produksi_item')
      .select('id, kode, gramasi, pcs, total_gram, current_status, peleburan_id, sisa_serbuk, berat_reject, berat_reject_dilebur')
      .in('peleburan_id', peleburanIds)
      .is('voided_at', null)
      .order('gramasi')
    produksiItems = byPeleburan ?? []
  }

  return (
    <LaporanBatchDetail
      batch={batch as any}
      peleburans={(peleburans ?? []) as any}
      produksiItems={produksiItems as any}
      packings={(packings ?? []) as any}
      shieldtags={(shieldtags ?? []) as any}
      userRole={role}
    />
  )
}
