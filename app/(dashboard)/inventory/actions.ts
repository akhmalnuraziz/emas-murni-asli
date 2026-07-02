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

  // 1. Total pcs per gramasi dari packing (yang belum void) = total pernah masuk gudang.
  // pcs_reject/gram_reject dikeluarkan — barang reject tidak pernah jadi stok gudang.
  const { data: packings } = await supabase
    .from('packing')
    .select('id, gramasi, pcs_dipack, total_gram, pcs_reject, gram_reject, voided_at')
    .is('voided_at', null)

  // 2. Shieldtag Aktif di gudang saat ini (untuk kolom "tershieldtag" — stok fisik riil)
  const { data: shieldtagsAktif } = await supabase
    .from('shieldtag')
    .select('gramasi, packing_id')
    .is('voided_at', null)
    .eq('status', 'Aktif')
    .eq('lokasi', GUDANG_LOKASI)

  // 3. SEMUA shieldtag per packing_id (apapun status/lokasinya) — untuk hitung "belum tershieldtag"
  // yang benar: pcs dari packing ini yang BELUM PERNAH dibuatkan shieldtag sama sekali.
  // Barang yang sudah tershieldtag lalu terjual/mutasi TETAP terhitung "sudah tershieldtag",
  // bukan "belum" — beda dari formula lama yang keliru mengurangi stok aktif saat ini.
  const { data: shieldtagsAll } = await supabase
    .from('shieldtag')
    .select('packing_id')
    .is('voided_at', null)
    .not('packing_id', 'is', null)

  const taggedCountByPacking = new Map<number, number>()
  for (const s of shieldtagsAll ?? []) {
    if (s.packing_id == null) continue
    taggedCountByPacking.set(s.packing_id, (taggedCountByPacking.get(s.packing_id) ?? 0) + 1)
  }

  const packedMap = new Map<string, { pcs: number; gram: number; belum: number }>()
  for (const p of packings ?? []) {
    const g = String(p.gramasi)
    const cur = packedMap.get(g) ?? { pcs: 0, gram: 0, belum: 0 }
    const pcsGood = Math.max(0, Number(p.pcs_dipack ?? 0) - Number(p.pcs_reject ?? 0))
    const gramGood = Math.max(0, Number(p.total_gram ?? 0) - Number(p.gram_reject ?? 0))
    const sudahDitag = taggedCountByPacking.get(p.id) ?? 0
    cur.pcs += pcsGood
    cur.gram += gramGood
    cur.belum += Math.max(0, pcsGood - sudahDitag)
    packedMap.set(g, cur)
  }

  const stMap = new Map<string, number>()
  for (const s of shieldtagsAktif ?? []) {
    const g = String(s.gramasi)
    stMap.set(g, (stMap.get(g) ?? 0) + 1)
  }

  const allGramasi = new Set<string>([...packedMap.keys(), ...stMap.keys()])
  const rows: GudangRow[] = [...allGramasi].map(g => {
    const packed = packedMap.get(g) ?? { pcs: 0, gram: 0, belum: 0 }
    const tagged = stMap.get(g) ?? 0
    return {
      gramasi: g,
      total_packed: packed.pcs,
      tershieldtag: tagged,
      belum_shieldtag: packed.belum,
      total_gram: packed.gram,
    }
  }).filter(r => r.total_packed > 0 || r.tershieldtag > 0)
    .sort((a, b) => gramasiSort(a.gramasi, b.gramasi))

  return { rows }
}
