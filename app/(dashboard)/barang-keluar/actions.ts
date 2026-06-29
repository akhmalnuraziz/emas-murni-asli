'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

const GUDANG_LOKASI = 'Gudang Pusat'
const TUJUAN_OPTIONS = ['Shopee', 'TikTok', 'Aplikasi Raja Emas', 'Lain-lain']

async function generateBKKode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'barang_keluar' })
  return `BK.GDCJ/${String(data ?? 1).padStart(4, '0')}`
}

export async function getBarangKeluarList(limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('barang_keluar')
    .select('*, items:barang_keluar_item(*)')
    .is('voided_at', null)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data ?? [] }
}

export async function getShieldtagAktifGudang() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, batch_kode')
    .eq('status', 'Aktif')
    .eq('lokasi', GUDANG_LOKASI)
    .is('voided_at', null)
    .order('gramasi')
  return { data: data ?? [] }
}

export async function createBarangKeluar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const tanggal    = formData.get('tanggal') as string
  const tujuan     = formData.get('tujuan') as string
  const adminInput = (formData.get('admin_input') as string) || profile?.name || ''
  const catatan    = (formData.get('catatan') as string) || null
  const kodes      = JSON.parse(formData.get('shieldtag_kodes') as string ?? '[]') as string[]

  if (!tanggal)        return { error: 'Tanggal wajib diisi' }
  if (!tujuan)         return { error: 'Tujuan wajib diisi' }
  if (!kodes.length)   return { error: 'Minimal satu Shieldtag wajib dipilih' }

  // Validasi: semua shieldtag harus Aktif di Gudang Pusat
  const { data: tags } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, status, lokasi, voided_at')
    .in('kode', kodes)

  const invalid = (tags ?? []).filter(
    (t: any) => t.voided_at || t.status !== 'Aktif' || t.lokasi !== GUDANG_LOKASI
  )
  if (invalid.length > 0) {
    return { error: `${invalid.length} shieldtag tidak valid (harus berstatus Aktif & berada di Gudang Pusat): ${invalid.map((t: any) => t.kode).join(', ')}` }
  }

  const kode = await generateBKKode(supabase)

  const { data: bk, error } = await supabase.from('barang_keluar').insert({
    kode, tanggal, tujuan,
    admin_input: adminInput,
    catatan,
    created_by: user.id,
  }).select('id').single()

  if (error) return { error: error.message }

  // Insert items
  const itemRows = (tags ?? []).map((t: any) => ({
    barang_keluar_id: bk.id,
    shieldtag_kode: t.kode,
    gramasi: t.gramasi,
  }))
  await supabase.from('barang_keluar_item').insert(itemRows)

  // Update shieldtag: status Terjual, lokasi = tujuan
  await supabase.from('shieldtag')
    .update({ status: 'Terjual', lokasi: tujuan })
    .in('kode', kodes)

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_BARANG_KELUAR', module: 'BARANG_KELUAR',
    record_key: kode, record_id: String(bk.id),
    after_data: { tanggal, tujuan, qty: kodes.length, shieldtags: kodes },
  })

  createNotif({
    judul: `Barang Keluar: ${kode}`,
    pesan: `${kodes.length} pcs → ${tujuan} · oleh ${profile?.name ?? adminInput}`,
    tipe: 'info',
    link: '/barang-keluar',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/barang-keluar')
  revalidatePath('/inventory')

  return { success: true, kode }
}

export async function voidBarangKeluar(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }

  const { data: bk } = await supabase
    .from('barang_keluar')
    .select('kode, items:barang_keluar_item(shieldtag_kode)')
    .eq('id', id).single()
  if (!bk) return { error: 'Data tidak ditemukan' }

  const kodes = (bk.items ?? []).map((it: any) => it.shieldtag_kode)

  // Void barang keluar
  await supabase.from('barang_keluar').update({
    voided_at: new Date().toISOString(),
    void_reason: 'VOIDED_BY_USER',
  }).eq('id', id)

  // Kembalikan shieldtag ke Aktif di Gudang Pusat
  if (kodes.length > 0) {
    await supabase.from('shieldtag')
      .update({ status: 'Aktif', lokasi: GUDANG_LOKASI })
      .in('kode', kodes)
  }

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_BARANG_KELUAR', module: 'BARANG_KELUAR',
    record_key: bk.kode, record_id: String(id),
  })

  revalidatePath('/barang-keluar')
  revalidatePath('/inventory')

  return { success: true }
}
