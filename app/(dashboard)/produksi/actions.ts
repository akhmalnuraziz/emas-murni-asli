'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'
import { syncSerbukScrap, voidScrapBySumberRef } from '@/lib/scrap-sync'

const PROD_PREFIX = 'PROD.GDCJ'
const PCKG_PREFIX = 'PCKG.GDCJ'

async function generateProduksiCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'produksi' })
  return `${PROD_PREFIX}/${String(data ?? 1).padStart(4, '0')}`
}

async function generatePackingCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'packing' })
  return `${PCKG_PREFIX}/${String(data ?? 1).padStart(4, '0')}`
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
  const { decodeAndValidateBase64Image, sanitizePathSegment } = await import('@/lib/upload-validation')
  const urls: string[] = []
  const safe = sanitizePathSegment(prefix)
  for (let i = 0; i < b64Array.length; i++) {
    const b64 = b64Array[i]
    if (!b64) continue
    try {
      const { buffer, ext, contentType } = decodeAndValidateBase64Image(b64)
      // Crypto-random suffix to avoid collision when 2 concurrent uploads race on Date.now()
      const rand = Math.random().toString(36).slice(2, 8)
      const path = `produksi/${safe}/${Date.now()}_${i}_${rand}.${ext}`
      const { error } = await supabase.storage
        .from('emas-fotos').upload(path, buffer, { contentType, upsert: false })
      if (!error) {
        const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
        urls.push(data.publicUrl)
      } else {
        console.error('[uploadBase64Fotos] storage error:', error.message, 'path:', path)
      }
    } catch (err: any) {
      console.error('[uploadBase64Fotos] validation failed:', err?.message ?? err)
    }
  }
  return urls
}

async function uploadSignature(supabase: any, dataUrl: string, prefix: string): Promise<string | null> {
  try {
    const { decodeAndValidateBase64Image, sanitizePathSegment } = await import('@/lib/upload-validation')
    const { buffer, ext } = decodeAndValidateBase64Image(dataUrl, { allow: ['png', 'jpeg', 'webp'], maxBytes: 500_000 })
    const safe = sanitizePathSegment(prefix)
    const path = `ttd/${safe}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('emas-fotos').upload(path, buffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true })
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
  const rows = (data ?? []).map((p: any) => ({
    id: p.id, kode: p.kode,
    diterima: Number(p.diterima_gram ?? 0),
    terpakai: Number(p.terpakai_cetak ?? 0),
    sisa: Number(p.diterima_gram ?? 0) - Number(p.terpakai_cetak ?? 0),
  })).filter((p: any) => p.sisa > 0.001)
  return { rows }
}

export async function createProduksi(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const batchKode = formData.get('batch_kode') as string
  const beratAwal = parseFloat(formData.get('berat_awal') as string)
  const statusAwal = formData.get('status_awal') as string
  const tanggalProduksi = formData.get('tanggal_produksi') as string
  const peleburanId = parseInt(formData.get('peleburan_id') as string) || null

  if (!batchKode) return { error: 'Batch wajib dipilih' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat (serah gram) wajib diisi' }
  if (!statusAwal) return { error: 'Status awal wajib dipilih' }
  if (!tanggalProduksi) return { error: 'Tanggal produksi wajib diisi' }
  if (!peleburanId) return { error: 'Peleburan asal wajib dipilih' }

  const { data: batch } = await supabase.from('batch').select('*').eq('kode', batchKode).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.voided_at && batch.void_reason === 'LOCKED_BY_USER') return { error: 'Batch terkunci' }

  const { data: plb } = await supabase.from('peleburan')
    .select('id, kode, diterima_gram, terpakai_cetak, status').eq('id', peleburanId).single()
  if (!plb) return { error: 'Peleburan asal tidak ditemukan' }
  if (plb.status !== 'selesai') return { error: 'Peleburan asal belum selesai' }

  const jatahPLB = Number(plb.diterima_gram ?? 0) - Number(plb.terpakai_cetak ?? 0)
  if (beratAwal > jatahPLB + 0.01) {
    return { error: `Berat melebihi sisa bahan dari peleburan ${plb.kode} (${jatahPLB.toFixed(2)} gr tersisa).` }
  }

  const bahanSiapCetak = Number(batch.bahan_siap_cetak ?? 0)
  if (beratAwal > bahanSiapCetak + 0.01) {
    return { error: `Berat melebihi bahan siap cetak (${bahanSiapCetak.toFixed(2)} gr tersedia). Lebur bahan terlebih dahulu.` }
  }

  const sisaSerbuk = statusAwal === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0
  const targetSelesai = (formData.get('target_selesai') as string) || null
  const jamMulai = (formData.get('jam_mulai') as string) || null
  const namaItem = (formData.get('nama_item') as string) || ''
  const catatan = formData.get('catatan') as string || null
  const operator = formData.get('operator') as string || profile?.name || null

  const kode = await generateProduksiCode(supabase)

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  const { data: produksi, error } = await supabase.from('produksi_item').insert({
    kode, batch_kode: batchKode,
    gramasi: null,
    nama_item: namaItem,
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
    tim_anggota_aktif: (formData.get('tim_anggota_aktif') as string) || null,
    admin_input: (formData.get('admin_input') as string) || null,
    memo: formData.get('memo') as string || null,
    operator, catatan, created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  if (fotoUrls.length > 0) {
    await supabase.from('produksi_item').update({ foto_serahkan_cutting: fotoUrls }).eq('id', produksi.id)
  }

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksi.id, tanggal: tanggalProduksi,
    status: statusAwal, total_gram: beratAwal, berat_sebelumnya: beratAwal,
    sisa_serbuk: sisaSerbuk, losses: 0, catatan,
    user_name: profile?.name || null, fotos: fotoUrls,
  })

  await supabase.from('batch').update({
    bahan_siap_cetak: Math.max(0, bahanSiapCetak - beratAwal)
  }).eq('kode', batchKode)

  await supabase.from('peleburan').update({
    terpakai_cetak: Number(plb.terpakai_cetak ?? 0) + beratAwal
  }).eq('id', peleburanId)

  await updateBatchSisaSeharusnya(supabase, batchKode)

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE', module: 'PRODUKSI', record_key: kode, record_id: String(produksi.id), after_data: produksi,
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')

  createNotif({
    judul: `Item Produksi Baru — ${kode}`,
    pesan: `Dari batch ${batchKode} · ${beratAwal}gr (gramasi menyusul saat diterima)`,
    tipe: 'info',
    link: '/produksi',
    untuk_role: ['owner', 'manager', 'spv', 'admin_produksi'],
  })

  return { success: true, kode, count: 1 }
}

export async function updateStatusProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const [{ data: profile }, { data: produksi }] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user.id).single(),
    supabase.from('produksi_item').select('*').eq('id', produksiId).single(),
  ])
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }

  const statusBaru = formData.get('status') as string
  const isReject = formData.get('is_reject') === '1' || statusBaru === 'Reject'
  const tanggal = formData.get('tanggal') as string
  const jamMulai = (formData.get('jam_mulai') as string) || null

  if (!statusBaru) return { error: 'Status wajib dipilih' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const beratSebelumnya = Number(produksi.total_gram ?? 0)

  if (isReject) {
    // ── Reject path ──────────────────────────────────────────────────────────
    const pcsReject  = parseInt(formData.get('pcs_reject') as string)
    const beratReject = parseFloat(formData.get('berat_reject') as string)
    if (!pcsReject  || pcsReject  <= 0) return { error: 'PCS reject wajib diisi' }
    if (!beratReject || beratReject <= 0) return { error: 'Berat reject wajib diisi' }
    const pcsGoodNow  = Number(produksi.pcs_good ?? produksi.pcs ?? 0)
    if (pcsReject > pcsGoodNow) return { error: `PCS reject (${pcsReject}) melebihi PCS good (${pcsGoodNow})` }

    const newTotalGram = Math.max(0, beratSebelumnya - beratReject)

    await Promise.all([
      supabase.from('produksi_event').insert({
        produksi_item_id: produksiId, tanggal, status: 'Reject',
        total_gram: newTotalGram, berat_sebelumnya: beratSebelumnya,
        losses: beratReject, jam_mulai: jamMulai,
        catatan: formData.get('catatan') as string || null,
        user_name: profile?.name || null,
      }),
      supabase.from('produksi_item').update({
        current_status: produksi.current_status,
        total_gram: newTotalGram,
        pcs_reject: (Number(produksi.pcs_reject) || 0) + pcsReject,
        pcs_good: pcsGoodNow - pcsReject,
        berat_reject: (Number(produksi.berat_reject) || 0) + beratReject,
        status_reject: 'belum_dilebur',
      }).eq('id', produksiId),
    ])

    supabase.from('audit_log').insert({
      user_id: user.id, user_name: profile?.name, user_role: profile?.role,
      action: 'INPUT_REJECT', module: 'PRODUKSI',
      record_key: produksiKode, record_id: String(produksiId),
      after_data: { pcs_reject: pcsReject, berat_reject: beratReject, new_total_gram: newTotalGram },
    })

    revalidatePath('/produksi')
    revalidatePath('/bahan-baku')
    return { success: true }
  }

  // ── Normal status update path ────────────────────────────────────────────
  const totalGramBaru = parseFloat(formData.get('total_gram') as string)
  const sisaSerbuk = statusBaru === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0
  if (!totalGramBaru || totalGramBaru <= 0) return { error: 'Total berat wajib diisi' }

  const losses = Math.max(0, beratSebelumnya - totalGramBaru - sisaSerbuk)

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-${statusBaru}`) : []

  const fotosSerbukB64Raw = formData.get('fotos_serbuk_b64') as string
  const fotosSerbukB64 = fotosSerbukB64Raw ? JSON.parse(fotosSerbukB64Raw) : []
  const fotoSerbukUrls = fotosSerbukB64.length > 0 ? await uploadBase64Fotos(supabase, fotosSerbukB64, `${produksiKode}-serbuk`) : []

  const kategoriLosses = (formData.get('kategori_losses') as string) || null

  await Promise.all([
    supabase.from('produksi_event').insert({
      produksi_item_id: produksiId, tanggal, status: statusBaru,
      total_gram: totalGramBaru, berat_sebelumnya: beratSebelumnya,
      sisa_serbuk: sisaSerbuk, losses,
      kategori_losses: kategoriLosses,
      jam_mulai: jamMulai,
      catatan: formData.get('catatan') as string || null,
      user_name: profile?.name || null,
      fotos: fotoUrls,
      fotos_sisa_serbuk: fotoSerbukUrls,
    }),
    supabase.from('produksi_item').update({
      current_status: statusBaru, total_gram: totalGramBaru,
    }).eq('id', produksiId),
  ])

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'UPDATE_STATUS', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: { status: produksi.current_status, total_gram: beratSebelumnya },
    after_data: { status: statusBaru, total_gram: totalGramBaru, losses },
  })

  revalidatePath('/produksi')

  if (statusBaru === 'Siap Packing') {
    createNotif({
      judul: `Siap Packing — ${produksiKode}`,
      pesan: `${produksi.gramasi}gr dari batch ${produksi.batch_kode} · ${totalGramBaru}gr siap dipacking`,
      tipe: 'success',
      link: '/produksi',
      untuk_role: ['owner', 'manager', 'spv', 'admin_produksi'],
    })
  } else if (statusBaru === 'Reject') {
    createNotif({
      judul: `Reject — ${produksiKode}`,
      pesan: `${produksi.gramasi}gr dari batch ${produksi.batch_kode} · belum dilebur`,
      tipe: 'warning',
      link: '/produksi',
      untuk_role: ['owner', 'manager', 'spv'],
    })
  }

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

  supabase.from('audit_log').insert({
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
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }
  // ROLE_CHECK_DISABLED: 
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

  supabase.from('audit_log').insert({
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
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  const { data: existing } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!existing) return { error: 'Item produksi tidak ditemukan' }

  // Cek relasi turunan: Packing Log + Shieldtag.
  // Aturan: Shieldtag → Hapus, Packing Log → Hapus, baru Produksi bisa dihapus.
  const { data: packingRows } = await supabase.from('packing')
    .select('id')
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  const packingIds = (packingRows ?? []).map((p: any) => p.id)
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

  // Cek reject sudah masuk peleburan aktif
  const { data: rejectLeburRows } = await supabase
    .from('peleburan_sumber')
    .select('id, peleburan:peleburan_id(voided_at)')
    .eq('tipe', 'reject_cutting')
    .eq('ref_id', String(produksiId))
  const activeRejectLebur = (rejectLeburRows ?? []).filter((r: any) => !r.peleburan?.voided_at)
  if (activeRejectLebur.length > 0) {
    return { error: 'Tidak bisa hapus — reject dari item ini sudah masuk Peleburan. Void Peleburan terkait terlebih dahulu.' }
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

  supabase.from('audit_log').insert({
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

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PRODUKSI',
    record_key: kode, record_id: String(packing.id), after_data: packing,
  })

  createNotif({
    judul: `Packing Selesai — ${kode}`,
    pesan: `${pcsDispack} pcs ${produksi.gramasi}gr dari batch ${produksi.batch_kode} · ${totalGramAktual}gr`,
    tipe: 'success',
    link: '/packing-log',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/produksi')
  return { success: true, kode }
}

export async function voidPacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  await supabase.from('packing').update({
    voided_at: new Date().toISOString(), void_reason: 'VOIDED_BY_USER',
  }).eq('id', packingId)

  supabase.from('audit_log').insert({
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
  supabase.from('audit_log').insert({
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
  const existingFotosRaw = formData.get('existing_fotos') as string
  const existingFotos: string[] = existingFotosRaw ? JSON.parse(existingFotosRaw) : []

  // Paralelkan: profile + produksi_item + toleransi + foto upload
  const [{ data: profile }, { data: produksi }, tolMap, newFotoUrls] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user.id).single(),
    supabase.from('produksi_item').select('*').eq('id', produksiId).single(),
    getToleransiLoss(),
    fotosB64.length > 0 ? uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-terima`) : Promise.resolve([] as string[]),
  ])

  const fotoUrls = [...existingFotos, ...newFotoUrls]
  if (!produksi) return { error: 'Item tidak ditemukan' }
  const serahGram = produksi.serah_gram ?? produksi.berat_awal ?? 0
  const losses = Math.max(0, serahGram - terimaGram - rejectGram)

  // ── Validasi loss vs toleransi ──────────────────────────────────────────────
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

  // ── Validasi gain (timbangan naik): terima + reject > serah ────────────────
  const gainCut = Math.max(0, (terimaGram + rejectGram) - serahGram)
  if (gainCut > toleransi + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Timbangan naik ${gainCut.toFixed(3)}gr melebihi toleransi ${toleransi}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    await saveLossApproval(supabase, {
      batchKode: produksi.batch_kode, proses: 'cutting', refTable: 'produksi_item', refId: produksiId,
      timId: produksi.tim_id ?? null, timNama: produksi.tim_nama ?? null,
      masukGram: serahGram, keluarGram: terimaGram + rejectGram, lossGram: gainCut, toleransiGram: toleransi,
      alasan: `[Timbangan naik +${gainCut.toFixed(3)}gr] ${lossAlasan}`, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || produksi.operator || null,
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
  // Catatan terima cutting → kolom terpisah agar tidak menimpa catatan serah
  if (catatan) updateData.catatan_terima = catatan
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

  createNotif({
    judul: `Cutting Selesai — ${produksiKode}`,
    pesan: `Terima ${terimaGram}gr · Reject ${rejectGram}gr · Loss ${losses.toFixed(2)}gr`,
    tipe: 'produksi',
    link: '/produksi',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  return { success: true }
}

export async function editProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

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

  const newSerahRaw = formData.get('foto_serahkan_b64') as string
  const newSerahB64 = newSerahRaw ? JSON.parse(newSerahRaw) : []

  const [{ data: profile }, { data: before }, newSerahUrls] = await Promise.all([
    supabase.from('users_profile').select('name, role').eq('id', user.id).single(),
    supabase.from('produksi_item').select('*').eq('id', produksiId).single(),
    newSerahB64.length > 0 ? uploadBase64Fotos(supabase, newSerahB64, `${produksiKode}-serah-edit`) : Promise.resolve([] as string[]),
  ])

  // PCS wajib HANYA jika sudah Diterima (cutting selesai). Jika masih Diserahkan, PCS opsional.
  const sudahDiterima = before?.status_cutting === 'selesai' || (before?.terima_gram != null)
  if (sudahDiterima && (!pcs || pcs <= 0)) return { error: 'PCS wajib diisi (barang sudah diterima)' }

  // Foto serahkan: gabung existing yang dipertahankan + upload baru
  const existingSerahRaw = formData.get('existing_fotos_serah') as string
  const existingSerah: string[] = existingSerahRaw ? JSON.parse(existingSerahRaw) : (Array.isArray(before?.foto_serahkan_cutting) ? before.foto_serahkan_cutting : [])
  const fotoSerahFinal = [...existingSerah, ...newSerahUrls]

  const namaItemBaru = (formData.get('nama_item') as string) || `LM REI ${gramasi}GR`
  const timIdEdit = formData.get('tim_id') ? Number(formData.get('tim_id')) : undefined
  const timNamaEdit = (formData.get('tim_nama') as string) || undefined
  const timAnggotaEdit = (formData.get('tim_anggota_aktif') as string) || undefined
  const adminInputEdit = (formData.get('admin_input') as string) || undefined
  const updateData: any = {
    gramasi, berat_awal: beratAwal,
    serah_gram: beratAwal, total_gram: sudahDiterima ? (Number(before?.terima_gram) || beratAwal) : beratAwal,
    nama_item: namaItemBaru,
    operator: formData.get('operator') as string || operator || null,
    catatan: catatan || null,
    tanggal_produksi: tanggal, tanggal, memo: memo || null,
    target_selesai: targetSelesai,
    foto_serahkan_cutting: fotoSerahFinal,
    ...(timIdEdit !== undefined && { tim_id: timIdEdit }),
    ...(timNamaEdit !== undefined && { tim_nama: timNamaEdit }),
    ...(timAnggotaEdit !== undefined && { tim_anggota_aktif: timAnggotaEdit }),
    ...(adminInputEdit !== undefined && { admin_input: adminInputEdit }),
  }
  if (pcs && pcs > 0) { updateData.pcs = pcs; updateData.pcs_awal = pcs; updateData.pcs_good = pcs }
  const { error } = await supabase.from('produksi_item').update(updateData).eq('id', produksiId)

  if (error) return { error: error.message }

  supabase.from('audit_log').insert({
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

  const [{ data: profile }, { data: item }] = await Promise.all([
    supabase.from('users_profile').select('name').eq('id', user.id).single(),
    supabase.from('produksi_item').select('*').eq('id', produksiId).single(),
  ])
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

  const terimaGram     = parseFloat(formData.get('terima_gram') as string)
  const terimaPcs      = parseInt(formData.get('terima_pcs') as string || '0') || null
  const terimaTanggal  = formData.get('terima_tanggal') as string
  const terimaJam      = (formData.get('terima_jam') as string) || null
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
  const existingFotosRaw = formData.get('existing_fotos') as string
  const existingTerimaFotos: string[] = existingFotosRaw ? JSON.parse(existingFotosRaw) : []

  // Paralelkan: profile + produksi_item + toleransi + foto upload
  const [{ data: profile }, { data: item }, tolMap, newFotoUrls] = await Promise.all([
    supabase.from('users_profile').select('name').eq('id', user.id).single(),
    supabase.from('produksi_item').select('total_gram, pcs_good, pcs, batch_kode, gramasi').eq('id', produksiId).single(),
    getToleransiLoss(),
    fotosB64.length > 0 ? uploadBase64Fotos(supabase, fotosB64, `${produksiKode}-terima-${tahap}`) : Promise.resolve([] as string[]),
  ])

  const terimaOp = (formData.get('terima_operator') as string) || profile?.name || null
  const fotoUrls = [...existingTerimaFotos, ...newFotoUrls]

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

  // ── Validasi gain (timbangan naik): total keluar > serah → wajib disetujui ──
  const gainStage = Math.max(0, (terimaGram + rejectGram + sisaSerbuk) - serahGramStage)
  if (gainStage > toleransiStage + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Timbangan naik ${gainStage.toFixed(3)}gr melebihi toleransi ${toleransiStage}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    const { data: itemBatch } = await supabase.from('produksi_item').select('batch_kode').eq('id', produksiId).single()
    await saveLossApproval(supabase, {
      batchKode: itemBatch?.batch_kode ?? null, proses: tahap, refTable: 'stage_handover', refId: targetHandoverId,
      timId: terimaTimId, timNama: terimaTimNama,
      masukGram: serahGramStage, keluarGram: terimaGram + rejectGram + sisaSerbuk, lossGram: gainStage, toleransiGram: toleransiStage,
      alasan: `[Timbangan naik +${gainStage.toFixed(3)}gr] ${lossAlasan}`, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || terimaOp,
      ttdAdminDataUrl: ttdAdmin, adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  // Serbuk Pas Berat otomatis masuk Scrap Inventory (upsert — edit tersinkron).
  // Dijalankan sebelum update handover supaya error validasi tidak menyisakan data setengah jalan.
  if (tahap === 'pas_berat') {
    const sync = await syncSerbukScrap(supabase, {
      sumberRef: `SH:${targetHandoverId}`,
      batchKode: (item as any)?.batch_kode ?? null,
      gramasi: (item as any)?.gramasi != null ? String((item as any).gramasi) : null,
      berat: sisaSerbuk,
      tanggal: terimaTanggal,
      admin: (formData.get('terima_admin_input') as string) || null,
      createdBy: user.id,
    })
    if (sync.error) return { error: sync.error }
    revalidatePath('/scrap')
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
  if (sisaSerbuk > 0) updateData.sisa_serbuk = sisaSerbuk
  if (rejectPcs > 0 || rejectGram > 0) {
    // Akumulatif: reject dari stage ini ditambahkan ke total reject item
    // (detail per-stage tetap tersimpan di stage_handover.reject_gram/reject_pcs)
    const { data: cur } = await supabase.from('produksi_item')
      .select('berat_reject, pcs_reject').eq('id', produksiId).single()
    updateData.berat_reject  = Number(cur?.berat_reject ?? 0) + rejectGram
    updateData.pcs_reject    = Number(cur?.pcs_reject ?? 0) + rejectPcs
    updateData.status_reject = 'belum_dilebur'
  }
  const { error: updErr } = await supabase.from('produksi_item').update(updateData).eq('id', produksiId)
  if (updErr) return { error: `Gagal update produksi_item: ${updErr.message}` }

  revalidatePath('/produksi')

  const TAHAP_LABEL: Record<string, string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  createNotif({
    judul: `${TAHAP_LABEL[tahap] ?? tahap} Selesai — ${produksiKode}`,
    pesan: `Terima ${terimaGram}gr${rejectGram > 0 ? ` · Reject ${rejectGram}gr` : ''}`,
    tipe: tahap === 'siap_packing' ? 'success' : 'produksi',
    link: '/produksi',
    untuk_role: ['owner', 'manager', 'spv'],
  })

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

  // Tidak boleh kalau reject sudah masuk peleburan aktif
  const { data: rcRows } = await supabase
    .from('peleburan_sumber')
    .select('id, peleburan:peleburan_id(voided_at)')
    .eq('tipe', 'reject_cutting')
    .eq('ref_id', String(produksiId))
  const activeRC = (rcRows ?? []).filter((r: any) => !r.peleburan?.voided_at)
  if (activeRC.length > 0) {
    return { error: 'Tidak dapat menghapus Cutting — reject dari item ini sudah masuk Peleburan. Void Peleburan terkait terlebih dahulu.' }
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

  supabase.from('audit_log').insert({
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

  // Serbuk scrap dari handover ini ikut di-void (diblokir jika sudah terpakai di peleburan)
  if (tahap === 'pas_berat') {
    const v = await voidScrapBySumberRef(supabase, `SH:${handoverId}`, 'HANDOVER_DIVOID')
    if (v.error) return { error: v.error }
    revalidatePath('/scrap')
  }

  await supabase.from('stage_handover').update({
    voided_at: new Date().toISOString(), void_reason: alasan
  }).eq('id', handoverId)

  // Dynamically determine what to revert to based on remaining active handovers
  const STAGE_ORDER = ['pas_berat', 'annealing', 'siap_packing']
  const STAGE_STATUS: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
  const { data: remaining } = await supabase.from('stage_handover')
    .select('tahap, status').eq('produksi_item_id', produksiId).is('voided_at', null)
  const lastDone = (remaining ?? [])
    .filter(h => h.status === 'selesai')
    .sort((a,b) => STAGE_ORDER.indexOf(b.tahap) - STAGE_ORDER.indexOf(a.tahap))[0]
  // If there are handovers in proses (not selesai), stay at that stage's status
  const inProses = (remaining ?? []).find(h => h.status === 'proses')
  const prevStatus = inProses
    ? STAGE_STATUS[inProses.tahap]
    : lastDone
      ? STAGE_STATUS[lastDone.tahap]
      : 'Cutting' // fallback: revert to Cutting if no active handovers remain
  await supabase.from('produksi_item').update({ current_status: prevStatus }).eq('id', produksiId)

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Terima Cutting: single item (no gramasi yet) → pick gramasi & split ─────
export async function terimaCuttingItem(itemId: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { data: item } = await supabase.from('produksi_item').select('*').eq('id', itemId).is('voided_at', null).single()
  if (!item) return { error: 'Item tidak ditemukan' }

  const tanggalSelesai = formData.get('tanggal_selesai') as string
  const jamSelesai = (formData.get('jam_selesai') as string) || null
  const rejectTotal = parseFloat(formData.get('reject_cutting_gram') as string || '0')
  if (!tanggalSelesai) return { error: 'Tanggal selesai wajib diisi' }

  type GramasiRow = { gramasi: string; pcs: number; acc_gram: number; catatan: string | null }
  const gramasiList: GramasiRow[] = JSON.parse(formData.get('gramasi_list') as string || '[]')
  if (!gramasiList.length || gramasiList.some(r => !r.gramasi || !r.acc_gram)) return { error: 'Gramasi & berat ACC wajib diisi' }
  const gramasis = gramasiList.map(r => r.gramasi)
  if (new Set(gramasis).size !== gramasis.length) return { error: 'Tidak boleh ada gramasi yang sama' }

  const allFotosB64Raw = formData.get('fotos_b64') as string
  const allFotosB64: Record<string, string[]> = allFotosB64Raw ? JSON.parse(allFotosB64Raw) : {}

  // Tim Yang Mengerjakan + anggota PIC + admin penerima dari form (fallback ke data item)
  const terimaTimId = formData.get('terima_tim_id') ? Number(formData.get('terima_tim_id')) : (item.tim_id ?? null)
  const terimaTimNama = (formData.get('terima_tim_nama') as string) || item.tim_nama || null
  const terimaAnggota = (formData.get('terima_tim_anggota_aktif') as string) || item.tim_anggota_aktif || null
  const terimaAdmin = (formData.get('terima_admin_input') as string) || item.admin_input || null

  const totalAcc = gramasiList.reduce((s, r) => s + r.acc_gram, 0)
  const beratSerahBatch = Number(item.berat_awal ?? 0)

  const serahGram = Number(item.serah_gram ?? item.berat_awal ?? 0)

  // ── Validasi loss vs toleransi (loss seluruh batch cutting) ──────────────────
  const totalLoss = Math.max(0, serahGram - totalAcc - rejectTotal)
  const tolMap = await getToleransiLoss()
  const toleransiCut = tolMap['cutting'] ?? 0.05
  const lossAlasan = (formData.get('loss_alasan') as string) || ''
  if (totalLoss > toleransiCut + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Loss ${totalLoss.toFixed(3)}gr melebihi toleransi ${toleransiCut}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    await saveLossApproval(supabase, {
      batchKode: item.batch_kode, proses: 'cutting', refTable: 'produksi_item', refId: itemId,
      timId: item.tim_id ?? null, timNama: item.tim_nama ?? null,
      masukGram: serahGram, keluarGram: totalAcc, lossGram: totalLoss, toleransiGram: toleransiCut,
      alasan: lossAlasan, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || item.operator || null,
      ttdAdminDataUrl: ttdAdmin, adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  // ── Validasi gain (timbangan naik): total ACC + reject > serah ─────────────
  const totalGain = Math.max(0, (totalAcc + rejectTotal) - serahGram)
  if (totalGain > toleransiCut + 0.0001) {
    const ttdOp = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    if (!lossAlasan.trim()) return { error: `Timbangan naik ${totalGain.toFixed(3)}gr melebihi toleransi ${toleransiCut}gr. Alasan wajib diisi.` }
    if (!ttdOp) return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
    await saveLossApproval(supabase, {
      batchKode: item.batch_kode, proses: 'cutting', refTable: 'produksi_item', refId: itemId,
      timId: item.tim_id ?? null, timNama: item.tim_nama ?? null,
      masukGram: serahGram, keluarGram: totalAcc + rejectTotal, lossGram: totalGain, toleransiGram: toleransiCut,
      alasan: `[Timbangan naik +${totalGain.toFixed(3)}gr] ${lossAlasan}`, ttdOperatorDataUrl: ttdOp, operatorNama: (formData.get('loss_operator_nama') as string) || item.operator || null,
      ttdAdminDataUrl: ttdAdmin, adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
    })
  }

  const sesiId = gramasiList.length > 1 ? crypto.randomUUID() : null
  if (gramasiList.length === 1) {
    // 1 gramasi → UPDATE existing item
    const row = gramasiList[0]
    const losses = Math.max(0, serahGram - row.acc_gram - rejectTotal)
    const fotoUrls = await uploadFotosIndex(allFotosB64, 0, `${item.kode}-terima`)
    const existingFotos: string[] = Array.isArray(item.foto_diterima_cutting) ? item.foto_diterima_cutting : []
    const finalFotos = [...existingFotos, ...fotoUrls]

    const updateData: any = {
      gramasi: row.gramasi,
      pcs: row.pcs > 0 ? row.pcs : null,
      pcs_awal: row.pcs > 0 ? row.pcs : null,
      pcs_good: row.pcs > 0 ? row.pcs : null,
      nama_item: item.nama_item || `LM REI ${row.gramasi}GR`,
      terima_gram: row.acc_gram,
      reject_cutting_gram: rejectTotal,
      tanggal_selesai: tanggalSelesai,
      jam_selesai: jamSelesai,
      status_cutting: 'selesai',
      total_gram: row.acc_gram,
      foto_diterima_cutting: finalFotos,
      tim_id: terimaTimId, tim_nama: terimaTimNama,
      tim_anggota_aktif: terimaAnggota, admin_input: terimaAdmin,
    }
    if (row.catatan) updateData.catatan_terima = row.catatan
    if (rejectTotal > 0) {
      updateData.berat_reject = Number(item.berat_reject ?? 0) + rejectTotal
      updateData.status_reject = 'belum_dilebur'
    }

    await supabase.from('produksi_item').update(updateData).eq('id', itemId)

    await supabase.from('produksi_event').insert({
      produksi_item_id: itemId, tanggal: tanggalSelesai, status: 'Cutting',
      total_gram: row.acc_gram, berat_sebelumnya: serahGram,
      sisa_serbuk: rejectTotal, losses, jam_mulai: jamSelesai,
      catatan: `Serah: ${serahGram}gr | Terima: ${row.acc_gram}gr | Reject: ${rejectTotal}gr${row.catatan ? ` | ${row.catatan}` : ''}`,
      user_name: profile?.name || null, fotos: finalFotos,
    })
  } else {
    // Multi gramasi → VOID original, create new items
    const now = new Date().toISOString()
    await supabase.from('produksi_item').update({
      voided_at: now, void_reason: 'SPLIT_GRAMASI',
    }).eq('id', itemId)

    const totalWeight = gramasiList.reduce((s, r) => s + parseFloat(r.gramasi) * (r.pcs || 1), 0)
    const berats: number[] = []
    let allocated = 0
    for (let i = 0; i < gramasiList.length - 1; i++) {
      const b = parseFloat((beratSerahBatch * parseFloat(gramasiList[i].gramasi) * (gramasiList[i].pcs || 1) / totalWeight).toFixed(4))
      berats.push(b); allocated += b
    }
    berats.push(parseFloat((beratSerahBatch - allocated).toFixed(4)))

    const createdItems: any[] = []
    for (let i = 0; i < gramasiList.length; i++) {
      const row = gramasiList[i]
      const kode = await generateProduksiCode(supabase)
      const losses = Math.max(0, serahGram * (berats[i] / beratSerahBatch) - row.acc_gram - (rejectTotal * berats[i] / beratSerahBatch))
      const fotoUrls = await uploadFotosIndex(allFotosB64, i, `${kode}-terima`)
      const rejectItem = parseFloat((rejectTotal * berats[i] / beratSerahBatch).toFixed(4))

      const { data: newItem, error } = await supabase.from('produksi_item').insert({
        kode, batch_kode: item.batch_kode,
        gramasi: row.gramasi, pcs: row.pcs > 0 ? row.pcs : null,
        pcs_awal: row.pcs > 0 ? row.pcs : null, pcs_good: row.pcs > 0 ? row.pcs : null, pcs_reject: 0,
        nama_item: item.nama_item || `LM REI ${row.gramasi}GR`,
        berat_awal: berats[i], serah_gram: berats[i], total_gram: row.acc_gram,
        terima_gram: row.acc_gram, reject_cutting_gram: rejectItem,
        current_status: 'Pas Berat',
        status_cutting: 'selesai',
        tanggal_produksi: item.tanggal_produksi, tanggal: tanggalSelesai,
        tanggal_mulai: item.tanggal_mulai, tanggal_selesai: tanggalSelesai,
        jam_mulai_cutting: item.jam_mulai_cutting, jam_selesai: jamSelesai,
        peleburan_id: item.peleburan_id, peleburan_kode: item.peleburan_kode,
        sesi_id: sesiId, tim_id: terimaTimId, tim_nama: terimaTimNama,
        tim_anggota_aktif: terimaAnggota,
        operator: item.operator, admin_input: terimaAdmin,
        created_by: user.id, foto_diterima_cutting: fotoUrls,
        catatan_terima: row.catatan, catatan: item.catatan,
        berat_reject: rejectItem > 0 ? rejectItem : 0, status_reject: rejectItem > 0 ? 'belum_dilebur' : null,
      }).select().single()
      if (error) return { error: error.message }
      createdItems.push(newItem)

      await supabase.from('produksi_event').insert({
        produksi_item_id: newItem.id, tanggal: tanggalSelesai, status: 'Cutting',
        total_gram: row.acc_gram, berat_sebelumnya: berats[i],
        sisa_serbuk: rejectItem, losses, jam_mulai: jamSelesai,
        catatan: `Serah: ${berats[i]}gr | Terima: ${row.acc_gram}gr | Reject: ${rejectItem}gr${row.catatan ? ` | ${row.catatan}` : ''}`,
        user_name: profile?.name || null, fotos: fotoUrls,
      })
    }

    supabase.from('audit_log').insert({
      user_id: user.id, user_name: profile?.name, user_role: profile?.role,
      action: 'SPLIT_GRAMASI', module: 'PRODUKSI', record_key: item.kode, record_id: String(item.id),
      before_data: item, after_data: { gramasi_list: gramasiList, created: createdItems.map((ci: any) => ci.kode) },
    })
  }

  revalidatePath('/produksi')
  return { success: true }
}

// Helper: upload fotos for a given index
async function uploadFotosIndex(allFotosB64: Record<string, string[]>, idx: number, prefix: string) {
  if (!allFotosB64) return []
  const supabase = await createClient()
  const fotos = allFotosB64[idx] ?? allFotosB64[String(idx)] ?? []
  return fotos.length > 0 ? await uploadBase64Fotos(supabase, fotos, prefix) : []
}

// ─── Sesi: Terima Cutting (multi-gramasi bersama — legacy) ──────────────────
export async function terimaCuttingSesi(sesiId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: items } = await supabase.from('produksi_item')
    .select('*').eq('sesi_id', sesiId).is('voided_at', null)
  if (!items?.length) return { error: 'Sesi tidak ditemukan' }

  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const tanggalSelesai = formData.get('tanggal_selesai') as string
  const jamSelesai = (formData.get('jam_selesai') as string) || null
  const rejectTotal = parseFloat(formData.get('reject_cutting_gram') as string || '0')

  if (!tanggalSelesai) return { error: 'Tanggal selesai wajib diisi' }

  const allFotosB64Raw = formData.get('fotos_b64') as string
  const allFotosB64: Record<string, string[]> = allFotosB64Raw ? JSON.parse(allFotosB64Raw) : {}

  const totalBeratAwal = items.reduce((s, it) => s + Number(it.berat_awal ?? 0), 0)
  const beratSerahBatch = Number(items[0]?.berat_serah_batch ?? totalBeratAwal)

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const accGram = parseFloat(formData.get(`acc_gram_${item.id}`) as string || '0')
    if (!accGram || accGram <= 0) return { error: `Berat ACC untuk ${item.gramasi}gr wajib diisi` }

    const totalAccSoFar = items.reduce((s, it) => {
      if (it.id === item.id) return s + accGram
      return s + parseFloat(formData.get(`acc_gram_${it.id}`) as string || '0')
    }, 0)
    if (totalAccSoFar + rejectTotal > beratSerahBatch + 0.01) {
      return { error: `Total ACC (${totalAccSoFar.toFixed(2)}gr) + Reject (${rejectTotal}gr) melebihi berat serah batch (${beratSerahBatch}gr)` }
    }

    const rejectItem = totalBeratAwal > 0
      ? parseFloat((rejectTotal * Number(item.berat_awal ?? 0) / totalBeratAwal).toFixed(4))
      : 0

    const serahGram = Number(item.serah_gram ?? item.berat_awal ?? 0)
    const losses = Math.max(0, serahGram - accGram - rejectItem)

    const catatanItem = (formData.get(`catatan_${item.id}`) as string) || null

    const fotosItemB64 = allFotosB64[idx] ?? allFotosB64[String(idx)] ?? []
    const fotoUrls = fotosItemB64.length > 0
      ? await uploadBase64Fotos(supabase, fotosItemB64, `${item.kode}-terima`)
      : []
    const existingFotos: string[] = Array.isArray(item.foto_diterima_cutting) ? item.foto_diterima_cutting : []
    const finalFotos = [...existingFotos, ...fotoUrls]

    await supabase.from('produksi_event').insert({
      produksi_item_id: item.id,
      tanggal: tanggalSelesai,
      status: 'Cutting',
      total_gram: accGram,
      berat_sebelumnya: serahGram,
      sisa_serbuk: rejectItem,
      losses,
      jam_mulai: jamSelesai,
      catatan: catatanItem
        ? `Serah: ${serahGram}gr | Terima: ${accGram}gr | Reject: ${rejectItem}gr | ${catatanItem}`
        : `Serah: ${serahGram}gr | Terima: ${accGram}gr | Reject: ${rejectItem}gr`,
      user_name: profile?.name || null,
      fotos: finalFotos,
    })

    const pcsGood = parseInt(formData.get(`pcs_${item.id}`) as string || '0') || null
    const updateData: any = {
      terima_gram: accGram,
      reject_cutting_gram: rejectItem,
      tanggal_selesai: tanggalSelesai,
      jam_selesai: jamSelesai,
      status_cutting: 'selesai',
      total_gram: accGram,
      foto_diterima_cutting: finalFotos,
    }
    if (catatanItem) updateData.catatan_terima = catatanItem
    if (pcsGood && pcsGood > 0) { updateData.pcs_good = pcsGood; updateData.pcs = pcsGood }
    if (rejectItem > 0) {
      updateData.berat_reject = Number(item.berat_reject ?? 0) + rejectItem
      updateData.status_reject = 'belum_dilebur'
    }
    if (formData.get('terima_tim_id')) { updateData.tim_id = Number(formData.get('terima_tim_id')); updateData.tim_nama = (formData.get('terima_tim_nama') as string) || null }
    if (formData.get('terima_admin_input')) updateData.admin_input = formData.get('terima_admin_input') as string
    await supabase.from('produksi_item').update(updateData).eq('id', item.id)
  }

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Sesi: Serah tahap berikutnya (Pas Berat / Annealing / Siap Packing) ─────
export async function serahSesiStage(sesiId: string, tahap: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: items } = await supabase.from('produksi_item')
    .select('*, stage_handover(*)').eq('sesi_id', sesiId).is('voided_at', null)
  if (!items?.length) return { error: 'Sesi tidak ditemukan' }

  const { data: profile } = await supabase.from('users_profile').select('name').eq('id', user.id).single()
  const serahTanggal = (formData.get('serah_tanggal') as string) || new Date().toISOString().split('T')[0]
  const serahJam = (formData.get('serah_jam') as string) || null
  const serahCatatan = (formData.get('serah_catatan') as string) || null
  const serahTimId = formData.get('serah_tim_id') ? Number(formData.get('serah_tim_id')) : null
  const serahTimNama = (formData.get('serah_tim_nama') as string) || null
  const serahAdmin = (formData.get('serah_admin_input') as string) || null

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0
    ? await uploadBase64Fotos(supabase, fotosB64, `sesi-${sesiId}-serah-${tahap}`)
    : []

  const nextStatusMap: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }

  for (const item of items) {
    const handovers = (item.stage_handover ?? []).filter((h: any) => !h.voided_at)
    const existing = handovers.find((h: any) => h.tahap === tahap)
    if (existing) continue // sudah ada, skip

    // Ambil berat serah dari per-item form field atau fallback ke current
    const serahGramOverride = parseFloat(formData.get(`serah_gram_${item.id}`) as string || '0')
    let serahGram = serahGramOverride > 0 ? serahGramOverride : 0
    if (!serahGram) {
      if (tahap === 'pas_berat') {
        serahGram = Number(item.terima_gram ?? item.total_gram ?? 0)
      } else {
        const prevTahapMap: Record<string,string> = { annealing: 'pas_berat', siap_packing: 'annealing' }
        const prevH = handovers.find((h: any) => h.tahap === prevTahapMap[tahap] && h.status === 'selesai')
        serahGram = Number(prevH?.terima_gram ?? item.total_gram ?? 0)
      }
    }
    const serahPcs = item.pcs_good ?? item.pcs ?? 0

    await supabase.from('stage_handover').insert({
      produksi_item_id: item.id, tahap,
      serah_gram: serahGram, serah_pcs: serahPcs,
      serah_tanggal: serahTanggal, serah_jam: serahJam,
      serah_operator: (formData.get('serah_operator') as string) || profile?.name || null,
      serah_catatan: serahCatatan, serah_fotos: fotoUrls, status: 'proses',
      tim_id: serahTimId, tim_nama: serahTimNama,
      serah_admin_input: serahAdmin,
      tim_anggota_aktif: (formData.get('serah_tim_anggota_aktif') as string) || null,
    })

    const nextStatus = nextStatusMap[tahap]
    if (nextStatus) await supabase.from('produksi_item').update({ current_status: nextStatus }).eq('id', item.id)
  }

  revalidatePath('/produksi')
  return { success: true }
}

// ─── Sesi: Terima tahap (Pas Berat / Annealing) ───────────────────────────────
export async function terimaSesiStage(sesiId: string, tahap: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: items } = await supabase.from('produksi_item')
    .select('*, stage_handover(*)').eq('sesi_id', sesiId).is('voided_at', null)
  if (!items?.length) return { error: 'Sesi tidak ditemukan' }

  const [{ data: profile }, tolMap] = await Promise.all([
    supabase.from('users_profile').select('name').eq('id', user.id).single(),
    getToleransiLoss(),
  ])

  const terimaTanggal = formData.get('terima_tanggal') as string
  const terimaJam     = (formData.get('terima_jam') as string) || null
  const terimaCatatan = (formData.get('terima_catatan') as string) || null
  if (!terimaTanggal) return { error: 'Tanggal diterima wajib diisi' }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0
    ? await uploadBase64Fotos(supabase, fotosB64, `sesi-${sesiId}-terima-${tahap}`)
    : []

  const nextStatusMap: Record<string,string> = { pas_berat: 'Annealing', annealing: 'Siap Packing', siap_packing: 'Siap Packing' }
  const terimaOp    = (formData.get('terima_operator') as string) || profile?.name || null
  const terimaTimId  = formData.get('terima_tim_id') ? Number(formData.get('terima_tim_id')) : null
  const terimaTimNama = (formData.get('terima_tim_nama') as string) || null
  const lossAlasan   = (formData.get('loss_alasan') as string) || ''

  // ── Pass 1: parse semua item & validasi loss/gain sebelum menyimpan ───────────
  type IP = { item: any; handover: any; terimaGram: number; terimaPcs: number|null; sisaSerbuk: number; rejectGram: number; rejectPcs: number; serahGram: number; losses: number; gain: number; tol: number }
  const proc: IP[] = []
  for (const item of items) {
    const handovers = (item.stage_handover ?? []).filter((h: any) => !h.voided_at)
    const handover  = handovers.find((h: any) => h.tahap === tahap && h.status === 'proses')
    if (!handover) continue

    const terimaGram = parseFloat(formData.get(`terima_gram_${item.id}`) as string || '0')
    if (!terimaGram || terimaGram <= 0) return { error: `Berat terima untuk ${item.gramasi}gr wajib diisi` }

    const sisaSerbuk = tahap === 'pas_berat' ? parseFloat(formData.get(`sisa_serbuk_${item.id}`) as string || '0') : 0
    const rejectGram = parseFloat(formData.get(`reject_gram_${item.id}`) as string || '0') || 0
    const rejectPcs  = parseInt(formData.get(`reject_pcs_${item.id}`) as string || '0') || 0
    const terimaPcs  = parseInt(formData.get(`terima_pcs_${item.id}`) as string || '0') || null
    const serahGram  = Number(handover.serah_gram ?? 0)
    const losses     = Math.max(0, serahGram - terimaGram - sisaSerbuk - rejectGram)
    const gain       = Math.max(0, (terimaGram + sisaSerbuk + rejectGram) - serahGram)
    const tol        = tolMap[tahap] ?? 0.05
    proc.push({ item, handover, terimaGram, terimaPcs, sisaSerbuk, rejectGram, rejectPcs, serahGram, losses, gain, tol })
  }

  const needsTTD = proc.some(x => x.losses > x.tol + 0.0001 || x.gain > x.tol + 0.0001)
  if (needsTTD) {
    const ttdOp    = formData.get('loss_ttd_operator') as string
    const ttdAdmin = formData.get('loss_ttd_admin') as string
    const worstVal = proc.reduce((m, x) => Math.max(m, x.losses, x.gain), 0)
    const isGain   = proc.some(x => x.gain > x.tol + 0.0001)
    if (!lossAlasan.trim()) return { error: `${isGain ? 'Timbangan naik' : 'Loss'} ${worstVal.toFixed(3)}gr melebihi toleransi. Alasan wajib diisi.` }
    if (!ttdOp)    return { error: 'Tanda tangan operator wajib.' }
    if (!ttdAdmin) return { error: 'Tanda tangan admin/manager wajib.' }
  }

  // ── Pass 2: simpan semua ──────────────────────────────────────────────────────
  for (const { item, handover, terimaGram, terimaPcs, sisaSerbuk, rejectGram, rejectPcs, serahGram, losses, gain, tol } of proc) {
    if (losses > tol + 0.0001) {
      await saveLossApproval(supabase, {
        batchKode: item.batch_kode ?? null, proses: tahap, refTable: 'stage_handover', refId: handover.id,
        timId: terimaTimId, timNama: terimaTimNama,
        masukGram: serahGram, keluarGram: terimaGram, lossGram: losses, toleransiGram: tol,
        alasan: lossAlasan, ttdOperatorDataUrl: formData.get('loss_ttd_operator') as string,
        operatorNama: (formData.get('loss_operator_nama') as string) || terimaOp,
        ttdAdminDataUrl: formData.get('loss_ttd_admin') as string,
        adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
      })
    }
    if (gain > tol + 0.0001) {
      await saveLossApproval(supabase, {
        batchKode: item.batch_kode ?? null, proses: tahap, refTable: 'stage_handover', refId: handover.id,
        timId: terimaTimId, timNama: terimaTimNama,
        masukGram: serahGram, keluarGram: terimaGram + sisaSerbuk + rejectGram, lossGram: gain, toleransiGram: tol,
        alasan: `[Timbangan naik +${gain.toFixed(3)}gr] ${lossAlasan}`, ttdOperatorDataUrl: formData.get('loss_ttd_operator') as string,
        operatorNama: (formData.get('loss_operator_nama') as string) || terimaOp,
        ttdAdminDataUrl: formData.get('loss_ttd_admin') as string,
        adminUserId: user.id, adminNama: (formData.get('loss_admin_nama') as string) || profile?.name || null,
      })
    }

    // Serbuk Pas Berat otomatis masuk Scrap Inventory (upsert — edit tersinkron)
    if (tahap === 'pas_berat') {
      const sync = await syncSerbukScrap(supabase, {
        sumberRef: `SH:${handover.id}`,
        batchKode: item.batch_kode ?? null,
        gramasi: item.gramasi != null ? String(item.gramasi) : null,
        berat: sisaSerbuk,
        tanggal: terimaTanggal,
        admin: (formData.get('terima_admin_input') as string) || null,
        createdBy: user.id,
      })
      if (sync.error) return { error: `${item.gramasi}gr: ${sync.error}` }
    }

    await supabase.from('stage_handover').update({
      terima_gram: terimaGram, terima_pcs: terimaPcs,
      terima_tanggal: terimaTanggal, terima_jam: terimaJam,
      terima_catatan: terimaCatatan, terima_fotos: fotoUrls,
      sisa_serbuk: sisaSerbuk, losses, status: 'selesai',
      terima_operator: terimaOp,
      tim_id: terimaTimId ?? handover.tim_id,
      tim_nama: terimaTimNama ?? handover.tim_nama,
      tim_anggota_aktif: (formData.get('terima_tim_anggota_aktif') as string) || handover.tim_anggota_aktif || null,
      terima_admin_input: (formData.get('terima_admin_input') as string) || null,
    }).eq('id', handover.id)

    const updateItem: any = { total_gram: terimaGram, terima_gram: terimaGram }
    if (terimaPcs) { updateItem.pcs_good = terimaPcs; updateItem.pcs = terimaPcs }
    if (rejectGram > 0 || rejectPcs > 0) {
      updateItem.berat_reject  = Number(item.berat_reject ?? 0) + rejectGram
      updateItem.pcs_reject    = Number(item.pcs_reject ?? 0) + rejectPcs
      updateItem.status_reject = 'belum_dilebur'
    }
    if (sisaSerbuk > 0) updateItem.sisa_serbuk = sisaSerbuk

    const handovers = (item.stage_handover ?? []).filter((h: any) => !h.voided_at)
    const STAGE_ORDER = ['pas_berat', 'annealing', 'siap_packing']
    const nextStageDone = STAGE_ORDER.slice(STAGE_ORDER.indexOf(tahap) + 1)
    const anyNext = handovers.find((h: any) => nextStageDone.includes(h.tahap) && h.status !== 'voided')
    if (!anyNext) {
      const STAGE_STATUS: Record<string,string> = { pas_berat: 'Pas Berat', annealing: 'Annealing', siap_packing: 'Siap Packing' }
      updateItem.current_status = nextStatusMap[tahap] ?? STAGE_STATUS[tahap]
    }
    const { error: updErr } = await supabase.from('produksi_item').update(updateItem).eq('id', item.id)
    if (updErr) return { error: `Gagal update item ${item.gramasi}gr: ${updErr.message}` }
  }

  if (tahap === 'pas_berat') revalidatePath('/scrap')
  revalidatePath('/produksi')
  return { success: true }
}







