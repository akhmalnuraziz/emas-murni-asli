import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  const [
    { count: totalShieldtagAktif },
    { count: totalProduksiHariIni },
    { count: totalSiapPacking },
    { count: totalReject },
    { count: totalBatchAktif },
    { data: produksiTerbaru },
    { data: batchTerbaru },
    { data: shieldtagByGramasi },
  ] = await Promise.all([
    supabase.from('shieldtag').select('*', { count: 'exact', head: true }).eq('status', 'Aktif'),
    supabase.from('produksi_item').select('*', { count: 'exact', head: true })
      .gte('created_at', today),
    supabase.from('produksi_item').select('*', { count: 'exact', head: true })
      .eq('current_status', 'Siap Packing').is('voided_at', null),
    supabase.from('produksi_item').select('*', { count: 'exact', head: true })
      .eq('current_status', 'Reject').is('voided_at', null),
    supabase.from('batch').select('*', { count: 'exact', head: true }).is('voided_at', null),
    supabase.from('produksi_item').select('kode, gramasi, pcs, current_status, created_at, batch_kode')
      .is('voided_at', null).order('created_at', { ascending: false }).limit(6),
    supabase.from('batch').select('kode, tanggal, timbangan_akhir, sisa_fisik, hpp_gr')
      .is('voided_at', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('shieldtag').select('gramasi').eq('status', 'Aktif'),
  ])

  // Aggregate shieldtag by gramasi
  const gramasiCount: Record<string, number> = {}
  shieldtagByGramasi?.forEach((s: any) => {
    if (s.gramasi) {
      gramasiCount[s.gramasi] = (gramasiCount[s.gramasi] || 0) + 1
    }
  })
  const gramasiChartData = Object.entries(gramasiCount)
    .map(([gramasi, pcs]) => ({ gramasi: `${gramasi}gr`, pcs }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))
    .slice(0, 8)

  const stats = {
    shieldtagAktif: totalShieldtagAktif ?? 0,
    produksiHariIni: totalProduksiHariIni ?? 0,
    siapPacking: totalSiapPacking ?? 0,
    reject: totalReject ?? 0,
    batchAktif: totalBatchAktif ?? 0,
  }

  return (
    <DashboardClient
      stats={stats}
      produksiTerbaru={produksiTerbaru ?? []}
      batchTerbaru={batchTerbaru ?? []}
      gramasiChartData={gramasiChartData}
    />
  )
}
