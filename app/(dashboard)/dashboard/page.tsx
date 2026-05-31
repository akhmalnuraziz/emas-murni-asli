import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const weekAgo   = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(Date.now() - 180*86400000).toISOString().split('T')[0]

  const [
    { data: profile },
    // Summary counts
    { count: batchAktif },
    { count: siapPacking },
    { count: packing_transit },
    { count: mutasiTransit },
    // Stok gudang (packing sudah cetak)
    { data: packingCetak },
    // Reject total
    { data: rejectData },
    // Produksi terbaru
    { data: produksiTerbaru },
    // Batch list (sisa bahan)
    { data: batchList },
    // Produksi per bulan (6 bulan)
    { data: produksiBulanan },
    // Status breakdown
    { data: statusBreakdown },
    // Pengaturan
    { data: settingGudang },
    // Mutasi terbaru
    { data: mutasiTerbaru },
  ] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user?.id ?? '').single(),
    supabase.from('batch').select('*', { count:'exact', head:true }).eq('status','aktif').is('voided_at',null),
    supabase.from('produksi_item').select('*', { count:'exact', head:true }).eq('current_status','Siap Packing').is('voided_at',null),
    supabase.from('packing').select('*', { count:'exact', head:true }).neq('status_surat','sudah_cetak').is('voided_at',null),
    supabase.from('mutasi').select('*', { count:'exact', head:true }).eq('status','transit'),
    supabase.from('packing').select('pcs_dipack, gramasi, produksi_item:produksi_item_id(nama_item, produk:produk_id(nama))').eq('status_surat','sudah_cetak').is('voided_at',null),
    supabase.from('produksi_item').select('pcs_reject, berat_reject').is('voided_at',null).gt('pcs_reject',0),
    supabase.from('produksi_item')
      .select('kode, gramasi, pcs, pcs_good, pcs_reject, current_status, created_at, tanggal, batch_kode, nama_item, total_gram')
      .is('voided_at',null)
      .order('created_at', { ascending:false })
      .limit(8),
    supabase.from('batch')
      .select('kode, nama_batch, timbangan_akhir, sisa_bahan_seharusnya, sisa_fisik, hpp_gr, tanggal, status')
      .is('voided_at',null)
      .order('created_at', { ascending:false })
      .limit(10),
    supabase.from('produksi_item')
      .select('tanggal_produksi, pcs_good, total_gram')
      .is('voided_at',null)
      .gte('tanggal_produksi', sixMonthsAgo),
    supabase.from('produksi_item')
      .select('current_status, pcs_good')
      .is('voided_at',null)
      .not('current_status','is',null),
    supabase.from('pengaturan').select('value').eq('key','nama_gudang').single(),
    supabase.from('mutasi')
      .select('nomor, tanggal, dari_lokasi, ke_lokasi, status, pcs')
      .is('voided_at',null)
      .order('created_at', { ascending:false })
      .limit(5),
  ])

  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  // Stok gudang total pcs
  const stokGudang = (packingCetak ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack ?? 0), 0)

  // Total reject pcs + berat
  const totalRejectPcs   = (rejectData ?? []).reduce((s: number, i: any) => s + (i.pcs_reject ?? 0), 0)

  // Status breakdown for donut
  const statusMap: Record<string, number> = {}
  ;(statusBreakdown ?? []).forEach((item: any) => {
    const st = item.current_status
    if (!statusMap[st]) statusMap[st] = 0
    statusMap[st] += item.pcs_good ?? 0
  })
  const statusChartData = Object.entries(statusMap)
    .map(([status, pcs]) => ({ status, pcs }))
    .sort((a, b) => b.pcs - a.pcs)

  // Produksi per bulan (last 6 months)
  const monthMap: Record<string, { pcs: number; gram: number }> = {}
  ;(produksiBulanan ?? []).forEach((item: any) => {
    const month = (item.tanggal_produksi ?? '').slice(0, 7)
    if (!month) return
    if (!monthMap[month]) monthMap[month] = { pcs: 0, gram: 0 }
    monthMap[month].pcs  += item.pcs_good  ?? 0
    monthMap[month].gram += parseFloat(item.total_gram ?? 0)
  })
  const bulanLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const produksiChart = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, data]) => ({
      bulan: bulanLabels[parseInt(month.slice(5,7)) - 1],
      pcs: data.pcs,
      gram: Math.round(data.gram * 100) / 100,
    }))

  // Batch dengan sisa bahan terendah (persentase sisa/awal)
  const batchSisa = (batchList ?? [])
    .filter((b: any) => b.timbangan_akhir > 0)
    .map((b: any) => ({
      ...b,
      sisaPct: Math.round(((b.sisa_bahan_seharusnya ?? b.timbangan_akhir) / b.timbangan_akhir) * 100),
    }))
    .sort((a: any, b: any) => a.sisaPct - b.sisaPct)
    .slice(0, 4)

  return (
    <DashboardClient
      namaGudang={namaGudang}
      userName={profile?.name ?? ''}
      userRole={profile?.role ?? ''}
      today={today}
      stats={{
        batchAktif:    batchAktif    ?? 0,
        siapPacking:   siapPacking   ?? 0,
        stokGudang,
        totalRejectPcs,
        mutasiTransit: mutasiTransit ?? 0,
        packingTransit: packing_transit ?? 0,
      }}
      produksiTerbaru={produksiTerbaru ?? []}
      batchSisa={batchSisa}
      produksiChart={produksiChart}
      statusChartData={statusChartData}
      mutasiTerbaru={mutasiTerbaru ?? []}
    />
  )
}
