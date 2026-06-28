import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LaporanClient from '@/components/modules/laporan/laporan-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profile').select('role,name,cabang_kode').eq('id', user?.id ?? '').single()
  const isKepala = profile?.role === 'kepala_cabang'
  const cabangFilter = isKepala ? (profile?.cabang_kode ?? null) : null

  const sp = await searchParams
  const period   = sp?.period ?? 'month'
  const todayStr = new Date().toISOString().split('T')[0]
  let dateFrom: string
  let dateTo: string = todayStr

  if (period === 'today') {
    dateFrom = todayStr
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'custom') {
    dateFrom = sp?.from ?? todayStr.slice(0, 7) + '-01'
    dateTo   = sp?.to ?? todayStr
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
    { data: batchesNeraca },
    { data: pengeluaranPeriode },
  ] = await Promise.all([
    supabase.from('produksi_item').select('total_gram, current_status, berat_reject, status_reject').is('voided_at', null).limit(5000),
    supabase.from('packing').select('pcs').is('voided_at', null).limit(5000),
    supabase.from('shieldtag').select('status, gramasi').is('voided_at', null).limit(5000),
    // All-time penjualan for ringkasan (filter cabang jika kepala_cabang)
    (() => {
      let q = supabase.from('penjualan').select('gramasi, pcs, harga_jual').is('voided_at' as any, null)
      if (cabangFilter) q = (q as any).eq('cabang_kode', cabangFilter)
      return q
    })(),
    // Period penjualan for laba rugi (include items for per-gramasi breakdown)
    (() => {
      let q = supabase.from('penjualan')
        .select('id, no_faktur, nomor_invoice, tanggal, nama_customer, channel, source, toko, cabang_nama, pcs, gramasi, total_harga_jual, harga_jual, hpp_total, total_profit, profit, metode_pembayaran, items:penjualan_item(gramasi, hpp, harga_jual, profit)')
        .gte('tanggal', dateFrom).lte('tanggal', dateTo).is('voided_at' as any, null).order('tanggal', { ascending: false })
      if (cabangFilter) q = (q as any).eq('cabang_kode', cabangFilter)
      return q
    })(),
    supabase.from('buyback').select('id, tanggal').gte('tanggal', dateFrom).lte('tanggal', dateTo).is('voided_at', null),
    supabase.from('mutasi').select('pcs').in('status', ['dikirim', 'SELESAI', 'SHORT_SHIP']).is('voided_at', null).limit(5000),
    supabase.from('batch').select('timbangan_akhir').is('voided_at', null),
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

  // ── Neraca Emas (Balance Engine) ────────────────────────────────────────
  const allItems = produksiItems ?? []
  const allShieldtag = shieldtags ?? []
  const allPenjualan = penjualanAll ?? []
  // MASUK: total emas dari semua batch
  const masukBatch = (batchesNeraca ?? []).reduce((s, b: any) => s + Number(b.timbangan_akhir ?? 0), 0)

  // STOK: shieldtag aktif + transit cabang
  const stokAktifGram    = allShieldtag.filter(s => s.status === 'Aktif').reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)
  const stokTransitGram  = allShieldtag.filter(s => s.status === 'Transit').reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)

  // KELUAR: terjual (gramasi × pcs dari penjualan)
  const gramTerjual = allPenjualan.reduce((s, p) => s + parseFloat(p.gramasi ?? '0') * (Number(p.pcs) || 1), 0)

  // WIP: produksi item yang masih di pipeline (belum jadi shieldtag, belum reject)
  const DONE_STATUSES = ['Sudah Packing', 'Reject']
  const gramWIP = allItems
    .filter(r => !DONE_STATUSES.includes((r as any).current_status ?? ''))
    .reduce((s, r) => s + Number(r.total_gram ?? 0), 0)

  // REJECT: belum dilebur
  const gramRejectBelumDilebur = allItems
    .filter(r => (r as any).status_reject === 'belum_dilebur')
    .reduce((s, r) => s + Number((r as any).berat_reject ?? 0), 0)

  // REJECT: sudah dilebur (kembali jadi bahan baku, bukan keluar)
  const gramRejectSudahDilebur = allItems
    .filter(r => (r as any).status_reject === 'sudah_dilebur')
    .reduce((s, r) => s + Number((r as any).berat_reject ?? 0), 0)

  // TOTAL TERTRACKING = stok aktif + transit + WIP + terjual + reject belum dilebur
  const totalTertracking = stokAktifGram + stokTransitGram + gramWIP + gramTerjual + gramRejectBelumDilebur
  const selisihGram = masukBatch - totalTertracking

  const neraca = {
    masukBatch,
    stokAktifGram,
    stokTransitGram,
    gramTerjual,
    gramWIP,
    gramRejectBelumDilebur,
    gramRejectSudahDilebur,
    totalTertracking,
    selisihGram,
  }

  // Per-gramasi breakdown dari penjualan_item periode (dengan HPP + margin)
  const gramasiPeriodeMap = new Map<string, { pcs: number; omzet: number; hpp: number; profit: number }>()
  for (const p of penjualanPeriode ?? []) {
    const pItems: any[] = (p as any).items ?? []
    if (pItems.length > 0) {
      for (const it of pItems) {
        const g = String(it.gramasi ?? '?')
        const cur = gramasiPeriodeMap.get(g) ?? { pcs: 0, omzet: 0, hpp: 0, profit: 0 }
        gramasiPeriodeMap.set(g, {
          pcs:    cur.pcs + 1,
          omzet:  cur.omzet  + Number(it.harga_jual ?? 0),
          hpp:    cur.hpp    + Number(it.hpp ?? 0),
          profit: cur.profit + Number(it.profit ?? 0),
        })
      }
    } else {
      // fallback: penjualan header jika items kosong
      const g = String((p as any).gramasi ?? '?')
      const cur = gramasiPeriodeMap.get(g) ?? { pcs: 0, omzet: 0, hpp: 0, profit: 0 }
      const pcs = Number((p as any).pcs ?? 1)
      gramasiPeriodeMap.set(g, {
        pcs:    cur.pcs + pcs,
        omzet:  cur.omzet  + Number((p as any).total_harga_jual ?? (p as any).harga_jual ?? 0),
        hpp:    cur.hpp    + Number((p as any).hpp_total ?? 0),
        profit: cur.profit + Number((p as any).total_profit ?? (p as any).profit ?? 0),
      })
    }
  }
  const penjualanByGramasiPeriode = [...gramasiPeriodeMap.entries()]
    .map(([gramasi, v]) => ({ gramasi, ...v, margin: v.omzet > 0 ? (v.profit / v.omzet * 100) : 0 }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

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
      penjualanByGramasiPeriode={penjualanByGramasiPeriode}
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
      neraca={neraca}
    />
  )
}
