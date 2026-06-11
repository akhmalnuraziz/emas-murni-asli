import { createClient } from '@/lib/supabase/server'
import BahanBakuClient from '@/components/modules/bahan-baku/bahan-baku-client'

export default async function BahanBakuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: batches },
    { data: profile },
    { data: peleburanRaw },
    { data: produksiUsage },
    { data: rejectItems },
    { data: produksiItems },
  ] = await Promise.all([
    supabase.from('batch').select('*').order('created_at', { ascending: false }),
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('peleburan')
      .select('id, kode, batch_kode, tanggal, jam_mulai, dikasih_gram, diterima_gram, losses_gram, sumber_batch_gram, operator, keterangan_serahkan, foto_serahkan, tanggal_diterima, jam_selesai, operator_diterima, keterangan_diterima, foto_diterima, status')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    // Hitung berapa dari tiap peleburan sudah dipakai produksi
    supabase.from('produksi_item')
      .select('peleburan_id, total_gram')
      .is('voided_at', null)
      .not('peleburan_id', 'is', null),
    // Reject items belum dilebur ulang
    supabase.from('produksi_item')
      .select('id, kode, gramasi, nama_item, berat_reject, reject_cutting_gram, current_status, batch_kode')
      .eq('status_reject', 'belum_dilebur')
      .gt('berat_reject', 0)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    // Produksi items untuk rekonsiliasi + losses table
    supabase.from('produksi_item')
      .select('batch_kode, total_gram, losses_cutting, reject_cutting_gram, voided_at')
      .is('voided_at', null),
  ])

  // Compute sisa_gram per peleburan = diterima - sudah dipakai produksi
  const usageMap: Record<number, number> = {}
  for (const item of produksiUsage ?? []) {
    if (item.peleburan_id) {
      usageMap[item.peleburan_id] = (usageMap[item.peleburan_id] ?? 0) + parseFloat(item.total_gram ?? '0')
    }
  }

  const peleburanList = (peleburanRaw ?? []).map(p => ({
    ...p,
    sisa_gram: p.diterima_gram != null
      ? parseFloat(String(p.diterima_gram)) - (usageMap[p.id] ?? 0)
      : null,
  }))

  // rejectCountMap for badge on batch card
  const rejectCountMap: Record<string, number> = {}
  for (const r of rejectItems ?? []) {
    if (r.batch_kode) rejectCountMap[r.batch_kode] = (rejectCountMap[r.batch_kode] ?? 0) + 1
  }

  return (
    <BahanBakuClient
      batches={batches ?? []}
      peleburanList={peleburanList}
      rejectItems={rejectItems ?? []}
      produksiItems={produksiItems ?? []}
      rejectCountMap={rejectCountMap}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}

