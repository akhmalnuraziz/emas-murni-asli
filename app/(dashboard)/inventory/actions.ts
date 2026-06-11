'use server'

import { createClient } from '@/lib/supabase/server'

const GUDANG_LOKASI = 'Gudang Pusat'

export interface GudangRow {
  gramasi: string
  total_packed: number       // total pcs yang sudah packing (masuk gudang)
  tershieldtag: number       // pcs yang sudah punya shieldtag aktif di gudang
  belum_shieldtag: number    // total_packed - tershieldtag
  total_gram: number
}

// Urutan gramasi standar
const GRAMASI_ORDER = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']
function gramasiSort(a: string, b: string) {
  const ia = GRAMASI_ORDER.indexOf(a)
  const ib = GRAMASI_ORDER.indexOf(b)
  if (ia === -1 && ib === -1) return a.localeCompare(b)
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
}

export async function fetchInventoryGudang(): Promise<{ rows: GudangRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Unauthorized' }

  // 1. Total pcs per gramasi dari packing (yang belum void) = total masuk gudang
  const { data: packings } = await supabase
    .from('packing')
    .select('gramasi, pcs, total_gram, voided_at')
    .is('voided_at', null)

  // 2. Shieldtag aktif di gudang per gramasi = yang sudah tershieldtag & masih di gudang
  const { data: shieldtags } = await supabase
    .from('shieldtag')
    .select('gramasi, status, lokasi, voided_at')
    .is('voided_at', null)
    .eq('status', 'Aktif')
    .eq('lokasi', GUDANG_LOKASI)

  const packedMap = new Map<string, { pcs: number; gram: number }>()
  for (const p of packings ?? []) {
    const g = String(p.gramasi)
    const cur = packedMap.get(g) ?? { pcs: 0, gram: 0 }
    cur.pcs += Number(p.pcs ?? 0)
    cur.gram += Number(p.total_gram ?? 0)
    packedMap.set(g, cur)
  }

  const stMap = new Map<string, number>()
  for (const s of shieldtags ?? []) {
    const g = String(s.gramasi)
    stMap.set(g, (stMap.get(g) ?? 0) + 1)
  }

  const allGramasi = new Set<string>([...packedMap.keys(), ...stMap.keys()])
  const rows: GudangRow[] = [...allGramasi].map(g => {
    const packed = packedMap.get(g) ?? { pcs: 0, gram: 0 }
    const tagged = stMap.get(g) ?? 0
    return {
      gramasi: g,
      total_packed: packed.pcs,
      tershieldtag: tagged,
      belum_shieldtag: Math.max(0, packed.pcs - tagged),
      total_gram: packed.gram,
    }
  }).filter(r => r.total_packed > 0 || r.tershieldtag > 0)
    .sort((a, b) => gramasiSort(a.gramasi, b.gramasi))

  return { rows }
}
