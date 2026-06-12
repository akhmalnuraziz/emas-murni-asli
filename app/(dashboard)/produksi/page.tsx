import { createClient } from '@/lib/supabase/server'
import ProduksiClient from '@/components/modules/produksi/produksi-client'

export const dynamic = 'force-dynamic'

export default async function ProduksiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: produksiList },
    { data: batches },
    { data: peleburanRaw },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('produksi_item')
      .select(`*, produksi_event(*), packing!left(pcs_dipack, shieldtag_count, voided_at), batch!left(sisa_bahan_seharusnya, sisa_fisik, timbangan_akhir, bahan_dari_pusat), stage_handover(*)`)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase.from('batch')
      .select('kode, nama_batch, sisa_bahan_seharusnya, timbangan_akhir, bahan_siap_cetak')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('peleburan')
      .select('id, kode, batch_kode, diterima_gram, terpakai_cetak')
      .eq('status', 'selesai')
      .is('voided_at', null)
      .order('id'),
  ])

  // Map peleburan tersedia per batch (sisa jatah > 0) — di-pass ke client biar tidak loading saat modal dibuka
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
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}

