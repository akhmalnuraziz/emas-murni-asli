import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/modules/dashboard/dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

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
    { data: pengaturanRows },
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
    supabase.from('pengaturan').select('key, value').like('key', 'biaya_packaging_%'),
  ])

  // Build biaya packaging map
  const pkgMap: Record<string, number> = {}
  for (const r of pengaturanRows ?? []) {
    pkgMap[r.key.replace('biaya_packaging_', '')] = Number(r.value ?? 0)
  }

  // Stok aktif stats
  const stokAktifPcs = (shieldtagAktif ?? []).length
  const stokAktifGram = (shieldtagAktif ?? []).reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)
  const nilaiStok = (shieldtagAktif ?? []).reduce((s, t) => s + Number(t.hpp ?? 0), 0)

  // Transit stats
  const transitPcs = (shieldtagTransit ?? []).length
  const transitGram = (shieldtagTransit ?? []).reduce((s, t) => s + parseFloat(t.gramasi ?? '0'), 0)

  // Penjualan bulan ini
  const terjualPcs = (penjualanBulanIni ?? []).reduce((s, p) => s + (Number(p.pcs) || 0), 0)
  const omzetBulanIni = (penjualanBulanIni ?? []).reduce((s, p) => s + (Number(p.harga_jual) || 0), 0)

  // Reject
  const rejectPcs = (rejectBelumDilebur ?? []).length
  const rejectGram = (rejectBelumDilebur ?? []).reduce((s, r) => s + Number(r.berat_reject ?? 0), 0)

  // Produksi pipeline
  const pipeline: Record<string, number> = {}
  for (const p of produksiPipeline ?? []) {
    const s = p.current_status ?? 'Unknown'
    pipeline[s] = (pipeline[s] ?? 0) + 1
  }

  // Stok per gramasi (bar chart)
  const gramasiMap: Record<string, number> = {}
  for (const t of shieldtagAktif ?? []) {
    if (t.gramasi) gramasiMap[t.gramasi] = (gramasiMap[t.gramasi] ?? 0) + 1
  }
  const gramasiChartData = Object.entries(gramasiMap)
    .map(([gramasi, pcs]) => ({ gramasi: `${gramasi}gr`, pcs }))
    .sort((a, b) => parseFloat(a.gramasi) - parseFloat(b.gramasi))

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
    />
  )
}
