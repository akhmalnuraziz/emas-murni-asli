'use server'

import { createClient } from '@/lib/supabase/server'

export interface SearchResult {
  type: 'shieldtag' | 'batch' | 'po_cabang' | 'mutasi' | 'produksi'
  label: string
  sub: string
  href: string
  status?: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !query.trim()) return []

  const q = query.trim().toUpperCase()
  const results: SearchResult[] = []

  const [
    { data: shieldtags },
    { data: batches },
    { data: poList },
    { data: mutasiList },
    { data: produksiList },
  ] = await Promise.all([
    supabase.from('shieldtag')
      .select('kode, gramasi, status, batch_kode')
      .ilike('kode', `%${q}%`)
      .is('voided_at', null)
      .limit(5),

    supabase.from('batch')
      .select('kode, gramasi, status')
      .ilike('kode', `%${q}%`)
      .limit(5),

    supabase.from('po_cabang')
      .select('nomor_po, cabang_kode, status')
      .or(`nomor_po.ilike.%${q}%,cabang_kode.ilike.%${q}%`)
      .limit(5),

    supabase.from('mutasi')
      .select('kode, ke_lokasi, status')
      .ilike('kode', `%${q}%`)
      .limit(5),

    supabase.from('produksi_item')
      .select('kode, nama_item, gramasi')
      .or(`kode.ilike.%${q}%,nama_item.ilike.%${q}%`)
      .limit(4),
  ])

  for (const s of shieldtags ?? []) {
    results.push({
      type: 'shieldtag',
      label: s.kode,
      sub: `${s.gramasi}gr · ${s.batch_kode} · ${s.status}`,
      href: '/shieldtag',
      status: s.status,
    })
  }
  for (const b of batches ?? []) {
    results.push({
      type: 'batch',
      label: b.kode,
      sub: `Batch · ${b.gramasi}gr · ${b.status ?? '—'}`,
      href: '/bahan-baku',
    })
  }
  for (const p of poList ?? []) {
    results.push({
      type: 'po_cabang',
      label: p.nomor_po ?? p.cabang_kode,
      sub: `PO Cabang · ${p.cabang_kode} · ${p.status}`,
      href: '/po-cabang',
      status: p.status,
    })
  }
  for (const m of mutasiList ?? []) {
    results.push({
      type: 'mutasi',
      label: m.kode,
      sub: `Mutasi → ${m.ke_lokasi} · ${m.status}`,
      href: '/mutasi',
      status: m.status,
    })
  }
  for (const pr of produksiList ?? []) {
    results.push({
      type: 'produksi',
      label: pr.kode,
      sub: `${pr.nama_item ?? '—'} · ${pr.gramasi}gr`,
      href: '/produksi',
    })
  }

  return results.slice(0, 12)
}
