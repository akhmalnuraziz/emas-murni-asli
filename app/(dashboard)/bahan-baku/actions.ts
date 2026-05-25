'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// FORMAT KODE BATCH — EDIT DI SINI JIKA MAU UBAH FORMAT
// Format saat ini: PROD.GDCJ/BATCH/0001
// ============================================================
const BATCH_PREFIX = 'PROD.GDCJ/BATCH'

async function generateBatchCode(supabase: any): Promise<string> {
  // Hitung total batch yang pernah ada (termasuk yang dihapus) untuk nomor urut tidak pernah repeat
  const { count } = await supabase
    .from('batch')
    .select('*', { count: 'exact', head: true })
  const nomor = String((count ?? 0) + 1).padStart(4, '0')
  return `${BATCH_PREFIX}/${nomor}`
}

async function uploadFotos(supabase: any, files: File[], batchKode: string): Promise<string[]> {
  const urls: string[] = []
  const safeKode = batchKode.replace(/\//g, '_')
  for (let i = 0; i < Math.min(files.length, 10); i++) {
    const file = files[i]
    if (!file || file.size === 0) continue
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `batch/${safeKode}/${Date.now()}_${i}.${ext}`
    const { error } = await supabase.storage
      .from('emas-fotos')
      .upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
  }
  return urls
}

export async function createBatch(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  // Kode batch — manual atau auto-generate
  const kodeInput = (formData.get('kode') as string)?.trim()
  let kode = kodeInput || await generateBatchCode(supabase)

  // Cek duplikat kode manual
  if (kodeInput) {
    const { data: existing } = await supabase.from('batch').select('id').eq('kode', kode).single()
    if (existing) return { error: `Kode batch "${kode}" sudah digunakan` }
  }

  // Validasi wajib
  const tanggalDatang = formData.get('tanggal_datang') as string
  const tanggalBeli = formData.get('tanggal_beli') as string
  const beratPusat = parseFloat(formData.get('bahan_dari_pusat') as string)
  const beratGudang = parseFloat(formData.get('timbangan_akhir') as string)

  if (!tanggalDatang) return { error: 'Tanggal kedatangan bahan baku wajib diisi' }
  if (!tanggalBeli) return { error: 'Tanggal pembelian / transaksi wajib diisi' }
  if (!beratPusat || beratPusat <= 0) return { error: 'Berat dari pusat / supplier wajib diisi' }
  if (!beratGudang || beratGudang <= 0) return { error: 'Berat timbangan gudang wajib diisi' }

  // HPP = (harga_beli + total_biaya_tambahan) / timbangan_akhir
  const hargaBeli = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw = formData.get('biaya_tbh') as string
  const biayaTbh = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : []
  const totalBiayaTbh = biayaTbh.reduce((sum: number, b: any) => sum + (b.jumlah || 0), 0)
  const totalHpp = hargaBeli + totalBiayaTbh
  const hppGr = beratGudang > 0 ? totalHpp / beratGudang : 0

  // Upload fotos
  const fotoFiles = (formData.getAll('fotos') as File[]).filter(f => f.size > 0)
  const fotoUrls = fotoFiles.length > 0 ? await uploadFotos(supabase, fotoFiles, kode) : []

  const { data, error } = await supabase.from('batch').insert({
    kode,
    nama_batch: (formData.get('nama_batch') as string) || null,
    tanggal: tanggalDatang,
    tanggal_datang: tanggalDatang,
    tanggal_beli: tanggalBeli,
    supplier: (formData.get('supplier') as string) || null,
    bahan_dari_pusat: beratPusat,
    timbangan_akhir: beratGudang,
    sisa_fisik: beratGudang,
    harga_beli: hargaBeli,
    hpp_gr: hppGr,
    biaya_tbh: biayaTbh,
    fotos: fotoUrls,
    catatan: (formData.get('catatan') as string) || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE', module: 'BAHAN_BAKU',
    record_key: kode, record_id: String(data.id), after_data: data,
  })

  revalidatePath('/bahan-baku')
  return { success: true, kode }
}

export async function updateBatch(batchId: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) {
    return { error: 'Tidak memiliki izin untuk mengedit batch' }
  }

  const { data: existing } = await supabase.from('batch').select('*').eq('id', batchId).single()
  if (!existing) return { error: 'Batch tidak ditemukan' }
  if (existing.voided_at) return { error: 'Batch terkunci tidak bisa diedit. Buka kunci dulu.' }

  // Validasi wajib
  const tanggalDatang = formData.get('tanggal_datang') as string
  const tanggalBeli = formData.get('tanggal_beli') as string
  const beratPusat = parseFloat(formData.get('bahan_dari_pusat') as string)
  const beratGudang = parseFloat(formData.get('timbangan_akhir') as string)

  if (!tanggalDatang) return { error: 'Tanggal kedatangan wajib diisi' }
  if (!tanggalBeli) return { error: 'Tanggal pembelian wajib diisi' }
  if (!beratPusat || beratPusat <= 0) return { error: 'Berat pusat / supplier wajib diisi' }
  if (!beratGudang || beratGudang <= 0) return { error: 'Berat gudang wajib diisi' }

  // HPP recalculate
  const hargaBeli = parseFloat(formData.get('harga_beli') as string) || 0
  const biayaTbhRaw = formData.get('biaya_tbh') as string
  const biayaTbh = biayaTbhRaw ? JSON.parse(biayaTbhRaw) : (existing.biaya_tbh ?? [])
  const totalBiayaTbh = biayaTbh.reduce((sum: number, b: any) => sum + (b.jumlah || 0), 0)
  const totalHpp = hargaBeli + totalBiayaTbh
  const hppGr = beratGudang > 0 ? totalHpp / beratGudang : 0

  // Foto: keep existing yang tidak dihapus + tambah baru
  const fotosExistingRaw = formData.get('fotos_existing') as string
  let fotosExisting: string[] = fotosExistingRaw
    ? JSON.parse(fotosExistingRaw)
    : (existing.fotos ?? [])
  const fotoFiles = (formData.getAll('fotos') as File[]).filter(f => f.size > 0)
  if (fotoFiles.length > 0) {
    const newUrls = await uploadFotos(supabase, fotoFiles, existing.kode)
    fotosExisting = [...fotosExisting, ...newUrls].slice(0, 10)
  }

  const { error } = await supabase.from('batch').update({
    nama_batch: (formData.get('nama_batch') as string) || null,
    tanggal: tanggalDatang,
    tanggal_datang: tanggalDatang,
    tanggal_beli: tanggalBeli,
    supplier: (formData.get('supplier') as string) || null,
    bahan_dari_pusat: beratPusat,
    timbangan_akhir: beratGudang,
    harga_beli: hargaBeli,
    hpp_gr: hppGr,
    biaya_tbh: biayaTbh,
    fotos: fotosExisting,
    catatan: (formData.get('catatan') as string) || null,
  }).eq('id', batchId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE', module: 'BAHAN_BAKU',
    record_key: existing.kode, record_id: String(batchId),
    before_data: existing,
    after_data: { tanggal_datang: tanggalDatang, tanggal_beli: tanggalBeli, beratGudang, hargaBeli, hppGr },
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function deleteBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()

  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) {
    return { error: 'Hanya Owner / Admin Pusat yang dapat menghapus batch' }
  }

  const { data: existing } = await supabase
    .from('batch').select('*').eq('id', batchId).single()
  if (!existing) return { error: 'Batch tidak ditemukan' }

  // ============================================================
  // CEK CASCADE — Urutan: Shieldtag → Packing → Produksi
  // Harus bersih semua sebelum batch bisa dihapus
  // ============================================================

  // 1. Cek Shieldtag
  const { count: shieldtagCount } = await supabase
    .from('shieldtag')
    .select('*', { count: 'exact', head: true })
    .eq('batch_kode', batchKode)
    .is('voided_at', null)

  if ((shieldtagCount ?? 0) > 0) {
    return {
      error: `Batch ini memiliki ${shieldtagCount} data shieldtag aktif. Hapus semua shieldtag terkait di modul Shieldtag terlebih dahulu, kemudian hapus data packing, lalu hapus produksi, baru bisa hapus batch ini.`,
      step: 'shieldtag',
      count: shieldtagCount,
    }
  }

  // 2. Cek Packing
  const { count: packingCount } = await supabase
    .from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('batch_kode', batchKode)
    .is('voided_at', null)

  if ((packingCount ?? 0) > 0) {
    return {
      error: `Batch ini memiliki ${packingCount} data packing. Hapus semua data packing terkait di modul Produksi terlebih dahulu, kemudian hapus produksi, baru bisa hapus batch ini.`,
      step: 'packing',
      count: packingCount,
    }
  }

  // 3. Cek Produksi
  const { count: produksiCount } = await supabase
    .from('produksi_item')
    .select('*', { count: 'exact', head: true })
    .eq('batch_kode', batchKode)
    .is('voided_at', null)

  if ((produksiCount ?? 0) > 0) {
    return {
      error: `Batch ini memiliki ${produksiCount} item produksi aktif. Hapus semua data produksi terkait di modul Produksi terlebih dahulu, baru bisa hapus batch ini.`,
      step: 'produksi',
      count: produksiCount,
    }
  }

  // ============================================================
  // AMAN — Tidak ada data terkait, lanjut hapus (soft delete)
  // ============================================================
  const { error } = await supabase.from('batch').update({
    voided_at: new Date().toISOString(),
    void_reason: 'DELETED_BY_USER',
  }).eq('id', batchId)

  if (error) return { error: error.message }

  // Audit log — selalu dicatat
  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: profile?.name,
    user_role: profile?.role,
    action: 'DELETE',
    module: 'BAHAN_BAKU',
    record_key: batchKode,
    record_id: String(batchId),
    before_data: existing,
    reason: `Manual delete oleh ${profile?.role} — tidak ada data produksi terkait`,
  })

  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function lockBatch(batchId: number, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase
    .from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? ''))
    return { error: 'Tidak memiliki izin mengunci batch' }
  const { data: before } = await supabase.from('batch').select('*').eq('id', batchId).single()
  const { error } = await supabase.from('batch')
    .update({ voided_at: new Date().toISOString(), void_reason: 'LOCKED_BY_USER' })
    .eq('id', batchId)
  if (error) return { error: error.message }
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'LOCK_BATCH', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId), before_data: before,
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
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? ''))
    return { error: 'Hanya Owner / Admin Pusat yang dapat membuka kunci batch' }
  const { error } = await supabase.from('batch')
    .update({ voided_at: null, void_reason: null })
    .eq('id', batchId)
  if (error) return { error: error.message }
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UNLOCK_BATCH', module: 'BAHAN_BAKU',
    record_key: batchKode, record_id: String(batchId),
  })
  revalidatePath('/bahan-baku')
  return { success: true }
}
