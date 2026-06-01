import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const sixMonthsAgo = new Date(Date.now() - 180*86400000).toISOString().split('T')[0]

  const [
    { data: profile },
    // Batch
    { data: batchAktifList },
    { data: batchTidakAktifList },
    // Siap Packing hari ini
    { count: siapPackingHariIni },
    // Siap Packing kemarin (perbandingan)
    { count: siapPackingKemarin },
    // Reject total
    { data: rejectData },
    // Stok Gudang (packing cetak)
    { data: packingCetak },
    { count: stGudangAktif },
    // Stok Cabang
    { count: stokCabang },
    // Stok Cabang kemarin (perbandingan)
    { count: stokCabangKemarin },
    // Mutasi transit
    { count: mutasiTransit },
    // Produksi terbaru
    { data: produksiTerbaru },
    // Chart per bulan
    { data: produksiBulanan },
    // Status breakdown
    { data: statusBreakdown },
    // Pengaturan
    { data: settingGudang },
    // Batch sisa
    { data: batchList },
    // Mutasi terbaru
    { data: mutasiTerbaru },
    // Notifikasi: item siap packing (untuk bell)
    { data: notifSiapPacking },
    // Notifikasi: mutasi transit
    { data: notifMutasi },
  ] = await Promise.all([
    supabase.from('users_profile').select('name,role').eq('id', user?.id ?? '').single(),
    supabase.from('batch').select('kode,timbangan_akhir,tanggal').eq('status','aktif').is('voided_at',null),
    supabase.from('batch').select('kode,timbangan_akhir,tanggal,status').neq('status','aktif').is('voided_at',null),
    supabase.from('produksi_item').select('*',{count:'exact',head:true}).eq('current_status','Siap Packing').eq('tanggal_produksi',today).is('voided_at',null),
    supabase.from('produksi_item').select('*',{count:'exact',head:true}).eq('current_status','Siap Packing').eq('tanggal_produksi',yesterday).is('voided_at',null),
    supabase.from('produksi_item').select('pcs_reject').is('voided_at',null).gt('pcs_reject',0),
    supabase.from('packing').select('pcs_dipack').eq('status_surat','sudah_cetak').is('voided_at',null),
    supabase.from('shieldtag').select('*',{count:'exact',head:true}).eq('status','Aktif').is('voided_at',null),
    supabase.from('shieldtag').select('*',{count:'exact',head:true}).eq('status','Terdistribusi').is('voided_at',null),
    supabase.from('shieldtag').select('*',{count:'exact',head:true}).eq('status','Terdistribusi').is('voided_at',null).lte('tgl_regis',yesterday),
    supabase.from('mutasi').select('*',{count:'exact',head:true}).eq('status','transit'),
    supabase.from('produksi_item').select('kode,gramasi,pcs,pcs_good,pcs_reject,current_status,created_at,tanggal,tanggal_produksi,batch_kode,nama_item,total_gram').is('voided_at',null).order('created_at',{ascending:false}).limit(8),
    supabase.from('produksi_item').select('tanggal_produksi,pcs_good,total_gram').is('voided_at',null).gte('tanggal_produksi',sixMonthsAgo),
    supabase.from('produksi_item').select('current_status,pcs_good').is('voided_at',null).not('current_status','is',null),
    supabase.from('pengaturan').select('value').eq('key','nama_gudang').single(),
    supabase.from('batch').select('kode,nama_batch,timbangan_akhir,sisa_bahan_seharusnya,hpp_gr,tanggal,status').is('voided_at',null).order('sisa_bahan_seharusnya',{ascending:true}).limit(6),
    supabase.from('mutasi').select('nomor,tanggal,dari_lokasi,ke_lokasi,status,pcs').is('voided_at',null).order('created_at',{ascending:false}).limit(5),
    supabase.from('produksi_item').select('kode,batch_kode,gramasi,nama_item,pcs_good,current_status').eq('current_status','Siap Packing').is('voided_at',null).limit(10),
    supabase.from('mutasi').select('nomor,ke_lokasi,pcs,created_at').eq('status','transit').limit(10),
  ])

  const namaGudang   = settingGudang?.value ?? 'Gudang CJ'
  const stokGudangTotal = (packingCetak ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack ?? 0), 0)
  const stGudangPending = Math.max(0, stokGudangTotal - (stGudangAktif ?? 0))
  const totalRejectPcs  = (rejectData ?? []).reduce((s: number, i: any) => s + (i.pcs_reject ?? 0), 0)
  const totalBahanAktif = (batchAktifList ?? []).reduce((s: number, b: any) => s + parseFloat(b.timbangan_akhir ?? 0), 0)
  const totalBahanTidakAktif = (batchTidakAktifList ?? []).reduce((s: number, b: any) => s + parseFloat(b.timbangan_akhir ?? 0), 0)

  // % perbandingan
  function pctChange(now: number, before: number) {
    if (before === 0) return now > 0 ? 100 : 0
    return Math.round(((now - before) / before) * 100)
  }
  const siapPackingNow    = siapPackingHariIni ?? 0
  const siapPackingPrev   = siapPackingKemarin ?? 0
  const stokCabangNow     = stokCabang ?? 0
  const stokCabangPrev    = stokCabangKemarin ?? 0

  // Status breakdown (donut)
  const statusMap: Record<string,number> = {}
  ;(statusBreakdown ?? []).forEach((item: any) => {
    statusMap[item.current_status] = (statusMap[item.current_status] ?? 0) + (item.pcs_good ?? 0)
  })
  const statusChartData = Object.entries(statusMap).map(([status,pcs]) => ({status,pcs})).sort((a,b) => b.pcs - a.pcs)

  // Chart bulanan
  const monthMap: Record<string,{pcs:number;gram:number}> = {}
  ;(produksiBulanan ?? []).forEach((item: any) => {
    const m = (item.tanggal_produksi ?? '').slice(0,7)
    if (!m) return
    if (!monthMap[m]) monthMap[m] = {pcs:0,gram:0}
    monthMap[m].pcs  += item.pcs_good ?? 0
    monthMap[m].gram += parseFloat(item.total_gram ?? 0)
  })
  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const produksiChart = Object.entries(monthMap)
    .sort(([a],[b]) => a.localeCompare(b)).slice(-6)
    .map(([m,d]) => ({ bulan: BULAN[parseInt(m.slice(5,7))-1], pcs: d.pcs, gram: Math.round(d.gram*100)/100 }))

  // Bahan baku sisa (only aktif batches)
  const batchSisa = (batchList ?? [])
    .filter((b: any) => b.status === 'aktif' && b.timbangan_akhir > 0)
    .map((b: any) => ({
      ...b,
      sisa: b.sisa_bahan_seharusnya ?? b.timbangan_akhir,
      sisaPct: Math.round(((b.sisa_bahan_seharusnya ?? b.timbangan_akhir) / b.timbangan_akhir) * 100),
    }))
    .sort((a: any, b: any) => a.sisaPct - b.sisaPct)
    .slice(0, 4)

  // Notifikasi
  const notifikasi = [
    ...(notifSiapPacking ?? []).map((i: any) => ({
      id: `sp-${i.kode}`, type: 'siap_packing' as const,
      title: `${i.nama_item ?? i.gramasi+'gr'} siap packing`,
      sub: `${i.batch_kode} · ${i.pcs_good} pcs`,
      time: 'Baru',
    })),
    ...(notifMutasi ?? []).map((m: any) => ({
      id: `mt-${m.nomor}`, type: 'mutasi' as const,
      title: `Mutasi ke ${m.ke_lokasi} menunggu ACC`,
      sub: `${m.nomor} · ${m.pcs} pcs`,
      time: m.created_at?.slice(11,16) ?? '',
    })),
  ]

  return (
    <DashboardClient
      namaGudang={namaGudang}
      userName={profile?.name ?? ''}
      userRole={profile?.role ?? ''}
      today={today}
      stats={{
        batchAktif:         (batchAktifList ?? []).length,
        batchTidakAktif:    (batchTidakAktifList ?? []).length,
        totalBahanAktif:    Math.round(totalBahanAktif*100)/100,
        totalBahanTidakAktif: Math.round(totalBahanTidakAktif*100)/100,
        siapPackingHariIni: siapPackingNow,
        siapPackingPct:     pctChange(siapPackingNow, siapPackingPrev),
        totalRejectPcs,
        stokGudangTotal,
        stGudangAktif:      stGudangAktif ?? 0,
        stGudangPending,
        stokCabang:         stokCabangNow,
        stokCabangPct:      pctChange(stokCabangNow, stokCabangPrev),
        mutasiTransit:      mutasiTransit ?? 0,
      }}
      produksiTerbaru={produksiTerbaru ?? []}
      batchSisa={batchSisa}
      produksiChart={produksiChart}
      statusChartData={statusChartData}
      mutasiTerbaru={mutasiTerbaru ?? []}
      notifikasi={notifikasi}
    />
  )
}
