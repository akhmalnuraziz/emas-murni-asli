import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProduksiClient from '@/components/modules/produksi/produksi-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function ProduksiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const status = sp.status ?? 'Semua'
  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  let prodQuery = supabase
    .from('produksi_item')
    .select(`*, produksi_event(*), packing!left(pcs_dipack, shieldtag_count, voided_at), batch!left(sisa_bahan_seharusnya, sisa_fisik, timbangan_akhir, bahan_dari_pusat), stage_handover(*)`, { count: 'exact' })
    .is('voided_at', null)
    .order('created_at', { ascending: false })

  if (q) {
    prodQuery = prodQuery.or(`kode.ilike.%${q}%,nama_item.ilike.%${q}%,batch_kode.ilike.%${q}%`)
  }
  if (status !== 'Semua') {
    prodQuery = prodQuery.eq('current_status', status)
  }
  prodQuery = prodQuery.range(offset, offset + PAGE_SIZE - 1)

  const [
    { data: profile },
    { data: produksiList, count },
    { data: batches },
    { data: peleburanRaw },
    { data: tims },
    { data: toleransiRows },
    { data: adminRows },
    { data: lossApprovalRows },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user.id).single(),
    prodQuery,
    supabase.from('batch')
      .select('kode, nama_batch, sisa_bahan_seharusnya, timbangan_akhir, bahan_siap_cetak')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('peleburan')
      .select('id, kode, batch_kode, diterima_gram, terpakai_cetak')
      .eq('status', 'selesai')
      .is('voided_at', null)
      .order('id'),
    supabase.from('tim_produksi')
      .select('id, nama, warna, aktif, anggota:tim_anggota(id, nama, aktif)')
      .eq('aktif', true).is('voided_at', null).order('id'),
    supabase.from('pengaturan').select('key, value').like('key', 'toleransi_loss%'),
    supabase.from('admin_input').select('id, nama').is('voided_at', null).order('id'),
    supabase.from('loss_approval')
      .select('id, proses, ref_table, ref_id, alasan, operator_nama, admin_nama, ttd_operator_url, ttd_admin_url, loss_gram, created_at')
      .neq('proses', 'peleburan')
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const toleransi: Record<string, number> = {}
  for (const r of toleransiRows ?? []) {
    toleransi[r.key.replace('toleransi_loss_', '')] = parseFloat(r.value) || 0.05
  }

  const peleburanByBatch: Record<string, { id: number; kode: string; diterima: number; terpakai: number; sisa: number }[]> = {}
  for (const p of peleburanRaw ?? []) {
    const sisa = Number(p.diterima_gram ?? 0) - Number(p.terpakai_cetak ?? 0)
    if (sisa <= 0.001) continue
    if (!peleburanByBatch[p.batch_kode]) peleburanByBatch[p.batch_kode] = []
    peleburanByBatch[p.batch_kode].push({
      id: p.id, kode: p.kode,
      diterima: Number(p.diterima_gram ?? 0),
      terpakai: Number(p.terpakai_cetak ?? 0),
      sisa,
    })
  }

  return (
    <ProduksiClient
      produksiList={produksiList ?? []}
      batches={batches ?? []}
      peleburanByBatch={peleburanByBatch}
      tims={tims ?? []}
      toleransi={toleransi}
      adminList={adminRows ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      lossApprovals={lossApprovalRows ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      currentQ={q}
      currentStatus={status}
    />
  )
}
