'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'
import { generateScrapKode, scrapStatusFrom } from '@/lib/scrap-sync'

export async function createScrap(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv', 'admin_gudang'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { error: 'Tidak ada akses' }
  // ROLE_CHECK_DISABLED: 
  const berat = parseFloat(formData.get('berat_gram') as string)
  if (!berat || berat <= 0) return { error: 'Berat wajib diisi' }

  const tanggal = formData.get('tanggal') as string
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const kode = await generateScrapKode(supabase)

  const { error } = await supabase.from('scrap_inventory').insert({
    kode,
    sumber_proses: 'manual',
    berat_gram: berat,
    berat_sisa: berat,
    berat_terpakai: 0,
    status: 'tersedia',
    tanggal,
    catatan: (formData.get('catatan') as string) || null,
    admin_input: (formData.get('admin_input') as string) || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  createNotif({
    judul: `Scrap Baru: ${kode}`,
    pesan: `${berat}gr · manual`,
    tipe: 'info',
    link: '/scrap',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/scrap')
  return { success: true, kode }
}

export async function editScrap(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv', 'admin_gudang'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { error: 'Tidak ada akses' }
  // ROLE_CHECK_DISABLED: 
  const berat = parseFloat(formData.get('berat_gram') as string)
  if (!berat || berat <= 0) return { error: 'Berat wajib diisi' }

  const { data: existing } = await supabase.from('scrap_inventory')
    .select('berat_gram, berat_terpakai, status, sumber_ref').eq('id', id).single()
  if (!existing) return { error: 'Data tidak ditemukan' }
  if (existing.sumber_ref) return { error: 'Scrap otomatis (serbuk/buyback) — edit dari sumber asalnya' }
  if (!['tersedia', 'sebagian'].includes(existing.status)) return { error: 'Scrap yang sudah habis terpakai tidak dapat diedit' }

  const beratTerpakai = Number(existing.berat_terpakai ?? 0)
  if (berat < beratTerpakai - 0.001)
    return { error: `Berat tidak boleh di bawah yang sudah terpakai (${beratTerpakai.toFixed(3)}gr)` }

  const { error } = await supabase.from('scrap_inventory').update({
    berat_gram: berat,
    berat_sisa: Math.max(0, berat - beratTerpakai),
    status: scrapStatusFrom(berat, beratTerpakai),
    tanggal: formData.get('tanggal') as string,
    catatan: (formData.get('catatan') as string) || null,
    admin_input: (formData.get('admin_input') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/scrap')
  return { success: true }
}

export async function voidScrap(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { error: 'Hanya Owner/Manager yang bisa void' }
  // ROLE_CHECK_DISABLED: 
  const { data: row } = await supabase.from('scrap_inventory').select('berat_terpakai').eq('id', id).single()
  if (Number(row?.berat_terpakai ?? 0) > 0.0001)
    return { error: 'Scrap sudah terpakai di peleburan — batalkan peleburannya terlebih dahulu' }

  const { error } = await supabase.from('scrap_inventory').update({
    voided_at: new Date().toISOString(),
    void_reason: reason,
  }).eq('id', id)
  if (error) return { error: error.message }

  createNotif({
    judul: `Scrap #${id} Di-VOID`,
    pesan: `Alasan: ${reason}`,
    tipe: 'warning',
    link: '/scrap',
    untuk_role: ['owner', 'manager'],
  })

  revalidatePath('/scrap')
  return { success: true }
}
