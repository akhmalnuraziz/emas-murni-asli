'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED = ['owner','admin_pusat','spv','operator_produksi','kepala_cabang']

async function generateNomor(supabase: any): Promise<string> {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const { count } = await supabase.from('penjualan')
    .select('*',{count:'exact',head:true}).like('nomor_invoice',`INV/${today}/%`)
  return `INV/${today}/${String((count ?? 0) + 1).padStart(4,'0')}`
}

// ── GET ST BY KODE ─────────────────────────────────────────────────────────────
export async function getShieldtagByKode(kode: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('shieldtag')
    .select(`kode, gramasi, hpp, status, lokasi, voided_at,
      packing:packing_id(
        produksi_item:produksi_item_id(
          nama_item, gramasi,
          produk:produk_id(nama, gramasi, series:series_id(nama))
        )
      )`)
    .eq('kode', kode.trim().toUpperCase())
    .single()
  if (error || !data) return { error: 'Shieldtag tidak ditemukan' }
  if (data.voided_at) return { error: 'Shieldtag sudah di-void' }
  if (!['Aktif','Terdistribusi'].includes(data.status as string))
    return { error: `Shieldtag tidak tersedia (status: ${data.status})` }
  const pi = (data.packing as any)?.produksi_item
  const pd = pi?.produk
  return {
    data: {
      kode: data.kode,
      gramasi: data.gramasi,
      hpp: data.hpp,
      status: data.status,
      lokasi: data.lokasi,
      produk_nama: pd?.nama ?? pi?.nama_item ?? `LM REI ${data.gramasi}GR`,
      series: pd?.series?.nama ?? 'Reguler',
    }
  }
}

// ── CARI / BUAT CUSTOMER ───────────────────────────────────────────────────────
export async function searchCustomer(query: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('customer')
    .select('id, nama, no_hp, ktp, alamat, email')
    .is('voided_at', null)
    .or(`nama.ilike.%${query}%,no_hp.ilike.%${query}%`)
    .limit(10)
  return data ?? []
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama   = (formData.get('nama') as string)?.trim()
  const no_hp  = (formData.get('no_hp') as string)?.trim() || null
  const ktp    = (formData.get('ktp') as string)?.trim() || null
  const alamat = (formData.get('alamat') as string)?.trim() || null
  const email  = (formData.get('email') as string)?.trim() || null

  if (!nama) return { error: 'Nama customer wajib diisi' }

  const kode = `CUST-${Date.now().toString().slice(-8)}`
  const { data, error } = await supabase.from('customer')
    .insert({ kode, nama, no_hp, ktp, alamat, email, created_by: user.id })
    .select('id, nama, no_hp, ktp, alamat, email').single()
  if (error) return { error: error.message }
  return { data }
}

// ── CREATE PENJUALAN ───────────────────────────────────────────────────────────
export async function createPenjualan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role').eq('id',user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const customer_id  = parseInt(formData.get('customer_id') as string)
  const channel      = formData.get('channel') as string
  const mktpl_fee    = parseFloat(formData.get('marketplace_fee') as string ?? '0') || 0
  const catatan      = (formData.get('catatan') as string)?.trim() || null
  const items        = JSON.parse(formData.get('items') as string ?? '[]')
  const payments     = JSON.parse(formData.get('payments') as string ?? '[]')

  if (!customer_id) return { error: 'Pilih customer dulu' }
  if (!channel) return { error: 'Pilih channel penjualan' }
  if (!items.length) return { error: 'Tambahkan minimal 1 item' }

  // Validasi total payment = total harga
  const totalHJ = items.reduce((s: number, i: any) => s + (parseFloat(i.harga_jual) || 0), 0)
  const totalPaid = payments.reduce((s: number, p: any) => s + (parseFloat(p.jumlah) || 0), 0)
  if (Math.abs(totalPaid - totalHJ) > 1) {
    return { error: `Total pembayaran (${totalPaid.toLocaleString('id-ID')}) tidak sama dengan total harga (${totalHJ.toLocaleString('id-ID')})` }
  }

  const nomor = await generateNomor(supabase)
  const tanggal = new Date().toISOString().split('T')[0]

  const { data: result, error } = await supabase.rpc('create_penjualan_atomic', {
    p_nomor: nomor, p_tanggal: tanggal, p_customer_id: customer_id,
    p_channel: channel, p_mktpl_fee: mktpl_fee, p_catatan: catatan ?? '',
    p_items: items, p_payments: payments, p_created_by: user.id,
  })
  if (error) return { error: error.message }
  if (result?.error) return { error: result.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PENJUALAN', module: 'PENJUALAN',
    record_id: String(result.penjualan_id), record_key: nomor,
    after_data: { nomor, channel, pcs: items.length, total: totalHJ },
  })

  revalidatePath('/penjualan')
  revalidatePath('/inventory')
  return { success: true, nomor, penjualanId: result.penjualan_id }
}

// ── GET DETAIL UNTUK INVOICE ──────────────────────────────────────────────────
export async function getPenjualanDetail(id: number) {
  const supabase = await createClient()
  const [{ data: penjualan }, { data: items }, { data: payments }, ] = await Promise.all([
    supabase.from('penjualan').select('*, customer:customer_id(*)').eq('id',id).single(),
    supabase.from('penjualan_item').select('*').eq('penjualan_id',id),
    supabase.from('penjualan_payment').select('*').eq('penjualan_id',id),
  ])
  return { penjualan, items: items ?? [], payments: payments ?? [] }
}

// ── LIST PENJUALAN ─────────────────────────────────────────────────────────────
export async function getPenjualanList(limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase.from('penjualan')
    .select('id, nomor_invoice, no_faktur, tanggal, channel, source, nama_customer, hp_customer, pcs, total_harga_jual, harga_jual, total_profit, profit, status, voided_at, customer:customer_id(nama, no_hp)')
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}


// ── VOID PENJUALAN ─────────────────────────────────────────────────────────────
export async function voidPenjualan(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role').eq('id',user.id).single()
  if (!['owner','admin_pusat','spv'].includes(profile?.role ?? '')) return { error: 'Hanya owner/admin yang bisa void invoice' }
  if (!reason.trim()) return { error: 'Alasan void wajib diisi' }

  const { data: result, error } = await supabase.rpc('void_penjualan_atomic', {
    p_id: id, p_reason: reason, p_by: user.id
  })
  if (error) return { error: error.message }
  if (result?.error) return { error: result.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_PENJUALAN', module: 'PENJUALAN', record_id: String(id),
    after_data: { reason },
  })
  revalidatePath('/penjualan')
  revalidatePath('/inventory')
  return { success: true }
}

// ── UPDATE PENJUALAN ───────────────────────────────────────────────────────────
export async function updatePenjualan(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role').eq('id',user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const customer_id = parseInt(formData.get('customer_id') as string)
  const channel     = formData.get('channel') as string
  const mktpl_fee   = parseFloat(formData.get('marketplace_fee') as string ?? '0') || 0
  const catatan     = (formData.get('catatan') as string)?.trim() || null
  const items       = JSON.parse(formData.get('items') as string ?? '[]')
  const payments    = JSON.parse(formData.get('payments') as string ?? '[]')

  if (!customer_id) return { error: 'Pilih customer' }
  if (!items.length) return { error: 'Minimal 1 item' }

  const totalHJ  = items.reduce((s: number, i: any) => s + (parseFloat(i.harga_jual) || 0), 0)
  const totalHPP = items.reduce((s: number, i: any) => s + (parseFloat(i.hpp) || 0), 0)

  // Update penjualan header
  await supabase.from('penjualan').update({
    customer_id, channel, source: channel,
    fee_marketplace: mktpl_fee,
    catatan,
    harga_jual: totalHJ, total_harga_jual: totalHJ,
    hpp_total: totalHPP,
    profit: totalHJ - totalHPP - (totalHJ * mktpl_fee / 100),
    total_profit: totalHJ - totalHPP - (totalHJ * mktpl_fee / 100),
  }).eq('id', id)

  // Replace items: delete old, insert new
  const { data: oldItems } = await supabase.from('penjualan_item').select('shieldtag_kode').eq('penjualan_id', id)
  await supabase.from('penjualan_item').delete().eq('penjualan_id', id)

  // Restore ST lama → Aktif dulu
  const oldKodes = (oldItems ?? []).map((i: any) => i.shieldtag_kode)
  if (oldKodes.length) {
    await supabase.from('shieldtag').update({ status: 'Aktif', tgl_jual: null, harga_jual: null }).in('kode', oldKodes)
  }

  // Insert items baru
  for (const item of items) {
    await supabase.from('penjualan_item').insert({
      penjualan_id: id, shieldtag_kode: item.shieldtag_kode || item.kode,
      produk_nama: item.produk_nama, gramasi: item.gramasi,
      hpp: parseFloat(item.hpp), harga_jual: parseFloat(item.harga_jual),
    })
  }

  // Update ST baru → Terjual
  const today = new Date().toISOString().split('T')[0]
  for (const item of items) {
    await supabase.from('shieldtag').update({
      status: 'Terjual', tgl_jual: today, harga_jual: parseFloat(item.harga_jual)
    }).eq('kode', item.shieldtag_kode || item.kode)
  }

  // Replace payments
  await supabase.from('penjualan_payment').delete().eq('penjualan_id', id)
  for (const p of payments) {
    if (parseFloat(p.jumlah) > 0) {
      await supabase.from('penjualan_payment').insert({ penjualan_id: id, metode: p.metode, jumlah: parseFloat(p.jumlah) })
    }
  }

  revalidatePath('/penjualan')
  return { success: true }
}
