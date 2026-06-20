import { createClient } from '@/lib/supabase/server'
import LaporanClient from '@/components/modules/laporan/laporan-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile').select('role,name').eq('id', user?.id ?? '').single()

  const [
    { data: produksiItems },
    { data: packings },
    { data: shieldtags },
    { data: penjualanRaw },
    { data: buybackRaw },
    { data: mutasiRaw },
    { data: batches },
  ] = await Promise.all([
    supabase.from('produksi_item').select('total_gram').is('voided_at', null),
    supabase.from('packing').select('pcs').is('voided_at', null),
    supabase.from('shieldtag').select('status').is('voided_at', null),
    supabase.from('penjualan').select('gramasi, pcs, harga_jual').is('voided_at' as any, null),
    supabase.from('buyback').select('id').is('voided_at', null),
    supabase.from('mutasi').select('pcs').eq('status_kirim', 'Sudah Dikirim'),
    supabase.from('batch').select('kode, tanggal, supplier, timbangan_akhir, hpp_gr, status').is('voided_at', null).order('created_at', { ascending: false }),
  ])

  const totalProduksiGram = (produksiItems ?? []).reduce((a, r) => a + (Number(r.total_gram) || 0), 0)
  const totalPackingPcs   = (packings ?? []).reduce((a, r) => a + (Number(r.pcs) || 0), 0)
  const totalShieldtagAktif = (shieldtags ?? []).filter(s => s.status === 'Aktif').length
  const totalTerjual      = (shieldtags ?? []).filter(s => s.status === 'Terjual').length
  const totalBuyback      = (buybackRaw ?? []).length
  const totalMutasiKeluar = (mutasiRaw ?? []).reduce((a, r) => a + (Number(r.pcs) || 0), 0)

  // Group penjualan by gramasi
  const gMap = new Map<string, { pcs: number; total: number }>()
  for (const p of penjualanRaw ?? []) {
    const g = p.gramasi ?? '?'
    const cur = gMap.get(g) ?? { pcs: 0, total: 0 }
    gMap.set(g, { pcs: cur.pcs + (p.pcs || 0), total: cur.total + (Number(p.harga_jual) || 0) })
  }
  const penjualanByGramasi = [...gMap.entries()]
    .map(([gramasi, v]) => ({ gramasi, ...v }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  return (
    <LaporanClient
      summary={{ totalProduksiGram, totalPackingPcs, totalShieldtagAktif, totalTerjual, totalBuyback, totalMutasiKeluar }}
      penjualanByGramasi={penjualanByGramasi}
      batchList={(batches ?? []) as any}
      userRole={profile?.role ?? 'operator_produksi'}
    />
  )
}
