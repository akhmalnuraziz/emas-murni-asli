'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED = ['owner','admin_pusat','spv','kepala_cabang']

async function generateNomor(supabase: any): Promise<string> {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const { count } = await supabase.from('mutasi')
    .select('*',{count:'exact',head:true})
    .like('nomor',`MUT/${today}/%`)
  const seq = String((count ?? 0) + 1).padStart(4,'0')
  return `MUT/${today}/${seq}`
}

// ── BUAT MUTASI — atomic via RPC ──────────────────────────────────────────────
export async function createMutasi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile')
    .select('name,role,cabang_kode,toko').eq('id', user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const dari_lokasi = (formData.get('dari_lokasi') as string)?.trim()
  const ke_lokasi   = (formData.get('ke_lokasi')   as string)?.trim()
  const dari_kode   = (formData.get('dari_kode')   as string)?.trim() || null
  const ke_kode     = (formData.get('ke_kode')     as string)?.trim() || null
  const keterangan  = (formData.get('keterangan')  as string)?.trim() || null
  const stKodes     = JSON.parse(formData.get('st_kodes') as string ?? '[]') as string[]

  if (!dari_lokasi) return { error: 'Lokasi asal wajib diisi' }
  if (!ke_lokasi)   return { error: 'Lokasi tujuan wajib diisi' }
  if (!stKodes.length) return { error: 'Pilih minimal 1 Shieldtag' }
  if (dari_lokasi === ke_lokasi) return { error: 'Lokasi asal dan tujuan tidak boleh sama' }

  // Kepala cabang hanya bisa mutasi dari cabangnya sendiri
  const userCabangNama = profile?.toko ? 
    (await supabase.from('cabang').select('nama').eq('kode', profile.toko).single()).data?.nama : null
  if (profile?.role === 'kepala_cabang' && userCabangNama && dari_lokasi !== userCabangNama) {
    return { error: `Kepala cabang hanya bisa mutasi dari ${userCabangNama}` }
  }

  const nomor = await generateNomor(supabase)
  const kode  = `MUT-${Date.now()}`

  // Atomic via RPC
  const { data: result, error } = await supabase.rpc('create_mutasi_atomic', {
    p_nomor: nomor, p_kode: kode,
    p_tanggal: new Date().toISOString().split('T')[0],
    p_dari_lokasi: dari_lokasi, p_ke_lokasi: ke_lokasi,
    p_dari_kode: dari_kode ?? '', p_ke_kode: ke_kode ?? '',
    p_keterangan: keterangan ?? '',
    p_st_kodes: stKodes,
    p_pengirim_name: profile?.name ?? '',
    p_pengirim_by: user.id,
    p_created_by: user.id,
  })
  if (error) return { error: error.message }
  if (result?.error) return { error: result.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_MUTASI', module: 'MUTASI',
    record_id: String(result.mutasi_id), record_key: nomor,
    after_data: { nomor, dari_lokasi, ke_lokasi, pcs: stKodes.length },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true, nomor, mutasiId: result.mutasi_id }
}

// ── ACC MUTASI — atomic via RPC ────────────────────────────────────────────────
export async function accMutasi(mutasiId: number, catatan?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile')
    .select('name,role,toko').eq('id', user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  // Kepala cabang hanya bisa ACC mutasi ke cabangnya
  if (profile?.role === 'kepala_cabang' && profile.toko) {
    const { data: mutasi } = await supabase.from('mutasi').select('ke_kode,ke_lokasi').eq('id', mutasiId).single()
    const cabangNama = (await supabase.from('cabang').select('nama').eq('kode', profile.toko).single()).data?.nama
    if (mutasi?.ke_kode !== profile.toko && mutasi?.ke_lokasi !== cabangNama) {
      return { error: 'Anda hanya bisa ACC mutasi yang ditujukan ke cabang Anda' }
    }
  }

  const { data: settingGudang } = await supabase.from('pengaturan').select('value').eq('key','nama_gudang').single()
  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  const { data: result, error } = await supabase.rpc('acc_mutasi_atomic', {
    p_mutasi_id: mutasiId,
    p_acc_by: user.id, p_acc_name: profile?.name ?? '',
    p_acc_catatan: catatan ?? '',
    p_nama_gudang: namaGudang,
  })
  if (error) return { error: error.message }
  if (result?.error) return { error: result.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'ACC_MUTASI', module: 'MUTASI', record_id: String(mutasiId),
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true }
}

// ── TOLAK MUTASI — atomic via RPC ─────────────────────────────────────────────
export async function tolakMutasi(mutasiId: number, alasan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile')
    .select('name,role,toko').eq('id', user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  if (!alasan.trim()) return { error: 'Alasan penolakan wajib diisi' }

  const { data: settingGudang } = await supabase.from('pengaturan').select('value').eq('key','nama_gudang').single()
  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  const { data: result, error } = await supabase.rpc('tolak_mutasi_atomic', {
    p_mutasi_id: mutasiId,
    p_by: user.id, p_name: profile?.name ?? '',
    p_alasan: alasan,
    p_nama_gudang: namaGudang,
  })
  if (error) return { error: error.message }
  if (result?.error) return { error: result.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'TOLAK_MUTASI', module: 'MUTASI', record_id: String(mutasiId),
    after_data: { alasan },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  return { success: true }
}

// ── GET ST AVAILABLE ──────────────────────────────────────────────────────────
export async function getSTAvailable(lokasi: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('shieldtag')
    .select('kode, gramasi, status, lokasi, hpp, packing:packing_id(produksi_item:produksi_item_id(nama_item, gramasi, produk:produk_id(nama,gramasi)))')
    .in('status', ['Aktif','Terdistribusi'])
    .eq('lokasi', lokasi)
    .is('voided_at', null)
    .is('mutasi_id', null)
    .order('kode')
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
