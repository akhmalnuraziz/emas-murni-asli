'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BATCH_PREFIX = 'PROD.GDCJ/BATCH'

async function generateBatchCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('batch').select('*', { count: 'exact', head: true })
  return `${BATCH_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
}

// Hitung ulang sisa_bahan_seharusnya setelah ada produksi
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

  if (!tanggalDatang)               return { error: 'Tanggal kedatangan wajib diisi' }
  if (!tanggalBeli)                 return { error: 'Tanggal pembelian wajib diisi' }
  if (!beratPusat || beratPusat <= 0) return { error: 'Berat dari pusat wajib diisi' }
  if (!beratGudang || beratGudang <= 0) return { error: 'Berat timbangan gudang wajib diisi' }

  // Selisih = Pusat - Gudang (positif = kiriman lebih berat, negatif = terima kurang)
  const selisih     = beratPusat - beratGudang
  const absSelisih  = Math.abs(selisih)
  const catatan     = formData.get('catatan') as string

  if (absSelisih > 0.05 && !catatan?.trim()) {
    return { error: 'Selisih berat melewati batas toleransi (>0.05gr) — catatan wajib diisi' }
  }

  const hargaBeli      = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw    = formData.get('biaya_tbh') as string
  const biayaTbh       = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh  = biayaTbh.reduce((s: number, b: any) => s + (b.jumlah || 0), 0)
  const totalHpp       = hargaBeli + totalBiayaTbh
  const hppGr          = beratGudang > 0 ? totalHpp / beratGudang : 0

  // Foto — dikirim sebagai URL yang sudah di-upload client-side ke Supabase Storage
  const fotoUrlsRaw = formData.get('foto_urls') as string
  const fotoUrls    = fotoUrlsRaw ? JSON.parse(fotoUrlsRaw) : []

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
    sisa_bahan_seharusnya: beratGudang, // awal = full timbangan gudang
    created_by:            user.id,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_BATCH', module: 'BAHAN_BAKU',
    record_key: kode, after_data: data,
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
  const absSelisih  = Math.abs(selisih)
  const catatan     = formData.get('catatan') as string

  if (absSelisih > 0.05 && !catatan?.trim()) {
    return { error: 'Selisih berat melewati batas toleransi — catatan wajib diisi' }
  }

  const hargaBeli     = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw   = formData.get('biaya_tbh') as string
  const biayaTbh      = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh = biayaTbh.reduce((s: number, b: any) => s + (b.jumlah || 0), 0)
  const totalHpp      = hargaBeli + totalBiayaTbh
  const hppGr         = beratGudang > 0 ? totalHpp / beratGudang : 0

  const fotoUrlsRaw    = formData.get('foto_urls') as string
  const fotoUrls       = fotoUrlsRaw ? JSON.parse(fotoUrlsRaw) : undefined
  const sisaFisikRaw   = formData.get('sisa_fisik') as string
  const sisaFisik      = sisaFisikRaw ? parseFloat(sisaFisikRaw) : null

  const updateData: any = {
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
  }
  if (fotoUrls !== undefined) updateData.fotos = fotoUrls
  if (sisaFisik !== null)     updateData.sisa_fisik = sisaFisik

  const { data: before } = await supabase.from('batch').select('*').eq('id', batchId).single()
  const { error } = await supabase.from('batch').update(updateData).eq('id', batchId)
  if (error) return { error: error.message }

  await updateSisaSeharusnya(supabase, batchKode)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_BATCH', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
    before_data: before, after_data: updateData,
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
  if ((prodCount ?? 0) > 0) {
    return { error: `Batch memiliki ${prodCount} data produksi aktif. Hapus data produksi terlebih dahulu.` }
  }

  const { data: before } = await supabase.from('batch').select('*').eq('id', batchId).single()
  await supabase.from('batch').update({
    voided_at: new Date().toISOString(), void_reason: 'DELETED_BY_USER'
  }).eq('id', batchId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE_BATCH', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId), before_data: before,
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function lockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  await supabase.from('batch').update({
    voided_at: new Date().toISOString(), void_reason: 'LOCKED_BY_USER'
  }).eq('id', batchId)

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

export async function updateSisaFisik(batchId: number, batchKode: string, sisaFisik: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { error } = await supabase.from('batch').update({ sisa_fisik: sisaFisik }).eq('id', batchId)
  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_SISA_FISIK', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
    after_data: { sisa_fisik: sisaFisik },
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}