'use server'

import { createClient } from '@/lib/supabase/server'

// ── LAPORAN PER BATCH ─────────────────────────────────────────────────────────
export async function getLaporanBatch(batchKode: string) {
  const supabase = await createClient()

  const [
    { data: batch },
    { data: items },
    { data: events },
    { data: packings },
  ] = await Promise.all([
    supabase.from('batch').select('*').eq('kode', batchKode).single(),
    supabase.from('produksi_item').select('*').eq('batch_kode', batchKode).is('voided_at', null).order('tanggal'),
    supabase.from('produksi_event')
      .select('*, produksi_item:produksi_item_id(kode, gramasi, nama_item)')
      .in('produksi_item_id', (await supabase.from('produksi_item').select('id').eq('batch_kode', batchKode).is('voided_at', null)).data?.map(i => i.id) ?? [])
      .is('voided_at', null)
      .order('created_at'),
    supabase.from('packing')
      .select('*, produksi_item:produksi_item_id(gramasi, nama_item)')
      .eq('batch_kode', batchKode).is('voided_at', null).order('tanggal'),
  ])

  // Hitung summary
  const totalBeratAwal   = items?.reduce((s, i) => s + parseFloat(i.berat_awal ?? 0), 0) ?? 0
  const totalBeratAkhir  = items?.reduce((s, i) => s + parseFloat(i.total_gram ?? 0), 0) ?? 0
  const totalLosses      = totalBeratAwal - totalBeratAkhir
  const totalSerbuk      = events?.reduce((s, e) => s + parseFloat(e.sisa_serbuk ?? 0), 0) ?? 0
  const totalPcsGood     = items?.reduce((s, i) => s + (i.pcs_good ?? 0), 0) ?? 0
  const totalPcsReject   = items?.reduce((s, i) => s + (i.pcs_reject ?? 0), 0) ?? 0
  const totalPcsPacked   = packings?.reduce((s, p) => s + (p.pcs_dipack ?? 0), 0) ?? 0

  // Breakdown per gramasi
  const gramasiMap: Record<string, any> = {}
  items?.forEach(item => {
    const g = item.gramasi
    if (!gramasiMap[g]) gramasiMap[g] = { gramasi: g, nama_item: item.nama_item, jml_pcs: 0, total_gram: 0, pcs_reject: 0, pcs_good: 0 }
    gramasiMap[g].jml_pcs   += item.pcs ?? 0
    gramasiMap[g].total_gram += parseFloat(item.total_gram ?? 0)
    gramasiMap[g].pcs_reject += item.pcs_reject ?? 0
    gramasiMap[g].pcs_good   += item.pcs_good ?? 0
  })
  const gramasiBreakdown = Object.values(gramasiMap).sort((a: any, b: any) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  return {
    batch, items: items ?? [], events: events ?? [], packings: packings ?? [],
    summary: {
      totalBeratAwal, totalBeratAkhir, totalLosses, totalSerbuk,
      totalPcsGood, totalPcsReject, totalPcsPacked,
      sisaBahan: parseFloat(batch?.sisa_bahan_seharusnya ?? 0),
      sisaFisik: batch?.sisa_fisik ? parseFloat(batch.sisa_fisik) : null,
      hpp_gr: parseFloat(batch?.hpp_gr ?? 0),
    },
    gramasiBreakdown,
  }
}

// ── LAPORAN LABA RUGI ─────────────────────────────────────────────────────────
export async function getLaporanLabaRugi(dateFrom: string, dateTo: string, lokasi?: string) {
  const supabase = await createClient()

  // Penjualan dalam periode
  let pjQuery = supabase.from('penjualan')
    .select('id, tanggal, channel, source, harga_jual, total_harga_jual, hpp_total, profit, total_profit, fee_marketplace, pcs')
    .is('voided_at', null)
    .gte('tanggal', dateFrom)
    .lte('tanggal', dateTo)

  const { data: penjualanList } = await pjQuery

  // Items detail untuk HPP akurat
  const pjIds = (penjualanList ?? []).map(p => p.id)
  let totalHPP = 0, totalHJ = 0, totalFee = 0
  if (pjIds.length > 0) {
    const { data: pjItems } = await supabase.from('penjualan_item')
      .select('hpp, harga_jual').in('penjualan_id', pjIds)
    totalHPP = pjItems?.reduce((s, i) => s + parseFloat(i.hpp ?? 0), 0) ?? 0
    totalHJ  = pjItems?.reduce((s, i) => s + parseFloat(i.harga_jual ?? 0), 0) ?? 0
  }
  if (totalHJ === 0) {
    totalHJ  = (penjualanList ?? []).reduce((s, p) => s + parseFloat(p.total_harga_jual ?? p.harga_jual ?? 0), 0)
    totalHPP = (penjualanList ?? []).reduce((s, p) => s + parseFloat(p.hpp_total ?? 0), 0)
  }
  totalFee = (penjualanList ?? []).reduce((s, p) => {
    const hj = parseFloat(p.total_harga_jual ?? p.harga_jual ?? 0)
    const fee = parseFloat(p.fee_marketplace ?? 0)
    return s + (hj * fee / 100)
  }, 0)

  // Pengeluaran dalam periode
  let peQuery = supabase.from('pengeluaran')
    .select('id, tanggal, nama, nominal, lokasi, kategori:kategori_id(nama, warna)')
    .is('voided_at', null)
    .gte('tanggal', dateFrom)
    .lte('tanggal', dateTo)
  if (lokasi) peQuery = peQuery.eq('lokasi', lokasi)
  const { data: pengeluaranList } = await peQuery

  const totalPengeluaran = (pengeluaranList ?? []).reduce((s, p) => s + parseFloat(p.nominal), 0)

  // Pengeluaran per kategori
  const katMap: Record<string, any> = {}
  ;(pengeluaranList ?? []).forEach(p => {
    const k = p.kategori?.nama ?? 'Lainnya'
    katMap[k] = (katMap[k] ?? 0) + parseFloat(p.nominal)
  })

  // Penjualan per channel
  const channelMap: Record<string, any> = {}
  ;(penjualanList ?? []).forEach(p => {
    const ch = p.channel || p.source || 'toko'
    if (!channelMap[ch]) channelMap[ch] = { hj: 0, pcs: 0 }
    channelMap[ch].hj  += parseFloat(p.total_harga_jual ?? p.harga_jual ?? 0)
    channelMap[ch].pcs += p.pcs ?? 0
  })

  const grossProfit = totalHJ - totalHPP - totalFee
  const netProfit   = grossProfit - totalPengeluaran

  return {
    periode: { from: dateFrom, to: dateTo },
    pendapatan: {
      totalHJ, totalHPP, totalFee,
      grossProfit,
      totalTransaksi: (penjualanList ?? []).length,
      perChannel: channelMap,
    },
    pengeluaran: {
      total: totalPengeluaran,
      perKategori: katMap,
      list: pengeluaranList ?? [],
    },
    netProfit,
    marginPct: totalHJ > 0 ? Math.round(netProfit / totalHJ * 100 * 10) / 10 : 0,
  }
}

// ── GET BATCH LIST ─────────────────────────────────────────────────────────────
export async function getBatchList() {
  const supabase = await createClient()
  const { data } = await supabase.from('batch')
    .select('kode, nama_batch, status, tanggal, timbangan_akhir')
    .is('voided_at', null)
    .order('tanggal', { ascending: false })
  return data ?? []
}
