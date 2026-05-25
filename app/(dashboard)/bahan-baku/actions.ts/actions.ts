'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function generateBatchCode(existingCount: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const seq = String(existingCount + 1).padStart(5, '0')
  return `BCH/${year}/${month}${seq}`
}

export async function createBatch(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  const { count } = await supabase
    .from('batch').select('*', { count: 'exact', head: true }).is('voided_at', null)

  const kode = generateBatchCode(count ?? 0)
  const beratGudang = parseFloat(formData.get('timbangan_akhir') as string) || 0
  const hargaBeli = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw = formData.get('biaya_tbh') as string
  const biayaTbh = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh = biayaTbh.reduce((sum: number, b: any) => sum + (b.jumlah || 0), 0)
  const totalHpp = hargaBeli + totalBiayaTbh
  const hppGr = beratGudang > 0 ? totalHpp / beratGudang : 0

  const { data, error } = await supabase.from('batch').insert({
    kode,
    tanggal: formData.get('tanggal') as string,
    supplier: formData.get('supplier') as string || null,
    bahan_dari_pusat: parseFloat(formData.get('bahan_dari_pusat') as string) || 0,
    timbangan_akhir: beratGudang,
    sisa_fisik: beratGudang,
    harga_beli: hargaBeli,
    hpp_gr: hppGr,
    biaya_tbh: biayaTbh,
    catatan: formData.get('catatan') as string || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: profile?.name,
    user_role: profile?.role,
    action: 'CREATE',
    module: 'BAHAN_BAKU',
    record_key: kode,
    record_id: String(data.id),
    after_data: data,
  })

  revalidatePath('/bahan-baku')
  return { success: true, kode }
}

export async function lockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) {
    return { error: 'Tidak memiliki izin untuk mengunci batch' }
  }

  const { data: before } = await supabase.from('batch').select('*').eq('id', batchId).single()

  const { error } = await supabase.from('batch')
    .update({ voided_at: new Date().toISOString(), void_reason: 'LOCKED_BY_USER' })
    .eq('id', batchId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: profile?.name,
    user_role: profile?.role,
    action: 'LOCK_BATCH',
    module: 'BAHAN_BAKU',
    record_key: batchKode,
    record_id: String(batchId),
    before_data: before,
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function unlockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) {
    return { error: 'Hanya Owner/Admin yang dapat membuka kunci batch' }
  }

  const { error } = await supabase.from('batch')
    .update({ voided_at: null, void_reason: null })
    .eq('id', batchId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: profile?.name,
    user_role: profile?.role,
    action: 'UNLOCK_BATCH',
    module: 'BAHAN_BAKU',
    record_key: batchKode,
    record_id: String(batchId),
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}