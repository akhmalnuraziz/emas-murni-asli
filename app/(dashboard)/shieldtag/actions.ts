'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

// ─── Charset & Range Algorithm ────────────────────────────────────────────────
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function incrementCode(code: string): string {
  const chars = code.toUpperCase().split('')
  let i = chars.length - 1
  while (i >= 0) {
    const idx = CHARSET.indexOf(chars[i])
    if (idx === -1) { i--; continue }
    if (idx < CHARSET.length - 1) {
      chars[i] = CHARSET[idx + 1]
      return chars.join('')
    } else {
      chars[i] = CHARSET[0]
      i--
    }
  }
  return code // overflow guard
}

function generateRange(start: string, end: string): string[] {
  const s = start.toUpperCase().trim()
  const e = end.toUpperCase().trim()
  if (!s || !e) return []
  const codes: string[] = []
  let current = s
  codes.push(current)
  let guard = 0
  while (current !== e && guard < 5000) {
    current = incrementCode(current)
    codes.push(current)
    guard++
    if (current === e) break
  }
  return codes
}

function previewRange(start: string, end: string): { codes: string[]; count: number; error?: string } {
  try {
    if (!start || !end) return { codes: [], count: 0 }
    const codes = generateRange(start, end)
    if (codes.length > 5000) return { codes: [], count: 0, error: 'Range terlalu besar (max 5000 per range)' }
    if (codes.length === 0) return { codes: [], count: 0, error: 'Range tidak valid' }
    return { codes, count: codes.length }
  } catch {
    return { codes: [], count: 0, error: 'Format kode tidak valid' }
  }
}

export async function registerShieldtags(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const packingId = parseInt(formData.get('packing_id') as string)
  const tanggal = formData.get('tanggal') as string
  const rangesRaw = formData.get('ranges') as string // JSON: [{start, end}]
  const codesManualRaw = formData.get('codes_manual') as string // JSON: string[]

  if (!packingId) return { error: 'Packing wajib dipilih' }
  if (!tanggal) return { error: 'Tanggal registrasi wajib diisi' }

  const { data: packing } = await supabase.from('packing')
    .select('*, produksi_item(gramasi, batch_kode, hpp_per_gram:batch(hpp_gr))')
    .eq('id', packingId).single()
  if (!packing) return { error: 'Packing tidak ditemukan' }

  // Build final list of codes
  let allCodes: string[] = []

  if (codesManualRaw) {
    allCodes = JSON.parse(codesManualRaw) as string[]
  } else if (rangesRaw) {
    const ranges = JSON.parse(rangesRaw) as { start: string; end: string }[]
    for (const r of ranges) {
      const generated = generateRange(r.start, r.end)
      allCodes = [...allCodes, ...generated]
    }
  }

  if (allCodes.length === 0) return { error: 'Tidak ada kode Shieldtag yang akan diregistrasi' }

  // Check existing packing shieldtag count
  const { count: existingCount } = await supabase
    .from('shieldtag').select('*', { count: 'exact', head: true })
    .eq('packing_id', packingId).is('voided_at', null)

  const maxShieldtag = packing.pcs_dipack - (packing.pcs_reject ?? 0)
  const remaining = maxShieldtag - (existingCount ?? 0)
  if (allCodes.length > remaining) {
    return { error: `Hanya bisa registrasi ${remaining} Shieldtag lagi untuk packing ini (${existingCount} sudah terdaftar dari ${maxShieldtag} PCS valid — ${packing.pcs_dipack} dipack − ${packing.pcs_reject ?? 0} reject)` }
  }

  // Check for duplicate codes globally
  const { data: dupes } = await supabase
    .from('shieldtag').select('kode').in('kode', allCodes).is('voided_at', null)
  if (dupes && dupes.length > 0) {
    return { error: `Kode sudah terdaftar: ${dupes.map((d: any) => d.kode).join(', ')}` }
  }

  // Get HPP per gram from batch + biaya packaging untuk gramasi ini
  const [{ data: batchData }, { data: pkgRows }] = await Promise.all([
    supabase.from('batch').select('hpp_gr').eq('kode', packing.batch_kode).single(),
    supabase.from('pengaturan').select('key, value').like('key', 'biaya_packaging_%'),
  ])
  const hppGr = Number(batchData?.hpp_gr ?? 0)
  const gramasiVal = String(parseFloat(packing.gramasi ?? '0'))
  const pkgMap: Record<string, number> = {}
  for (const r of pkgRows ?? []) {
    const k = r.key.replace('biaya_packaging_', '')
    pkgMap[k] = Number(r.value ?? 0)
  }
  const biayaPkg = pkgMap[gramasiVal] ?? 0
  // HPP per pcs = (HPP per gram × gramasi) + biaya packaging
  const hppPerPcs = hppGr * parseFloat(packing.gramasi ?? '0') + biayaPkg

  // Insert all shieldtags
  const insertData = allCodes.map(kode => ({
    kode,
    packing_id: packingId,
    batch_kode: packing.batch_kode,
    gramasi: packing.gramasi,
    hpp: hppPerPcs,
    status: 'Aktif',
    lokasi: 'Gudang Pusat',
    tgl_regis: tanggal,
    registered_by: profile?.name || null,
    shieldtag_history: JSON.stringify([{
      tanggal,
      action: 'Registrasi',
      status: 'Aktif',
      lokasi: 'Gudang Pusat',
      oleh: profile?.name || 'System',
    }]),
  }))

  const { error } = await supabase.from('shieldtag').insert(insertData)
  if (error) return { error: error.message }

  // Update packing.shieldtag_count
  await supabase.from('packing')
    .update({ shieldtag_count: (existingCount ?? 0) + allCodes.length })
    .eq('id', packingId)

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'REGISTER_SHIELDTAG', module: 'SHIELDTAG',
    record_key: `PKG-${packingId}`,
    after_data: { count: allCodes.length, kodes: allCodes.slice(0, 10) },
  })

  revalidatePath('/shieldtag')
  revalidatePath('/packing-log')

  createNotif({
    judul: `${allCodes.length} Shieldtag Didaftarkan`,
    pesan: `Packing ${packing.kode} · ${allCodes[0]}${allCodes.length > 1 ? ` s/d ${allCodes[allCodes.length - 1]}` : ''} · ${packing.gramasi}gr`,
    tipe: 'success',
    link: '/shieldtag',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  return { success: true, count: allCodes.length }
}

export async function editShieldtagKode(shieldtagId: number, newKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { error: 'Hanya Owner/Manager/SPV yang bisa edit kode' }
  // ROLE_CHECK_DISABLED: 
  const newKodeUp = newKode.toUpperCase().trim()
  if (!newKodeUp) return { error: 'Kode tidak boleh kosong' }

  // Check duplicate
  const { data: existing } = await supabase
    .from('shieldtag').select('kode').eq('kode', newKodeUp).is('voided_at', null).neq('id', shieldtagId).single()
  if (existing) return { error: `Kode ${newKodeUp} sudah terdaftar` }

  const { data: st } = await supabase.from('shieldtag').select('kode, shieldtag_history').eq('id', shieldtagId).single()
  if (!st) return { error: 'Shieldtag tidak ditemukan' }

  const history = Array.isArray(st.shieldtag_history) ? st.shieldtag_history : []
  history.push({
    tanggal: new Date().toISOString().split('T')[0],
    action: `Edit kode: ${st.kode} → ${newKodeUp}`,
    oleh: profile?.name || 'System',
  })

  const { error: updateErr } = await supabase.from('shieldtag').update({ kode: newKodeUp, shieldtag_history: history }).eq('id', shieldtagId)
  if (updateErr) return { error: updateErr.message }

  revalidatePath('/shieldtag')

  createNotif({
    judul: `Kode Shieldtag Diubah`,
    pesan: `${st.kode} → ${newKodeUp} · diubah oleh ${profile?.name ?? 'Admin'}`,
    tipe: 'info',
    link: '/shieldtag',
    untuk_role: ['owner', 'manager'],
  })

  return { success: true }
}

export async function voidShieldtag(shieldtagId: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner','manager','spv'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager/SPV' }
  // ROLE_CHECK_DISABLED: 
  const { data: st } = await supabase.from('shieldtag').select('*').eq('id', shieldtagId).single()
  if (!st) return { error: 'Shieldtag tidak ditemukan' }

  const history = Array.isArray(st.shieldtag_history) ? st.shieldtag_history : []
  history.push({
    tanggal: new Date().toISOString().split('T')[0],
    action: 'VOID',
    alasan: reason,
    oleh: profile?.name || 'System',
  })

  await supabase.from('shieldtag').update({
    status: 'VOID',
    voided_at: new Date().toISOString(),
    void_reason: reason,
    shieldtag_history: history,
  }).eq('id', shieldtagId)

  // Update packing shieldtag_count
  if (st.packing_id) {
    const { count } = await supabase.from('shieldtag')
      .select('*', { count: 'exact', head: true })
      .eq('packing_id', st.packing_id).is('voided_at', null)
    await supabase.from('packing').update({ shieldtag_count: count ?? 0 }).eq('id', st.packing_id)
  }

  revalidatePath('/shieldtag')
  revalidatePath('/packing-log')

  createNotif({
    judul: `Shieldtag ${st.kode} Di-VOID`,
    pesan: `Alasan: ${reason} · oleh ${profile?.name ?? 'Admin'}`,
    tipe: 'warning',
    link: '/shieldtag',
    untuk_role: ['owner', 'manager'],
  })

  return { success: true }
}

export async function searchShieldtag(query: string): Promise<{ data: any | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const q = query.toUpperCase().trim()
  if (!q) return { data: null, error: 'Masukkan kode Shieldtag' }

  const { data, error } = await supabase
    .from('shieldtag')
    .select(`
      *,
      packing:packing_id (
        kode, gramasi, pcs_dipack, tanggal,
        produksi_item ( kode, nama_item )
      )
    `)
    .eq('kode', q)
    .single()

  if (error || !data) return { data: null, error: 'Shieldtag tidak ditemukan' }
  return { data }
}

export async function uploadFotoProdukShieldtag(kode: string, base64: string, ext: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const path = `shieldtag-foto/${kode}.${ext}`
  const buffer = Buffer.from(base64, 'base64')
  const { error: upErr } = await supabase.storage.from('fotos').upload(path, buffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  })
  if (upErr) return { error: upErr.message }

  const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path)
  const url = urlData.publicUrl

  const { error: dbErr } = await supabase.from('shieldtag').update({ foto_produk: url }).eq('kode', kode.toUpperCase())
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/shieldtag')
  return { url }
}

export async function bulkVoidShieldtag(ids: number[], reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner','manager','spv'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager/SPV' }
  // ROLE_CHECK_DISABLED: 
  const tanggal = new Date().toISOString().split('T')[0]
  const histEntry = { tanggal, action: 'VOID (Bulk)', alasan: reason, oleh: profile?.name || 'System' }

  const { data: existing } = await supabase.from('shieldtag').select('id, packing_id, shieldtag_history').in('id', ids)
  if (!existing || existing.length === 0) return { error: 'Tidak ada Shieldtag ditemukan' }

  for (const st of existing) {
    const hist = Array.isArray(st.shieldtag_history) ? st.shieldtag_history : []
    hist.push(histEntry)
    await supabase.from('shieldtag').update({
      status: 'VOID', voided_at: new Date().toISOString(),
      void_reason: reason, shieldtag_history: hist,
    }).eq('id', st.id)
  }

  const packingIds = [...new Set((existing ?? []).map((s: any) => s.packing_id).filter(Boolean))]
  for (const pid of packingIds) {
    const { count } = await supabase.from('shieldtag')
      .select('*', { count: 'exact', head: true })
      .eq('packing_id', pid).is('voided_at', null)
    await supabase.from('packing').update({ shieldtag_count: count ?? 0 }).eq('id', pid)
  }

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'BULK_VOID_SHIELDTAG', module: 'SHIELDTAG',
    after_data: { count: ids.length, reason },
  })

  revalidatePath('/shieldtag')
  revalidatePath('/packing-log')
  return { success: true, count: ids.length }
}
