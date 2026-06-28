import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Next.js 15+ searchParams is a Promise
  const sp = await searchParams

  // ── Date range from period filter ──────────────────────────────────────
  const period  = sp?.period ?? 'month'
  const todayStr = new Date().toISOString().split('T')[0]
  let dateFrom: string
  let dateTo: string = todayStr

  if (period === 'today') {
    dateFrom = todayStr
  } else if (period === 'week') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'custom') {
    dateFrom = sp?.from ?? todayStr.slice(0, 7) + '-01'
    dateTo   = sp?.to ?? todayStr
  } else {
    // month (default)
    dateFrom = todayStr.slice(0, 7) + '-01'
  }

  const [
    { data: profile },
    { data: shieldtagAktif },
    { data: _shieldtagTransit },
    { data: penjualanPeriode },
    { data: buybackPeriode },
    { data: produksiPipeline },
    { data: rejectBelumDilebur },
    { data: batchTerbaru },
    { data: mutasiTransit },
    // PO Packaging
    { data: poOpen },
    { data: batchPenerimaanPeriode },
    { data: rejectPending },
    { data: stokPackaging },
    // Pengeluaran
    { data: pengeluaranPeriode },
    // Trend produksi
    { data: packingHarian },
    // Packing hari ini
    { data: packingHariIni },
    // Siap packing
    { data: siapPackingItems },
    // Target packing
    { data: targetRow },
    // Balance Engine
    { data: balanceBatches },
    { data: _balanceProduksi },
    { data: _balanceShieldtag },
    { data: _balancePenjualan },
  ] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user?.id ?? '').single(),
    supabase.from('shieldtag').select('gramasi, hpp').eq('status', 'Aktif').is('voided_at', null),
    Promise.resolve({ data: null, error: null }), // transit handled by get_balance_summary RPC
    Promise.resolve({ data: [] as any[] }),   // penjualan dinonaktifkan
    supabase.from('buyback').select('id, tanggal')
      .gte('tanggal', dateFrom).lte('tanggal', dateTo).is('voided_at', null),
    supabase.from('produksi_item')
      .select('current_status, total_gram')
      .is('voided_at', null)
      .not('current_status', 'in', '("Sudah Packing","Reject")'),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, berat_reject, batch_kode')
      .eq('status_reject', 'belum_dilebur')
      .gt('berat_reject', 0)
      .is('voided_at', null),
    supabase.from('batch')
      .select('kode, tanggal, timbangan_akhir, bahan_siap_cetak, hpp_gr, status, supplier')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('mutasi')
      .select('id, ke_lokasi, pcs_dikirim, tanggal_kirim, status')
      .eq('status', 'dikirim')
      .is('voided_at', null)
      .order('tanggal_kirim', { ascending: false })
      .limit(10),
    // PO packaging
    supabase.from('po_packaging').select('id, status').is('voided_at', null).in('status', ['open', 'partial']),
    supabase.from('po_batch_penerimaan')
      .select('qty_diterima, qty_acc, qty_reject, qty_lebih, status_qc')
      .gte('tanggal_terima', dateFrom).lte('tanggal_terima', dateTo),
    supabase.from('po_packaging_reject').select('qty, jenis').eq('status_penanganan', 'pending'),
    supabase.from('stok_packaging')
      .select('stok_qty, produk_kode, produk_nama, produk:produk_packaging(gramasi)')
      .order('produk_id'),
    Promise.resolve({ data: [] as any[] }),   // pengeluaran dinonaktifkan
    // Trend produksi harian (dari packing)
    supabase.from('packing')
      .select('tanggal, gramasi, pcs_dipack')
      .gte('tanggal', dateFrom).lte('tanggal', dateTo)
      .is('voided_at', null)
      .order('tanggal'),
    // Packing hari ini
    supabase.from('packing')
      .select('kode, batch_kode, gramasi, pcs_dipack')
      .eq('tanggal', todayStr)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    // Siap packing — menunggu dipacking
    supabase.from('produksi_item')
      .select('id, kode, gramasi, batch_kode')
      .eq('current_status', 'Siap Packing')
      .is('voided_at', null)
      .order('updated_at', { ascending: false })
      .limit(30),
    // Target packing harian
    supabase.from('pengaturan').select('value').eq('key', 'target_packing_harian').single(),
    // Balance Engine — single RPC replaces 4 full table scans
    supabase.rpc('get_balance_summary'),
    Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: null, error: null }),
    Promise.resolve({ data: null, error: null }),
  ])

  // ── Build stats ──────────────────────────────────────────────────────────

  const stokAktifPcs  = (shieldtagAktif ?? []).length
  const stokAktifGram = (shieldtagAktif ?? []).reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)
  const nilaiStok     = (shieldtagAktif ?? []).reduce((s, t) => s + Number(t.hpp ?? 0), 0)
  // Transit stats from RPC (balanceBatches is now the get_balance_summary result)
  const balanceSummary = balanceBatches as any
  const transitPcs    = Number(balanceSummary?.transit_pcs ?? 0)
  const transitGram   = Number(balanceSummary?.transit_gram ?? 0)

  const terjualPcs    = (penjualanPeriode ?? []).reduce((s, p) => s + (Number(p.pcs) || 0), 0)
  const omzetPeriode  = (penjualanPeriode ?? []).reduce((s, p) => s + (Number(p.harga_jual) || 0), 0)

  const rejectPcs  = (rejectBelumDilebur ?? []).length
  const rejectGram = (rejectBelumDilebur ?? []).reduce((s, r) => s + Number(r.berat_reject ?? 0), 0)

  const pipeline: Record<string, number> = {}
  for (const p of produksiPipeline ?? []) {
    const s = p.current_status ?? 'Unknown'
    pipeline[s] = (pipeline[s] ?? 0) + 1
  }

  const gramasiMap: Record<string, number> = {}
  for (const t of shieldtagAktif ?? []) {
    if (t.gramasi) gramasiMap[t.gramasi] = (gramasiMap[t.gramasi] ?? 0) + 1
  }
  const gramasiChartData = Object.entries(gramasiMap)
    .map(([gramasi, pcs]) => ({ gramasi: `${gramasi}gr`, pcs }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  // PO Packaging stats
  const poOpenCount      = (poOpen ?? []).length
  const batchPeriode     = batchPenerimaanPeriode ?? []
  const totalDatangPeriode = batchPeriode.reduce((s, b: any) => s + (b.qty_diterima ?? 0), 0)
  const totalAccPeriode    = batchPeriode.reduce((s, b: any) => s + (b.qty_acc ?? 0), 0)
  const totalRejectPeriode = batchPeriode.reduce((s, b: any) => s + (b.qty_reject ?? 0), 0)
  const pendingQcCount     = batchPeriode.filter((b: any) => b.status_qc === 'pending').length
  const rejectPendingQty   = (rejectPending ?? []).reduce((s: number, r: any) => s + (r.qty ?? 0), 0)

  const stokAkrilik = (stokPackaging ?? []).map((s: any) => ({
    produk_nama: s.produk_nama,
    produk_kode: s.produk_kode,
    gramasi: s.produk?.gramasi ?? 0,
    stok_qty: s.stok_qty ?? 0,
  })).sort((a: any, b: any) => a.gramasi - b.gramasi)

  // Pengeluaran stats
  const totalPengeluaran = (pengeluaranPeriode ?? []).reduce((s: number, p: any) => s + Number(p.nominal ?? 0), 0)

  // Balance Engine — from single RPC (replaces 4 full table scans)
  const balanceMasuk     = Number(balanceSummary?.balance_masuk ?? 0)
  const balanceStokAktif = Number(balanceSummary?.balance_stok_aktif ?? 0)
  const balanceTransit   = Number(balanceSummary?.balance_transit ?? 0)
  const balanceTerjual   = Number(balanceSummary?.balance_terjual ?? 0)
  const balanceWIP       = Number(balanceSummary?.balance_wip ?? 0)
  const balanceReject    = Number(balanceSummary?.balance_reject ?? 0)
  const balanceSelisih   = balanceMasuk - (balanceStokAktif + balanceTransit + balanceTerjual + balanceWIP + balanceReject)

  // Trend produksi harian
  const GRAMASI_ORDER = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
  // { [gramasi]: { [day]: totalPcs } }
  const trendMap: Record<string, Record<number, number>> = {}
  const dailyTotal: Record<number, number> = {}
  for (const p of packingHarian ?? []) {
    const g = String(parseFloat(p.gramasi ?? '0'))
    const day = new Date(p.tanggal).getDate()
    const pcs = Number(p.pcs_dipack ?? 0)
    if (!trendMap[g]) trendMap[g] = {}
    trendMap[g][day] = (trendMap[g][day] ?? 0) + pcs
    dailyTotal[day] = (dailyTotal[day] ?? 0) + pcs
  }
  const trendGramasi = GRAMASI_ORDER.filter(g => trendMap[g])
  // Jumlah hari di bulan (pakai dateFrom untuk detect bulan)
  const trendMonth = dateFrom.slice(0, 7)
  const daysInMonth = new Date(Number(trendMonth.slice(0, 4)), Number(trendMonth.slice(5, 7)), 0).getDate()
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const produksiTrend = {
    gramasi: trendGramasi,
    trendMap,
    dailyTotal,
    allDays,
    daysInMonth,
    bulan: dateFrom.slice(0, 7),
    totalPcs: Object.values(dailyTotal).reduce((a, b) => a + b, 0),
  }

  const { count: batchAktifCount } = await supabase
    .from('batch').select('kode', { count: 'exact', head: true })
    .eq('status', 'aktif').is('voided_at', null)

  const canSeeRp = ['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')

  return (
    <DashboardClient
      userName={profile?.name ?? ''}
      userRole={profile?.role ?? 'operator_produksi'}
      canSeeRp={canSeeRp}
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      stok={{ pcs: stokAktifPcs, gram: stokAktifGram, nilaiRp: nilaiStok }}
      transit={{ pcs: transitPcs, gram: transitGram }}
      penjualan={{ pcs: terjualPcs, omzetRp: omzetPeriode, buybackCount: (buybackPeriode ?? []).length }}
      reject={{ count: rejectPcs, gram: rejectGram }}
      pipeline={pipeline}
      gramasiChartData={gramasiChartData}
      batchTerbaru={batchTerbaru ?? []}
      mutasiTransit={mutasiTransit ?? []}
      poPackaging={{
        openCount: poOpenCount,
        datangBulan: totalDatangPeriode,
        accBulan: totalAccPeriode,
        rejectBulan: totalRejectPeriode,
        pendingQc: pendingQcCount,
        rejectPendingQty,
      }}
      stokAkrilik={stokAkrilik}
      totalPengeluaran={totalPengeluaran}
      produksiTrend={produksiTrend}
      packingHariIni={packingHariIni ?? []}
      siapPacking={siapPackingItems ?? []}
      rejectList={rejectBelumDilebur ?? []}
      balanceSelisih={balanceSelisih}
      batchAktifCount={batchAktifCount ?? 0}
      targetPackingHarian={Number((targetRow as any)?.value ?? 0)}
    />
  )
}
