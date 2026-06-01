'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED = ['owner','admin_pusat','spv','kepala_cabang']

// ── KATEGORI ──────────────────────────────────────────────────────────────────
export async function createKategori(nama: string, warna: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!nama.trim()) return { error: 'Nama kategori wajib diisi' }
  const { error } = await supabase.from('kategori_pengeluaran')
    .insert({ nama: nama.trim(), warna, created_by: user.id })
  if (error) return { error: error.message.includes('unique') ? 'Kategori sudah ada' : error.message }
  revalidatePath('/pengeluaran')
  return { success: true }
}

export async function deleteKategori(id: number) {
  const supabase = await createClient()
  const { count } = await supabase.from('pengeluaran')
    .select('*',{count:'exact',head:true}).eq('kategori_id',id).is('voided_at',null)
  if ((count ?? 0) > 0) return { error: `Tidak bisa hapus: ${count} pengeluaran masih pakai kategori ini` }
  await supabase.from('kategori_pengeluaran').update({ aktif: false }).eq('id', id)
  revalidatePath('/pengeluaran')
  return { success: true }
}

// ── PENGELUARAN ───────────────────────────────────────────────────────────────
export async function createPengeluaran(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name,role').eq('id',user.id).single()
  if (!ALLOWED.includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const tanggal     = formData.get('tanggal') as string
  const kategori_id = parseInt(formData.get('kategori_id') as string)
  const nama        = (formData.get('nama') as string)?.trim()
  const nominal     = parseFloat(formData.get('nominal') as string)
  const lokasi      = (formData.get('lokasi') as string)?.trim()
  const keterangan  = (formData.get('keterangan') as string)?.trim() || null

  if (!tanggal)    return { error: 'Tanggal wajib diisi' }
  if (!nama)       return { error: 'Nama pengeluaran wajib diisi' }
  if (!nominal || nominal <= 0) return { error: 'Nominal harus lebih dari 0' }
  if (!lokasi)     return { error: 'Lokasi wajib diisi' }

  const { error } = await supabase.from('pengeluaran').insert({
    tanggal, kategori_id: kategori_id || null, nama, nominal, lokasi, keterangan, created_by: user.id
  })
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PENGELUARAN', module: 'PENGELUARAN',
    after_data: { nama, nominal, lokasi, tanggal },
  })
  revalidatePath('/pengeluaran')
  revalidatePath('/laporan')
  return { success: true }
}

export async function voidPengeluaran(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!reason.trim()) return { error: 'Alasan void wajib diisi' }
  await supabase.from('pengeluaran').update({ voided_at: new Date().toISOString(), void_reason: reason }).eq('id', id)
  revalidatePath('/pengeluaran')
  revalidatePath('/laporan')
  return { success: true }
}
