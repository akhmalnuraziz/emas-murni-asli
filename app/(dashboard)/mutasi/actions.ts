'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED_BUAT  = ['owner','admin_pusat','spv','kepala_cabang']
const ALLOWED_ACC   = ['owner','admin_pusat','spv','kepala_cabang']

// Generate nomor surat jalan: MUT/YYYYMMDD/XXXX
async function generateNomor(supabase: any): Promise<string> {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const { count } = await supabase.from('mutasi')
    .select('*', { count:'exact', head:true })
    .like('nomor', `MUT/${today}/%`)
  const seq = String((count ?? 0) + 1).padStart(4,'0')
  return `MUT/${today}/${seq}`
}

// ── BUAT MUTASI ───────────────────────────────────────────────────────────────
export async function createMutasi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role,cabang_kode').eq('id', user.id).single()
  if (!ALLOWED_BUAT.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const dari_lokasi = (formData.get('dari_lokasi') as string)?.trim()
  const ke_lokasi   = (formData.get('ke_lokasi') as string)?.trim()
  const dari_kode   = (formData.get('dari_kode') as string)?.trim() || null
  const ke_kode     = (formData.get('ke_kode') as string)?.trim() || null
  const keterangan  = (formData.get('keterangan') as string)?.trim() || null
  const stKodes     = JSON.parse(formData.get('st_kodes') as string ?? '[]') as string[]

  if (!dari_lokasi) return { error: 'Lokasi asal wajib diisi' }
  if (!ke_lokasi)   return { error: 'Lokasi tujuan wajib diisi' }
  if (!stKodes.length) return { error: 'Pilih minimal 1 Shieldtag' }
  if (dari_lokasi === ke_lokasi) return { error: 'Lokasi asal dan tujuan tidak boleh sama' }

  // Validasi: semua ST harus Aktif/Terdistribusi dan di lokasi asal
  const { data: stList } = await supabase.from('shieldtag')
    .select('id, kode, status, lokasi, voided_at, mutasi_id')
    .in('kode', stKodes)
  
  const invalid = (stList ?? []).filter(st =>
    st.voided_at ||
    !['Aktif','Terdistribusi'].includes(st.status) ||
    st.mutasi_id !== null
  )
  if (invalid.length > 0)
    return { error: `${invalid.length} Shieldtag tidak valid (sudah Transit/Terjual/VOID): ${invalid.map(s=>s.kode).join(', ')}` }

  const nomor = await generateNomor(supabase)

  // Insert mutasi
  const { data: mutasi, error: mutErr } = await supabase.from('mutasi').insert({
    nomor, tanggal: new Date().toISOString().slice(0,10),
    dari_lokasi, ke_lokasi, dari_kode, ke_kode,
    cabang_asal: dari_lokasi, cabang_tujuan: ke_lokasi,
    keterangan, status: 'transit',
    pcs: stKodes.length, pcs_dikirim: stKodes.length,
    pengirim_name: profile?.name, pengirim_by: user.id,
    shieldtag_kodes: stKodes,
    created_by: user.id,
  }).select().single()
  if (mutErr) return { error: mutErr.message }

  // Update semua ST: status Transit, mutasi_id
  const { error: stErr } = await supabase.from('shieldtag')
    .update({ status: 'Transit', mutasi_id: mutasi.id, lokasi: ke_lokasi })
    .in('kode', stKodes)
  if (stErr) return { error: stErr.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_MUTASI', module: 'MUTASI',
    record_id: String(mutasi.id), record_key: nomor,
    after_data: { nomor, dari_lokasi, ke_lokasi, pcs: stKodes.length },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true, nomor, mutasiId: mutasi.id }
}

// ── ACC MUTASI ────────────────────────────────────────────────────────────────
export async function accMutasi(mutasiId: number, catatan?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role,cabang_kode').eq('id', user.id).single()
  if (!ALLOWED_ACC.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: mutasi } = await supabase.from('mutasi').select('*').eq('id', mutasiId).single()
  if (!mutasi) return { error: 'Mutasi tidak ditemukan' }
  if (mutasi.status !== 'transit') return { error: 'Mutasi ini sudah tidak bisa di-ACC' }

  // Tentukan status ST baru
  const namaGudang = await supabase.from('pengaturan').select('value').eq('key','nama_gudang').single()
  const isKeGudang = mutasi.ke_lokasi === (namaGudang?.data?.value ?? 'Gudang CJ')
  const newStStatus = isKeGudang ? 'Aktif' : 'Terdistribusi'

  // Update mutasi
  await supabase.from('mutasi').update({
    status: 'selesai',
    acc_by: user.id, acc_name: profile?.name,
    acc_at: new Date().toISOString(),
    acc_catatan: catatan || null,
  }).eq('id', mutasiId)

  // Update ST: lokasi final, status final, clear mutasi_id
  const stKodes = mutasi.shieldtag_kodes as string[] ?? []
  await supabase.from('shieldtag')
    .update({ status: newStStatus, lokasi: mutasi.ke_lokasi, mutasi_id: null })
    .in('kode', stKodes)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'ACC_MUTASI', module: 'MUTASI', record_id: String(mutasiId),
    record_key: mutasi.nomor,
    after_data: { acc_name: profile?.name, ke_lokasi: mutasi.ke_lokasi, st_status: newStStatus },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true }
}

// ── TOLAK MUTASI ──────────────────────────────────────────────────────────────
export async function tolakMutasi(mutasiId: number, alasan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role').eq('id', user.id).single()
  if (!ALLOWED_ACC.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: mutasi } = await supabase.from('mutasi').select('*').eq('id', mutasiId).single()
  if (!mutasi) return { error: 'Mutasi tidak ditemukan' }
  if (mutasi.status !== 'transit') return { error: 'Mutasi sudah tidak bisa ditolak' }

  // Kembalikan ST ke status dan lokasi asal
  const stKodes = mutasi.shieldtag_kodes as string[] ?? []
  const namaGudang = await supabase.from('pengaturan').select('value').eq('key','nama_gudang').single()
  const isFromGudang = mutasi.dari_lokasi === (namaGudang?.data?.value ?? 'Gudang CJ')
  const originalStatus = isFromGudang ? 'Aktif' : 'Terdistribusi'

  await supabase.from('shieldtag')
    .update({ status: originalStatus, lokasi: mutasi.dari_lokasi, mutasi_id: null })
    .in('kode', stKodes)

  await supabase.from('mutasi').update({
    status: 'ditolak',
    acc_by: user.id, acc_name: profile?.name,
    acc_at: new Date().toISOString(),
    acc_catatan: alasan,
  }).eq('id', mutasiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'TOLAK_MUTASI', module: 'MUTASI', record_id: String(mutasiId),
    record_key: mutasi.nomor, after_data: { alasan },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true }
}

// ── GET ST AVAILABLE ──────────────────────────────────────────────────────────
export async function getSTAvailable(lokasi: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('shieldtag')
    .select('kode, gramasi, status, lokasi, hpp, packing:packing_id(produksi_item:produksi_item_id(nama_item, produk:produk_id(nama,gramasi)))')
    .in('status', ['Aktif','Terdistribusi'])
    .eq('lokasi', lokasi)
    .is('voided_at', null)
    .is('mutasi_id', null)
    .order('kode')
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
