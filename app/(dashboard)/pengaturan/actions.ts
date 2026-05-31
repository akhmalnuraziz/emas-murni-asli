'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── PENGATURAN UMUM ──────────────────────────────────────────────────────────
export async function updatePengaturan(key: string, value: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Hanya owner/admin yang bisa mengubah pengaturan' }

  const { error } = await supabase.from('pengaturan')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ─── SERIES ───────────────────────────────────────────────────────────────────
export async function createSeries(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki izin' }

  const nama = (formData.get('nama') as string)?.trim()
  const keterangan = (formData.get('keterangan') as string)?.trim() || null
  if (!nama) return { error: 'Nama series wajib diisi' }

  const { error } = await supabase.from('series').insert({ nama, keterangan, created_by: user.id })
  if (error) return { error: error.message.includes('unique') ? 'Nama series sudah ada' : error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updateSeries(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  const keterangan = (formData.get('keterangan') as string)?.trim() || null
  const aktif = formData.get('aktif') === '1'
  if (!nama) return { error: 'Nama series wajib diisi' }

  const { error } = await supabase.from('series').update({ nama, keterangan, aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/produksi')
  return { success: true }
}

export async function deleteSeries(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { count } = await supabase.from('produk').select('*', { count: 'exact', head: true }).eq('series_id', id)
  if ((count ?? 0) > 0) return { error: `Tidak bisa hapus: ${count} produk masih pakai series ini` }

  const { error } = await supabase.from('series').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

// ─── PRODUK ───────────────────────────────────────────────────────────────────
export async function createProduk(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki izin' }

  const nama      = (formData.get('nama') as string)?.trim()
  const gramasi   = (formData.get('gramasi') as string)?.trim()
  const series_id = parseInt(formData.get('series_id') as string)

  if (!nama)    return { error: 'Nama produk wajib diisi' }
  if (!gramasi) return { error: 'Gramasi wajib diisi' }
  if (!series_id) return { error: 'Series wajib dipilih' }

  const kode = `PROD-${nama.replace(/\s+/g,'-').toUpperCase()}-${Date.now().toString().slice(-6)}`
  const { error } = await supabase.from('produk').insert({ kode, nama, gramasi, series_id, created_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/produksi')
  return { success: true }
}

export async function updateProduk(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama      = (formData.get('nama') as string)?.trim()
  const gramasi   = (formData.get('gramasi') as string)?.trim()
  const series_id = parseInt(formData.get('series_id') as string)
  const aktif     = formData.get('aktif') === '1'

  if (!nama || !gramasi || !series_id) return { error: 'Semua field wajib diisi' }

  const { error } = await supabase.from('produk').update({ nama, gramasi, series_id, aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/produksi')
  return { success: true }
}

export async function deleteProduk(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('produk').update({ aktif: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  revalidatePath('/produksi')
  return { success: true }
}

// ─── CABANG ───────────────────────────────────────────────────────────────────
export async function createCabang(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki izin' }

  const kode    = (formData.get('kode') as string)?.trim().toUpperCase()
  const nama    = (formData.get('nama') as string)?.trim()
  const alamat  = (formData.get('alamat') as string)?.trim() || null
  const kepala  = (formData.get('kepala') as string)?.trim() || null
  const telp    = (formData.get('telp') as string)?.trim() || null

  if (!kode) return { error: 'Kode cabang wajib diisi' }
  if (!nama) return { error: 'Nama cabang wajib diisi' }

  const { error } = await supabase.from('cabang').insert({ kode, nama, alamat, kepala, telp, created_by: user.id })
  if (error) return { error: error.message.includes('unique') ? 'Kode cabang sudah dipakai' : error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updateCabang(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const kode   = (formData.get('kode') as string)?.trim().toUpperCase()
  const nama   = (formData.get('nama') as string)?.trim()
  const alamat = (formData.get('alamat') as string)?.trim() || null
  const kepala = (formData.get('kepala') as string)?.trim() || null
  const telp   = (formData.get('telp') as string)?.trim() || null
  const aktif  = formData.get('aktif') === '1'

  if (!kode || !nama) return { error: 'Kode dan nama wajib diisi' }

  const { error } = await supabase.from('cabang').update({ kode, nama, alamat, kepala, telp, aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function deleteCabang(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('cabang')
    .update({ aktif: false, voided_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return { success: true }
}
