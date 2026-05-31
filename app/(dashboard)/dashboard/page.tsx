import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today        = new Date().toISOString().split('T')[0]
  const sixMonthsAgo = new Date(Date.now() - 180*86400000).toISOString().split('T')[0]

  const [
    { data: profile },
    // Batch aktif
    { data: batchAktifList },
    // Produksi hari ini
    { count: produksiHariIni },
    // Siap Packing
    { count: siapPacking },
    // Reject
    { data: rejectData },
    // Stok Gudang CJ: packing sudah cetak
    { data: packingCetak },
    // ST aktif di gudang
    { count: stGudangAktif },
    // Stok cabang (ST Terdistribusi)
    { count: stokCabang },
    // Mutasi transit
    { count: mutasiTransit },
    // Produksi terbaru
    { data: produksiTerbaru },
    // Produksi per bulan
    { data: produksiBulanan },
    // Status breakdown
    { data: statusBreakdown },
    // Pengaturan
    { data: settingGudang },
    // Batch sisa bahan
    { data: batchList },
    // Mutasi terbaru
    { data: mutasiTerbaru },
  ] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user?.id ?? '').single(),
    supabase.from('batch').select('kode, timbangan_akhir').eq('status','aktif').is('voided_at',null),
    supabase.from('produksi_item').select('*',{count:'exact',head:true}).gte('created_at', today+'T00:00:00').is('voided_at',null),
    supabase.from('produksi_item').select('*',{count:'exact',head:true}).eq('current_status','Siap Packing').is('voided_at',null),
    supabase.from('produksi_item').select('pcs_reject').is('voided_at',null).gt('pcs_reject',0),
    supabase.from('packing').select('pcs_dipack, gramasi, produksi_item:produksi_item_id(nama_item, produk:produk_id(nama))').eq('status_surat','sudah_cetak').is('voided_at',null),
    supabase.from('shieldtag').select('*',{count:'exact',head:true}).eq('status','Aktif').is('voided_at',null),
    supabase.from('shieldtag').select('*',{count:'exact',head:true}).eq('status','Terdistribusi').is('voided_at',null),
    supabase.from('mutasi').select('*',{count:'exact',head:true}).eq('status','transit'),
    supabase.from('produksi_item')
      .select('kode, gramasi, pcs, pcs_good, pcs_reject, current_status, created_at, tanggal, batch_kode, nama_item, total_gram')
      .is('voided_at',null).order('created_at',{ascending:false}).limit(8),
    supabase.from('produksi_item')
      .select('tanggal_produksi, pcs_good, total_gram')
      .is('voided_at',null).gte('tanggal_produksi', sixMonthsAgo),
    supabase.from('produksi_item').select('current_status, pcs_good').is('voided_at',null).not('current_status','is',null),
    supabase.from('pengaturan').select('value').eq('key','nama_gudang').single(),
    supabase.from('batch').select('kode, nama_batch, timbangan_akhir, sisa_bahan_seharusnya, hpp_gr, tanggal, status').is('voided_at',null).order('created_at',{ascending:false}).limit(8),
    supabase.from('mutasi').select('nomor, tanggal, dari_lokasi, ke_lokasi, status, pcs').is('voided_at',null).order('created_at',{ascending:false}).limit(5),
  ])

  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  // Stok Gudang CJ
  const stokGudangTotal = (packingCetak ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack ?? 0), 0)
  const stGudangPending = stokGudangTotal - (stGudangAktif ?? 0)

  // Batch aktif: total gram
  const totalBahanAktif = (batchAktifList ?? []).reduce((s: number, b: any) => s + parseFloat(b.timbangan_akhir ?? 0), 0)

  // Reject
  const totalRejectPcs = (rejectData ?? []).reduce((s: number, i: any) => s + (i.pcs_reject ?? 0), 0)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  ;(statusBreakdown ?? []).forEach((item: any) => {
    const st = item.current_status
    statusMap[st] = (statusMap[st] ?? 0) + (item.pcs_good ?? 0)
  })
  const statusChartData = Object.entries(statusMap).map(([status, pcs]) => ({ status, pcs })).sort((a, b) => b.pcs - a.pcs)

  // Produksi per bulan — dual: pcs + gram
  const monthMap: Record<string, { pcs: number; gram: number }> = {}
  ;(produksiBulanan ?? []).forEach((item: any) => {
    const month = (item.tanggal_produksi ?? '').slice(0, 7)
    if (!month) return
    if (!monthMap[month]) monthMap[month] = { pcs: 0, gram: 0 }
    monthMap[month].pcs  += item.pcs_good ?? 0
    monthMap[month].gram += parseFloat(item.total_gram ?? 0)
  })
  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const produksiChart = Object.entries(monthMap)
    .sort(([a],[b]) => a.localeCompare(b)).slice(-6)
    .map(([month, d]) => ({
      bulan: BULAN[parseInt(month.slice(5,7)) - 1],
      pcs: d.pcs,
      gram: Math.round(d.gram * 100) / 100,
    }))

  // Batch sisa bahan
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
        batchAktif:      (batchAktifList ?? []).length,
        totalBahanAktif: Math.round(totalBahanAktif * 100) / 100,
        produksiHariIni: produksiHariIni ?? 0,
        siapPacking:     siapPacking ?? 0,
        totalRejectPcs,
        stokGudangTotal,
        stGudangAktif:   stGudangAktif ?? 0,
        stGudangPending: Math.max(0, stGudangPending),
        stokCabang:      stokCabang ?? 0,
        mutasiTransit:   mutasiTransit ?? 0,
      }}
      produksiTerbaru={produksiTerbaru ?? []}
      batchSisa={batchSisa}
      produksiChart={produksiChart}
      statusChartData={statusChartData}
      mutasiTerbaru={mutasiTerbaru ?? []}
    />
  )
}
