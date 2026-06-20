'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function genNomor(supabase: any, counter: string, prefix: string): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: counter })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `${prefix}/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

async function uploadSignature(supabase: any, b64: string, name: string): Promise<string> {
  const base64Data = b64.replace(/^data:image\/\w+;base64,/, '')
  const buf = Buffer.from(base64Data, 'base64')
  const path = `po-packaging/${name}_${Date.now()}.png`
  await supabase.storage.from('signatures').upload(path, buf, { contentType: 'image/png', upsert: true })
  const { data } = supabase.storage.from('signatures').getPublicUrl(path)
  return data.publicUrl
}

async function uploadFotos(supabase: any, b64Array: string[], prefix: string): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < b64Array.length; i++) {
    const b64 = b64Array[i]
    const mime = b64.match(/data:([^;]+);/)?.[1] || 'image/jpeg'
    const ext  = mime.split('/')[1] || 'jpg'
    const raw  = b64.replace(/^data:[^;]+;base64,/, '')
    const buf  = Buffer.from(raw, 'base64')
    const path = `po-packaging/${prefix}_${Date.now()}_${i}.${ext}`
    await supabase.storage.from('fotos').upload(path, buf, { contentType: mime, upsert: true })
    const { data } = supabase.storage.from('fotos').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

// ── MASTER PRODUK ─────────────────────────────────────────────────────────────

export async function createProdukPackaging(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama produk wajib diisi' }

  const { count } = await supabase.from('produk_packaging').select('*', { count: 'exact', head: true })
  const kode = `PKG${String((count ?? 0) + 1).padStart(3, '0')}`

  const { error } = await supabase.from('produk_packaging').insert({
    kode,
    nama,
    satuan: (formData.get('satuan') as string) || 'pcs',
    keterangan: (formData.get('keterangan') as string) || null,
    aktif: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true, kode }
}

export async function updateProdukPackaging(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('produk_packaging').update({
    nama: (formData.get('nama') as string)?.trim(),
    satuan: (formData.get('satuan') as string) || 'pcs',
    keterangan: (formData.get('keterangan') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function toggleProdukAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('produk_packaging').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── VENDOR ────────────────────────────────────────────────────────────────────

export async function createVendor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama vendor wajib diisi' }

  // auto kode: VDR001, VDR002, ...
  const { count } = await supabase.from('vendor_packaging').select('*', { count: 'exact', head: true })
  const kode = `VDR${String((count ?? 0) + 1).padStart(3, '0')}`

  const { error } = await supabase.from('vendor_packaging').insert({
    kode,
    nama,
    alamat: (formData.get('alamat') as string) || null,
    pic: (formData.get('pic') as string) || null,
    telepon: (formData.get('telepon') as string) || null,
    email: (formData.get('email') as string) || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true, kode }
}

export async function updateVendor(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('vendor_packaging').update({
    nama: (formData.get('nama') as string)?.trim(),
    alamat: (formData.get('alamat') as string) || null,
    pic: (formData.get('pic') as string) || null,
    telepon: (formData.get('telepon') as string) || null,
    email: (formData.get('email') as string) || null,
    aktif: formData.get('aktif') !== 'false',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── PO ────────────────────────────────────────────────────────────────────────

export async function createPO(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const vendorId   = parseInt(formData.get('vendor_id') as string)
  const produkId   = parseInt(formData.get('produk_id') as string)
  const qtyPO      = parseInt(formData.get('qty_po') as string)
  const tanggalPO  = formData.get('tanggal_po') as string
  const nomorManual = (formData.get('nomor_po') as string)?.trim()

  if (!vendorId)  return { error: 'Vendor wajib dipilih' }
  if (!produkId)  return { error: 'Produk wajib dipilih' }
  if (!qtyPO || qtyPO <= 0) return { error: 'Qty PO wajib diisi' }
  if (!tanggalPO) return { error: 'Tanggal PO wajib diisi' }

  const [{ data: vendor }, { data: produk }] = await Promise.all([
    supabase.from('vendor_packaging').select('nama').eq('id', vendorId).single(),
    supabase.from('produk_packaging').select('kode, nama').eq('id', produkId).single(),
  ])
  if (!vendor) return { error: 'Vendor tidak ditemukan' }
  if (!produk) return { error: 'Produk tidak ditemukan' }

  let nomorPO = nomorManual
  if (!nomorPO) nomorPO = await genNomor(supabase, 'po_packaging', 'PO')

  const { data: existing } = await supabase.from('po_packaging').select('id').eq('nomor_po', nomorPO).single()
  if (existing) return { error: `Nomor PO "${nomorPO}" sudah digunakan` }

  const { error } = await supabase.from('po_packaging').insert({
    nomor_po: nomorPO,
    vendor_id: vendorId,
    vendor_nama: vendor.nama,
    tanggal_po: tanggalPO,
    tanggal_jatuh_tempo: (formData.get('tanggal_jatuh_tempo') as string) || null,
    produk_id: produkId,
    produk_kode: produk.kode,
    produk_nama: produk.nama,
    qty_po: qtyPO,
    harga_satuan: parseFloat(formData.get('harga_satuan') as string) || null,
    catatan: (formData.get('catatan') as string) || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true, nomorPO }
}

export async function updatePO(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nomorPO = (formData.get('nomor_po') as string)?.trim()
  if (!nomorPO) return { error: 'Nomor PO wajib diisi' }

  // Check duplicate nomor (exclude self)
  const { data: dup } = await supabase.from('po_packaging').select('id').eq('nomor_po', nomorPO).neq('id', id).single()
  if (dup) return { error: `Nomor PO "${nomorPO}" sudah digunakan oleh PO lain` }

  const { error } = await supabase.from('po_packaging').update({
    nomor_po: nomorPO,
    tanggal_po: formData.get('tanggal_po') as string,
    tanggal_jatuh_tempo: (formData.get('tanggal_jatuh_tempo') as string) || null,
    qty_po: parseInt(formData.get('qty_po') as string),
    harga_satuan: parseFloat(formData.get('harga_satuan') as string) || null,
    catatan: (formData.get('catatan') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function voidPO(id: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }
  if (!reason) return { error: 'Alasan void wajib diisi' }

  // Check if any batch already received
  const { count } = await supabase.from('po_batch_penerimaan').select('*', { count: 'exact', head: true }).eq('po_id', id)
  if ((count ?? 0) > 0) return { error: 'Tidak bisa void PO yang sudah ada batch penerimaannya' }

  await supabase.from('po_packaging').update({ voided_at: new Date().toISOString(), void_reason: reason, status: 'void' }).eq('id', id)
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── BATCH PENERIMAAN ──────────────────────────────────────────────────────────

export async function createBatchPenerimaan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const poId        = parseInt(formData.get('po_id') as string)
  const qtyDiterima = parseInt(formData.get('qty_diterima') as string)
  const tanggal     = formData.get('tanggal_terima') as string

  if (!poId)                         return { error: 'PO wajib dipilih' }
  if (!qtyDiterima || qtyDiterima <= 0) return { error: 'Qty diterima wajib diisi' }
  if (!tanggal)                      return { error: 'Tanggal terima wajib diisi' }

  const { data: po } = await supabase.from('po_packaging')
    .select('nomor_po, vendor_id, vendor_nama, produk_id, produk_kode, produk_nama, qty_po, status')
    .eq('id', poId).single()
  if (!po) return { error: 'PO tidak ditemukan' }
  if (po.status === 'void') return { error: 'PO sudah divoid' }

  // Compute total already received (excluding lebihan)
  const { data: batches } = await supabase.from('po_batch_penerimaan')
    .select('qty_diterima, qty_lebih').eq('po_id', poId)
  const totalSudahDatang = (batches ?? []).reduce((s: number, b: any) => s + (b.qty_diterima - (b.qty_lebih ?? 0)), 0)
  const sisaPO = po.qty_po - totalSudahDatang

  // Compute lebihan jika qty_diterima > sisa PO
  const qtyLebih = Math.max(0, qtyDiterima - sisaPO)

  const nomor = await genNomor(supabase, 'batch_penerimaan', 'BTH')
  const fotosRaw = formData.get('fotos_b64') as string
  const fotosB64 = fotosRaw ? JSON.parse(fotosRaw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadFotos(supabase, fotosB64, nomor) : []

  const { data: batch, error } = await supabase.from('po_batch_penerimaan').insert({
    nomor_batch: nomor,
    po_id: poId,
    po_nomor: po.nomor_po,
    vendor_id: po.vendor_id,
    vendor_nama: po.vendor_nama,
    produk_id: po.produk_id,
    produk_kode: po.produk_kode,
    produk_nama: po.produk_nama,
    tanggal_terima: tanggal,
    qty_diterima: qtyDiterima,
    qty_lebih: qtyLebih,
    catatan: (formData.get('catatan') as string) || null,
    fotos: fotoUrls,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Update PO status
  const newTotal = totalSudahDatang + qtyDiterima - qtyLebih
  const newStatus = newTotal >= po.qty_po ? 'selesai' : 'partial'
  await supabase.from('po_packaging').update({ status: newStatus }).eq('id', poId)

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, batchId: batch.id, qtyLebih }
}

// ── QC ────────────────────────────────────────────────────────────────────────

export async function submitQC(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const batchId  = parseInt(formData.get('batch_id') as string)
  const qtyAcc   = parseInt(formData.get('qty_acc') as string)
  const qtyReject = parseInt(formData.get('qty_reject') as string)
  const qcTanggal = formData.get('qc_tanggal') as string

  if (isNaN(qtyAcc) || qtyAcc < 0)    return { error: 'Qty ACC tidak valid' }
  if (isNaN(qtyReject) || qtyReject < 0) return { error: 'Qty reject tidak valid' }
  if (!qcTanggal) return { error: 'Tanggal QC wajib diisi' }

  const { data: batch } = await supabase.from('po_batch_penerimaan')
    .select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status_qc === 'selesai') return { error: 'QC sudah diselesaikan' }

  const total = qtyAcc + qtyReject + (batch.qty_lebih ?? 0)
  if (total !== batch.qty_diterima)
    return { error: `Total ACC (${qtyAcc}) + Reject (${qtyReject}) + Lebihan (${batch.qty_lebih ?? 0}) harus sama dengan qty diterima (${batch.qty_diterima})` }

  // Optional TTD
  let ttdOpUrl: string | null = null
  let ttdAdminUrl: string | null = null
  const ttdOpB64    = formData.get('ttd_operator') as string
  const ttdAdminB64 = formData.get('ttd_admin') as string
  if (ttdOpB64)    ttdOpUrl    = await uploadSignature(supabase, ttdOpB64, `${batch.nomor_batch}_op`)
  if (ttdAdminB64) ttdAdminUrl = await uploadSignature(supabase, ttdAdminB64, `${batch.nomor_batch}_admin`)

  const { error } = await supabase.from('po_batch_penerimaan').update({
    qty_acc: qtyAcc,
    qty_reject: qtyReject,
    status_qc: 'selesai',
    status: 'selesai',
    qc_tanggal: qcTanggal,
    qc_operator_nama: (formData.get('operator_nama') as string) || null,
    qc_admin_nama: (formData.get('admin_nama') as string) || null,
    ttd_qc_operator_url: ttdOpUrl,
    ttd_qc_admin_url: ttdAdminUrl,
    catatan_qc: (formData.get('catatan_qc') as string) || null,
  }).eq('id', batchId)
  if (error) return { error: error.message }

  // Tambah stok ACC
  if (qtyAcc > 0) {
    await supabase.from('stok_packaging')
      .update({ stok_qty: supabase.rpc('__noop'), updated_at: new Date().toISOString() })
    // Use raw SQL via RPC or direct update with increment
    await supabase.rpc('increment_stok_packaging', { p_produk_id: batch.produk_id, p_qty: qtyAcc })
      .then(async (res: any) => {
        if (res.error) {
          // Fallback: read then update
          const { data: stok } = await supabase.from('stok_packaging')
            .select('stok_qty').eq('produk_id', batch.produk_id).single()
          if (stok) {
            await supabase.from('stok_packaging')
              .update({ stok_qty: (stok.stok_qty ?? 0) + qtyAcc, updated_at: new Date().toISOString() })
              .eq('produk_id', batch.produk_id)
          }
        }
      })
  }

  // Buat reject records
  const rejectItems: any[] = []
  if (qtyReject > 0) {
    rejectItems.push({
      batch_id: batchId, nomor_batch: batch.nomor_batch,
      po_id: batch.po_id, po_nomor: batch.po_nomor,
      vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
      produk_id: batch.produk_id, produk_kode: batch.produk_kode, produk_nama: batch.produk_nama,
      tanggal_terima: batch.tanggal_terima,
      jenis: 'reject', qty: qtyReject,
    })
  }
  if ((batch.qty_lebih ?? 0) > 0) {
    rejectItems.push({
      batch_id: batchId, nomor_batch: batch.nomor_batch,
      po_id: batch.po_id, po_nomor: batch.po_nomor,
      vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
      produk_id: batch.produk_id, produk_kode: batch.produk_kode, produk_nama: batch.produk_nama,
      tanggal_terima: batch.tanggal_terima,
      jenis: 'lebihan', qty: batch.qty_lebih,
    })
  }
  if (rejectItems.length > 0) {
    await supabase.from('po_packaging_reject').insert(rejectItems)
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── PENANGANAN REJECT/LEBIHAN ──────────────────────────────────────────────────

export async function updatePenangananReject(id: number, status: string, keterangan?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('po_packaging_reject').update({
    status_penanganan: status,
    penanganan_keterangan: keterangan || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── SURAT JALAN RETUR ─────────────────────────────────────────────────────────

export async function createSJRetur(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const vendorId    = parseInt(formData.get('vendor_id') as string)
  const tanggal     = formData.get('tanggal_retur') as string
  const rejectIdsRaw = formData.get('reject_ids') as string
  const rejectIds: number[] = rejectIdsRaw ? JSON.parse(rejectIdsRaw) : []

  if (!vendorId)          return { error: 'Vendor wajib dipilih' }
  if (!tanggal)           return { error: 'Tanggal retur wajib diisi' }
  if (!rejectIds.length)  return { error: 'Pilih minimal satu item reject' }

  const { data: vendor } = await supabase.from('vendor_packaging').select('nama').eq('id', vendorId).single()
  if (!vendor) return { error: 'Vendor tidak ditemukan' }

  const { data: rejects } = await supabase.from('po_packaging_reject')
    .select('qty, status_penanganan').in('id', rejectIds)
  if (!rejects) return { error: 'Item reject tidak ditemukan' }

  for (const r of rejects) {
    if (r.status_penanganan === 'diretur') return { error: 'Beberapa item sudah diretur sebelumnya' }
  }

  const totalQty = rejects.reduce((s: number, r: any) => s + r.qty, 0)
  const nomor = await genNomor(supabase, 'sj_retur_packaging', 'SJ-RTR')

  const { data: sj, error } = await supabase.from('sj_retur_packaging').insert({
    nomor_sj: nomor,
    tanggal_retur: tanggal,
    vendor_id: vendorId,
    vendor_nama: vendor.nama,
    total_qty: totalQty,
    catatan: (formData.get('catatan') as string) || null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Mark rejects as diretur
  await supabase.from('po_packaging_reject').update({
    status_penanganan: 'diretur',
    sj_retur_id: sj.id,
    tanggal_retur: tanggal,
  }).in('id', rejectIds)

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, sjId: sj.id }
}
