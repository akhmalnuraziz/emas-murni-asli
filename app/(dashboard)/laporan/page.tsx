import { createClient } from '@/lib/supabase/server'
import LaporanClient from '@/components/modules/laporan/laporan-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage({
  searchParams,
}: {
  searchParams?: { period?: string; from?: string; to?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile').select('role,name').eq('id', user?.id ?? '').single()

  const period   = searchParams?.period ?? 'month'
  const todayStr = new Date().toISOString().split('T')[0]
  let dateFrom: string
  let dateTo: string = todayStr

  if (period === 'today') {
    dateFrom = todayStr
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'custom') {
    dateFrom = searchParams?.from ?? todayStr.slice(0, 7) + '-01'
    dateTo   = searchParams?.to ?? todayStr
  } else {
    dateFrom = todayStr.slice(0, 7) + '-01'
  }

  const [
    { data: produksiItems },
    { data: packings },
    { data: shieldtags },
    { data: penjualanAll },
    { data: penjualanPeriode },
    { data: buybackPeriode },
    { data: mutasiRaw },
    { data: batches },
    { data: pengeluaranPeriode },
  ] = await Promise.all([
    supabase.from('produksi_item').select('total_gram').is('voided_at', null),
    supabase.from('packing').select('pcs').is('voided_at', null),
    supabase.from('shieldtag').select('status').is('voided_at', null),
    // All-time penjualan for ringkasan
    supabase.from('penjualan').select('gramasi, pcs, harga_jual').is('voided_at' as any, null),
    // Period penjualan for laba rugi
    supabase.from('penjualan')
      .select('id, no_faktur, nomor_invoice, tanggal, nama_customer, channel, source, toko, cabang_nama, pcs, gramasi, total_harga_jual, harga_jual, hpp_total, profit, metode_pembayaran')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
      .is('voided_at' as any, null)
      .order('tanggal', { ascending: false }),
    supabase.from('buyback').select('id, tanggal').gte('tanggal', dateFrom).lte('tanggal', dateTo).is('voided_at', null),
    supabase.from('mutasi').select('pcs').eq('status_kirim', 'Sudah Dikirim'),
    supabase.from('batch').select('kode, tanggal, supplier, timbangan_akhir, hpp_gr, status').is('voided_at', null).order('created_at', { ascending: false }),
    supabase.from('pengeluaran')
      .select('id, tanggal, nama, nominal, kategori:kategori_pengeluaran(nama, warna)')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
      .is('voided_at', null)
      .order('tanggal', { ascending: false }),
  ])

  const totalProduksiGram   = (produksiItems ?? []).reduce((a, r) => a + (Number(r.total_gram) || 0), 0)
  const totalPackingPcs     = (packings ?? []).reduce((a, r) => a + (Number(r.pcs) || 0), 0)
  const totalShieldtagAktif = (shieldtags ?? []).filter(s => s.status === 'Aktif').length
  const totalTerjual        = (shieldtags ?? []).filter(s => s.status === 'Terjual').length
  const totalBuyback        = (buybackPeriode ?? []).length
  const totalMutasiKeluar   = (mutasiRaw ?? []).reduce((a, r) => a + (Number(r.pcs) || 0), 0)

  // Group penjualan by gramasi (all-time for ringkasan)
  const gMap = new Map<string, { pcs: number; total: number }>()
  for (const p of penjualanAll ?? []) {
    const g = p.gramasi ?? '?'
    const cur = gMap.get(g) ?? { pcs: 0, total: 0 }
    gMap.set(g, { pcs: cur.pcs + (p.pcs || 0), total: cur.total + (Number(p.harga_jual) || 0) })
  }
  const penjualanByGramasi = [...gMap.entries()]
    .map(([gramasi, v]) => ({ gramasi, ...v }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  // Laba Rugi stats
  const omzetPeriode     = (penjualanPeriode ?? []).reduce((s, p: any) => s + Number(p.total_harga_jual ?? p.harga_jual ?? 0), 0)
  const hppPeriode       = (penjualanPeriode ?? []).reduce((s, p: any) => s + Number(p.hpp_total ?? 0), 0)
  const pengeluaranTotal = (pengeluaranPeriode ?? []).reduce((s: number, p: any) => s + Number(p.nominal ?? 0), 0)
  const labaKotor        = omzetPeriode - hppPeriode
  const labaBersih       = labaKotor - pengeluaranTotal

  // Channel breakdown
  const channelMap: Record<string, { omzet: number; pcs: number }> = {}
  for (const p of penjualanPeriode ?? []) {
    const ch = (p as any).channel ?? (p as any).source ?? 'Offline'
    const cur = channelMap[ch] ?? { omzet: 0, pcs: 0 }
    channelMap[ch] = {
      omzet: cur.omzet + Number((p as any).total_harga_jual ?? (p as any).harga_jual ?? 0),
      pcs:   cur.pcs   + Number((p as any).pcs ?? 0),
    }
  }
  const channelBreakdown = Object.entries(channelMap)
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.omzet - a.omzet)

  return (
    <LaporanClient
      summary={{ totalProduksiGram, totalPackingPcs, totalShieldtagAktif, totalTerjual, totalBuyback, totalMutasiKeluar }}
      penjualanByGramasi={penjualanByGramasi}
      batchList={(batches ?? []) as any}
      userRole={profile?.role ?? 'operator_produksi'}
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      labaRugi={{
        omzet: omzetPeriode,
        hpp: hppPeriode,
        labaKotor,
        pengeluaran: pengeluaranTotal,
        labaBersih,
        penjualanCount: (penjualanPeriode ?? []).length,
        buybackCount: (buybackPeriode ?? []).length,
      }}
      channelBreakdown={channelBreakdown}
      penjualanList={(penjualanPeriode ?? []) as any}
      pengeluaranList={(pengeluaranPeriode ?? []) as any}
    />
  )
}
