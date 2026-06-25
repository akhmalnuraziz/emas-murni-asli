'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ═══ MASTER TIM PRODUKSI ════════════════════════════════════════════════════

export async function createTim(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('tim_produksi').insert({
    nama: formData.get('nama') as string,
    warna: formData.get('warna') as string,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function updateTim(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('tim_produksi').update({
    nama: formData.get('nama') as string,
    warna: formData.get('warna') as string,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function toggleTimAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('tim_produksi').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteTim(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { count } = await supabase.from('produksi_item')
    .select('id', { count: 'exact', head: true }).eq('tim_id', id)
  if ((count ?? 0) > 0) {
    await supabase.from('tim_produksi').update({ aktif: false, voided_at: new Date().toISOString() }).eq('id', id)
    revalidatePath('/pengaturan')
    return { softDeleted: true }
  }
  const { error } = await supabase.from('tim_produksi').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function addAnggota(timId: number, nama: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('tim_anggota').insert({ tim_id: timId, nama, aktif: true })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteAnggota(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('tim_anggota').update({ aktif: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

// ═══ MASTER ADMIN INPUT ════════════════════════════════════════════════════

export async function createAdminInput(nama: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('admin_input').insert({ nama, aktif: true })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function updateAdminInput(id: number, nama: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('admin_input').update({ nama }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function toggleAdminInputAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('admin_input').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteAdminInput(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('admin_input').update({ voided_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

// ═══ TOLERANSI LOSS ════════════════════════════════════════════════════════

export async function updateToleransi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const keys = [
    'toleransi_loss_peleburan',
    'toleransi_loss_cutting',
    'toleransi_loss_pas_berat',
    'toleransi_loss_annealing',
    'toleransi_loss_siap_packing',
    'ambang_gain_wajar',
    'ambang_loss_kumulatif',
  ]
  for (const key of keys) {
    const val = formData.get(key) as string
    if (val !== null && val !== '') {
      await supabase.from('pengaturan').upsert({ key, value: val, updated_by: user.id }, { onConflict: 'key' })
    }
  }
  revalidatePath('/pengaturan')
}

export async function updateBiayaPackaging(gramasiList: string[], values: Record<string, string>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }

  for (const g of gramasiList) {
    const key = `biaya_packaging_${g}`
    const val = values[g]
    if (val !== undefined && val !== '') {
      await supabase.from('pengaturan').upsert({ key, value: val, updated_by: user.id }, { onConflict: 'key' })
    }
  }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ═══ MASTER CABANG ══════════════════════════════════════════════════════════

export async function createCabang(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama cabang wajib diisi' }
  const { count } = await supabase.from('cabang').select('*', { count: 'exact', head: true })
  const kode = `CAB${String((count ?? 0) + 1).padStart(3, '0')}`

  const { error } = await supabase.from('cabang').insert({
    kode, nama,
    alamat: (formData.get('alamat') as string) || null,
    kepala: (formData.get('kepala') as string) || null,
    telp: (formData.get('telp') as string) || null,
    aktif: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true, kode }
}

export async function updateCabang(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('cabang').update({
    nama: (formData.get('nama') as string)?.trim(),
    alamat: (formData.get('alamat') as string) || null,
    kepala: (formData.get('kepala') as string) || null,
    telp: (formData.get('telp') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function toggleCabangAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('cabang').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ═══ USER MANAGEMENT ════════════════════════════════════════════════════════

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }
  if (userId === user.id) return { error: 'Tidak bisa ubah role diri sendiri' }

  const { error } = await supabase.from('users_profile').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function toggleUserAktif(userId: string, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }
  if (userId === user.id) return { error: 'Tidak bisa nonaktifkan diri sendiri' }

  const { error } = await supabase.from('users_profile').update({
    aktif,
    voided_at: aktif ? null : new Date().toISOString(),
  }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function inviteUser(formData: FormData) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const regularClient = await (await import('@/lib/supabase/server')).createClient()
  const { data: { user } } = await regularClient.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await regularClient.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const name  = (formData.get('name') as string)?.trim()
  const role  = formData.get('role') as string
  if (!email || !name || !role) return { error: 'Email, nama, dan role wajib diisi' }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })
  if (error) return { error: error.message }

  // Upsert profile (will be created by trigger too, but ensure data is there)
  await regularClient.from('users_profile').upsert({
    id: data.user.id, email, name, role, aktif: true,
  }, { onConflict: 'id' })

  revalidatePath('/pengaturan')
  return { success: true }
}

export async function deleteUser(userId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()
  const regularClient = await (await import('@/lib/supabase/server')).createClient()
  const { data: { user } } = await regularClient.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await regularClient.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Hanya Owner/Manager' }
  if (userId === user.id) return { error: 'Tidak bisa hapus akun sendiri' }

  await regularClient.from('users_profile').delete().eq('id', userId)
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ═══ MASTER GRAMASI ═════════════════════════════════════════════════════════

export async function createGramasi(nilai: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak ada akses' }

  const v = nilai.trim()
  if (!v || isNaN(Number(v))) return { error: 'Nilai gramasi tidak valid' }

  const { count } = await supabase.from('gramasi_option').select('*', { count: 'exact', head: true })
  const { error } = await supabase.from('gramasi_option').insert({ nilai: v, urutan: (count ?? 0) + 1 })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updateGramasi(id: number, nilai: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const v = nilai.trim()
  if (!v || isNaN(Number(v))) return { error: 'Nilai tidak valid' }
  const { error } = await supabase.from('gramasi_option').update({ nilai: v }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function toggleGramasiAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('gramasi_option').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function deleteGramasi(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak ada akses' }
  const { error } = await supabase.from('gramasi_option').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ═══ MASTER PRODUK PACKAGING (dari /pengaturan) ═══════════════════════════════

export async function createProdukPengaturan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak ada akses' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama produk wajib diisi' }

  const { count } = await supabase.from('produk_packaging').select('*', { count: 'exact', head: true })
  const kode = `PKG${String((count ?? 0) + 1).padStart(3, '0')}`
  const { error } = await supabase.from('produk_packaging').insert({
    kode, nama,
    satuan: (formData.get('satuan') as string) || 'pcs',
    keterangan: (formData.get('keterangan') as string) || null,
    aktif: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function updateProdukPengaturan(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak ada akses' }
  const { error } = await supabase.from('produk_packaging').update({
    nama: (formData.get('nama') as string)?.trim(),
    satuan: (formData.get('satuan') as string) || 'pcs',
    keterangan: (formData.get('keterangan') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function toggleProdukPengaturanAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { error } = await supabase.from('produk_packaging').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function updateKpiTargetTim(timId: number, targetGram: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak memiliki akses' }
  await supabase.from('pengaturan').upsert(
    { key: `kpi_target_tim_${timId}`, value: String(targetGram), label: `KPI Target Serah Tim ${timId} (gr/bulan)`, updated_by: user.id },
    { onConflict: 'key' }
  )
  revalidatePath('/pengaturan')
  revalidatePath('/kpi-tim')
  return { success: true }
}

export async function updateSafetyStockGlobal(value: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak memiliki akses' }
  await supabase.from('pengaturan').upsert(
    { key: 'safety_stock_global', value: String(value), label: 'Safety Stock Default (pcs per gramasi)', updated_by: user.id },
    { onConflict: 'key' }
  )
  revalidatePath('/pengaturan')
  revalidatePath('/prioritas-produksi')
  return { success: true }
}

export async function updateTargetProduksi(targetPcs: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return { error: 'Tidak memiliki akses' }
  await supabase.from('pengaturan').upsert(
    { key: 'target_packing_harian', value: String(targetPcs), label: 'Target Packing Harian (pcs)', updated_by: user.id },
    { onConflict: 'key' }
  )
  revalidatePath('/pengaturan')
  revalidatePath('/dashboard')
  return { success: true }
}
