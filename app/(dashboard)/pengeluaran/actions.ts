'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

// ── Kategori ─────────────────────────────────────────────────────────────────

export async function createKategori(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv', 'admin_accounting'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki akses' }

  const nama  = (formData.get('nama') as string)?.trim()
  const warna = (formData.get('warna') as string) ?? '#6366F1'
  if (!nama) return { error: 'Nama kategori wajib diisi' }

  const { error } = await supabase.from('kategori_pengeluaran').insert({
    nama, warna, aktif: true, created_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/pengeluaran')
  return { success: true }
}

export async function updateKategori(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv', 'admin_accounting'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki akses' }

  const nama  = (formData.get('nama') as string)?.trim()
  const warna = (formData.get('warna') as string)
  if (!nama) return { error: 'Nama kategori wajib diisi' }

  const { error } = await supabase.from('kategori_pengeluaran')
    .update({ nama, warna }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengeluaran')
  return { success: true }
}

export async function toggleKategoriAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { error } = await supabase.from('kategori_pengeluaran')
    .update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pengeluaran')
  return { success: true }
}

// ── Pengeluaran ───────────────────────────────────────────────────────────────

export async function createPengeluaran(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const tanggal     = formData.get('tanggal') as string
  const nama        = (formData.get('nama') as string)?.trim()
  const nominalStr  = formData.get('nominal') as string
  const lokasi      = (formData.get('lokasi') as string)?.trim()
  const keterangan  = (formData.get('keterangan') as string)?.trim() || null
  const kategori_id = formData.get('kategori_id') ? Number(formData.get('kategori_id')) : null
  const fotoBase64  = formData.get('foto') as string | null

  if (!tanggal) return { error: 'Tanggal wajib diisi' }
  if (!nama)    return { error: 'Nama pengeluaran wajib diisi' }
  if (!lokasi)  return { error: 'Lokasi wajib diisi' }
  const nominal = parseFloat(nominalStr)
  if (isNaN(nominal) || nominal <= 0) return { error: 'Nominal harus lebih dari 0' }

  let fotoUrl: string | null = null
  if (fotoBase64 && fotoBase64.startsWith('data:')) {
    const base64Data = fotoBase64.split(',')[1]
    const mimeMatch  = fotoBase64.match(/data:([^;]+);/)
    const mime       = mimeMatch?.[1] ?? 'image/jpeg'
    const ext        = mime.split('/')[1] ?? 'jpg'
    const buf        = Buffer.from(base64Data, 'base64')
    const fileName   = `pengeluaran/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('foto-produksi').upload(fileName, buf, { contentType: mime, upsert: false })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('foto-produksi').getPublicUrl(fileName)
      fotoUrl = urlData.publicUrl
    }
  }

  const { error } = await supabase.from('pengeluaran').insert({
    tanggal, nama, nominal, lokasi, keterangan,
    kategori_id, foto: fotoUrl, created_by: user.id,
  })
  if (error) return { error: error.message }

  await createNotif({
    judul: `Pengeluaran Baru: ${nama}`,
    pesan: `Rp${nominal.toLocaleString('id-ID')} · ${lokasi}`,
    tipe: 'info',
    link: '/pengeluaran',
    untuk_role: ['owner', 'manager', 'admin_accounting'],
  })

  revalidatePath('/pengeluaran')
  return { success: true }
}

export async function updatePengeluaran(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const tanggal     = formData.get('tanggal') as string
  const nama        = (formData.get('nama') as string)?.trim()
  const nominalStr  = formData.get('nominal') as string
  const lokasi      = (formData.get('lokasi') as string)?.trim()
  const keterangan  = (formData.get('keterangan') as string)?.trim() || null
  const kategori_id = formData.get('kategori_id') ? Number(formData.get('kategori_id')) : null

  if (!tanggal) return { error: 'Tanggal wajib diisi' }
  if (!nama)    return { error: 'Nama pengeluaran wajib diisi' }
  if (!lokasi)  return { error: 'Lokasi wajib diisi' }
  const nominal = parseFloat(nominalStr)
  if (isNaN(nominal) || nominal <= 0) return { error: 'Nominal harus lebih dari 0' }

  const { error } = await supabase.from('pengeluaran')
    .update({ tanggal, nama, nominal, lokasi, keterangan, kategori_id })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pengeluaran')
  return { success: true }
}

export async function voidPengeluaran(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase.from('users_profile')
    .select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'admin_accounting'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki akses untuk menghapus pengeluaran' }

  if (!reason?.trim()) return { error: 'Alasan void wajib diisi' }

  const { error } = await supabase.from('pengeluaran').update({
    voided_at: new Date().toISOString(),
    void_reason: reason.trim(),
  }).eq('id', id)
  if (error) return { error: error.message }

  await createNotif({
    judul: `Pengeluaran #${id} Di-VOID`,
    pesan: `Alasan: ${reason.trim()}`,
    tipe: 'warning',
    link: '/pengeluaran',
    untuk_role: ['owner', 'manager'],
  })

  revalidatePath('/pengeluaran')
  return { success: true }
}
