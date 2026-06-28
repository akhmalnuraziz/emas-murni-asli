'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'foto-produk'

export async function uploadFotoMaster(gramasi: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Tidak punya akses upload foto' }

  const files = formData.getAll('foto') as File[]
  if (!files.length) return { error: 'Tidak ada file dipilih' }

  const { data: master } = await supabase.from('foto_produk_master').select('foto_urls').eq('gramasi', gramasi).single()
  const existing: string[] = master?.foto_urls ?? []

  const newUrls: string[] = []
  for (const file of files) {
    if (!file.size) continue
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${gramasi}gr/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (uploadErr) return { error: `Gagal upload: ${uploadErr.message}` }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    newUrls.push(publicUrl)
  }

  const updatedUrls = [...existing, ...newUrls]
  const { error } = await supabase.from('foto_produk_master').upsert({
    gramasi,
    foto_urls: updatedUrls,
    updated_at: new Date().toISOString(),
    updated_by: profile?.name ?? user.email,
  }, { onConflict: 'gramasi' })
  if (error) return { error: error.message }

  revalidatePath('/shieldtag/foto-master')
  return { success: true, count: newUrls.length }
}

export async function deleteFotoMaster(gramasi: string, url: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: master } = await supabase.from('foto_produk_master').select('foto_urls').eq('gramasi', gramasi).single()
  const updated = (master?.foto_urls ?? []).filter((u: string) => u !== url)

  // Delete from storage
  const path = url.split(`${BUCKET}/`)[1]
  if (path) await supabase.storage.from(BUCKET).remove([path])

  await supabase.from('foto_produk_master').update({ foto_urls: updated, updated_at: new Date().toISOString() }).eq('gramasi', gramasi)
  revalidatePath('/shieldtag/foto-master')
  return { success: true }
}
