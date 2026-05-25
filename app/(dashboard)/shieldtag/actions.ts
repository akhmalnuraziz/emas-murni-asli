'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateShieldtagRange } from '@/lib/shieldtag-utils'

function buildHistoryEvent(action: string, lokasi: string, detail?: string) {
  return {
    timestamp: new Date().toISOString(),
    action,
    lokasi,
    detail: detail ?? null,
  }
}

// ============================================================
// REGISTER RANGE — batch registrasi dari range kode
// ============================================================
export async function registerShieldtagRange(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  const packingId = parseInt(formData.get('packing_id') as string)
  const startCode = (formData.get('start_code') as string)?.trim().toUpperCase()
  const endCode = (formData.get('end_code') as string)?.trim().toUpperCase()

  if (!packingId) return { error: 'Packing ID wajib diisi' }
  if (!startCode || !endCode) return { error: 'Kode awal dan akhir wajib diisi' }

  // Generate range
  const { codes, error: rangeError } = generateShieldtagRange(startCode, endCode)
  if (rangeError) return { error: rangeError }
  if (codes.length === 0) return { error: 'Tidak ada kode yang di-generate' }

  // Get packing data
  const { data: packing } = await supabase
    .from('packing').select('*').eq('id', packingId).single()
  if (!packing) return { error: 'Packing tidak ditemukan' }

  // Get HPP dari batch
  const { data: batch } = await supabase
    .from('batch').select('hpp_gr').eq('kode', packing.batch_kode).single()
  const hppGr = batch?.hpp_gr ?? 0

  // Cek duplikat kode
  const { data: existing } = await supabase
    .from('shieldtag').select('kode').in('kode', codes)
  if (existing && existing.length > 0) {
    const dupes = existing.map((e: any) => e.kode).join(', ')
    return { error: `Kode berikut sudah terdaftar: ${dupes}` }
  }

  // Cek tidak melebihi PCS packing
  const { count: alreadyRegistered } = await supabase
    .from('shieldtag').select('*', { count: 'exact', head: true })
    .eq('packing_id', packingId).neq('status', 'VOID').is('voided_at', null)

  const pcsAvailable = (packing.pcs_dipack ?? packing.pcs ?? 0) - (alreadyRegistered ?? 0)
  if (codes.length > pcsAvailable) {
    return { error: `Jumlah kode (${codes.length}) melebihi sisa PCS yang belum di-Shieldtag (${pcsAvailable})` }
  }

  const now = new Date().toISOString()
  const historyEvent = buildHistoryEvent('Registrasi', 'Gudang Pusat', `Registered by ${profile?.name}`)

  const rows = codes.map(kode => ({
    kode,
    packing_id: packingId,
    batch_kode: packing.batch_kode,
    gramasi: packing.gramasi,
    hpp: hppGr,
    status: 'Aktif',
    lokasi: 'Gudang Pusat',
    tgl_regis: now,
    harga_jual: 0,
    registered_by: profile?.name ?? null,
    shieldtag_history: [historyEvent],
  }))

  const { error } = await supabase.from('shieldtag').insert(rows)
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'REGISTER_SHIELDTAG_RANGE', module: 'SHIELDTAG',
    record_key: `${startCode}-${endCode}`,
    after_data: { packing_id: packingId, count: codes.length, codes: codes.slice(0, 10) },
  })

  revalidatePath('/shieldtag')
  revalidatePath('/produksi')
  return { success: true, count: codes.length }
}

// ============================================================
// REGISTER MANUAL — single kode
// ============================================================
export async function registerShieldtagManual(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  const packingId = parseInt(formData.get('packing_id') as string)
  const kode = (formData.get('kode') as string)?.trim().toUpperCase()
  if (!packingId) return { error: 'Packing ID wajib' }
  if (!kode) return { error: 'Kode Shieldtag wajib diisi' }

  const { data: packing } = await supabase.from('packing').select('*').eq('id', packingId).single()
  if (!packing) return { error: 'Packing tidak ditemukan' }

  const { data: existing } = await supabase.from('shieldtag').select('id').eq('kode', kode).single()
  if (existing) return { error: `Kode ${kode} sudah terdaftar` }

  const { data: batch } = await supabase.from('batch').select('hpp_gr').eq('kode', packing.batch_kode).single()

  const historyEvent = buildHistoryEvent('Registrasi', 'Gudang Pusat', `Manual by ${profile?.name}`)

  const { error } = await supabase.from('shieldtag').insert({
    kode, packing_id: packingId, batch_kode: packing.batch_kode,
    gramasi: packing.gramasi, hpp: batch?.hpp_gr ?? 0,
    status: 'Aktif', lokasi: 'Gudang Pusat',
    tgl_regis: new Date().toISOString(), harga_jual: 0,
    registered_by: profile?.name ?? null,
    shieldtag_history: [historyEvent],
  })
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'REGISTER_SHIELDTAG_MANUAL', module: 'SHIELDTAG',
    record_key: kode, after_data: { packing_id: packingId, kode },
  })

  revalidatePath('/shieldtag')
  revalidatePath('/produksi')
  return { success: true }
}

// ============================================================
// EDIT KODE — ganti kode yang rusak
// ============================================================
export async function editShieldtagKode(shieldtagId: number, newKode: string, alasan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const newKodeUpper = newKode.trim().toUpperCase()
  const { data: existing } = await supabase.from('shieldtag').select('id').eq('kode', newKodeUpper).single()
  if (existing) return { error: `Kode ${newKodeUpper} sudah digunakan` }

  const { data: current } = await supabase.from('shieldtag').select('*').eq('id', shieldtagId).single()
  if (!current) return { error: 'Shieldtag tidak ditemukan' }

  const historyEvent = buildHistoryEvent('Edit Kode', current.lokasi ?? 'Gudang Pusat',
    `Kode lama: ${current.kode} → Kode baru: ${newKodeUpper}. Alasan: ${alasan}`)

  const newHistory = [...(current.shieldtag_history ?? []), historyEvent]

  const { error } = await supabase.from('shieldtag')
    .update({ kode: newKodeUpper, shieldtag_history: newHistory })
    .eq('id', shieldtagId)
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_KODE', module: 'SHIELDTAG',
    record_key: current.kode, record_id: String(shieldtagId),
    before_data: { kode: current.kode }, after_data: { kode: newKodeUpper, alasan },
  })

  revalidatePath('/shieldtag')
  return { success: true }
}

// ============================================================
// DISTRIBUSI — ke cabang
// ============================================================
export async function distribusiShieldtag(shieldtagIds: number[], cabangTujuan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv', 'gudang'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const now = new Date().toISOString()

  for (const id of shieldtagIds) {
    const { data: st } = await supabase.from('shieldtag').select('*').eq('id', id).single()
    if (!st) continue

    const historyEvent = buildHistoryEvent('Distribusi', cabangTujuan,
      `Didistribusikan ke ${cabangTujuan} oleh ${profile?.name}`)
    const newHistory = [...(st.shieldtag_history ?? []), historyEvent]

    await supabase.from('shieldtag').update({
      status: 'Terdistribusi', lokasi: cabangTujuan,
      tgl_dist: now, shieldtag_history: newHistory,
    }).eq('id', id)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DISTRIBUSI', module: 'SHIELDTAG',
    record_key: cabangTujuan,
    after_data: { count: shieldtagIds.length, cabang: cabangTujuan },
  })

  revalidatePath('/shieldtag')
  return { success: true }
}

// ============================================================
// VOID SHIELDTAG — manual
// ============================================================
export async function voidShieldtag(shieldtagId: number, alasan: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: st } = await supabase.from('shieldtag').select('*').eq('id', shieldtagId).single()
  if (!st) return { error: 'Shieldtag tidak ditemukan' }

  const historyEvent = buildHistoryEvent('VOID', st.lokasi ?? '-',
    `VOID oleh ${profile?.name}. Alasan: ${alasan}`)
  const newHistory = [...(st.shieldtag_history ?? []), historyEvent]

  const { error } = await supabase.from('shieldtag').update({
    status: 'VOID', voided_at: new Date().toISOString(),
    void_reason: alasan, shieldtag_history: newHistory,
  }).eq('id', shieldtagId)
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID', module: 'SHIELDTAG',
    record_key: st.kode, record_id: String(shieldtagId),
    before_data: st, reason: alasan,
  })

  revalidatePath('/shieldtag')
  return { success: true }
}
