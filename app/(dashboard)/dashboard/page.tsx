import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'
  const weekAgo    = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [
    { data: profile },
    { data: shieldtagAktif },
    { data: shieldtagTransit },
    { data: penjualanBulanIni },
    { data: buybackBulanIni },
    { data: produksiPipeline },
    { data: rejectBelumDilebur },
    { data: batchTerbaru },
    { data: mutasiTransit },
    // PO Packaging
    { data: poOpen },
    { data: batchPenerimaanBulanIni },
    { data: rejectPending },
    { data: stokPackaging },
  ] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user?.id ?? '').single(),
    supabase.from('shieldtag').select('gramasi, hpp').eq('status', 'Aktif').is('voided_at', null),
    supabase.from('shieldtag').select('gramasi').eq('status', 'Terdistribusi').is('voided_at', null),
    supabase.from('penjualan').select('gramasi, pcs, harga_jual, tanggal').gte('tanggal', monthStart).is('voided_at' as any, null),
    supabase.from('buyback').select('id, tanggal').gte('tanggal', monthStart).is('voided_at', null),
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
      .select('id, tujuan_cabang, pcs, tanggal_kirim, status_terima')
      .eq('status_kirim', 'Sudah Dikirim')
      .eq('status_terima', 'Belum Diterima')
      .is('voided_at', null)
      .order('tanggal_kirim', { ascending: false })
      .limit(10),
    // PO packaging
    supabase.from('po_packaging').select('id, status').is('voided_at', null).in('status', ['open','partial']),
    supabase.from('po_batch_penerimaan')
      .select('qty_diterima, qty_acc, qty_reject, qty_lebih, status_qc')
      .gte('tanggal_terima', monthStart),
    supabase.from('po_packaging_reject').select('qty, jenis').eq('status_penanganan', 'pending'),
    supabase.from('stok_packaging')
      .select('stok_qty, produk_kode, produk_nama, produk:produk_packaging(gramasi)')
      .order('produk_id'),
  ])

  // ── Build stats ──────────────────────────────────────────────────────────

  // Emas stok
  const stokAktifPcs  = (shieldtagAktif ?? []).length
  const stokAktifGram = (shieldtagAktif ?? []).reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)
  const nilaiStok     = (shieldtagAktif ?? []).reduce((s, t) => s + Number(t.hpp ?? 0), 0)
  const transitPcs    = (shieldtagTransit ?? []).length
  const transitGram   = (shieldtagTransit ?? []).reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)

  // Penjualan
  const terjualPcs     = (penjualanBulanIni ?? []).reduce((s, p) => s + (Number(p.pcs) || 0), 0)
  const omzetBulanIni  = (penjualanBulanIni ?? []).reduce((s, p) => s + (Number(p.harga_jual) || 0), 0)

  // Reject produksi
  const rejectPcs  = (rejectBelumDilebur ?? []).length
  const rejectGram = (rejectBelumDilebur ?? []).reduce((s, r) => s + Number(r.berat_reject ?? 0), 0)

  // Pipeline
  const pipeline: Record<string, number> = {}
  for (const p of produksiPipeline ?? []) {
    const s = p.current_status ?? 'Unknown'
    pipeline[s] = (pipeline[s] ?? 0) + 1
  }

  // Stok emas per gramasi
  const gramasiMap: Record<string, number> = {}
  for (const t of shieldtagAktif ?? []) {
    if (t.gramasi) gramasiMap[t.gramasi] = (gramasiMap[t.gramasi] ?? 0) + 1
  }
  const gramasiChartData = Object.entries(gramasiMap)
    .map(([gramasi, pcs]) => ({ gramasi: `${gramasi}gr`, pcs }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

  // PO Packaging stats
  const poOpenCount   = (poOpen ?? []).length
  const batchBulanIni = batchPenerimaanBulanIni ?? []
  const totalDatangBulan = batchBulanIni.reduce((s, b: any) => s + (b.qty_diterima ?? 0), 0)
  const totalAccBulan    = batchBulanIni.reduce((s, b: any) => s + (b.qty_acc ?? 0), 0)
  const totalRejectBulan = batchBulanIni.reduce((s, b: any) => s + (b.qty_reject ?? 0), 0)
  const pendingQcCount   = batchBulanIni.filter((b: any) => b.status_qc === 'pending').length
  const rejectPendingQty = (rejectPending ?? []).reduce((s: number, r: any) => s + (r.qty ?? 0), 0)

  // Stok akrilik per gramasi
  const stokAkrilik = (stokPackaging ?? []).map((s: any) => ({
    produk_nama: s.produk_nama,
    produk_kode: s.produk_kode,
    gramasi: s.produk?.gramasi ?? 0,
    stok_qty: s.stok_qty ?? 0,
  })).sort((a: any, b: any) => a.gramasi - b.gramasi)

  const canSeeRp = ['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')

  return (
    <DashboardClient
      userName={profile?.name ?? ''}
      userRole={profile?.role ?? 'operator_produksi'}
      canSeeRp={canSeeRp}
      stok={{ pcs: stokAktifPcs, gram: stokAktifGram, nilaiRp: nilaiStok }}
      transit={{ pcs: transitPcs, gram: transitGram }}
      penjualan={{ pcs: terjualPcs, omzetRp: omzetBulanIni, buybackCount: (buybackBulanIni ?? []).length }}
      reject={{ count: rejectPcs, gram: rejectGram }}
      pipeline={pipeline}
      gramasiChartData={gramasiChartData}
      batchTerbaru={batchTerbaru ?? []}
      mutasiTransit={mutasiTransit ?? []}
      poPackaging={{
        openCount: poOpenCount,
        datangBulan: totalDatangBulan,
        accBulan: totalAccBulan,
        rejectBulan: totalRejectBulan,
        pendingQc: pendingQcCount,
        rejectPendingQty,
      }}
      stokAkrilik={stokAkrilik}
    />
  )
}
