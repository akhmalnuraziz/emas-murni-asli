'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PROD_PREFIX = 'PROD.GDCJ'
const PCKG_PREFIX = 'PCKG.GDCJ'

async function generateProduksiCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('produksi_item').select('*', { count: 'exact', head: true })
  return `${PROD_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
}

async function generatePackingCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('packing').select('*', { count: 'exact', head: true })
  return `${PCKG_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
}

async function updateBatchSisaSeharusnya(supabase: any, batchKode: string) {
  const { data: produksiList } = await supabase
    .from('produksi_item').select('berat_awal')
    .eq('batch_kode', batchKode).is('voided_at', null)
  const totalTerpakai = (produksiList ?? []).reduce((s: number, p: any) => s + (p.berat_awal || 0), 0)
  const { data: batch } = await supabase.from('batch').select('timbangan_akhir').eq('kode', batchKode).single()
  if (batch) {
    await supabase.from('batch').update({
      sisa_bahan_seharusnya: Math.max(0, (batch.timbangan_akhir ?? 0) - totalTerpakai)
    }).eq('kode', batchKode)
  }
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
      const path = `produksi/${safe}/${Date.now()}_${i}.jpg`
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

async function uploadSignature(supabase: any, dataUrl: string, prefix: string): Promise<string | null> {
  try {
    const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '_')
    const path = `ttd/${safe}/${Date.now()}.png`
    const { error } = await supabase.storage.from('emas-fotos').upload(path, buffer, { contentType: 'image/png', upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
    return data.publicUrl
  } catch { return null }
}

export async function getToleransiLoss(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.from('pengaturan').select('key, value').like('key', 'toleransi_loss%')
  const out: Record<string, number> = {}
  for (const p of data ?? []) {
    const proses = p.key.replace('toleransi_loss_', '')
    out[proses] = parseFloat(p.value) || 0.05
  }
  return out
}

// Simpan approval loss (saat loss > toleransi). Dipanggil dari dalam action terima/selesai.
async function saveLossApproval(supabase: any, params: {
  batchKode: string | null; proses: string; refTable: string; refId: number | null
  timId: number | null; timNama: string | null
  masukGram: number; keluarGram: number; lossGram: number; toleransiGram: number
  alasan: string; ttdOperatorDataUrl: string | null; operatorNama: string | null
  ttdAdminDataUrl: string | null; adminUserId: string | null; adminNama: string | null
}) {
  const ttdOp = params.ttdOperatorDataUrl ? await uploadSignature(supabase, params.ttdOperatorDataUrl, `${params.proses}_op`) : null
  const ttdAd = params.ttdAdminDataUrl ? await uploadSignature(supabase, params.ttdAdminDataUrl, `${params.proses}_admin`) : null
  await supabase.from('loss_approval').insert({
    batch_kode: params.batchKode, proses: params.proses, ref_table: params.refTable, ref_id: params.refId,
    tim_id: params.timId, tim_nama: params.timNama,
    masuk_gram: params.masukGram, keluar_gram: params.keluarGram, loss_gram: params.lossGram, toleransi_gram: params.toleransiGram,
    alasan: params.alasan, ttd_operator_url: ttdOp, operator_nama: params.operatorNama,
    ttd_admin_url: ttdAd, admin_user_id: params.adminUserId, admin_nama: params.adminNama,
  })
}


export async function fetchPeleburanTersedia(batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [] }
  const { data } = await supabase.from('peleburan')
    .select('id, kode, diterima_gram, terpakai_cetak, tanggal_diterima')
    .eq('batch_kode', batchKode).eq('status', 'selesai').is('voided_at', null)
    .order('id')
  const rows = (data ?? []).map(p => ({
    id: p.id, kode: p.kode,
    diterima: Number(p.diterima_gram ?? 0),
    terpakai: Number(p.terpakai_cetak ?? 0),
    sisa: Number(p.diterima_gram ?? 0) - Number(p.terpakai_cetak ?? 0),
  })).filter(p => p.sisa > 0.001)
  return { rows }
}

export async function createProduksi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const batchKode = formData.get('batch_kode') as string
  const gramasi = formData.get('gramasi') as string
  const pcs = parseInt(formData.get('pcs') as string)
  const beratAwal = parseFloat(formData.get('berat_awal') as string)
  const statusAwal = formData.get('status_awal') as string
  const tanggalProduksi = formData.get('tanggal_produksi') as string
  const peleburanId = parseInt(formData.get('peleburan_id') as string) || null

  if (!batchKode) return { error: 'Batch wajib dipilih' }
  if (!gramasi) return { error: 'Gramasi wajib dipilih' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat (serah gram) wajib diisi' }
  if (!statusAwal) return { error: 'Status awal wajib dipilih' }
  if (!tanggalProduksi) return { error: 'Tanggal produksi wajib diisi' }
  if (!peleburanId) return { error: 'Peleburan asal wajib dipilih' }

  const { data: batch } = await supabase.from('batch').select('*').eq('kode', batchKode).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.voided_at && batch.void_reason === 'LOCKED_BY_USER') return { error: 'Batch terkunci' }

  // Ambil peleburan asal & validasi jatah cetak per-peleburan
  const { data: plb } = await supabase.from('peleburan')
    .select('id, kode, diterima_gram, terpakai_cetak, status').eq('id', peleburanId).single()
  if (!plb) return { error: 'Peleburan asal tidak ditemukan' }
  if (plb.status !== 'selesai') return { error: 'Peleburan asal belum selesai' }

  const jatahPLB = Number(plb.diterima_gram ?? 0) - Number(plb.terpakai_cetak ?? 0)
  if (beratAwal > jatahPLB + 0.01) {
    return { error: `Berat melebihi sisa bahan dari peleburan ${plb.kode} (${jatahPLB.toFixed(2)} gr tersisa).` }
  }

  // Bahan total siap cetak (batch level) sebagai guard tambahan
  const bahanSiapCetak = Number(batch.bahan_siap_cetak ?? 0)
  if (beratAwal > bahanSiapCetak + 0.01) {
    return { error: `Berat melebihi bahan siap cetak (${bahanSiapCetak.toFixed(2)} gr tersedia). Lebur bahan terlebih dahulu.` }
  }

  const kode = await generateProduksiCode(supabase)
  const sisaSerbuk = statusAwal === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0

  const targetSelesai = (formData.get('target_selesai') as string) || null

  const jamMulai = (formData.get('jam_mulai') as string) || null
  const pcsVal = pcs && pcs > 0 ? pcs : null   // PCS opsional saat create
  const namaItemBaru = (formData.get('nama_item') as string) || `LM REI ${gramasi}GR`

  const { data: produksi, error } = await supabase.from('produksi_item').insert({
    kode, batch_kode: batchKode, gramasi, pcs: pcsVal, pcs_awal: pcsVal, pcs_good: pcsVal, pcs_reject: 0,
    nama_item: namaItemBaru,
    berat_awal: beratAwal, serah_gram: beratAwal, total_gram: beratAwal, current_status: statusAwal,
    tanggal_produksi: tanggalProduksi, tanggal: tanggalProduksi,
    tanggal_mulai: tanggalProduksi,
    jam_mulai_cutting: jamMulai,
    jam_mulai_produksi: jamMulai,
    target_selesai: targetSelesai,
    peleburan_id: peleburanId,
    peleburan_kode: plb.kode,
    tim_id: formData.get('tim_id') ? Number(formData.get('tim_id')) : null,
    tim_nama: (formData.get('tim_nama') as string) || null,
    memo: formData.get('memo') as string || null,
    operator: formData.get('operator') as string || profile?.name || null,
    catatan: formData.get('catatan') as string || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  // Simpan foto serah ke item agar tampil di kartu alur serah-terima
  if (fotoUrls.length > 0) {
    await supabase.from('produksi_item').update({ foto_serahkan_cutting: fotoUrls }).eq('id', produksi.id)
  }

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksi.id, tanggal: tanggalProduksi,
    status: statusAwal, total_gram: beratAwal, berat_sebelumnya: beratAwal,
    sisa_serbuk: sisaSerbuk, losses: 0,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null, fotos: fotoUrls,
  })

  // Kurangi bahan siap cetak (bahan yang dipakai untuk cetak ini)
  await supabase.from('batch').update({
    bahan_siap_cetak: Math.max(0, bahanSiapCetak - beratAwal)
  }).eq('kode', batchKode)

  // Tambah jatah terpakai pada peleburan asal
  await supabase.from('peleburan').update({
    terpakai_cetak: Number(plb.terpakai_cetak ?? 0) + beratAwal
  }).eq('id', peleburanId)

  await updateBatchSisaSeharusnya(supabase, batchKode)
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE', module: 'PRODUKSI', record_key: kode, record_id: String(produksi.id), after_data: produksi,
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true, kode }
}

export async function updateStatusProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const statusBaru = formData.get('status') as string
  const totalGramBaru = parseFloat(formData.get('total_gram') as string)
  const tanggal = formData.get('tanggal') as string
  const sisaSerbuk = statusBaru === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0
  const jamMulai = (formData.get('jam_mulai') as string) || null

  if (!statusBaru) return { error: 'Status wajib dipilih' }
  if (!totalGramBaru || totalGramBaru <= 0) return { error: 'Total berat wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const beratSebelumnya = produksi.total_gram ?? 0
  const losses = Math.max(0, beratSebelumnya - totalGramBaru - sisaSerbuk)

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-${statusBaru}`) : []

  const fotosSerbukB64Raw = formData.get('fotos_serbuk_b64') as string
  const fotosSerbukB64 = fotosSerbukB64Raw ? JSON.parse(fotosSerbukB64Raw) : []
  const fotoSerbukUrls = fotosSerbukB64.length > 0 ? await uploadBase64Fotos(supabase, fotosSerbukB64, `${produksiKode}-serbuk`) : []

  const kategoriLosses = (formData.get('kategori_losses') as string) || null

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId, tanggal, status: statusBaru,
    total_gram: totalGramBaru, berat_sebelumnya: beratSebelumnya,
    sisa_serbuk: sisaSerbuk, losses,
    kategori_losses: kategoriLosses,
    jam_mulai: jamMulai,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null,
    fotos: fotoUrls,
    fotos_sisa_serbuk: fotoSerbukUrls,
  })

  await supabase.from('produksi_item').update({
    current_status: statusBaru, total_gram: totalGramBaru,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_STATUS', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: { status: produksi.current_status, total_gram: beratSebelumnya },
    after_data: { status: statusBaru, total_gram: totalGramBaru, losses },
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function inputReject(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const pcsReject = parseInt(formData.get('pcs_reject') as string)
  const beratReject = parseFloat(formData.get('berat_reject') as string)

  if (!pcsReject || pcsReject <= 0) return { error: 'PCS reject wajib diisi' }
  if (!beratReject || beratReject <= 0) return { error: 'Berat reject wajib diisi' }

  const pcsGoodNow = produksi.pcs_good ?? produksi.pcs ?? 0
  if (pcsReject > pcsGoodNow) {
    return { error: `PCS reject (${pcsReject}) melebihi PCS good (${pcsGoodNow})` }
  }

  const newPcsGood = pcsGoodNow - pcsReject
  const newTotalGram = Math.max(0, (produksi.total_gram ?? 0) - beratReject)

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId,
    tanggal: formData.get('tanggal') as string || new Date().toISOString().split('T')[0],
    status: 'Reject',
    total_gram: newTotalGram,
    berat_sebelumnya: produksi.total_gram ?? 0,
    sisa_serbuk: 0,
    losses: beratReject,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null,
    fotos: [],
  })

  await supabase.from('produksi_item').update({
    pcs_good: newPcsGood,
    pcs: newPcsGood,
    pcs_reject: (produksi.pcs_reject ?? 0) + pcsReject,
    berat_reject: (produksi.berat_reject ?? 0) + beratReject,
    total_gram: newTotalGram,
    status_reject: 'belum_dilebur',
    current_status: produksi.current_status,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'INPUT_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { pcs_reject: pcsReject, berat_reject: beratReject, pcs_good_remaining: newPcsGood },
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function leburReject(produksiId: number, produksiKode: string, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi || produksi.status_reject !== 'belum_dilebur') return { error: 'Tidak ada reject yang perlu dilebur' }

  // Lebur hanya bagian reject yang BELUM dilebur (total reject - yang sudah dilebur)
  const totalRejectGram   = Number(produksi.berat_reject ?? 0)
  const totalRejectPcs    = Number(produksi.pcs_reject ?? 0)
  const sudahDileburGram  = Number(produksi.berat_reject_dilebur ?? 0)
  const sudahDileburPcs   = Number(produksi.pcs_reject_dilebur ?? 0)
  const beratLebur = Math.max(0, totalRejectGram - sudahDileburGram)
  const pcsLebur   = Math.max(0, totalRejectPcs - sudahDileburPcs)

  if (beratLebur <= 0) return { error: 'Semua reject sudah dilebur' }

  const { data: batch } = await supabase.from('batch').select('bahan_siap_cetak').eq('kode', batchKode).single()
  if (batch) {
    await supabase.from('batch').update({
      bahan_siap_cetak: (batch.bahan_siap_cetak ?? 0) + beratLebur
    }).eq('kode', batchKode)
  }

  await supabase.from('produksi_item').update({
    status_reject: 'sudah_dilebur',
    berat_reject_dilebur: totalRejectGram,
    pcs_reject_dilebur: totalRejectPcs,
  }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'LEBUR_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { berat_kembali: beratLebur, pcs_kembali: pcsLebur, batch_kode: batchKode },
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
}

export async function deleteProduksi(produksiId: number, produksiKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: existing } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!existing) return { error: 'Item produksi tidak ditemukan' }

  // Cek relasi turunan: Packing Log + Shieldtag.
  // Aturan: Shieldtag → Hapus, Packing Log → Hapus, baru Produksi bisa dihapus.
  const { data: packingRows } = await supabase.from('packing')
    .select('id')
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  const packingIds = (packingRows ?? []).map(p => p.id)
  const packingCount = packingIds.length

  let shieldtagCount = 0
  if (packingIds.length > 0) {
    const { count } = await supabase.from('shieldtag')
      .select('*', { count: 'exact', head: true })
      .in('packing_id', packingIds).is('voided_at', null)
    shieldtagCount = count ?? 0
  }

  if (shieldtagCount > 0 || packingCount > 0) {
    return {
      error: 'Proses produksi tidak dapat dihapus karena sudah terhubung dengan Packing Log atau Shieldtag. Silakan hapus data Shieldtag dan Packing Log terlebih dahulu.',
      step: shieldtagCount > 0 ? 'shieldtag' : 'packing',
    }
  }

  await supabase.from('produksi_item').update({
    voided_at: new Date().toISOString(), void_reason: 'DELETED_BY_USER',
  }).eq('id', produksiId)

  // Kembalikan bahan ke siap cetak & jatah peleburan
  const beratAwal = Number(existing.berat_awal ?? 0)
  if (beratAwal > 0 && existing.batch_kode) {
    const { data: b } = await supabase.from('batch').select('bahan_siap_cetak').eq('kode', existing.batch_kode).single()
    if (b) await supabase.from('batch').update({
      bahan_siap_cetak: Number(b.bahan_siap_cetak ?? 0) + beratAwal
    }).eq('kode', existing.batch_kode)
  }
  if (beratAwal > 0 && existing.peleburan_id) {
    const { data: p } = await supabase.from('peleburan').select('terpakai_cetak').eq('id', existing.peleburan_id).single()
    if (p) await supabase.from('peleburan').update({
      terpakai_cetak: Math.max(0, Number(p.terpakai_cetak ?? 0) - beratAwal)
    }).eq('id', existing.peleburan_id)
  }

  if (existing.batch_kode) await updateBatchSisaSeharusnya(supabase, existing.batch_kode)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'DELETE', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId), before_data: existing,
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
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

  if (!produksiItemId) return { error: 'Item produksi wajib dipilih' }
  if (!pcsDispack || pcsDispack <= 0) return { error: 'PCS yang dipack wajib diisi' }
  if (!totalGramAktual || totalGramAktual <= 0) return { error: 'Total gram aktual wajib diisi' }
  if (!tanggal) return { error: 'Tanggal packing wajib diisi' }

  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiItemId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const kode = await generatePackingCode(supabase)
  const selisih = (produksi.total_gram ?? 0) - totalGramAktual

  const { data: packing, error } = await supabase.from('packing').insert({
    kode, produksi_item_id: produksiItemId, batch_kode: produksi.batch_kode,
    gramasi: produksi.gramasi, pcs: pcsDispack, pcs_dipack: pcsDispack,
    total_gram: totalGramAktual, total_gram_aktual: totalGramAktual,
    selisih_gram: selisih, tanggal,
    pic: formData.get('pic') as string || profile?.name || null,
    catatan: formData.get('catatan') as string || null,
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PRODUKSI',
    record_key: kode, record_id: String(packing.id), after_data: packing,
  })

  revalidatePath('/produksi')
  return { success: true, kode }
}

export async function voidPacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  await supabase.from('packing').update({
    voided_at: new Date().toISOString(), void_reason: 'VOIDED_BY_USER',
  }).eq('id', packingId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_PACKING', module: 'PRODUKSI',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function updateSisaFisikBatch(batchKode: string, sisaFisik: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const { error } = await supabase.from('batch').update({ sisa_fisik: sisaFisik }).eq('kode', batchKode)
  if (error) return { error: error.message }
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_SISA_FISIK', module: 'PRODUKSI',
    record_key: batchKode, after_data: { sisa_fisik: sisaFisik },
  })
  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true }
}


export async function selesaiCutting(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const terimaGram    = parseFloat(formData.get('terima_gram') as string)
  const rejectGram    = parseFloat(formData.get('reject_cutting_gram') as string || '0')
  const pcsGood       = parseInt(formData.get('pcs_good') as string || '0') || null
  const pcsReject     = parseInt(formData.get('pcs_reject') as string || '0')
  const jamSelesai    = (formData.get('jam_selesai') as string) || null
  const tanggalSelesai = formData.get('tanggal_selesai') as string
  const catatan       = (formData.get('catatan') as string) || null

  if (!terimaGram || terimaGram < 0) return { error: 'Berat diterima wajib diisi' }
  if (!tanggalSelesai) return { error: 'Tanggal selesai wajib diisi' }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const newFotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-terima`) : []
  // Gabung foto lama (yang dipertahankan saat edit) + foto baru
  const existingFotosRaw = formData.get('existing_fotos') as string
  const existingFotos: string[] = existingFotosRaw ? JSON.parse(existingFotosRaw) : []
  const fotoUrls = [...existingFotos, ...newFotoUrls]

  const { data: produksi } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!produksi) return { error: 'Item tidak ditemukan' }
  const serahGram = produksi.serah_gram ?? produksi.berat_awal ?? 0
  const losses = Math.max(0, serahGram - terimaGram - rejectGram)

  // ── Validasi loss vs toleransi ──────────────────────────────────────────────
  const tolMap = await getToleransiLoss()
  const toleransi = tolMap['cutting'] ?? 0.05
  const lossAlasan = (formData.get('loss_alasan') as string) || ''
  if (losses > toleransi + 0.0001) {
    // Loss melebihi toleransi → wajib alasan + 2 TTD
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Loss ${losses.toFixed(3)}gr melebihi toleransi ${toleransi}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    await saveLossApproval(supabase, {
      batchKode: produksi.batch_kode, proses: 'cutting', refTable: 'produksi_item', refId: produksiId,
      timId: produksi.tim_id ?? null, timNama: produksi.tim_nama ?? null,
      masukGram: serahGram, keluarGram: terimaGram, lossGram: losses, toleransiGram: toleransi,
      alasan: lossAlasan, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || produksi.operator || null,
      ttdAdminDataUrl: ttdAdmin, adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  // Insert event (Diterima Cutting)
  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId,
    tanggal: tanggalSelesai,
    status: 'Cutting',
    total_gram: terimaGram,
    berat_sebelumnya: serahGram,
    sisa_serbuk: rejectGram,
    losses,
    jam_mulai: jamSelesai,
    catatan: catatan
      ? `Serah: ${serahGram}gr | Terima: ${terimaGram}gr | Reject Cutting: ${rejectGram}gr | Losses: ${losses.toFixed(3)}gr | ${catatan}`
      : `Serah: ${serahGram}gr | Terima: ${terimaGram}gr | Reject Cutting: ${rejectGram}gr | Losses: ${losses.toFixed(3)}gr`,
    user_name: profile?.name || null,
    fotos: fotoUrls,
  })

  const isEdit = formData.get('is_edit') === '1'

  // Update produksi_item
  const updateData: any = {
    terima_gram: terimaGram,
    reject_cutting_gram: rejectGram,
    tanggal_selesai: tanggalSelesai,
    jam_selesai: jamSelesai,
    status_cutting: 'selesai',
    total_gram: terimaGram,
    foto_diterima_cutting: fotoUrls,
  }
  // Catatan terima cutting → simpan ke item agar tampil di kartu
  if (catatan) updateData.catatan = catatan
  if (pcsGood && pcsGood > 0) {
    updateData.pcs_good = pcsGood
    updateData.pcs = pcsGood
  }
  // Tim & admin dari form standar (terima_*)
  if (formData.get('terima_tim_id')) { updateData.tim_id = Number(formData.get('terima_tim_id')); updateData.tim_nama = (formData.get('terima_tim_nama') as string) || null }
  if (formData.get('terima_tim_anggota_aktif')) updateData.tim_anggota_aktif = formData.get('terima_tim_anggota_aktif') as string
  if (formData.get('terima_admin_input')) updateData.admin_input = formData.get('terima_admin_input') as string

  // Reject cutting → akumulasi total berat_reject.
  // Saat edit: ganti kontribusi cutting lama (reject_cutting_gram lama) dengan yang baru.
  const rejectCuttingLama = Number(produksi.reject_cutting_gram ?? 0)
  const beratRejectTotalLama = Number(produksi.berat_reject ?? 0)
  if (isEdit) {
    const beratRejectBaru = Math.max(0, beratRejectTotalLama - rejectCuttingLama + rejectGram)
    updateData.berat_reject = beratRejectBaru
    updateData.status_reject = beratRejectBaru > 0 ? 'belum_dilebur' : (produksi.status_reject ?? null)
  } else if (rejectGram > 0 || pcsReject > 0) {
    updateData.pcs_reject    = Number(produksi.pcs_reject ?? 0) + pcsReject
    updateData.berat_reject  = beratRejectTotalLama + rejectGram
    updateData.status_reject = 'belum_dilebur'
  }
  await supabase.from('produksi_item').update(updateData).eq('id', produksiId)

  revalidatePath('/produksi')
  return { success: true }
}

export async function editProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const gramasi        = formData.get('gramasi') as string
  const pcsRaw         = formData.get('pcs') as string
  const pcs            = pcsRaw ? parseInt(pcsRaw) : null
  const beratAwal      = parseFloat(formData.get('berat_awal') as string)
  const operator       = formData.get('operator') as string
  const catatan        = formData.get('catatan') as string
  const tanggal        = formData.get('tanggal_produksi') as string
  const memo           = formData.get('memo') as string
  const targetSelesai  = (formData.get('target_selesai') as string) || null

  if (!gramasi) return { error: 'Gramasi wajib diisi' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const { data: before } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()

  // PCS wajib HANYA jika sudah Diterima (cutting selesai). Jika masih Diserahkan, PCS opsional.
  const sudahDiterima = before?.status_cutting === 'selesai' || (before?.terima_gram != null)
  if (sudahDiterima && (!pcs || pcs <= 0)) return { error: 'PCS wajib diisi (barang sudah diterima)' }

  // Foto serahkan: gabung existing yang dipertahankan + upload baru
  const existingSerahRaw = formData.get('existing_fotos_serah') as string
  const existingSerah: string[] = existingSerahRaw ? JSON.parse(existingSerahRaw) : (Array.isArray(before?.foto_serahkan_cutting) ? before.foto_serahkan_cutting : [])
  const newSerahRaw = formData.get('foto_serahkan_b64') as string
  const newSerahB64 = newSerahRaw ? JSON.parse(newSerahRaw) : []
  const newSerahUrls = newSerahB64.length > 0 ? await uploadBase64Fotos(supabase, newSerahB64, `${produksiKode}-serah-edit`) : []
  const fotoSerahFinal = [...existingSerah, ...newSerahUrls]

  const namaItemBaru = (formData.get('nama_item') as string) || `LM REI ${gramasi}GR`
  const updateData: any = {
    gramasi, berat_awal: beratAwal,
    serah_gram: beratAwal, total_gram: beratAwal,
    nama_item: namaItemBaru,
    operator: operator || null, catatan: catatan || null,
    tanggal_produksi: tanggal, tanggal, memo: memo || null,
    target_selesai: targetSelesai,
    foto_serahkan_cutting: fotoSerahFinal,
  }
  if (pcs && pcs > 0) { updateData.pcs = pcs; updateData.pcs_awal = pcs; updateData.pcs_good = pcs }
  const { error } = await supabase.from('produksi_item').update(updateData).eq('id', produksiId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: before, after_data: { gramasi, pcs, berat_awal: beratAwal, operator, tanggal },
  })

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Serah ke tahap berikutnya ────────────────────────────────────────────────
export async function serahStageProduksi(
  produksiId: number, produksiKode: string, tahap: string, formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name').eq('id', user.id).single()
  const { data: item } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!item) return { error: 'Item tidak ditemukan' }

  // Ambil data serah dari tahap sebelumnya
  let serahGram = 0
  let serahPcs = item.pcs_good ?? item.pcs ?? 0
  const tahapMap: Record<string,string> = { pas_berat: 'Cutting', annealing: 'Pas Berat', siap_packing: 'Annealing' }
  const nextStatusMap: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }

  if (tahap === 'pas_berat') {
    serahGram = Number(item.terima_gram ?? item.total_gram ?? 0)
    serahPcs  = item.pcs_good ?? item.pcs ?? 0
  } else {
    // Ambil dari stage_handover tahap sebelumnya
    const prevTahapMap: Record<string,string> = { annealing: 'pas_berat', siap_packing: 'annealing' }
    const prevTahap = prevTahapMap[tahap]
    if (prevTahap) {
      const { data: prev } = await supabase.from('stage_handover')
        .select('*').eq('produksi_item_id', produksiId).eq('tahap', prevTahap)
        .eq('status','selesai').is('voided_at',null).single()
      serahGram = Number(prev?.terima_gram ?? item.total_gram ?? 0)
      serahPcs  = prev?.terima_pcs ?? item.pcs_good ?? item.pcs ?? 0
    }
  }

  const serahTanggal = (formData.get('serah_tanggal') as string) || new Date().toISOString().split('T')[0]
  const serahJam     = (formData.get('serah_jam') as string) || null
  const serahOp      = (formData.get('serah_operator') as string) || (formData.get('serah_operator_manual') as string) || profile?.name || null
  const serahCatatan = (formData.get('serah_catatan') as string) || null
  const serahTimId   = formData.get('serah_tim_id') ? Number(formData.get('serah_tim_id')) : null
  const serahTimNama = (formData.get('serah_tim_nama') as string) || null

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-serah-${tahap}`) : []

  // Cek apakah sudah ada handover di tahap ini
  const { data: existing } = await supabase.from('stage_handover')
    .select('id').eq('produksi_item_id', produksiId).eq('tahap', tahap).is('voided_at', null).maybeSingle()
  if (existing) return { error: `Handover ${tahap} sudah ada` }

  await supabase.from('stage_handover').insert({
    produksi_item_id: produksiId, tahap,
    serah_gram: serahGram, serah_pcs: serahPcs,
    serah_tanggal: serahTanggal, serah_jam: serahJam,
    serah_operator: serahOp, serah_catatan: serahCatatan,
    serah_fotos: fotoUrls, status: 'proses',
    tim_id: serahTimId, tim_nama: serahTimNama,
    serah_admin_input: (formData.get('serah_admin_input') as string) || null,
    tim_anggota_aktif: (formData.get('serah_tim_anggota_aktif') as string) || null,
  })

  // Update current_status
  const nextStatus = nextStatusMap[tahap]
  if (nextStatus) {
    await supabase.from('produksi_item').update({ current_status: nextStatus }).eq('id', produksiId)
  }

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Terima di tahap ini ──────────────────────────────────────────────────────
export async function terimaStageProduksi(
  handoverId: number, produksiId: number, produksiKode: string, tahap: string, formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name').eq('id', user.id).single()
  const { data: item } = await supabase.from('produksi_item').select('total_gram, pcs_good, pcs').eq('id', produksiId).single()

  const terimaGram     = parseFloat(formData.get('terima_gram') as string)
  const terimaPcs      = parseInt(formData.get('terima_pcs') as string || '0') || null
  const terimaTanggal  = formData.get('terima_tanggal') as string
  const terimaJam      = (formData.get('terima_jam') as string) || null
  const terimaOp       = (formData.get('terima_operator') as string) || profile?.name || null
  const terimaCatatan  = (formData.get('terima_catatan') as string) || null
  const terimaTimId    = formData.get('terima_tim_id') ? Number(formData.get('terima_tim_id')) : null
  const terimaTimNama  = (formData.get('terima_tim_nama') as string) || null
  const sisaSerbuk     = tahap === 'pas_berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0
  const rejectGram     = parseFloat(formData.get('reject_gram') as string || '0') || 0
  const rejectPcs      = parseInt(formData.get('reject_pcs') as string || '0') || 0

  if (!terimaGram || terimaGram < 0) return { error: 'Berat diterima wajib diisi' }
  if (!terimaTanggal) return { error: 'Tanggal diterima wajib diisi' }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-terima-${tahap}`) : []

  // Handle items without serah (old items) — create combined record
  const createSerahFirst = formData.get('create_serah_first') === '1'
  let targetHandoverId = handoverId

  if (createSerahFirst || handoverId === 0) {
    const serahGram = parseFloat(formData.get('serah_gram') as string || '0') || (item?.total_gram ?? 0)
    const serahPcs  = parseInt(formData.get('serah_pcs') as string || '0') || (item?.pcs_good ?? item?.pcs ?? 0)
    const { data: newH } = await supabase.from('stage_handover').insert({
      produksi_item_id: produksiId, tahap,
      serah_gram: serahGram, serah_pcs: serahPcs,
      serah_tanggal: terimaTanggal, status: 'proses',
    }).select('id').single()
    targetHandoverId = newH?.id ?? 0
    // update status first
    const nextStatusMap: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
    const ns = nextStatusMap[tahap]
    if (ns) await supabase.from('produksi_item').update({ current_status: ns }).eq('id', produksiId)
  }

  if (!targetHandoverId) return { error: 'Handover tidak ditemukan' }

  // ── Validasi loss vs toleransi ──────────────────────────────────────────────
  const { data: hCur } = await supabase.from('stage_handover').select('serah_gram, produksi_item:produksi_item_id(batch_kode)').eq('id', targetHandoverId).single()
  const serahGramStage = Number(hCur?.serah_gram ?? 0)
  const lossStage = Math.max(0, serahGramStage - terimaGram - rejectGram - sisaSerbuk)
  const tolMap = await getToleransiLoss()
  const toleransiStage = tolMap[tahap] ?? 0.05
  const lossAlasan = (formData.get('loss_alasan') as string) || ''
  if (lossStage > toleransiStage + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Loss ${lossStage.toFixed(3)}gr melebihi toleransi ${toleransiStage}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    const { data: itemBatch } = await supabase.from('produksi_item').select('batch_kode').eq('id', produksiId).single()
    await saveLossApproval(supabase, {
      batchKode: itemBatch?.batch_kode ?? null, proses: tahap, refTable: 'stage_handover', refId: targetHandoverId,
      timId: terimaTimId, timNama: terimaTimNama,
      masukGram: serahGramStage, keluarGram: terimaGram, lossGram: lossStage, toleransiGram: toleransiStage,
      alasan: lossAlasan, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || terimaOp,
      ttdAdminDataUrl: ttdAdmin, adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  // Update stage_handover record
  await supabase.from('stage_handover').update({
    terima_gram: terimaGram, terima_pcs: terimaPcs,
    terima_tanggal: terimaTanggal, terima_jam: terimaJam,
    terima_operator: terimaOp, terima_catatan: terimaCatatan,
    terima_fotos: fotoUrls,
    sisa_serbuk: sisaSerbuk, reject_gram: rejectGram, reject_pcs: rejectPcs,
    status: 'selesai',
    terima_admin_input: (formData.get('terima_admin_input') as string) || null,
    ...(terimaTimId ? { tim_id: terimaTimId, tim_nama: terimaTimNama } : {}),
  }).eq('id', targetHandoverId)

  // Update produksi_item total_gram
  const updateData: any = { total_gram: terimaGram }
  if (terimaPcs && terimaPcs > 0) { updateData.pcs_good = terimaPcs }
  if (rejectPcs > 0 || rejectGram > 0) {
    // Akumulatif: reject dari stage ini ditambahkan ke total reject item
    // (detail per-stage tetap tersimpan di stage_handover.reject_gram/reject_pcs)
    const { data: cur } = await supabase.from('produksi_item')
      .select('berat_reject, pcs_reject').eq('id', produksiId).single()
    updateData.berat_reject  = Number(cur?.berat_reject ?? 0) + rejectGram
    updateData.pcs_reject    = Number(cur?.pcs_reject ?? 0) + rejectPcs
    updateData.status_reject = 'belum_dilebur'
  }
  await supabase.from('produksi_item').update(updateData).eq('id', produksiId)

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Void/batalkan handover ───────────────────────────────────────────────────
export async function editSerahStage(
  handoverId: number, produksiKode: string, tahap: string, formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serahGram    = parseFloat(formData.get('serah_gram') as string) || 0
  const serahTanggal = (formData.get('serah_tanggal') as string) || null
  const serahJam     = (formData.get('serah_jam') as string) || null
  const serahOp      = (formData.get('serah_operator') as string) || null
  const serahCatatan = (formData.get('serah_catatan') as string) || null
  const serahTimId   = formData.get('serah_tim_id') ? Number(formData.get('serah_tim_id')) : null
  const serahTimNama = (formData.get('serah_tim_nama') as string) || null

  // Foto: gabung existing + baru
  const { data: cur } = await supabase.from('stage_handover').select('serah_fotos').eq('id', handoverId).single()
  const existing: string[] = Array.isArray(cur?.serah_fotos) ? cur.serah_fotos : []
  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-serah-${tahap}-edit`) : []

  await supabase.from('stage_handover').update({
    serah_gram: serahGram, serah_tanggal: serahTanggal, serah_jam: serahJam,
    serah_operator: serahOp, serah_catatan: serahCatatan,
    tim_id: serahTimId, tim_nama: serahTimNama,
    serah_admin_input: (formData.get('serah_admin_input') as string) || null,
    tim_anggota_aktif: (formData.get('serah_tim_anggota_aktif') as string) || null,
    serah_fotos: [...existing, ...fotoUrls],
  }).eq('id', handoverId)

  revalidatePath('/produksi')
  return { success: true }
}

export async function resetCutting(produksiId: number, produksiKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { data: item } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!item) return { error: 'Item tidak ditemukan' }

  // Tidak boleh hapus kalau sudah lanjut ke tahap berikutnya (ada stage handover aktif)
  const { count: shCount } = await supabase.from('stage_handover')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  if ((shCount ?? 0) > 0) {
    return { error: 'Tidak dapat menghapus Cutting karena sudah lanjut ke tahap berikutnya. Hapus proses Pas Berat/Annealing/Siap Packing terlebih dahulu.' }
  }
  // Tidak boleh kalau sudah ada packing
  const { count: pkCount } = await supabase.from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  if ((pkCount ?? 0) > 0) {
    return { error: 'Tidak dapat menghapus Cutting karena sudah ada Packing Log. Hapus Packing Log terlebih dahulu.' }
  }

  // Kembalikan kontribusi reject cutting dari total berat_reject
  const rejectCuttingLama = Number(item.reject_cutting_gram ?? 0)
  const beratRejectBaru = Math.max(0, Number(item.berat_reject ?? 0) - rejectCuttingLama)

  // Reset data penerimaan cutting → balik ke proses
  await supabase.from('produksi_item').update({
    terima_gram: null, reject_cutting_gram: 0, tanggal_selesai: null, jam_selesai: null,
    status_cutting: 'proses', current_status: 'Cutting',
    foto_diterima_cutting: [], catatan_terima: null,
    berat_reject: beratRejectBaru,
    total_gram: item.serah_gram ?? item.berat_awal,
  }).eq('id', produksiId)

  // Void event diterima cutting
  await supabase.from('produksi_event')
    .update({ voided_at: new Date().toISOString() })
    .eq('produksi_item_id', produksiId).eq('status', 'Cutting').not('jam_mulai', 'is', null)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'RESET_CUTTING', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
  })

  revalidatePath('/produksi')
  return { success: true }
}

export async function voidStageHandover(
  handoverId: number, produksiId: number, tahap: string, alasan: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const prevStatusMap: Record<string,string> = {
    pas_berat: 'Cutting', annealing: 'Pas Berat', siap_packing: 'Annealing'
  }
  await supabase.from('stage_handover').update({
    voided_at: new Date().toISOString(), void_reason: alasan
  }).eq('id', handoverId)

  // Revert produksi_item status
  const prevStatus = prevStatusMap[tahap]
  if (prevStatus) {
    await supabase.from('produksi_item').update({ current_status: prevStatus }).eq('id', produksiId)
  }

  revalidatePath('/produksi')
  return { success: true }
}










