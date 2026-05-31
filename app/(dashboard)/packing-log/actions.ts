'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PCKG_PREFIX = 'PCKG.GDCJ'

async function generatePackingCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('get_next_code', { p_name: 'packing' })
  return `${PCKG_PREFIX}/${String(data ?? 1).padStart(4, '0')}`
}


async function uploadBase64Fotos(supabase: any, b64Array: string[], prefix: string): Promise<string[]> {
  const urls: string[] = []
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_')
  for (let i = 0; i < b64Array.length; i++) {
    const b64 = b64Array[i]
    if (!b64) continue
    try {
      const base64Data = b64.replace(/^data:image\/[^;]+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const path = `packing/${safe}/${Date.now()}_${i}.jpg`
      const { error } = await supabase.storage
        .from('emas-fotos').upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    } catch {}
  }
  return urls
}

export async function createPacking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const produksiItemId = parseInt(formData.get('produksi_item_id') as string)
  const pcsDispack = parseInt(formData.get('pcs_dipack') as string)
  const totalGramAktual = parseFloat(formData.get('total_gram_aktual') as string)
  const tanggal = formData.get('tanggal') as string
  const pic = formData.get('pic') as string
  const catatan = formData.get('catatan') as string

  if (!produksiItemId) return { error: 'Item produksi wajib dipilih' }
  if (!pcsDispack || pcsDispack <= 0) return { error: 'PCS yang dipack wajib diisi' }
  if (!totalGramAktual || totalGramAktual <= 0) return { error: 'Total gram aktual wajib diisi' }
  if (!tanggal) return { error: 'Tanggal packing wajib diisi' }

  const { data: produksi } = await supabase
    .from('produksi_item')
    .select('*, packing!left(pcs_dipack, voided_at)')
    .eq('id', produksiItemId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }
  if (produksi.current_status !== 'Siap Packing') return { error: 'Item harus dalam status Siap Packing' }

  // Hitung sisa PCS yang belum dipacking
  const activePacking = (produksi.packing ?? []).filter((p: any) => !p.voided_at)
  const totalSudahDipack = activePacking.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
  const pcsTersisa = (produksi.pcs_good ?? produksi.pcs) - totalSudahDipack

  if (pcsDispack > pcsTersisa) {
    return { error: `PCS yang dipack (${pcsDispack}) melebihi sisa PCS (${pcsTersisa})` }
  }

  const gramasi = parseFloat(produksi.gramasi)
  const totalGramTarget = gramasi * pcsDispack
  const selisih = totalGramAktual - totalGramTarget

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const kode = await generatePackingCode(supabase)
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  const { data: packing, error } = await supabase.from('packing').insert({
    kode,
    produksi_item_id: produksiItemId,
    batch_kode: produksi.batch_kode,
    gramasi: produksi.gramasi,
    pcs: pcsDispack,
    pcs_dipack: pcsDispack,
    total_gram: totalGramAktual,
    total_gram_aktual: totalGramAktual,
    selisih_gram: selisih,
    tanggal,
    pic: pic || profile?.name || null,
    pic_packing: pic || profile?.name || null,
    catatan: catatan || null,
    status_surat: 'belum_cetak',
    shieldtag_count: 0,
    fotos: fotoUrls,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // Jika semua PCS sudah dipacking → insert event 'Sudah Packing' (DB trigger sync current_status)
  const newTotalPacked = totalSudahDipack + pcsDispack
  if (newTotalPacked >= (produksi.pcs_good ?? produksi.pcs)) {
    await supabase.from('produksi_event').insert({
      produksi_item_id: produksiItemId,
      tanggal: new Date().toISOString().split('T')[0],
      status: 'Sudah Packing',
      total_gram: produksi.total_gram,
      berat_sebelumnya: produksi.total_gram,
      losses: 0,
      pcs_good_snapshot: produksi.pcs_good ?? produksi.pcs,
      user_name: profile?.name || 'System',
    })
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PACKING',
    record_key: kode, record_id: String(packing.id), after_data: packing,
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true, kode }
}

export async function editPacking(packingId: number, packingKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  if (!['owner','admin_pusat','spv'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin/SPV yang bisa edit packing' }

  const { data: existing } = await supabase.from('packing').select('*, produksi_item(*)').eq('id', packingId).single()
  if (!existing) return { error: 'Packing tidak ditemukan' }
  if (existing.voided_at) return { error: 'Packing sudah VOID, tidak bisa diedit' }

  const fotosB64RawEdit = formData.get('fotos_b64') as string
  const fotosB64Edit = fotosB64RawEdit ? JSON.parse(fotosB64RawEdit) : []
  const existingFotosEdit: string[] = formData.get('existing_fotos') ? JSON.parse(formData.get('existing_fotos') as string) : (existing.fotos ?? [])
  const newFotoUrlsEdit = fotosB64Edit.length > 0 ? await uploadBase64Fotos(supabase, fotosB64Edit, packingKode) : []
  const allFotosEdit = [...existingFotosEdit, ...newFotoUrlsEdit]

  const pcsDispack = parseInt(formData.get('pcs_dipack') as string)
  const totalGramAktual = parseFloat(formData.get('total_gram_aktual') as string)
  const tanggal = formData.get('tanggal') as string
  const pic = formData.get('pic') as string
  const catatan = formData.get('catatan') as string

  // Validate pcs won't exceed pcs_good when combined with other active packings
  const { data: otherPackings } = await supabase.from('packing')
    .select('pcs_dipack').eq('produksi_item_id', existing.produksi_item_id)
    .is('voided_at', null).neq('id', packingId)
  const otherPacked = (otherPackings ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
  const pcsGoodItem = existing.produksi_item?.pcs_good ?? existing.produksi_item?.pcs ?? 0
  if (pcsDispack + otherPacked > pcsGoodItem)
    return { error: `PCS tidak valid: edit ini (${pcsDispack}) + packing lain (${otherPacked}) = ${pcsDispack + otherPacked} melebihi PCS good (${pcsGoodItem})` }

  const gramasi = parseFloat(existing.gramasi)
  const totalGramTarget = gramasi * pcsDispack
  const selisih = totalGramAktual - totalGramTarget

  await supabase.from('packing').update({
    pcs: pcsDispack, pcs_dipack: pcsDispack,
    total_gram: totalGramAktual, total_gram_aktual: totalGramAktual,
    selisih_gram: selisih, tanggal,
    pic: pic || null, pic_packing: pic || null,
    catatan: catatan || null,
    fotos: allFotosEdit,
  }).eq('id', packingId)

  // Re-check status produksi
  const produksiId = existing.produksi_item_id
  const { data: allPacking } = await supabase.from('packing')
    .select('pcs_dipack').eq('produksi_item_id', produksiId).is('voided_at', null)
  const totalPacked = (allPacking ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
  const produksi = existing.produksi_item
  const pcsGood = produksi?.pcs_good ?? produksi?.pcs ?? 0
  const newStatus = totalPacked >= pcsGood ? 'Sudah Packing' : 'Siap Packing'
  await supabase.from('produksi_item').update({ current_status: newStatus }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_PACKING', module: 'PACKING',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}

export async function voidPacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  // Block if shieldtags already registered
  const { count: stCount } = await supabase.from('shieldtag')
    .select('*', { count: 'exact', head: true })
    .eq('packing_id', packingId).is('voided_at', null)
  if ((stCount ?? 0) > 0) {
    return { error: `Tidak bisa hapus — ada ${stCount} Shieldtag terdaftar. VOID semua Shieldtag terlebih dahulu.` }
  }

  const { data: existing } = await supabase.from('packing').select('produksi_item_id').eq('id', packingId).single()

  await supabase.from('packing').update({
    voided_at: new Date().toISOString(),
    void_reason: 'VOIDED_BY_USER',
  }).eq('id', packingId)

  // Revert status: cek sisa packing aktif setelah void ini
  if (existing?.produksi_item_id) {
    const { data: remPack } = await supabase.from('packing')
      .select('pcs_dipack').eq('produksi_item_id', existing.produksi_item_id)
      .is('voided_at', null).neq('id', packingId)
    const remTotal = (remPack ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
    const { data: prodItem } = await supabase.from('produksi_item')
      .select('pcs_good, pcs').eq('id', existing.produksi_item_id).single()
    const pcsGood = prodItem?.pcs_good ?? prodItem?.pcs ?? 0
    // Only revert to Siap Packing if remaining packings don't cover all pcs
    const correctStatus = remTotal >= pcsGood ? 'Sudah Packing' : 'Siap Packing'
    await supabase.from('produksi_item')
      .update({ current_status: correctStatus })
      .eq('id', existing.produksi_item_id)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_PACKING', module: 'PACKING',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}

export async function markPrinted(packingId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner','admin_pusat','spv','operator_packing','operator_produksi'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki izin' }

  // BUG 1 FIX: Validasi shieldtag terdaftar harus = pcs_dipack sebelum print
  const { data: pk } = await supabase.from('packing').select('pcs_dipack').eq('id', packingId).single()
  const { count: stCount } = await supabase.from('shieldtag')
    .select('*', { count: 'exact', head: true })
    .eq('packing_id', packingId).is('voided_at', null)
  if (pk && (stCount ?? 0) < pk.pcs_dipack) {
    return { error: `Shieldtag belum lengkap: ${stCount ?? 0} terdaftar dari ${pk.pcs_dipack} PCS. Registrasi semua Shieldtag dulu sebelum print.` }
  }

  await supabase.from('packing').update({ status_surat: 'sudah_cetak' }).eq('id', packingId)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'MARK_PRINTED', module: 'PACKING', record_id: String(packingId),
  })
  revalidatePath('/packing-log')
  return { success: true }
}



