import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EfisiensiClient from './efisiensi-client'

export const dynamic = 'force-dynamic'

export default async function EfisiensiPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: const allowed = ['owner', 'manager', 'admin_pusat', 'spv', 'accounting']
  // ROLE_CHECK_DISABLED: if (!allowed.includes(profile?.role ?? '')) redirect('/dashboard')

  const sp = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const dateFrom = sp?.from ?? ''
  const dateTo   = sp?.to   ?? ''

  let batchQ = supabase
    .from('batch')
    .select('kode, tanggal, supplier, bahan_dari_pusat, bahan_siap_cetak, timbangan_akhir, status')
    .is('voided_at', null)
    .order('tanggal', { ascending: false })
  if (dateFrom) batchQ = batchQ.gte('tanggal', dateFrom)
  if (dateTo)   batchQ = batchQ.lte('tanggal', dateTo)

  const [
    { data: batches },
    { data: produksiItems },
    { data: peleburans },
    { data: packingRejects },
  ] = await Promise.all([
    batchQ,
    supabase.from('produksi_item').select('batch_kode, total_gram, current_status, peleburan_id').is('voided_at', null),
    supabase.from('peleburan').select('batch_kode, dikasih_gram, diterima_gram').is('voided_at', null),
    supabase.from('packing').select('batch_kode, gram_reject, gram_reject_dilebur').gt('gram_reject', 0).is('voided_at', null),
  ])

  // Produksi Jadi per batch = sum of total_gram (semua item yg diproduksi)
  const itemMap: Record<string, { produksiJadi: number; rejectBelumLebur: number }> = {}
  for (const p of produksiItems ?? []) {
    const k = p.batch_kode ?? ''
    if (!itemMap[k]) itemMap[k] = { produksiJadi: 0, rejectBelumLebur: 0 }
    const gr = Number(p.total_gram ?? 0)
    if (p.current_status === 'Reject' && !p.peleburan_id) {
      itemMap[k].rejectBelumLebur += gr
    } else if (p.current_status !== 'Reject') {
      itemMap[k].produksiJadi += gr
    }
  }
  // Tambah packing reject yang belum dilebur
  for (const pk of packingRejects ?? []) {
    const k = pk.batch_kode ?? ''
    if (!k) continue
    if (!itemMap[k]) itemMap[k] = { produksiJadi: 0, rejectBelumLebur: 0 }
    const sisa = Math.max(0, Number(pk.gram_reject ?? 0) - Number(pk.gram_reject_dilebur ?? 0))
    itemMap[k].rejectBelumLebur += sisa
  }

  // Serbuk per batch = losses dari peleburan (dikasih - diterima)
  const serbukMap: Record<string, number> = {}
  for (const l of peleburans ?? []) {
    const k = l.batch_kode ?? ''
    serbukMap[k] = (serbukMap[k] ?? 0) + Math.max(0, Number(l.dikasih_gram ?? 0) - Number(l.diterima_gram ?? 0))
  }

  const rows = (batches ?? []).map(b => {
    const bahanBaku   = Number(b.bahan_dari_pusat ?? 0)
    const sb          = Number(b.bahan_siap_cetak ?? 0)
    const items       = itemMap[b.kode] ?? { produksiJadi: 0, rejectBelumLebur: 0 }
    const produksiJadi = items.produksiJadi
    const serbuk      = serbukMap[b.kode] ?? 0
    const reject      = items.rejectBelumLebur
    const totalLoses  = bahanBaku - produksiJadi - sb - serbuk - reject
    const losesPct    = bahanBaku > 0 ? ((bahanBaku - produksiJadi) / bahanBaku * 100) : 0
    const efisiensiPct = bahanBaku > 0 ? (produksiJadi / bahanBaku * 100) : 0
    return { kode: b.kode, tanggal: b.tanggal, supplier: b.supplier, status: b.status, bahanBaku, produksiJadi, sb, serbuk, reject, totalLoses, losesPct, efisiensiPct }
  }).filter(r => r.bahanBaku > 0)

  return <EfisiensiClient rows={rows} dateFrom={dateFrom} dateTo={dateTo} />
}
