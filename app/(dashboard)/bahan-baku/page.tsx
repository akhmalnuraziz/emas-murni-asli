import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BahanBakuClient from '@/components/modules/bahan-baku/bahan-baku-client'

export const dynamic = 'force-dynamic'

export default async function BahanBakuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const q = sp.q?.trim() ?? ''

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
    { data: batchLossRows },
  ] = await Promise.all([
    (() => {
      const bq = supabase.from('batch').select('*').order('created_at', { ascending: false })
      return q ? bq.or(`kode.ilike.%${q}%,nama_batch.ilike.%${q}%,supplier.ilike.%${q}%`).limit(200) : bq.limit(200)
    })(),
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
      .select('id, kode, gramasi, nama_item, berat_reject, berat_reject_dilebur, reject_cutting_gram, pcs_reject, pcs_reject_dilebur, current_status, batch_kode, stage_handover(tahap, reject_gram, reject_pcs, voided_at)')
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
    supabase.from('loss_approval')
      .select('ref_id, alasan, operator_nama, admin_nama, ttd_operator_url, ttd_admin_url, created_at')
      .eq('proses', 'peleburan')
      .eq('ref_table', 'peleburan')
      .order('created_at', { ascending: false }),
    supabase.from('loss_approval')
      .select('ref_id, alasan, operator_nama, admin_nama, ttd_operator_url, ttd_admin_url, created_at')
      .eq('proses', 'batch_selisih')
      .eq('ref_table', 'batch')
      .order('created_at', { ascending: false }),
  ])

  const usageMap: Record<number, number> = {}
  for (const item of produksiUsage ?? []) {
    if (item.peleburan_id) {
      usageMap[item.peleburan_id] = (usageMap[item.peleburan_id] ?? 0) + parseFloat(item.total_gram ?? '0')
    }
  }

  const lossMap: Record<number, any> = {}
  for (const la of lossApprovalRows ?? []) {
    if (la.ref_id != null && !lossMap[la.ref_id]) lossMap[la.ref_id] = la
  }

  const peleburanList = (peleburanRaw ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    sisa_gram: p.diterima_gram != null
      ? parseFloat(String(p.diterima_gram)) - (usageMap[Number(p.id)] ?? 0)
      : null,
    loss_approval: lossMap[Number(p.id)] ?? null,
  }))

  const batchLossMap: Record<number, any> = {}
  for (const bla of batchLossRows ?? []) {
    if (bla.ref_id != null && !batchLossMap[bla.ref_id]) batchLossMap[bla.ref_id] = bla
  }

  // Hitung SISA reject (belum dilebur) + label sumber yang tersisa (FIFO: cutting → pas berat → annealing → siap packing)
  // "Sudah dilebur" diambil dari berat_reject_dilebur (di-set semua jalur lebur: createPeleburan & leburReject)
  const STAGE_LABEL: Record<string, string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  const enrichedReject = (rejectItems ?? []).map((r: any) => {
    const dilebur = Number(r.berat_reject_dilebur ?? 0)
    const sh = (r.stage_handover ?? []).filter((h: any) => !h.voided_at)
    const sources = [
      { label: 'Cutting', gram: Number(r.reject_cutting_gram ?? 0), pcs: 0 },
      ...['pas_berat', 'annealing', 'siap_packing'].map(tahap => {
        const h = sh.find((x: any) => x.tahap === tahap)
        return { label: STAGE_LABEL[tahap], gram: Number(h?.reject_gram ?? 0), pcs: Number(h?.reject_pcs ?? 0) }
      }),
    ].filter(s => s.gram > 0.0001)
    const stagePcs = sources.filter(s => s.label !== 'Cutting').reduce((a, s) => a + s.pcs, 0)
    const cut = sources.find(s => s.label === 'Cutting')
    if (cut) cut.pcs = Math.max(0, Number(r.pcs_reject ?? 0) - stagePcs)

    let melted = dilebur
    const remaining: { label: string; gram: number; pcs: number }[] = []
    for (const s of sources) {
      if (melted >= s.gram - 0.0001) { melted -= s.gram; continue } // sumber ini sudah habis dilebur
      remaining.push({ label: s.label, gram: s.gram - melted, pcs: s.pcs })
      melted = 0
    }
    const sisaGram = Math.max(0, Number(r.berat_reject ?? 0) - dilebur)
    return {
      ...r,
      sisa_reject_gram: sisaGram,
      sisa_pcs: remaining.reduce((a, s) => a + s.pcs, 0),
      sisa_label: remaining.length ? 'Reject ' + remaining.map(s => s.label).join(', ') : 'Reject',
    }
  }).filter((r: any) => r.sisa_reject_gram > 0.0001)

  const rejectCountMap: Record<string, number> = {}
  for (const r of enrichedReject) {
    if (r.batch_kode) rejectCountMap[r.batch_kode] = (rejectCountMap[r.batch_kode] ?? 0) + 1
  }

  return (
    <BahanBakuClient
      batches={batches ?? []}
      peleburanList={peleburanList}
      rejectItems={enrichedReject}
      produksiItems={produksiItems ?? []}
      rejectCountMap={rejectCountMap}
      toleransiPeleburan={parseFloat(tolPlbRow?.value ?? '0.05') || 0.05}
      tims={tims ?? []}
      adminList={adminRows ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      batchLossMap={batchLossMap}
      currentQ={q}
    />
  )
}
