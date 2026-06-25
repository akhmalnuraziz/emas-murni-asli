'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

export async function createScrap(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv', 'admin_gudang'].includes(profile?.role ?? ''))
    return { error: 'Tidak ada akses' }

  const berat = parseFloat(formData.get('berat_gram') as string)
  if (!berat || berat <= 0) return { error: 'Berat wajib diisi' }

  const tanggal = formData.get('tanggal') as string
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const { data: counterData } = await supabase.rpc('increment_counter', { counter_name: 'scrap' })
  const kode = `SCR${String(counterData ?? 1).padStart(4, '0')}`

  const { error } = await supabase.from('scrap_inventory').insert({
    kode,
    batch_kode: (formData.get('batch_kode') as string) || null,
    sumber_proses: (formData.get('sumber_proses') as string) || 'manual',
    berat_gram: berat,
    berat_sisa: berat,
    status: 'tersedia',
    tanggal,
    catatan: (formData.get('catatan') as string) || null,
    tim_nama: (formData.get('tim_nama') as string) || null,
    admin_input: (formData.get('admin_input') as string) || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  await createNotif({
    judul: `Scrap Baru: ${kode}`,
    pesan: `${berat}gr · ${(formData.get('sumber_proses') as string) || 'manual'}`,
    tipe: 'info',
    link: '/scrap',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/scrap')
  return { success: true, kode }
}

export async function updateScrapStatus(id: number, status: string, beratTerpakai?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const updates: any = { status }
  if (beratTerpakai !== undefined) {
    const { data: scrap } = await supabase.from('scrap_inventory').select('berat_gram').eq('id', id).single()
    if (scrap) {
      updates.berat_terpakai = beratTerpakai
      updates.berat_sisa = Math.max(0, scrap.berat_gram - beratTerpakai)
    }
  }

  const { error } = await supabase.from('scrap_inventory').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/scrap')
  return { success: true }
}

export async function voidScrap(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager'].includes(profile?.role ?? ''))
    return { error: 'Hanya Owner/Manager yang bisa void' }

  const { error } = await supabase.from('scrap_inventory').update({
    voided_at: new Date().toISOString(),
    void_reason: reason,
  }).eq('id', id)
  if (error) return { error: error.message }

  await createNotif({
    judul: `Scrap #${id} Di-VOID`,
    pesan: `Alasan: ${reason}`,
    tipe: 'warning',
    link: '/scrap',
    untuk_role: ['owner', 'manager'],
  })

  revalidatePath('/scrap')
  return { success: true }
}
