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
    { data: tolPlbRow },
    { data: tims },
    { data: adminRows },
    { data: lossApprovalRows },
  ] = await Promise.all([
    supabase.from('batch').select('*').order('created_at', { ascending: false }),
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('peleburan')
      .select('id, kode, batch_kode, tanggal, jam_mulai, dikasih_gram, diterima_gram, losses_gram, sumber_batch_gram, operator, keterangan_serahkan, foto_serahkan, tanggal_diterima, jam_selesai, operator_diterima, keterangan_diterima, foto_diterima, status, tim_id, tim_nama, admin_input, tim_anggota_aktif')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('produksi_item')
      .select('peleburan_id, total_gram')
      .is('voided_at', null)
      .not('peleburan_id', 'is', null),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, nama_item, berat_reject, reject_cutting_gram, current_status, batch_kode')
      .eq('status_reject', 'belum_dilebur')
      .gt('berat_reject', 0)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('produksi_item')
      .select('batch_kode, total_gram, losses_cutting, reject_cutting_gram, voided_at')
      .is('voided_at', null),
    supabase.from('pengaturan').select('value').eq('key', 'toleransi_loss_peleburan').maybeSingle(),
    supabase.from('tim_produksi')
      .select('id, nama, warna, aktif, anggota:tim_anggota(id, nama, aktif)')
      .eq('aktif', true).is('voided_at', null).order('id'),
    supabase.from('admin_input').select('id, nama').is('voided_at', null).order('id'),
    // Loss approval untuk peleburan — load alasan + TTD info
    supabase.from('loss_approval')
      .select('ref_id, alasan, operator_nama, admin_nama, ttd_operator_url, ttd_admin_url, created_at')
      .eq('proses', 'peleburan')
      .eq('ref_table', 'peleburan')
      .order('created_at', { ascending: false }),
  ])

  const usageMap: Record<number, number> = {}
  for (const item of produksiUsage ?? []) {
    if (item.peleburan_id) {
      usageMap[item.peleburan_id] = (usageMap[item.peleburan_id] ?? 0) + parseFloat(item.total_gram ?? '0')
    }
  }

  // Map loss_approval by ref_id (peleburan.id) — ambil yang paling baru
  const lossMap: Record<number, any> = {}
  for (const la of lossApprovalRows ?? []) {
    if (la.ref_id != null && !lossMap[la.ref_id]) {
      lossMap[la.ref_id] = la
    }
  }

  const peleburanList = (peleburanRaw ?? []).map(p => ({
    ...p,
    sisa_gram: p.diterima_gram != null
      ? parseFloat(String(p.diterima_gram)) - (usageMap[p.id] ?? 0)
      : null,
    loss_approval: lossMap[p.id] ?? null,
  }))

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
      toleransiPeleburan={parseFloat(tolPlbRow?.value ?? '0.05') || 0.05}
      tims={tims ?? []}
      adminList={adminRows ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
