'use server'

import { createClient } from '@/lib/supabase/server'

export interface ShieldtagDetail {
  tag: any
  packing: any | null
  produksiItem: any | null
  produksiEvents: any[]
  batch: any | null
  mutasi: any[]
  penjualan: any | null
  auditLogs: any[]
  buyback: any | null
}

export async function searchShieldtag(kode: string): Promise<{ data?: ShieldtagDetail; error?: string }> {
  const supabase = await createClient()
  const k = kode.trim().toUpperCase()
  if (!k) return { error: 'Kode shieldtag tidak boleh kosong' }

  // 1. Cari shieldtag
  const { data: tag, error: tagErr } = await supabase
    .from('shieldtag')
    .select('*')
    .or(`kode.eq.${k},replaced_by_kode.eq.${k},replaces_kode.eq.${k}`)
    .limit(1)
    .single()

  if (tagErr || !tag) return { error: `Shieldtag "${k}" tidak ditemukan` }

  // 2. Packing
  const { data: packing } = tag.packing_id
    ? await supabase.from('packing').select('*').eq('id', tag.packing_id).single()
    : { data: null }

  // 3. Produksi item
  const { data: produksiItem } = packing?.produksi_item_id
    ? await supabase.from('produksi_item').select('*').eq('id', packing.produksi_item_id).single()
    : { data: null }

  // 4. Produksi events
  const { data: produksiEvents } = produksiItem?.id
    ? await supabase.from('produksi_event').select('*').eq('produksi_item_id', produksiItem.id).order('created_at')
    : { data: [] }

  // 5. Batch
  const batchKode = tag.batch_kode ?? packing?.batch_kode ?? produksiItem?.batch_kode
  const { data: batch } = batchKode
    ? await supabase.from('batch').select('*').eq('kode', batchKode).single()
    : { data: null }

  // 6. Mutasi yang melibatkan shieldtag ini
  const { data: mutasiRaw } = await supabase
    .from('mutasi')
    .select('kode, tanggal_kirim, cabang_tujuan, cabang_asal, status_kirim, status_terima, tanggal_terima')
    .contains('shieldtag_kodes', [k])
    .order('created_at')

  // 7. Penjualan
  const { data: penjualan } = await supabase
    .from('penjualan')
    .select('no_faktur, tanggal, toko, nama_customer, gramasi, harga_jual, profit, status')
    .contains('shieldtag_kodes', [k])
    .limit(1)
    .maybeSingle()

  // 8. Audit logs untuk kode ini
  const { data: auditLogs } = await supabase
    .from('audit_log')
    .select('timestamp, user_name, user_role, action, module, reason')
    .eq('record_key', k)
    .order('timestamp', { ascending: false })
    .limit(20)

  // 9. Buyback
  const { data: buyback } = await supabase
    .from('buyback')
    .select('kode, tanggal, nama_customer, kondisi_emas, kondisi_tag, hasil_inspeksi, harga_beli, status')
    .eq('shieldtag_kode', k)
    .maybeSingle()

  return {
    data: {
      tag,
      packing: packing ?? null,
      produksiItem: produksiItem ?? null,
      produksiEvents: produksiEvents ?? [],
      batch: batch ?? null,
      mutasi: mutasiRaw ?? [],
      penjualan: penjualan ?? null,
      auditLogs: auditLogs ?? [],
      buyback: buyback ?? null,
    }
  }
}
