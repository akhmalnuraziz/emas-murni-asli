'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function generateNoFaktur(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'penjualan' })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `INV/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

export async function createPenjualan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const tanggal        = formData.get('tanggal') as string
  const channel        = formData.get('channel') as string       // toko | shopee | tiktok | raja_emas | cabang
  const namaCustomer   = formData.get('nama_customer') as string | null
  const hpCustomer     = formData.get('hp_customer') as string | null
  const ktpCustomer    = formData.get('ktp_customer') as string | null
  const marketplaceAkun= formData.get('marketplace_akun') as string | null
  const noInvoiceMktpl = formData.get('no_invoice_mktpl') as string | null
  const cabangKode     = formData.get('cabang_kode') as string | null
  const cabangNama     = formData.get('cabang_nama') as string | null
  const catatan        = formData.get('catatan') as string | null
  const itemsRaw       = formData.get('items') as string          // JSON array
  const paymentsRaw    = formData.get('payments') as string       // JSON array

  if (!tanggal)   return { error: 'Tanggal wajib diisi' }
  if (!channel)   return { error: 'Channel wajib dipilih' }
  if (!itemsRaw)  return { error: 'Minimal satu item wajib diisi' }

  const items: { shieldtag_kode: string; harga_jual: number }[] = JSON.parse(itemsRaw)
  if (!items.length) return { error: 'Minimal satu item wajib diisi' }

  const payments: { metode: string; jumlah: number; catatan?: string }[] = paymentsRaw ? JSON.parse(paymentsRaw) : []

  // Validate & fetch shieldtag data
  const kodes = items.map(i => i.shieldtag_kode.toUpperCase().trim())
  const { data: tags, error: tagErr } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, hpp, status')
    .in('kode', kodes)
    .is('voided_at', null)

  if (tagErr) return { error: tagErr.message }
  if (!tags || tags.length !== kodes.length) return { error: `Beberapa kode ShieldTag tidak ditemukan: ${kodes.filter(k => !tags?.find((t: any) => t.kode === k)).join(', ')}` }

  for (const t of tags as any[]) {
    if (t.status !== 'Aktif') return { error: `ShieldTag ${t.kode} tidak berstatus Aktif (status: ${t.status})` }
  }

  // Lookup marketplace fee
  let feeMarketplace = 0
  let feeCustom = 0
  if (channel !== 'toko' && channel !== 'cabang') {
    const { data: mkt } = await supabase.from('marketplace_setting').select('fee_persen').eq('channel', channel).single()
    feeMarketplace = Number(mkt?.fee_persen ?? 0)
  }

  const noFaktur = await generateNoFaktur(supabase)

  // Compute totals
  let totalHargaJual = 0
  let hppTotal = 0
  const itemRows = items.map(it => {
    const tag = (tags as any[]).find(t => t.kode === it.shieldtag_kode.toUpperCase().trim())!
    const hargaJual = Number(it.harga_jual)
    const hpp = Number(tag.hpp ?? 0)
    const feeAmt = hargaJual * (feeMarketplace / 100)
    const profit = hargaJual - hpp - feeAmt
    totalHargaJual += hargaJual
    hppTotal += hpp
    return {
      shieldtag_kode: tag.kode,
      produk_nama: `LM REI ${tag.gramasi}GR`,
      gramasi: tag.gramasi,
      hpp,
      harga_jual: hargaJual,
      profit,
    }
  })
  const totalProfit = totalHargaJual - hppTotal - (totalHargaJual * feeMarketplace / 100)

  // Insert penjualan header
  const { data: pj, error: pjErr } = await supabase.from('penjualan').insert({
    no_faktur: noFaktur,
    tanggal,
    status: 'lunas',
    channel,
    source: channel === 'toko' ? 'toko' : (channel === 'cabang' ? 'cabang' : 'marketplace'),
    tipe: 'jual',
    nama_customer: namaCustomer || null,
    hp_customer: hpCustomer || null,
    ktp_customer: ktpCustomer || null,
    marketplace_akun: marketplaceAkun || null,
    no_invoice_mktpl: noInvoiceMktpl || null,
    cabang_kode: cabangKode || null,
    cabang_nama: cabangNama || null,
    catatan: catatan || null,
    pcs: items.length,
    gramasi: items.length === 1 ? (tags as any[])[0].gramasi : null,
    shieldtag_kodes: kodes,
    harga_jual: items.length === 1 ? Number(items[0].harga_jual) : null,
    total_harga_jual: totalHargaJual,
    hpp_total: hppTotal,
    fee_marketplace: feeMarketplace,
    profit: items.length === 1 ? itemRows[0].profit : null,
    total_profit: totalProfit,
    created_by: user.id,
  }).select('id').single()
  if (pjErr) return { error: pjErr.message }

  // Insert items
  const { error: itemErr } = await supabase.from('penjualan_item').insert(itemRows.map(r => ({ ...r, penjualan_id: pj.id })))
  if (itemErr) return { error: itemErr.message }

  // Insert payments
  if (payments.length > 0) {
    const { error: payErr } = await supabase.from('penjualan_payment').insert(payments.map(p => ({ penjualan_id: pj.id, ...p })))
    if (payErr) return { error: payErr.message }
  }

  // Update shieldtag status to Terjual
  const { error: stErr } = await supabase.from('shieldtag').update({ status: 'Terjual' }).in('kode', kodes)
  if (stErr) return { error: stErr.message }

  revalidatePath('/penjualan')
  revalidatePath('/dashboard')
  return { success: true, noFaktur }
}

export async function voidPenjualan(penjualanId: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }
  if (!reason) return { error: 'Alasan void wajib diisi' }

  const { data: pj } = await supabase.from('penjualan').select('id, shieldtag_kodes, voided_at').eq('id', penjualanId).single()
  if (!pj) return { error: 'Penjualan tidak ditemukan' }
  if (pj.voided_at) return { error: 'Sudah divoid sebelumnya' }

  const now = new Date().toISOString()
  await supabase.from('penjualan').update({ voided_at: now, void_reason: reason, status: 'void' }).eq('id', penjualanId)

  // Restore shieldtag back to Aktif
  if (pj.shieldtag_kodes?.length) {
    await supabase.from('shieldtag').update({ status: 'Aktif' }).in('kode', pj.shieldtag_kodes)
  }

  revalidatePath('/penjualan')
  revalidatePath('/dashboard')
  return { success: true }
}
