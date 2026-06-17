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
  const { error } = await supabase.from('tim_produksi').update({
    nama: formData.get('nama') as string,
    warna: formData.get('warna') as string,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function toggleTimAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('tim_produksi').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteTim(id: number) {
  const supabase = await createClient()
  // Cek apakah sudah dipakai
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
  const { error } = await supabase.from('tim_anggota').insert({ tim_id: timId, nama, aktif: true })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteAnggota(id: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('tim_anggota').update({ aktif: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

// ═══ MASTER ADMIN INPUT ════════════════════════════════════════════════════

export async function createAdminInput(nama: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('admin_input').insert({ nama, aktif: true })
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function updateAdminInput(id: number, nama: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('admin_input').update({ nama }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function toggleAdminInputAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('admin_input').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
}

export async function deleteAdminInput(id: number) {
  const supabase = await createClient()
  // Soft delete
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
