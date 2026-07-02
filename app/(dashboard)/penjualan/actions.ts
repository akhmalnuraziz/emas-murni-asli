'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

async function generateNoFaktur(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'penjualan' })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `INV/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

export async function lookupShieldtag(kode: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, status')
    .eq('kode', kode.toUpperCase().trim())
    .is('voided_at', null)
    .single()
  if (error || !data) return { error: 'Kode tidak ditemukan' }
  return {
    kode: data.kode,
    gramasi: data.gramasi as string,
    produk_nama: `LM REI ${data.gramasi}GR`,
    status: data.status as string,
  }
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
  const alamatCustomer = formData.get('alamat_customer') as string | null
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

  // Atomic: lock shieldtag + insert pj+items+payments + update shieldtag in one TX.
  // Fixes double-sell race + partial-write inconsistency.
  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_penjualan_atomic', {
    p_no_faktur: noFaktur,
    p_tanggal: tanggal,
    p_channel: channel,
    p_source: channel === 'toko' ? 'toko' : (channel === 'cabang' ? 'cabang' : 'marketplace'),
    p_kodes: kodes,
    p_items: itemRows,
    p_payments: payments,
    p_header: {
      nama_customer: namaCustomer,
      hp_customer: hpCustomer,
      ktp_customer: ktpCustomer,
      alamat_customer: alamatCustomer,
      marketplace_akun: marketplaceAkun,
      no_invoice_mktpl: noInvoiceMktpl,
      cabang_kode: cabangKode,
      cabang_nama: cabangNama,
      catatan,
    },
    p_user_id: user.id,
    p_total_harga_jual: totalHargaJual,
    p_hpp_total: hppTotal,
    p_fee_marketplace: feeMarketplace,
    p_total_profit: totalProfit,
  })
  if (rpcErr) return { error: rpcErr.message }
  const pj = { id: (rpcData as any)?.id as number }

  revalidatePath('/penjualan')
  revalidatePath('/dashboard')

  // Notif ke owner/admin_pusat/spv
  const itemSummary = itemRows.map(r => `${r.gramasi}gr`).join(', ')
  const channelLabel = channel === 'toko' ? 'Toko' : channel === 'cabang' ? `Cabang ${cabangNama ?? ''}` : channel
  createNotif({
    judul: `Penjualan Baru — ${noFaktur}`,
    pesan: `${items.length} pcs (${itemSummary}) via ${channelLabel} · Rp ${totalHargaJual.toLocaleString('id-ID')}`,
    tipe: 'success',
    link: '/penjualan',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  return { success: true, noFaktur, id: pj.id as number }
}

export async function voidPenjualan(penjualanId: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  if (!reason) return { error: 'Alasan void wajib diisi' }

  const { data: pj } = await supabase.from('penjualan').select('id, shieldtag_kodes, voided_at').eq('id', penjualanId).single()
  if (!pj) return { error: 'Penjualan tidak ditemukan' }
  if (pj.voided_at) return { error: 'Sudah divoid sebelumnya' }

  const now = new Date().toISOString()
  await supabase.from('penjualan').update({ voided_at: now, void_reason: reason, status: 'void' }).eq('id', penjualanId)

  // Restore shieldtag back to Aktif @ Gudang Pusat
  if (pj.shieldtag_kodes?.length) {
    await supabase.from('shieldtag')
      .update({ status: 'Aktif', lokasi: 'Gudang Pusat' })
      .in('kode', pj.shieldtag_kodes)
  }

  revalidatePath('/penjualan')
  revalidatePath('/dashboard')

  createNotif({
    judul: `Penjualan Divoid`,
    pesan: `ID ${penjualanId} · alasan: ${reason}`,
    tipe: 'warning',
    link: '/penjualan',
    untuk_role: ['owner', 'manager'],
  })

  return { success: true }
}

// Edit metadata penjualan (channel, customer, catatan) — items tidak bisa diubah
export async function editPenjualan(penjualanId: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }
  // ROLE_CHECK_DISABLED: 
  const { data: pj } = await supabase.from('penjualan').select('voided_at').eq('id', penjualanId).single()
  if (!pj) return { error: 'Penjualan tidak ditemukan' }
  if (pj.voided_at) return { error: 'Penjualan yang sudah void tidak bisa diedit' }

  const { error } = await supabase.from('penjualan').update({
    tanggal:          formData.get('tanggal') as string,
    channel:          formData.get('channel') as string,
    nama_customer:    (formData.get('nama_customer') as string) || null,
    hp_customer:      (formData.get('hp_customer') as string) || null,
    ktp_customer:     (formData.get('ktp_customer') as string) || null,
    alamat_customer:  (formData.get('alamat_customer') as string) || null,
    marketplace_akun: (formData.get('marketplace_akun') as string) || null,
    no_invoice_mktpl: (formData.get('no_invoice_mktpl') as string) || null,
    cabang_kode:      (formData.get('cabang_kode') as string) || null,
    cabang_nama:      (formData.get('cabang_nama') as string) || null,
    catatan:          (formData.get('catatan') as string) || null,
  }).eq('id', penjualanId)

  if (error) return { error: error.message }
  revalidatePath('/penjualan')
  return { success: true }
}
