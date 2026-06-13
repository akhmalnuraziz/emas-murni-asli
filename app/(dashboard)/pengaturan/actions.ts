'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── TIM PRODUKSI ───────────────────────────────────────────────────────────
export async function createTim(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  const warna = (formData.get('warna') as string) || '#8B5CF6'
  if (!nama) return { error: 'Nama tim wajib diisi' }

  const { data, error } = await supabase.from('tim_produksi')
    .insert({ nama, warna, created_by: user.id }).select().single()
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true, id: data.id }
}

export async function updateTim(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  const warna = (formData.get('warna') as string) || '#8B5CF6'
  if (!nama) return { error: 'Nama tim wajib diisi' }

  const { error } = await supabase.from('tim_produksi')
    .update({ nama, warna }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true }
}

export async function toggleTimAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('tim_produksi').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true }
}

export async function deleteTim(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Cek apakah tim sudah dipakai di transaksi
  const [{ count: pakaiPeleburan }, { count: pakaiProduksi }] = await Promise.all([
    supabase.from('peleburan').select('*', { count: 'exact', head: true }).eq('tim_id', id),
    supabase.from('produksi_item').select('*', { count: 'exact', head: true }).eq('tim_id', id),
  ])
  if ((pakaiPeleburan ?? 0) > 0 || (pakaiProduksi ?? 0) > 0) {
    // Soft disable, jangan hard delete kalau sudah dipakai (jaga histori)
    await supabase.from('tim_produksi').update({ aktif: false, voided_at: new Date().toISOString() }).eq('id', id)
    revalidatePath('/pengaturan')
    return { success: true, softDeleted: true }
  }

  const { error } = await supabase.from('tim_produksi').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true }
}

// ─── ANGGOTA TIM ────────────────────────────────────────────────────────────
export async function addAnggota(timId: number, nama: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!nama?.trim()) return { error: 'Nama anggota wajib diisi' }

  const { error } = await supabase.from('tim_anggota').insert({ tim_id: timId, nama: nama.trim() })
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true }
}

export async function deleteAnggota(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('tim_anggota').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return { success: true }
}

// ─── TOLERANSI LOSS ─────────────────────────────────────────────────────────
export async function updateToleransi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const keys = ['toleransi_loss_peleburan', 'toleransi_loss_cutting', 'toleransi_loss_pas_berat', 'toleransi_loss_annealing']
  for (const key of keys) {
    const raw = formData.get(key) as string
    if (raw === null || raw === '') continue
    const val = String(parseFloat(raw.replace(',', '.')) || 0)
    await supabase.from('pengaturan').update({ value: val, updated_by: user.id }).eq('key', key)
  }

  revalidatePath('/pengaturan')
  return { success: true }
}
