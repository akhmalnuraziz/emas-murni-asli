'use server'

import { createClient } from '@/lib/supabase/server'

const PRIVILEGED = ['owner', 'admin_pusat', 'accounting', 'spv']

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!profile) return { error: 'Unauthorized' }

  const k = kode.trim().toUpperCase()
  if (!k) return { error: 'Kode shieldtag tidak boleh kosong' }

  const canSeeFinancial = PRIVILEGED.includes(profile.role ?? '')

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

  // 5. Batch — sembunyikan HPP untuk non-privileged
  const batchKode = tag.batch_kode ?? packing?.batch_kode ?? produksiItem?.batch_kode
  let batch: any = null
  if (batchKode) {
    const { data: batchRaw } = await supabase.from('batch').select('*').eq('kode', batchKode).single()
    if (batchRaw) {
      batch = canSeeFinancial ? batchRaw : { ...batchRaw, hpp_gr: undefined, hpp_total: undefined }
    }
  }

  // 6. Mutasi
  const { data: mutasiRaw } = await supabase
    .from('mutasi')
    .select('kode, tanggal_kirim, cabang_tujuan, cabang_asal, status_kirim, status_terima, tanggal_terima')
    .contains('shieldtag_kodes', [k])
    .order('created_at')

  // 7. Penjualan — sembunyikan harga_jual/profit untuk non-privileged
  const penjualanSelect = canSeeFinancial
    ? 'no_faktur, tanggal, toko, nama_customer, gramasi, harga_jual, profit, status'
    : 'no_faktur, tanggal, toko, nama_customer, gramasi, status'
  const { data: penjualan } = await supabase
    .from('penjualan')
    .select(penjualanSelect)
    .contains('shieldtag_kodes', [k])
    .limit(1)
    .maybeSingle()

  // 8. Audit logs — hanya privileged
  const auditLogs: any[] = []
  if (canSeeFinancial) {
    const { data: logs } = await supabase
      .from('audit_log')
      .select('timestamp, user_name, user_role, action, module, reason')
      .eq('record_key', k)
      .order('timestamp', { ascending: false })
      .limit(20)
    auditLogs.push(...(logs ?? []))
  }

  // 9. Buyback
  const { data: buyback } = await supabase
    .from('buyback')
    .select('kode, tanggal, nama_customer, kondisi_emas, kondisi_tag, hasil_inspeksi, harga_beli, status')
    .eq('shieldtag_kode', k)
    .maybeSingle()

  // Sembunyikan harga_beli buyback untuk non-privileged
  const safeBuyback = buyback && !canSeeFinancial
    ? { ...buyback, harga_beli: undefined }
    : buyback

  // Sembunyikan HPP shieldtag untuk non-privileged
  const safeTag = canSeeFinancial ? tag : { ...tag, hpp: undefined }

  return {
    data: {
      tag: safeTag,
      packing: packing ?? null,
      produksiItem: produksiItem ?? null,
      produksiEvents: produksiEvents ?? [],
      batch,
      mutasi: mutasiRaw ?? [],
      penjualan: penjualan ?? null,
      auditLogs,
      buyback: safeBuyback ?? null,
    }
  }
}
