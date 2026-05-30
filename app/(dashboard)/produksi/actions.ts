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

  if (!batchKode) return { error: 'Batch wajib dipilih' }
  if (!gramasi) return { error: 'Gramasi wajib dipilih' }
  if (!pcs || pcs <= 0) return { error: 'PCS wajib diisi' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat wajib diisi' }
  if (!statusAwal) return { error: 'Status awal wajib dipilih' }
  if (!tanggalProduksi) return { error: 'Tanggal produksi wajib diisi' }

  const { data: batch } = await supabase.from('batch').select('*').eq('kode', batchKode).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status === 'terkunci') return { error: 'Batch terkunci — tidak bisa dipakai untuk produksi baru' }

  const sisaSeharusnya = batch.sisa_bahan_seharusnya ?? batch.timbangan_akhir ?? 0
  if (beratAwal > sisaSeharusnya + 0.01) {
    return { error: `Berat melebihi sisa bahan batch (${sisaSeharusnya.toFixed(2)} gr tersisa)` }
  }

  const kode = await generateProduksiCode(supabase)
  const sisaSerbuk = statusAwal === 'Pas Berat' ? parseFloat(formData.get('sisa_serbuk') as string || '0') : 0

  const { data: produksi, error } = await supabase.from('produksi_item').insert({
    kode, batch_kode: batchKode, gramasi, pcs, pcs_awal: pcs, pcs_good: pcs, pcs_reject: 0,
    nama_item: formData.get('nama_item') as string || null,
    berat_awal: beratAwal, total_gram: beratAwal, current_status: statusAwal,
    tanggal_produksi: tanggalProduksi, tanggal: tanggalProduksi,
    memo: formData.get('memo') as string || null,
    operator: formData.get('operator') as string || profile?.name || null,
    catatan: formData.get('catatan') as string || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  const fotosB64Raw = formData.get('fotos_b64') as string
  const fotosB64 = fotosB64Raw ? JSON.parse(fotosB64Raw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadBase64Fotos(supabase, fotosB64, kode) : []

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksi.id, tanggal: tanggalProduksi,
    status: statusAwal, total_gram: beratAwal, berat_sebelumnya: beratAwal,
    sisa_serbuk: sisaSerbuk, losses: 0,
    pcs_good_snapshot: pcs,
    catatan: formData.get('catatan') as string || null,
    user_name: profile?.name || null, fotos: fotoUrls,
  })

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

  await supabase.from('produksi_event').insert({
    produksi_item_id: produksiId, tanggal, status: statusBaru,
    total_gram: totalGramBaru, berat_sebelumnya: beratSebelumnya,
    sisa_serbuk: sisaSerbuk, losses,
    pcs_good_snapshot: produksi.pcs_good ?? produksi.pcs ?? 0,
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
    losses: 0, // reject BUKAN losses permanen — emas akan dilebur kembali
    pcs_good_snapshot: newPcsGood,  // pcs good SETELAH reject dikurangi
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

  // Atomic RPC: prevents race condition + double-lebur in one transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc('lebur_reject_atomic', {
    p_produksi_id: produksiId,
    p_batch_kode:  batchKode,
  })
  if (rpcError) return { error: rpcError.message }
  if (rpcResult?.error) return { error: rpcResult.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'LEBUR_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { berat_kembali: rpcResult?.berat_kembali, batch_kode: batchKode },
  })

  revalidatePath('/produksi')
  revalidatePath('/bahan-baku')
  return { success: true, berat_kembali: rpcResult?.berat_kembali }
}

export async function batalLeburReject(produksiId: number, produksiKode: string, batchKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('batal_lebur_reject_atomic', {
    p_produksi_id: produksiId,
    p_batch_kode:  batchKode,
  })
  if (rpcError) return { error: rpcError.message }
  if (rpcResult?.error) return { error: rpcResult.error }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'BATAL_LEBUR_REJECT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    after_data: { berat_dikembalikan: rpcResult?.berat_dikembalikan, batch_kode: batchKode },
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

  const { count: packingCount } = await supabase.from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)

  if ((packingCount ?? 0) > 0) {
    return {
      error: `Item produksi ini memiliki ${packingCount} data packing aktif. Hapus data packing terlebih dahulu.`,
      step: 'packing',
    }
  }

  await supabase.from('produksi_item').update({
    voided_at: new Date().toISOString(), void_reason: 'DELETED_BY_USER',
  }).eq('id', produksiId)

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

export async function editProduksi(produksiId: number, produksiKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const gramasi   = formData.get('gramasi') as string
  const pcs       = parseInt(formData.get('pcs') as string)
  const beratAwal = parseFloat(formData.get('berat_awal') as string)
  const operator  = formData.get('operator') as string
  const catatan   = formData.get('catatan') as string
  const tanggal   = formData.get('tanggal_produksi') as string
  const memo      = formData.get('memo') as string

  if (!gramasi) return { error: 'Gramasi wajib diisi' }
  if (!pcs || pcs <= 0) return { error: 'PCS wajib diisi' }
  if (!beratAwal || beratAwal <= 0) return { error: 'Total berat wajib diisi' }
  if (!tanggal) return { error: 'Tanggal wajib diisi' }

  const { data: before } = await supabase.from('produksi_item').select('*').eq('id', produksiId).single()
  if (!before) return { error: 'Item produksi tidak ditemukan' }

  // Block edit jika ada packing aktif
  const { count: packingCount } = await supabase.from('packing')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId).is('voided_at', null)
  if ((packingCount ?? 0) > 0)
    return { error: `Tidak bisa edit: ada ${packingCount} packing aktif. Void packing terlebih dahulu.` }

  // Recalculate pcs_good: new pcs minus existing rejects
  const existingReject = before.pcs_reject ?? 0
  const newPcsGood = pcs - existingReject
  if (newPcsGood < 0)
    return { error: `PCS baru (${pcs}) tidak boleh kurang dari jumlah reject yang sudah ada (${existingReject})` }

  // total_gram: reset ke beratAwal HANYA jika belum ada event proses
  // (lebih dari 1 event berarti sudah ada proses setelah CREATE)
  const { count: eventCount } = await supabase.from('produksi_event')
    .select('*', { count: 'exact', head: true })
    .eq('produksi_item_id', produksiId)
  const hasProcessEvents = (eventCount ?? 0) > 1
  const newTotalGram = hasProcessEvents ? before.total_gram : beratAwal

  const { error } = await supabase.from('produksi_item').update({
    gramasi, pcs, pcs_awal: pcs, pcs_good: newPcsGood,
    berat_awal: beratAwal, total_gram: newTotalGram,
    operator: operator || null, catatan: catatan || null,
    tanggal_produksi: tanggal, tanggal, memo: memo || null,
  }).eq('id', produksiId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT', module: 'PRODUKSI',
    record_key: produksiKode, record_id: String(produksiId),
    before_data: before,
    after_data: { gramasi, pcs, pcs_good: newPcsGood, berat_awal: beratAwal, operator, tanggal },
  })

  revalidatePath('/produksi')
  return { success: true }
}



