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
  ] = await Promise.all([
    supabase.from('users_profile').select('role').eq('id', user.id).single(),
    // PO aktif (pending + diproses) dengan items
    supabase.from('po_cabang')
      .select('id, kode, cabang_nama, status, items:po_cabang_item(gramasi, qty_diminta, qty_dikirim)')
      .in('status', ['pending', 'diproses']),
    // Stok aktif per gramasi
    supabase.from('shieldtag').select('gramasi').eq('status', 'Aktif').is('voided_at', null),
    // Stok transit per gramasi
    supabase.from('shieldtag').select('gramasi').eq('status', 'Terdistribusi').is('voided_at', null),
  ])

  // Aggregate stok per gramasi
  const stokMap: Record<string, number> = {}
  for (const s of stokAktif ?? []) {
    if (s.gramasi) stokMap[s.gramasi] = (stokMap[s.gramasi] ?? 0) + 1
  }
  const transitMap: Record<string, number> = {}
  for (const s of stokTransit ?? []) {
    if (s.gramasi) transitMap[s.gramasi] = (transitMap[s.gramasi] ?? 0) + 1
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

  // Safety stock threshold: 10 pcs per gramasi (simple rule)
  const SAFETY_STOCK = 10

  // Build priority list
  const gramasiSet = new Set([
    ...Object.keys(stokMap),
    ...Object.keys(poMap),
  ])

  const prioritasList = [...gramasiSet].map(g => {
    const stok = stokMap[g] ?? 0
    const transit = transitMap[g] ?? 0
    const poDemand = poMap[g]?.qty ?? 0
    const poKodes = poMap[g]?.pos ?? []
    const tersedia = stok + transit

    let prioritas: 'P1' | 'P2' | 'P3'
    if (poDemand > 0 && stok < poDemand) prioritas = 'P1'
    else if (tersedia < SAFETY_STOCK) prioritas = 'P2'
    else prioritas = 'P3'

    return { gramasi: g, stok, transit, poDemand, poKodes, tersedia, prioritas }
  }).sort((a, b) => {
    const order = { P1: 0, P2: 1, P3: 2 }
    if (order[a.prioritas] !== order[b.prioritas]) return order[a.prioritas] - order[b.prioritas]
    return parseFloat(a.gramasi) - parseFloat(b.gramasi)
  })

  return (
    <PrioritasProduksiClient
      prioritasList={prioritasList}
      safetyStock={SAFETY_STOCK}
    />
  )
}
