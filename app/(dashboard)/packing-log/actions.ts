'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function generatePackingCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('packing').select('*', { count: 'exact', head: true })
  return `PCKG.GDCJ/${String((count ?? 0) + 1).padStart(4, '0')}`
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
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  // Get produksi item
  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiItemId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }
  if (produksi.current_status !== 'Siap Packing') return { error: 'Item harus berstatus Siap Packing' }

  const pcsPacked = produksi.pcs_packed ?? 0
  const pcsGood = produksi.pcs_good ?? produksi.pcs ?? 0
  const pcsRemaining = pcsGood - pcsPacked

  if (pcsDispack > pcsRemaining) {
    return { error: `PCS melebihi sisa (${pcsRemaining} PCS tersisa)` }
  }

  // Total gram expected for this pack
  const gramPerPcs = produksi.total_gram > 0 ? produksi.total_gram / pcsGood : parseFloat(produksi.gramasi)
  const totalGramExpected = gramPerPcs * pcsDispack
  const selisihGram = totalGramAktual - totalGramExpected

  const kode = await generatePackingCode(supabase)

  // Upload fotos
  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  const { data: packing, error } = await supabase.from('packing').insert({
    kode,
    produksi_item_id: produksiItemId,
    batch_kode: produksi.batch_kode,
    gramasi: produksi.gramasi,
    tanggal,
    pcs: pcsDispack,
    pcs_dipack: pcsDispack,
    total_gram: totalGramAktual,
    total_gram_aktual: totalGramAktual,
    selisih_gram: selisihGram,
    pic: pic || profile?.name || null,
    pic_packing: pic || profile?.name || null,
    catatan: catatan || null,
    fotos: fotoUrls,
    shieldtag_count: 0,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // Update produksi_item pcs_packed
  const newPcsPacked = pcsPacked + pcsDispack
  const allPacked = newPcsPacked >= pcsGood

  await supabase.from('produksi_item').update({
    pcs_packed: newPcsPacked,
    current_status: allPacked ? 'Sudah Packing' : 'Siap Packing',
  }).eq('id', produksiItemId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PACKING',
    record_key: kode, record_id: String(packing.id),
    after_data: { kode, pcs_dipack: pcsDispack, total_gram: totalGramAktual, all_packed: allPacked },
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

  const { data: existing } = await supabase.from('packing').select('*, produksi_item(*)').eq('id', packingId).single()
  if (!existing) return { error: 'Packing tidak ditemukan' }

  const pcsDispack = parseInt(formData.get('pcs_dipack') as string)
  const totalGramAktual = parseFloat(formData.get('total_gram_aktual') as string)
  const pic = formData.get('pic') as string
  const catatan = formData.get('catatan') as string

  if (!pcsDispack || pcsDispack <= 0) return { error: 'PCS wajib diisi' }
  if (!totalGramAktual || totalGramAktual <= 0) return { error: 'Total gram wajib diisi' }

  const produksi = existing.produksi_item as any
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  // Recalculate pcs_packed: subtract old, add new
  const oldPcs = existing.pcs_dipack ?? existing.pcs ?? 0
  const currentPcsPacked = produksi.pcs_packed ?? 0
  const pcsGood = produksi.pcs_good ?? produksi.pcs ?? 0
  const pcsAvailable = pcsGood - currentPcsPacked + oldPcs // return old, check new

  if (pcsDispack > pcsAvailable) {
    return { error: `PCS melebihi sisa yang tersedia (${pcsAvailable} PCS)` }
  }

  const gramPerPcs = produksi.total_gram > 0 ? produksi.total_gram / pcsGood : parseFloat(produksi.gramasi)
  const selisihGram = totalGramAktual - (gramPerPcs * pcsDispack)

  // Upload new fotos if any
  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const existingFotosRaw = formData.get('existing_fotos') as string
  const existingFotos = existingFotosRaw ? JSON.parse(existingFotosRaw) : (existing.fotos ?? [])
  const newFotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, packingKode) : []
  const fotoUrls = [...existingFotos, ...newFotoUrls]

  const { error } = await supabase.from('packing').update({
    pcs: pcsDispack,
    pcs_dipack: pcsDispack,
    total_gram: totalGramAktual,
    total_gram_aktual: totalGramAktual,
    selisih_gram: selisihGram,
    pic: pic || null,
    pic_packing: pic || null,
    catatan: catatan || null,
    fotos: fotoUrls,
  }).eq('id', packingId)

  if (error) return { error: error.message }

  // Update produksi_item pcs_packed
  const newPcsPacked = currentPcsPacked - oldPcs + pcsDispack
  const allPacked = newPcsPacked >= pcsGood

  await supabase.from('produksi_item').update({
    pcs_packed: newPcsPacked,
    current_status: allPacked ? 'Sudah Packing' : 'Siap Packing',
  }).eq('id', existing.produksi_item_id)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_PACKING', module: 'PACKING', record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}

export async function deletePacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: packing } = await supabase.from('packing').select('*, produksi_item(*)').eq('id', packingId).single()
  if (!packing) return { error: 'Packing tidak ditemukan' }

  // Check shieldtags
  const { count: shieldtagCount } = await supabase.from('shieldtag')
    .select('*', { count: 'exact', head: true }).eq('packing_id', packingId).is('voided_at', null)
  if ((shieldtagCount ?? 0) > 0) {
    return { error: `Packing memiliki ${shieldtagCount} shieldtag terdaftar. Hapus shieldtag terlebih dahulu.` }
  }

  // Restore pcs_packed
  const produksi = packing.produksi_item as any
  if (produksi) {
    const oldPcs = packing.pcs_dipack ?? packing.pcs ?? 0
    const newPcsPacked = Math.max(0, (produksi.pcs_packed ?? 0) - oldPcs)
    await supabase.from('produksi_item').update({
      pcs_packed: newPcsPacked,
      current_status: 'Siap Packing',
    }).eq('id', packing.produksi_item_id)
  }

  await supabase.from('packing').update({
    voided_at: new Date().toISOString(),
    void_reason: 'DELETED_BY_USER',
  }).eq('id', packingId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE_PACKING', module: 'PACKING', record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}
