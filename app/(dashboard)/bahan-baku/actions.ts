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
        .from('fotos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (storageErr) {
        return { urls, uploadError: `Foto ${i+1} gagal upload: ${storageErr.message}` }
      }
      const { data } = supabase.storage.from('fotos').getPublicUrl(path)
      urls.push(data.publicUrl)
    } catch (err: any) {
      return { urls, uploadError: `Foto ${i+1} error: ${err?.message ?? 'unknown'}` }
    }
  }
  return { urls }
}

// Upload tanda tangan PNG (loss approval peleburan)
async function uploadSignaturePlb(supabase: any, dataUrl: string, prefix: string): Promise<string | null> {
  try {
    const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
    if (!base64Data) return null
    const buffer = Buffer.from(base64Data, 'base64')
    const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_')
    const path = `ttd/${safe}/${Date.now()}.png`
    const { error } = await supabase.storage.from('fotos').upload(path, buffer, { contentType: 'image/png', upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('fotos').getPublicUrl(path)
    return data.publicUrl
  } catch { return null }
}

// Ambil toleransi loss peleburan dari pengaturan
async function getToleransiPeleburan(supabase: any): Promise<number> {
  const { data } = await supabase.from('pengaturan').select('value').eq('key', 'toleransi_loss_peleburan').maybeSingle()
  return parseFloat(data?.value ?? '0.05') || 0.05
}

export async function createBatch(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Hanya Owner/Admin Pusat yang bisa membuat batch bahan baku' }

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
  const selisihPersen = beratGudang > 0 ? Math.abs(selisih) / beratGudang * 100 : 0
  if (selisihPersen > 5)
    return { error: `Selisih (${selisih.toFixed(3)}gr = ${selisihPersen.toFixed(2)}%) melebihi batas 5%. Periksa data timbangan.` }
  if (Math.abs(selisih) > 0.05 && !catatan?.trim())
    return { error: 'Selisih melebihi toleransi — catatan wajib diisi' }

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
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Hanya Owner/Admin Pusat yang bisa update batch bahan baku' }

  const beratPusat  = parseFloat(formData.get('bahan_dari_pusat') as string)
  const beratGudang = parseFloat(formData.get('timbangan_akhir') as string)
  const selisih     = beratPusat - beratGudang
  const catatan     = formData.get('catatan') as string
  const selisihPct  = beratGudang > 0 ? Math.abs(selisih) / beratGudang * 100 : 0
  if (selisihPct > 5)
    return { error: `Selisih (${selisih.toFixed(3)}gr = ${selisihPct.toFixed(2)}%) melebihi batas 5%. Periksa data timbangan.` }
  if (Math.abs(selisih) > 0.05 && !catatan?.trim())
    return { error: 'Selisih melebihi toleransi — catatan wajib diisi' }

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

  await supabase.from('batch').update({
    status:      'terkunci',
    locked_at:   new Date().toISOString(),
    locked_by:   user.id,
    lock_reason: 'LOCKED_BY_USER',
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

  await supabase.from('batch').update({ status: 'aktif', locked_at: null, locked_by: null, lock_reason: null }).eq('id', batchId)
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
  const catatanSisaFisik = formData.get('catatan_sisa_fisik') as string || null

  const { error } = await supabase.rpc('update_sisa_fisik', {
    p_id: batchId,
    p_sisa_fisik: sisaFisik,
    p_fotos: fotoUrls,
  })

  if (error) return { error: `DB error: ${error.message}` }

  if (catatanSisaFisik !== null) {
    await supabase.from('batch').update({ catatan_sisa_fisik: catatanSisaFisik || null }).eq('id', batchId)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_SISA_FISIK', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
    after_data: { sisa_fisik: sisaFisik, fotos_uploaded: fotoUrls.length },
  })

  revalidatePath('/bahan-baku')
  return { success: true, fotosCount: fotoUrls.length }
}

export async function hapusSisaFisik(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { error } = await supabase.rpc('update_sisa_fisik', {
    p_id: batchId,
    p_sisa_fisik: null,
    p_fotos: [],
  })
  if (error) return { error: `DB error: ${error.message}` }

  await supabase.from('batch').update({ catatan_sisa_fisik: null }).eq('id', batchId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'HAPUS_SISA_FISIK', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function createPeleburan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const batchKode  = formData.get('batch_kode') as string
  const tanggal    = formData.get('tanggal') as string
  const jamMulai   = formData.get('jam_mulai') as string || null
  const operator   = formData.get('operator') as string || null
  const keterangan = formData.get('keterangan_serahkan') as string || null

  if (!batchKode) return { error: 'Batch wajib dipilih' }
  if (!tanggal)   return { error: 'Tanggal mulai wajib diisi' }
  if (!jamMulai)  return { error: 'Jam mulai wajib diisi' }

  // ── Parse sumber bahan ──────────────────────────────────────────────────
  type SumberItem = {
    tipe: 'batch_mentah' | 'sisa_peleburan' | 'reject_cutting'
    ref_id: string | null
    ref_label: string
    gram_otomatis: number
    gram_aktual: number
  }
  const sumberRaw  = formData.get('sumber_json') as string
  const sumberList: SumberItem[] = sumberRaw ? JSON.parse(sumberRaw) : []

  if (sumberList.length === 0) return { error: 'Minimal satu sumber bahan harus dipilih' }

  const totalDikasih    = sumberList.reduce((s, x) => s + Number(x.gram_aktual), 0)
  const sumberBatchGram = sumberList.filter(x => x.tipe === 'batch_mentah')
                                    .reduce((s, x) => s + Number(x.gram_aktual), 0)
  const sumberLeburGram = sumberList.filter(x => x.tipe === 'sisa_peleburan')
                                    .reduce((s, x) => s + Number(x.gram_aktual), 0)

  if (totalDikasih <= 0) return { error: 'Total bahan dikasih harus lebih dari 0' }

  const { data: batchRow } = await supabase.from('batch')
    .select('sisa_bahan_seharusnya, bahan_siap_cetak, timbangan_akhir').eq('kode', batchKode).single()

  // Validasi: timbangan naik pada batch_mentah → wajib keterangan
  if (sumberBatchGram > 0) {
    const sisaTersedia = Number(batchRow?.sisa_bahan_seharusnya ?? 0)
    if (sumberBatchGram > sisaTersedia && !keterangan)
      return { error: `Timbangan naik ${(sumberBatchGram - sisaTersedia).toFixed(3)} gr dari sisa batch (${sisaTersedia.toFixed(3)} gr). Wajib isi Keterangan.` }
  }

  // Validasi: lebur ulang hasil lebur tidak boleh melebihi bahan_siap_cetak
  if (sumberLeburGram > 0) {
    const siapCetak = Number(batchRow?.bahan_siap_cetak ?? 0)
    if (sumberLeburGram > siapCetak + 0.01)
      return { error: `Hasil lebur yang dilebur ulang (${sumberLeburGram.toFixed(3)} gr) melebihi yang tersedia (${siapCetak.toFixed(3)} gr).` }
  }

  // ── Upload foto ──────────────────────────────────────────────────────────
  const fotosRaw = formData.get('foto_serahkan_b64') as string
  const fotosB64 = fotosRaw ? JSON.parse(fotosRaw) : []
  const { urls: fotoUrls } = fotosB64.length > 0
    ? await uploadBase64Fotos(supabase, fotosB64, batchKode + '_plb', [])
    : { urls: [] as string[] }

  // ── Generate kode ────────────────────────────────────────────────────────
  const { count } = await supabase.from('peleburan').select('*', { count: 'exact', head: true })
  const kode = `PLB.GDCJ/${String((count ?? 0) + 1).padStart(4, '0')}`

  // ── Insert peleburan ─────────────────────────────────────────────────────
  const { data, error } = await supabase.from('peleburan').insert({
    kode, batch_kode: batchKode,
    tanggal, jam_mulai: jamMulai,
    dikasih_gram: totalDikasih,
    sumber_batch_gram: sumberBatchGram,
    diterima_gram: null,
    operator, keterangan_serahkan: keterangan,
    foto_serahkan: fotoUrls,
    status: 'proses',
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // ── Insert sumber records ────────────────────────────────────────────────
  if (sumberList.length > 0) {
    await supabase.from('peleburan_sumber').insert(
      sumberList.map(s => ({
        peleburan_id: data.id,
        tipe:         s.tipe,
        ref_id:       s.ref_id,
        ref_label:    s.ref_label,
        gram_otomatis: s.gram_otomatis,
        gram_aktual:   s.gram_aktual,
      }))
    )
  }

  // ── Lebur ulang hasil lebur → kurangi bahan_siap_cetak ───────────────────
  if (sumberLeburGram > 0) {
    const siapCetakNow = Number(batchRow?.bahan_siap_cetak ?? 0)
    await supabase.from('batch').update({
      bahan_siap_cetak: Math.max(0, siapCetakNow - sumberLeburGram)
    }).eq('kode', batchKode)
  }

  // ── Update reject items → sudah_dilebur ──────────────────────────────────
  const rejectIds = sumberList
    .filter(s => s.tipe === 'reject_cutting' && s.ref_id)
    .map(s => parseInt(s.ref_id!))
  if (rejectIds.length > 0)
    await supabase.from('produksi_item').update({ status_reject: 'sudah_dilebur' }).in('id', rejectIds)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE', module: 'peleburan', record_key: kode, record_id: String(data.id),
    after_data: { batch_kode: batchKode, dikasih: totalDikasih, sumber_count: sumberList.length, status: 'proses' },
  })

  revalidatePath('/bahan-baku')
  revalidatePath('/produksi')
  return { success: true, kode, id: data.id }
}

export async function selesaiLebur(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const diterima        = parseFloat(formData.get('diterima_gram') as string)
  const tanggalTerima   = formData.get('tanggal_diterima') as string
  const jamSelesai      = formData.get('jam_selesai') as string || null
  const operatorTerima  = formData.get('operator_diterima') as string || null
  const keteranganTrm   = formData.get('keterangan_diterima') as string || null

  if (!diterima || diterima <= 0) return { error: 'Berat diterima wajib diisi' }
  if (!tanggalTerima)             return { error: 'Tanggal diterima wajib diisi' }
  if (!jamSelesai)                return { error: 'Jam selesai wajib diisi' }

  const { data: plb } = await supabase.from('peleburan').select('dikasih_gram, kode, batch_kode, diterima_gram, status, tim_id, tim_nama').eq('id', id).single()
  if (!plb) return { error: 'Peleburan tidak ditemukan' }
  if (diterima > plb.dikasih_gram) return { error: 'Diterima tidak boleh melebihi dikasih' }

  // ── Validasi loss vs toleransi peleburan ────────────────────────────────────
  const lossLebur = Math.max(0, Number(plb.dikasih_gram) - diterima)
  const toleransiLebur = await getToleransiPeleburan(supabase)
  const lossAlasan = (formData.get('loss_alasan') as string) || ''
  if (lossLebur > toleransiLebur + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Loss ${lossLebur.toFixed(3)}gr melebihi toleransi ${toleransiLebur}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib (loss melebihi toleransi).' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib (loss melebihi toleransi).' }
    const ttdOpUrl = await uploadSignaturePlb(supabase, ttdOp, `${plb.kode}_op`)
    const ttdAdminUrl = await uploadSignaturePlb(supabase, ttdAdmin, `${plb.kode}_admin`)
    await supabase.from('loss_approval').insert({
      batch_kode: plb.batch_kode, proses: 'peleburan', ref_table: 'peleburan', ref_id: id,
      tim_id: plb.tim_id ?? null, tim_nama: plb.tim_nama ?? null,
      masuk_gram: plb.dikasih_gram, keluar_gram: diterima, loss_gram: lossLebur, toleransi_gram: toleransiLebur,
      alasan: lossAlasan,
      ttd_operator_url: ttdOpUrl, operator_nama: (formData.get('loss_operator_nama') as string) || operatorTerima,
      ttd_admin_url: ttdAdminUrl, admin_user_id: user.id, admin_nama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  const fotosRaw  = formData.get('foto_diterima_b64') as string
  const fotosB64  = fotosRaw ? JSON.parse(fotosRaw) : []
  const { urls: fotoUrls } = fotosB64.length > 0
    ? await uploadBase64Fotos(supabase, fotosB64, plb.kode + '_done', [])
    : { urls: [] }

  const { error } = await supabase.from('peleburan').update({
    diterima_gram: diterima,
    tanggal_diterima: tanggalTerima,
    jam_selesai: jamSelesai,
    operator_diterima: operatorTerima,
    keterangan_diterima: keteranganTrm,
    foto_diterima: fotoUrls,
    status: 'selesai',
  }).eq('id', id)

  if (error) return { error: error.message }

  // ── Hasil lebur jadi bahan siap cetak ────────────────────────────────────
  // Jika sebelumnya sudah selesai (re-edit), tambahkan hanya selisihnya
  if (plb.batch_kode) {
    const sudahMasuk = (plb.status === 'selesai' && plb.diterima_gram) ? Number(plb.diterima_gram) : 0
    const tambahan = diterima - sudahMasuk
    if (tambahan !== 0) {
      const { data: batch } = await supabase.from('batch').select('bahan_siap_cetak').eq('kode', plb.batch_kode).single()
      await supabase.from('batch').update({
        bahan_siap_cetak: Math.max(0, Number(batch?.bahan_siap_cetak ?? 0) + tambahan)
      }).eq('kode', plb.batch_kode)
    }
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT', module: 'peleburan', record_key: plb.kode, record_id: String(id),
    after_data: { diterima, losses: Number(plb.dikasih_gram) - diterima, status: 'selesai' },
  })

  revalidatePath('/bahan-baku')
  revalidatePath('/produksi')
  return { success: true }
}

export async function editPeleburan(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const dikasih   = parseFloat(formData.get('dikasih_gram') as string)
  const tanggal   = formData.get('tanggal') as string
  const jamMulai  = formData.get('jam_mulai') as string || null
  const operator  = formData.get('operator') as string || null
  const keterangan = formData.get('keterangan_serahkan') as string || null

  if (!dikasih || dikasih <= 0) return { error: 'Berat diserahkan wajib diisi' }
  if (!tanggal)                  return { error: 'Tanggal mulai wajib diisi' }
  if (!jamMulai)                 return { error: 'Jam mulai wajib diisi' }

  const { data: plb } = await supabase.from('peleburan').select('kode, dikasih_gram, batch_kode, diterima_gram').eq('id', id).single()
  if (!plb) return { error: 'Peleburan tidak ditemukan' }
  if (plb.diterima_gram && dikasih < plb.diterima_gram)
    return { error: `Dikasih tidak boleh kurang dari diterima (${plb.diterima_gram} gr)` }

  // Handle sisa bahan jika dikasih berubah
  const selisih = dikasih - Number(plb.dikasih_gram)
  if (selisih !== 0) {
    const { data: batch } = await supabase.from('batch').select('sisa_bahan_seharusnya').eq('kode', plb.batch_kode).single()
    const sisaBaru = Number(batch?.sisa_bahan_seharusnya ?? 0) - selisih
    // Timbangan naik diizinkan — keterangan sudah divalidasi di client
    await supabase.from('batch').update({ sisa_bahan_seharusnya: sisaBaru }).eq('kode', plb.batch_kode)
  }

  // Handle foto serahkan - keep existing + add new
  const existingRaw = formData.get('existing_fotos') as string
  const existing = existingRaw ? JSON.parse(existingRaw) : []
  const newFotosRaw = formData.get('foto_serahkan_b64') as string
  const newFotosB64 = newFotosRaw ? JSON.parse(newFotosRaw) : []
  const { urls: fotoUrls } = newFotosB64.length > 0
    ? await uploadBase64Fotos(supabase, newFotosB64, plb.kode + '_edit', existing)
    : { urls: existing }

  const updatePayload: any = {
    dikasih_gram: dikasih, tanggal, jam_mulai: jamMulai,
    operator, keterangan_serahkan: keterangan,
    foto_serahkan: fotoUrls,
  }

  // ── Handle bagian DITERIMA (jika peleburan sudah selesai) ────────────────
  const diterimaRaw = formData.get('diterima_gram') as string
  if (diterimaRaw !== null && diterimaRaw !== '') {
    const diterimaBaru = parseFloat(diterimaRaw)
    if (diterimaBaru > dikasih) return { error: `Diterima tidak boleh melebihi dikasih (${dikasih} gr)` }

    // foto diterima
    const existingDtRaw = formData.get('existing_fotos_diterima') as string
    const existingDt = existingDtRaw ? JSON.parse(existingDtRaw) : []
    const newDtRaw = formData.get('foto_diterima_b64') as string
    const newDtB64 = newDtRaw ? JSON.parse(newDtRaw) : []
    const { urls: fotoDtUrls } = newDtB64.length > 0
      ? await uploadBase64Fotos(supabase, newDtB64, plb.kode + '_done_edit', existingDt)
      : { urls: existingDt }

    updatePayload.diterima_gram      = diterimaBaru
    updatePayload.tanggal_diterima   = formData.get('tanggal_diterima') as string || null
    updatePayload.jam_selesai        = formData.get('jam_selesai') as string || null
    updatePayload.operator_diterima  = formData.get('operator_diterima') as string || null
    updatePayload.keterangan_diterima = formData.get('keterangan_diterima') as string || null
    updatePayload.foto_diterima      = fotoDtUrls

    // Sesuaikan bahan_siap_cetak: ganti kontribusi lama dengan baru
    const diterimaLama = Number(plb.diterima_gram ?? 0)
    const selisihDiterima = diterimaBaru - diterimaLama
    if (selisihDiterima !== 0 && plb.batch_kode) {
      const { data: b } = await supabase.from('batch').select('bahan_siap_cetak').eq('kode', plb.batch_kode).single()
      await supabase.from('batch').update({
        bahan_siap_cetak: Math.max(0, Number(b?.bahan_siap_cetak ?? 0) + selisihDiterima)
      }).eq('kode', plb.batch_kode)
    }
  }

  const { error } = await supabase.from('peleburan').update(updatePayload).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT', module: 'peleburan', record_key: plb.kode, record_id: String(id),
    before_data: { dikasih_gram: plb.dikasih_gram }, after_data: { dikasih_gram: dikasih },
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function voidPeleburan(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  // Cek tidak ada produksi item yang pakai peleburan ini
  const { count } = await supabase.from('produksi_item')
    .select('*', { count: 'exact', head: true })
    .eq('peleburan_id', id).is('voided_at', null)
  if ((count ?? 0) > 0) return { error: 'Tidak bisa void: ada item produksi yang menggunakan peleburan ini' }

  const { data: plb } = await supabase.from('peleburan').select('kode').eq('id', id).single()
  await supabase.from('peleburan').update({ voided_at: new Date().toISOString(), void_reason: reason }).eq('id', id)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID', module: 'peleburan', record_key: plb?.kode ?? '', record_id: String(id), reason,
  })

  revalidatePath('/bahan-baku')
  revalidatePath('/produksi')
  return { success: true }
}

export async function getPeleburanByBatch(batchKode: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('peleburan')
    .select('id, kode, tanggal, dikasih_gram, diterima_gram, losses_gram, operator, catatan, voided_at')
    .eq('batch_kode', batchKode)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}



