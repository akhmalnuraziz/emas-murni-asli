'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import { generateRange } from '@/lib/shieldtag-utils'

export async function registerShieldtags(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const packingId = parseInt(formData.get('packing_id') as string)
  const kodesRaw = formData.get('kodes') as string
  const tanggal = formData.get('tanggal') as string

  if (!packingId) return { error: 'Packing wajib dipilih' }
  if (!kodesRaw) return { error: 'Kode shieldtag wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const kodes: string[] = JSON.parse(kodesRaw)
  if (!kodes.length) return { error: 'Tidak ada kode shieldtag yang valid' }

  // Get packing data
  const { data: packing } = await supabase.from('packing')
    .select('*, produksi_item(gramasi, batch_kode)')
    .eq('id', packingId).single()
  if (!packing) return { error: 'Packing tidak ditemukan' }

  // Check PCS limit
  const { count: existingCount } = await supabase.from('shieldtag')
    .select('*', { count: 'exact', head: true })
    .eq('packing_id', packingId)
    .is('voided_at', null)
  const alreadyRegistered = existingCount ?? 0
  const remaining = packing.pcs_dipack - alreadyRegistered
  if (kodes.length > remaining) {
    return { error: `Packing ini masih bisa menerima ${remaining} shieldtag (sudah ${alreadyRegistered}/${packing.pcs_dipack})` }
  }

  // Check duplicate kodes in this batch
  const { data: existingKodes } = await supabase.from('shieldtag')
    .select('kode').in('kode', kodes).is('voided_at', null)
  if (existingKodes && existingKodes.length > 0) {
    const dupes = existingKodes.map((k: any) => k.kode).join(', ')
    return { error: `Kode sudah terdaftar: ${dupes}` }
  }

  // Get HPP from batch
  const { data: batch } = await supabase.from('batch')
    .select('hpp_gr').eq('kode', packing.batch_kode ?? packing.produksi_item?.batch_kode).single()
  const hppGr = batch?.hpp_gr ?? 0

  // Insert shieldtags
  const insertData = kodes.map((kode: string) => ({
    kode: kode.toUpperCase(),
    packing_id: packingId,
    batch_kode: packing.batch_kode ?? packing.produksi_item?.batch_kode,
    gramasi: packing.gramasi ?? packing.produksi_item?.gramasi,
    hpp: hppGr,
    status: 'Aktif',
    lokasi: 'Gudang Pusat',
    tgl_regis: tanggal,
    registered_by: profile?.name ?? null,
    shieldtag_history: JSON.stringify([{
      tanggal, status: 'Aktif', lokasi: 'Gudang Pusat',
      catatan: `Registrasi oleh ${profile?.name ?? 'sistem'}`, user: profile?.name
    }])
  }))

  const { error } = await supabase.from('shieldtag').insert(insertData)
  if (error) return { error: error.message }

  // Update packing shieldtag_count
  await supabase.from('packing').update({
    shieldtag_count: alreadyRegistered + kodes.length
  }).eq('id', packingId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'REGISTER_SHIELDTAG', module: 'SHIELDTAG',
    record_key: `PACKING-${packingId}`,
    after_data: { count: kodes.length, kodes: kodes.slice(0, 5) }
  })

  revalidatePath('/shieldtag')
  revalidatePath('/packing-log')
  return { success: true, count: kodes.length }
}

export async function voidShieldtag(shieldtagId: number, kode: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: st } = await supabase.from('shieldtag').select('*').eq('id', shieldtagId).single()
  if (!st) return { error: 'Shieldtag tidak ditemukan' }

  const history = Array.isArray(st.shieldtag_history) ? st.shieldtag_history : []
  history.push({ tanggal: new Date().toISOString().split('T')[0], status: 'VOID', catatan: reason, user: profile?.name })

  await supabase.from('shieldtag').update({
    status: 'VOID', voided_at: new Date().toISOString(), void_reason: reason,
    shieldtag_history: history
  }).eq('id', shieldtagId)

  // Reduce packing shieldtag_count
  if (st.packing_id) {
    const { data: packing } = await supabase.from('packing').select('shieldtag_count').eq('id', st.packing_id).single()
    if (packing) {
      await supabase.from('packing').update({
        shieldtag_count: Math.max(0, (packing.shieldtag_count ?? 0) - 1)
      }).eq('id', st.packing_id)
    }
  }

  revalidatePath('/shieldtag')
  revalidatePath('/packing-log')
  return { success: true }
}
