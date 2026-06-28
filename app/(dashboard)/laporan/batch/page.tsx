import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LaporanBatchList from './laporan-batch-list'

export const dynamic = 'force-dynamic'

export default async function LaporanBatchListPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const q = (sp?.q ?? '').trim().toUpperCase()
  const statusFilter = sp?.status ?? 'semua'

  let batchQuery = supabase
    .from('batch')
    .select('kode, tanggal, supplier, bahan_dari_pusat, bahan_siap_cetak, timbangan_akhir, hpp_gr, status')
    .is('voided_at', null)
    .order('tanggal', { ascending: false })
  if (q) batchQuery = batchQuery.ilike('kode', `%${q}%`)
  if (statusFilter === 'aktif') batchQuery = batchQuery.eq('status', 'aktif')
  else if (statusFilter === 'selesai') batchQuery = batchQuery.eq('status', 'terkunci')

  const [
    { data: batches },
    { data: stSummary },
    { data: packSummary },
    { data: peleburanSummary },
    { data: pipelineSummary },
  ] = await Promise.all([
    batchQuery.limit(500),
    supabase.from('shieldtag').select('batch_kode, status').is('voided_at', null),
    supabase.from('packing').select('batch_kode, pcs_dipack').is('voided_at', null),
    supabase.from('peleburan').select('batch_kode, dikasih_gram, diterima_gram').is('voided_at', null),
    supabase.from('produksi_item')
      .select('batch_kode, current_status, pcs')
      .is('voided_at', null),
  ])

  // Shieldtag per batch
  const stMap: Record<string, { aktif: number; terjual: number; transit: number; total: number }> = {}
  for (const s of stSummary ?? []) {
    const k = s.batch_kode ?? ''
    if (!stMap[k]) stMap[k] = { aktif: 0, terjual: 0, transit: 0, total: 0 }
    stMap[k].total++
    if (s.status === 'Aktif') stMap[k].aktif++
    else if (s.status === 'Terjual') stMap[k].terjual++
    else if (s.status === 'Transit') stMap[k].transit++
  }

  // Packing per batch
  const packMap: Record<string, number> = {}
  for (const p of packSummary ?? []) {
    const k = p.batch_kode ?? ''
    packMap[k] = (packMap[k] ?? 0) + (p.pcs_dipack ?? 0)
  }

  // Peleburan per batch
  const lebMap: Record<string, { dikasih: number; diterima: number }> = {}
  for (const l of peleburanSummary ?? []) {
    const k = l.batch_kode ?? ''
    if (!lebMap[k]) lebMap[k] = { dikasih: 0, diterima: 0 }
    lebMap[k].dikasih += Number(l.dikasih_gram ?? 0)
    lebMap[k].diterima += Number(l.diterima_gram ?? 0)
  }

  // Pipeline status per batch
  const PIPELINE_STAGES = ['Cutting', 'Annealing', 'Pas Berat', 'QC', 'Siap Packing', 'Sudah Packing', 'Reject']
  const pipelineMap: Record<string, Record<string, number>> = {}
  for (const p of pipelineSummary ?? []) {
    const k = p.batch_kode ?? ''
    const s = p.current_status ?? 'Unknown'
    if (!pipelineMap[k]) pipelineMap[k] = {}
    pipelineMap[k][s] = (pipelineMap[k][s] ?? 0) + (p.pcs ?? 1)
  }

  const totalBatch = batches?.length ?? 0
  const totalAktif = batches?.filter(b => b.status === 'aktif').length ?? 0
  const totalSelesai = batches?.filter(b => b.status === 'terkunci').length ?? 0
  const totalPcs = Object.values(packMap).reduce((s, v) => s + v, 0)
  const totalShieldtag = Object.values(stMap).reduce((s, v) => s + v.total, 0)

  return (
    <LaporanBatchList
      batches={batches ?? []}
      stMap={stMap}
      packMap={packMap}
      lebMap={lebMap}
      pipelineMap={pipelineMap}
      stats={{ totalBatch, totalAktif, totalSelesai, totalPcs, totalShieldtag }}
      currentQ={q}
      currentStatus={statusFilter}
    />
  )
}
