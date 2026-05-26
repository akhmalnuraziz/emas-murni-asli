'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BATCH_PREFIX = 'PROD.GDCJ/BATCH'

async function generateBatchCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('batch').select('*', { count: 'exact', head: true })
  return `${BATCH_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
}

async function updateSisaSeharusnya(supabase: any, batchKode: string) {
  const { data: prodList } = await supabase
    .from('produksi_item').select('berat_awal')
    .eq('batch_kode', batchKode).is('voided_at', null)
  const totalTerpakai = (prodList ?? []).reduce((s: number, p: any) => s + (p.berat_awal || 0), 0)
  const { data: batch } = await supabase.from('batch').select('timbangan_akhir').eq('kode', batchKode).single()
  if (batch) {
    await supabase.from('batch').update({
      sisa_bahan_seharusnya: Math.max(0, (batch.timbangan_akhir ?? 0) - totalTerpakai)
    }).eq('kode', batchKode)
  }
}

// Upload foto dari base64 string ke Supabase Storage (server selalu authenticated)
async function uploadBase64Fotos(
  supabase: any, b64Array: string[], prefix: string, existing: string[]
): Promise<{ urls: string[]; uploadError?: string }> {
  const urls: string[] = [...existing]
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_')
  for (let i = 0; i < b64Array.length; i++) {
    const b64 = b64Array[i]
    if (!b64) continue
    try {
      const base64Data = b64.replace(/^data:image\/[^;]+;base64,/, '')
      if (!base64Data) return { urls, uploadError: `Foto ${i+1}: format base64 tidak valid` }
      const buffer = Buffer.from(base64Data, 'base64')
      if (buffer.length === 0) return { urls, uploadError: `Foto ${i+1}: buffer kosong` }
      const path = `batch/${safe}/${Date.now()}_${i}.jpg`
      const { error: storageErr } = await supabase.storage
        .from('emas-fotos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (storageErr) {
        return { urls, uploadError: `Foto ${i+1} gagal upload: ${storageErr.message}` }
      }
      const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
      urls.push(data.publicUrl)
    } catch (err: any) {
      return { urls, uploadError: `Foto ${i+1} error: ${err?.message ?? 'unknown'}` }
    }
  }
  return { urls }
}

export async function createBatch(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const kodeInput = (formData.get('kode') as string)?.trim()
  const kode = kodeInput || await generateBatchCode(supabase)

  if (kodeInput) {
    const { data: existing } = await supabase.from('batch').select('id').eq('kode', kode).single()
    if (existing) return { error: `Kode batch "${kode}" sudah digunakan` }
  }

  const tanggalDatang = formData.get('tanggal_datang') as string
  const tanggalBeli   = formData.get('tanggal_beli') as string
  const beratPusat    = parseFloat(formData.get('bahan_dari_pusat') as string)
  const beratGudang   = parseFloat(formData.get('timbangan_akhir') as string)

  if (!tanggalDatang) return { error: 'Tanggal kedatangan wajib diisi' }
  if (!tanggalBeli)   return { error: 'Tanggal pembelian wajib diisi' }
  if (!beratPusat || beratPusat <= 0) return { error: 'Berat dari pusat wajib diisi' }
  if (!beratGudang || beratGudang <= 0) return { error: 'Berat timbangan gudang wajib diisi' }

  const selisih    = beratPusat - beratGudang
  const catatan    = formData.get('catatan') as string
  if (Math.abs(selisih) > 0.05 && !catatan?.trim()) {
    return { error: 'Selisih berat melewati batas toleransi (>0.05gr) — catatan wajib diisi' }
  }

  const hargaBeli     = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw   = formData.get('biaya_tbh') as string
  const biayaTbh      = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh = biayaTbh.reduce((s: number, b: any) => s + (b.jumlah || 0), 0)
  const totalHpp      = hargaBeli + totalBiayaTbh
  const hppGr         = beratGudang > 0 ? totalHpp / beratGudang : 0

  // Upload foto dari base64
  const existingRaw = formData.get('existing_fotos') as string
  const existing    = existingRaw ? JSON.parse(existingRaw) : []
  const newB64Raw   = formData.get('new_fotos_b64') as string
  const newB64s     = newB64Raw ? JSON.parse(newB64Raw) : []
  const { urls: fotoUrls, uploadError: fotoErr } = await uploadBase64Fotos(supabase, newB64s, kode, existing)
  if (fotoErr) console.error("[createBatch] foto error:", fotoErr)

  const { data, error } = await supabase.from('batch').insert({
    kode,
    nama_batch:            formData.get('nama_batch') as string || kode,
    supplier:              formData.get('supplier') as string || 'GUDANG PUSAT',
    tanggal:               tanggalDatang,
    tanggal_beli:          tanggalBeli,
    bahan_dari_pusat:      beratPusat,
    timbangan_akhir:       beratGudang,
    selisih_berat:         selisih,
    harga_beli:            hargaBeli,
    biaya_tambahan:        biayaTbh,
    total_hpp:             totalHpp,
    hpp_gr:                hppGr,
    catatan:               catatan || null,
    fotos:                 fotoUrls,
    sisa_bahan_seharusnya: beratGudang,
    created_by:            user.id,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_BATCH', module: 'BAHAN_BAKU',
    record_key: kode, after_data: { kode, fotos_count: fotoUrls.length },
  })

  revalidatePath('/bahan-baku')
  return { success: true, kode }
}

export async function updateBatch(batchId: number, batchKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const beratPusat  = parseFloat(formData.get('bahan_dari_pusat') as string)
  const beratGudang = parseFloat(formData.get('timbangan_akhir') as string)
  const selisih     = beratPusat - beratGudang
  const catatan     = formData.get('catatan') as string

  if (Math.abs(selisih) > 0.05 && !catatan?.trim()) {
    return { error: 'Selisih berat melewati batas toleransi — catatan wajib diisi' }
  }

  const hargaBeli     = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw   = formData.get('biaya_tbh') as string
  const biayaTbh      = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh = biayaTbh.reduce((s: number, b: any) => s + (b.jumlah || 0), 0)
  const totalHpp      = hargaBeli + totalBiayaTbh
  const hppGr         = beratGudang > 0 ? totalHpp / beratGudang : 0

  const existingRaw = formData.get('existing_fotos') as string
  const existing    = existingRaw ? JSON.parse(existingRaw) : []
  const newB64Raw   = formData.get('new_fotos_b64') as string
  const newB64s     = newB64Raw ? JSON.parse(newB64Raw) : []
  const fotoUrls    = newB64s.length > 0
    ? await uploadBase64Fotos(supabase, newB64s, batchKode, existing)
    : existing

  const { data: before } = await supabase.from('batch').select('*').eq('id', batchId).single()

  const { error } = await supabase.from('batch').update({
    nama_batch:       formData.get('nama_batch') as string,
    supplier:         formData.get('supplier') as string,
    tanggal:          formData.get('tanggal_datang') as string,
    tanggal_beli:     formData.get('tanggal_beli') as string,
    bahan_dari_pusat: beratPusat,
    timbangan_akhir:  beratGudang,
    selisih_berat:    selisih,
    harga_beli:       hargaBeli,
    biaya_tambahan:   biayaTbh,
    total_hpp:        totalHpp,
    hpp_gr:           hppGr,
    catatan:          catatan || null,
    fotos:            fotoUrls,
  }).eq('id', batchId)

  if (error) return { error: error.message }

  await updateSisaSeharusnya(supabase, batchKode)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_BATCH', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
    before_data: before,
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function deleteBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { count: prodCount } = await supabase.from('produksi_item')
    .select('*', { count: 'exact', head: true }).eq('batch_kode', batchKode).is('voided_at', null)
  if ((prodCount ?? 0) > 0) return { error: `Batch memiliki ${prodCount} data produksi. Hapus produksi terlebih dahulu.` }

  await supabase.from('batch').update({ voided_at: new Date().toISOString(), void_reason: 'DELETED_BY_USER' }).eq('id', batchId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE_BATCH', module: 'BAHAN_BAKU', record_key: batchKode, record_id: String(batchId),
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function lockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  await supabase.from('batch').update({ voided_at: new Date().toISOString(), void_reason: 'LOCKED_BY_USER' }).eq('id', batchId)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'LOCK_BATCH', module: 'BAHAN_BAKU', record_key: batchKode, record_id: String(batchId),
  })
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function unlockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  await supabase.from('batch').update({ voided_at: null, void_reason: null }).eq('id', batchId)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UNLOCK_BATCH', module: 'BAHAN_BAKU', record_key: batchKode, record_id: String(batchId),
  })
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function updateSisaFisik(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const batchId   = parseInt(formData.get('batch_id') as string)
  const batchKode = formData.get('batch_kode') as string
  const sisaFisik = parseFloat(formData.get('sisa_fisik') as string)
  const existingRaw = formData.get('existing_fotos') as string
  const existing  = existingRaw ? JSON.parse(existingRaw) : []
  const newB64Raw = formData.get('new_fotos_b64') as string
  const newB64s   = newB64Raw ? JSON.parse(newB64Raw) : []

  let fotoUrls = existing
  if (newB64s.length > 0) {
    const { urls, uploadError } = await uploadBase64Fotos(supabase, newB64s, `sisa-fisik-${batchKode}`, existing)
    if (uploadError) return { error: `Upload foto gagal: ${uploadError}` }
    fotoUrls = urls
  }

  // Pakai RPC untuk bypass PostgREST schema cache issue
  const { error } = await supabase.rpc('update_sisa_fisik', {
    p_id: batchId,
    p_sisa_fisik: sisaFisik,
    p_fotos: fotoUrls,
  })

  if (error) return { error: `DB error: ${error.message}` }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_SISA_FISIK', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
    after_data: { sisa_fisik: sisaFisik, fotos_uploaded: fotoUrls.length },
  })

  revalidatePath('/bahan-baku')
  return { success: true, fotosCount: fotoUrls.length }
}