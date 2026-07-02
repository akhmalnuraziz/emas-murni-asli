'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

const GRAMASI_ORDER = ['0.1','0.5','1','2','5','10','20','25','50','100','250','500','1000']

export interface StokCabangRow {
  gramasi: string
  qty_shieldtag: number   // dari shieldtag Terdistribusi
  net_adjustment: number  // net dari semua adjustment
  ready_stock: number     // qty_shieldtag + net_adjustment
  outstanding_po: number  // qty ordered not yet received
  total_stock: number     // ready_stock + outstanding_po
}

export interface CabangStokSummary {
  kode: string
  nama: string
  rows: StokCabangRow[]
  total_ready: number
  total_outstanding: number
  total_stok: number
  last_adjustment?: string
}

export async function getStokSemuaCabang(cabangKodeFilter?: string): Promise<{ data: CabangStokSummary[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Unauthorized' }

  let cabangQuery = supabase.from('cabang').select('kode, nama').eq('aktif', true).order('nama')
  if (cabangKodeFilter) cabangQuery = cabangQuery.eq('kode', cabangKodeFilter) as any

  const [
    { data: cabangList },
    { data: shieldtagDist },
    { data: adjustments },
    { data: poItems },
  ] = await Promise.all([
    cabangQuery,
    supabase.from('shieldtag')
      .select('gramasi, lokasi')
      .eq('status', 'Aktif')
      .neq('lokasi', 'Gudang Pusat')
      .is('voided_at', null)
      .limit(5000),
    supabase.from('stok_cabang_adjustment')
      .select('cabang_kode, gramasi, selisih, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase.from('po_cabang_item')
      .select('gramasi, qty_diminta, qty_diterima, po:po_cabang!inner(cabang_kode, status)')
      .not('po.status', 'in', '("selesai","ditolak")'),
  ])

  // Build shieldtag map: { cabang_kode: { gramasi: count } }
  const stMap: Record<string, Record<string, number>> = {}
  for (const t of shieldtagDist ?? []) {
    const lok = t.lokasi ?? ''
    const g   = String(parseFloat(t.gramasi ?? '0'))
    if (!stMap[lok]) stMap[lok] = {}
    stMap[lok][g] = (stMap[lok][g] ?? 0) + 1
  }

  // Build adjustment net map: { cabang_kode: { gramasi: net } }
  const adjMap: Record<string, Record<string, number>> = {}
  const adjLastMap: Record<string, string> = {}
  for (const a of adjustments ?? []) {
    const k = a.cabang_kode
    const g = a.gramasi
    if (!adjMap[k]) adjMap[k] = {}
    adjMap[k][g] = (adjMap[k][g] ?? 0) + (a.selisih ?? 0)
    if (!adjLastMap[k]) adjLastMap[k] = a.created_at
  }

  // Build outstanding PO map: { cabang_kode: { gramasi: outstanding_qty } }
  const poMap: Record<string, Record<string, number>> = {}
  for (const item of poItems ?? []) {
    const po = item.po as any
    const cabKode = po?.cabang_kode ?? ''
    const g = String(parseFloat(item.gramasi ?? '0'))
    const outstanding = Math.max(0, (item.qty_diminta ?? 0) - (item.qty_diterima ?? 0))
    if (!poMap[cabKode]) poMap[cabKode] = {}
    poMap[cabKode][g] = (poMap[cabKode][g] ?? 0) + outstanding
  }

  const result: CabangStokSummary[] = []
  for (const cab of cabangList ?? []) {
    const st  = stMap[cab.nama] ?? {}
    const adj = adjMap[cab.kode] ?? {}
    const po  = poMap[cab.kode] ?? {}

    // Collect all gramasi that have any data
    const allGramasi = new Set([
      ...Object.keys(st),
      ...Object.keys(adj),
      ...Object.keys(po),
    ])

    const rows: StokCabangRow[] = GRAMASI_ORDER
      .filter(g => allGramasi.has(g))
      .map(g => {
        const qty_shieldtag   = st[g] ?? 0
        const net_adjustment  = adj[g] ?? 0
        const ready_stock     = Math.max(0, qty_shieldtag + net_adjustment)
        const outstanding_po  = po[g] ?? 0
        return {
          gramasi: g,
          qty_shieldtag,
          net_adjustment,
          ready_stock,
          outstanding_po,
          total_stock: ready_stock + outstanding_po,
        }
      })

    const total_ready       = rows.reduce((s, r) => s + r.ready_stock, 0)
    const total_outstanding = rows.reduce((s, r) => s + r.outstanding_po, 0)

    result.push({
      kode: cab.kode,
      nama: cab.nama,
      rows,
      total_ready,
      total_outstanding,
      total_stok: total_ready + total_outstanding,
      last_adjustment: adjLastMap[cab.kode],
    })
  }

  return { data: result }
}

export async function getAdjustmentHistory(cabangKode: string): Promise<any[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('stok_cabang_adjustment')
    .select('*')
    .eq('cabang_kode', cabangKode)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function createStockAdjustment(params: {
  cabangKode: string
  cabangNama: string
  gramasi: string
  qtyBefore: number
  qtyAfter: number
  alasan: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { success: false, error: 'Hanya Owner/Manager/SPV yang bisa adjust stok' }
  if (!params.alasan.trim()) return { success: false, error: 'Alasan wajib diisi' }

  const { error } = await supabase.from('stok_cabang_adjustment').insert({
    cabang_kode:    params.cabangKode,
    cabang_nama:    params.cabangNama,
    gramasi:        params.gramasi,
    qty_before:     params.qtyBefore,
    qty_after:      params.qtyAfter,
    alasan:         params.alasan.trim(),
    created_by:     user.id,
    created_by_name: profile?.name ?? 'Unknown',
  })
  if (error) return { success: false, error: error.message }

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name,
    action: 'STOCK_ADJUSTMENT', module: 'stok_cabang',
    record_key: `${params.cabangKode}/${params.gramasi}`,
    before_data: { qty: params.qtyBefore },
    after_data: { qty: params.qtyAfter },
    reason: params.alasan,
  })

  createNotif({
    judul: `Stok Cabang Disesuaikan`,
    pesan: `${params.cabangNama} · ${params.gramasi}gr · ${params.qtyBefore} → ${params.qtyAfter} · ${params.alasan}`,
    tipe: 'info',
    link: '/stok-cabang',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/stok-cabang')
  return { success: true }
}

export async function exportStokCabangCsv(cabangKodeFilter?: string): Promise<{ csv: string; error?: string }> {
  const result = await getStokSemuaCabang(cabangKodeFilter)
  if (result.error) return { csv: '', error: result.error }

  const rows: string[] = []
  rows.push(['Cabang', 'Gramasi (gr)', 'Shieldtag', 'Adj Net', 'Ready Stock', 'Outstanding PO', 'Total Stok'].join(','))

  for (const cab of result.data) {
    for (const r of cab.rows) {
      rows.push([
        `"${cab.nama}"`,
        r.gramasi,
        r.qty_shieldtag,
        r.net_adjustment,
        r.ready_stock,
        r.outstanding_po,
        r.total_stock,
      ].join(','))
    }
    // Summary row per cabang
    rows.push([
      `"${cab.nama} — TOTAL"`,
      '',
      '',
      '',
      cab.total_ready,
      cab.total_outstanding,
      cab.total_stok,
    ].join(','))
    rows.push('') // blank separator
  }

  return { csv: rows.join('\n') }
}

export async function konfirmasiTerimaPoItem(params: {
  itemId: number
  poId: number
  qtyDiterima: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  // Update item
  const { error: itemErr } = await supabase.from('po_cabang_item').update({
    qty_diterima: params.qtyDiterima,
    diterima_at: new Date().toISOString(),
    diterima_by: profile?.name ?? 'Unknown',
  }).eq('id', params.itemId)
  if (itemErr) return { success: false, error: itemErr.message }

  // Cek apakah semua item di PO ini sudah selesai diterima
  const { data: allItems } = await supabase.from('po_cabang_item')
    .select('qty_diminta, qty_diterima')
    .eq('po_id', params.poId)

  const semuaSelesai = (allItems ?? []).every(
    it => (it.qty_diterima ?? 0) >= (it.qty_diminta ?? 0)
  )
  const adaPartial = (allItems ?? []).some(
    it => (it.qty_diterima ?? 0) > 0 && (it.qty_diterima ?? 0) < (it.qty_diminta ?? 0)
  )

  let newStatus: string | null = null
  if (semuaSelesai) newStatus = 'selesai'
  else if (adaPartial) newStatus = 'partial'

  if (newStatus) {
    await supabase.from('po_cabang').update({
      status: newStatus,
      ...(newStatus === 'selesai' ? { selesai_at: new Date().toISOString() } : {}),
    }).eq('id', params.poId)
  }

  revalidatePath('/stok-cabang')
  revalidatePath('/po-cabang')
  return { success: true }
}
