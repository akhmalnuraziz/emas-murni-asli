import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrioritasProduksiClient from '@/components/modules/prioritas-produksi/prioritas-produksi-client'

export const dynamic = 'force-dynamic'

export default async function PrioritasProduksiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: poItems },
    { data: stokAktif },
    { data: stokTransit },
    { data: wipItems },
    { data: gramasiOptions },
    { data: pengaturanRows },
  ] = await Promise.all([
    supabase.from('users_profile').select('role').eq('id', user.id).single(),
    // PO aktif (pending + diproses) dengan items
    supabase.from('po_cabang')
      .select('id, kode, cabang_nama, status, items:po_cabang_item(gramasi, qty_diminta, qty_dikirim)')
      .in('status', ['pending', 'diproses']),
    // Stok aktif per gramasi
    supabase.from('shieldtag').select('gramasi').eq('status', 'Aktif').is('voided_at', null).limit(5000),
    // Stok transit per gramasi
    supabase.from('shieldtag').select('gramasi').eq('status', 'Transit').is('voided_at', null).limit(5000),
    // WIP: produksi_item yang sedang berjalan (belum jadi shieldtag)
    supabase.from('produksi_item')
      .select('gramasi')
      .not('current_status', 'in', '("Sudah Packing","Reject")')
      .is('voided_at', null)
      .limit(1000),
    // Semua gramasi yang ada di master
    supabase.from('gramasi_option').select('nilai').eq('aktif', true).order('urutan'),
    // Safety stock setting dari pengaturan (global + per-gramasi)
    supabase.from('pengaturan').select('key, value')
      .or('key.eq.safety_stock_global,key.like.safety_stock_%'),
  ])

  // Build pengaturan map
  const pMap: Record<string, string> = {}
  for (const r of pengaturanRows ?? []) pMap[r.key] = r.value
  const safetyStockGlobal = Number(pMap['safety_stock_global'] ?? 10)

  // Aggregate stok per gramasi
  const stokMap: Record<string, number> = {}
  for (const s of stokAktif ?? []) {
    if (s.gramasi) stokMap[s.gramasi] = (stokMap[s.gramasi] ?? 0) + 1
  }
  const transitMap: Record<string, number> = {}
  for (const s of stokTransit ?? []) {
    if (s.gramasi) transitMap[s.gramasi] = (transitMap[s.gramasi] ?? 0) + 1
  }

  // WIP per gramasi (item dalam proses produksi)
  const wipMap: Record<string, number> = {}
  for (const w of wipItems ?? []) {
    if (w.gramasi) wipMap[w.gramasi] = (wipMap[w.gramasi] ?? 0) + 1
  }

  // Aggregate PO demand per gramasi
  const poMap: Record<string, { qty: number; pos: string[] }> = {}
  for (const po of poItems ?? []) {
    for (const it of (po.items ?? []) as any[]) {
      const g = it.gramasi
      if (!poMap[g]) poMap[g] = { qty: 0, pos: [] }
      const remaining = it.qty_diminta - (it.qty_dikirim ?? 0)
      if (remaining > 0) {
        poMap[g].qty += remaining
        if (!poMap[g].pos.includes(po.kode)) poMap[g].pos.push(po.kode)
      }
    }
  }

  // Gabungkan semua gramasi yang relevan
  const masterGramasi = (gramasiOptions ?? []).map((g: any) => g.nilai as string)
  const gramasiSet = new Set([
    ...masterGramasi,
    ...Object.keys(stokMap),
    ...Object.keys(poMap),
    ...Object.keys(wipMap),
  ])

  // Build priority list
  const prioritasList = [...gramasiSet].map(g => {
    const stok      = stokMap[g] ?? 0
    const transit   = transitMap[g] ?? 0
    const wip       = wipMap[g] ?? 0
    const poDemand  = poMap[g]?.qty ?? 0
    const poKodes   = poMap[g]?.pos ?? []
    const tersedia  = stok + transit
    const safetyStock = Number(pMap[`safety_stock_${g}`] ?? safetyStockGlobal)

    // Rekomendasi = berapa pcs perlu diproduksi
    const totalKebutuhan = safetyStock + poDemand
    const totalAda       = stok + transit + wip
    const rekomendasi    = Math.max(0, totalKebutuhan - totalAda)

    let prioritas: 'P1' | 'P2' | 'P3'
    if (poDemand > 0 && stok < poDemand) prioritas = 'P1'
    else if (tersedia < safetyStock) prioritas = 'P2'
    else prioritas = 'P3'

    return { gramasi: g, stok, transit, wip, poDemand, poKodes, tersedia, safetyStock, rekomendasi, prioritas }
  }).sort((a, b) => {
    const order = { P1: 0, P2: 1, P3: 2 }
    if (order[a.prioritas] !== order[b.prioritas]) return order[a.prioritas] - order[b.prioritas]
    return parseFloat(a.gramasi) - parseFloat(b.gramasi)
  })

  return (
    <PrioritasProduksiClient
      prioritasList={prioritasList}
      safetyStockGlobal={safetyStockGlobal}
      userRole={profile?.role ?? ''}
    />
  )
}
