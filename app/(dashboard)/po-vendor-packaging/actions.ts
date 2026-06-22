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

// items JSON: [{ produk_id, qty_po, harga_satuan }]
export async function createPO(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const vendorId    = parseInt(formData.get('vendor_id') as string)
  const tanggalPO   = formData.get('tanggal_po') as string
  const nomorManual = (formData.get('nomor_po') as string)?.trim()
  const itemsRaw    = formData.get('items') as string

  if (!vendorId)   return { error: 'Vendor wajib dipilih' }
  if (!tanggalPO)  return { error: 'Tanggal PO wajib diisi' }
  if (!itemsRaw)   return { error: 'Minimal satu produk harus diisi' }

  const items: { produk_id: number; qty_po: number; harga_satuan?: number }[] = JSON.parse(itemsRaw)
  if (!items.length) return { error: 'Minimal satu produk harus diisi' }
  for (const it of items) {
    if (!it.produk_id) return { error: 'Produk wajib dipilih' }
    if (!it.qty_po || it.qty_po <= 0) return { error: 'Qty PO setiap produk wajib diisi' }
  }

  const { data: vendor } = await supabase.from('vendor_packaging').select('nama').eq('id', vendorId).single()
  if (!vendor) return { error: 'Vendor tidak ditemukan' }

  // Fetch all produk info at once
  const produkIds = items.map(i => i.produk_id)
  const { data: produkList } = await supabase.from('produk_packaging').select('id, kode, nama').in('id', produkIds)
  if (!produkList || produkList.length !== produkIds.length) return { error: 'Satu atau lebih produk tidak ditemukan' }
  const produkMap = Object.fromEntries(produkList.map((p: any) => [p.id, p]))

  let nomorPO = nomorManual
  if (!nomorPO) nomorPO = await genNomor(supabase, 'po_packaging', 'PO')

  const { data: existing } = await supabase.from('po_packaging').select('id').eq('nomor_po', nomorPO).single()
  if (existing) return { error: `Nomor PO "${nomorPO}" sudah digunakan` }

  const { data: po, error: poErr } = await supabase.from('po_packaging').insert({
    nomor_po: nomorPO,
    vendor_id: vendorId,
    vendor_nama: vendor.nama,
    tanggal_po: tanggalPO,
    tanggal_jatuh_tempo: (formData.get('tanggal_jatuh_tempo') as string) || null,
    catatan: (formData.get('catatan') as string) || null,
    created_by: user.id,
  }).select('id').single()
  if (poErr) return { error: poErr.message }

  const itemRows = items.map(it => ({
    po_id: po.id,
    produk_id: it.produk_id,
    produk_kode: produkMap[it.produk_id].kode,
    produk_nama: produkMap[it.produk_id].nama,
    qty_po: it.qty_po,
    harga_satuan: it.harga_satuan || null,
  }))
  const { error: itemErr } = await supabase.from('po_packaging_items').insert(itemRows)
  if (itemErr) {
    await supabase.from('po_packaging').delete().eq('id', po.id)
    return { error: itemErr.message }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomorPO }
}

export async function updatePO(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nomorPO  = (formData.get('nomor_po') as string)?.trim()
  const itemsRaw = formData.get('items') as string

  if (!nomorPO) return { error: 'Nomor PO wajib diisi' }

  const { data: dup } = await supabase.from('po_packaging').select('id').eq('nomor_po', nomorPO).neq('id', id).single()
  if (dup) return { error: `Nomor PO "${nomorPO}" sudah digunakan oleh PO lain` }

  const { error } = await supabase.from('po_packaging').update({
    nomor_po: nomorPO,
    tanggal_po: formData.get('tanggal_po') as string,
    tanggal_jatuh_tempo: (formData.get('tanggal_jatuh_tempo') as string) || null,
    catatan: (formData.get('catatan') as string) || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  // Update items if provided
  if (itemsRaw) {
    const items: { id?: number; produk_id: number; qty_po: number; harga_satuan?: number }[] = JSON.parse(itemsRaw)

    // Check none of the existing items have batches
    const { count: batchCount } = await supabase.from('po_batch_penerimaan')
      .select('*', { count: 'exact', head: true }).eq('po_id', id)
    if ((batchCount ?? 0) > 0) return { error: 'Tidak bisa edit item PO yang sudah ada batch penerimaannya' }

    // Fetch produk info
    const produkIds = items.map(i => i.produk_id)
    const { data: produkList } = await supabase.from('produk_packaging').select('id, kode, nama').in('id', produkIds)
    const produkMap = Object.fromEntries((produkList ?? []).map((p: any) => [p.id, p]))

    await supabase.from('po_packaging_items').delete().eq('po_id', id)
    const itemRows = items.map(it => ({
      po_id: id,
      produk_id: it.produk_id,
      produk_kode: produkMap[it.produk_id]?.kode ?? '',
      produk_nama: produkMap[it.produk_id]?.nama ?? '',
      qty_po: it.qty_po,
      harga_satuan: it.harga_satuan || null,
    }))
    const { error: itemErr } = await supabase.from('po_packaging_items').insert(itemRows)
    if (itemErr) return { error: itemErr.message }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function deletePO(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat yang bisa menghapus PO' }

  // 1. Reverse stok untuk semua batch yang sudah QC selesai
  const { data: batches } = await supabase.from('po_batch_penerimaan')
    .select('produk_id, qty_acc').eq('po_id', id).eq('status_qc', 'selesai')
  for (const b of batches ?? []) {
    if ((b.qty_acc ?? 0) > 0) {
      const { data: stok } = await supabase.from('stok_packaging')
        .select('stok_qty').eq('produk_id', b.produk_id).single()
      if (stok) {
        await supabase.from('stok_packaging')
          .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - b.qty_acc) })
          .eq('produk_id', b.produk_id)
      }
    }
  }

  // 2. Hapus SJ Retur yang terkait dengan reject PO ini
  const { data: batchIds } = await supabase.from('po_batch_penerimaan')
    .select('id').eq('po_id', id)
  const bIds = (batchIds ?? []).map((b: any) => b.id)
  if (bIds.length > 0) {
    const { data: rejects } = await supabase.from('po_packaging_reject')
      .select('sj_retur_id').in('batch_id', bIds).not('sj_retur_id', 'is', null)
    const sjIds = [...new Set((rejects ?? []).map((r: any) => r.sj_retur_id).filter(Boolean))]
    if (sjIds.length > 0) {
      await supabase.from('sj_retur_packaging').delete().in('id', sjIds)
    }
  }

  // 3. Delete cascade: reject → batch → items → po
  if (bIds.length > 0) {
    await supabase.from('po_packaging_reject').delete().in('batch_id', bIds)
  }
  await supabase.from('po_batch_penerimaan').delete().eq('po_id', id)
  await supabase.from('po_packaging_items').delete().eq('po_id', id)
  const { error } = await supabase.from('po_packaging').delete().eq('id', id)
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
  const poItemId    = parseInt(formData.get('po_item_id') as string)
  const qtyDiterima = parseInt(formData.get('qty_diterima') as string)
  const tanggal     = formData.get('tanggal_terima') as string

  if (!poId)                           return { error: 'PO wajib dipilih' }
  if (!poItemId)                       return { error: 'Item produk wajib dipilih' }
  if (!qtyDiterima || qtyDiterima <= 0) return { error: 'Qty diterima wajib diisi' }
  if (!tanggal)                        return { error: 'Tanggal terima wajib diisi' }

  const { data: po } = await supabase.from('po_packaging')
    .select('nomor_po, vendor_id, vendor_nama, status')
    .eq('id', poId).single()
  if (!po) return { error: 'PO tidak ditemukan' }
  if (po.status === 'void') return { error: 'PO sudah divoid' }

  const { data: item } = await supabase.from('po_packaging_items')
    .select('produk_id, produk_kode, produk_nama, qty_po, qty_diterima')
    .eq('id', poItemId).single()
  if (!item) return { error: 'Item PO tidak ditemukan' }

  // Already received for this item
  const { data: batches } = await supabase.from('po_batch_penerimaan')
    .select('qty_diterima, qty_lebih').eq('po_item_id', poItemId)
  const totalSudahDatang = (batches ?? []).reduce((s: number, b: any) => s + (b.qty_diterima - (b.qty_lebih ?? 0)), 0)
  const sisaPO = item.qty_po - totalSudahDatang
  const qtyLebih = Math.max(0, qtyDiterima - sisaPO)

  const nomorManual = (formData.get('nomor_batch') as string)?.trim()
  const nomor = nomorManual || await genNomor(supabase, 'batch_penerimaan', 'BTH')

  // Check duplicate nomor_batch
  const { data: dupBatch } = await supabase.from('po_batch_penerimaan').select('id').eq('nomor_batch', nomor).single()
  if (dupBatch) return { error: `Nomor batch "${nomor}" sudah digunakan` }

  const fotosRaw = formData.get('fotos_b64') as string
  const fotosB64 = fotosRaw ? JSON.parse(fotosRaw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadFotos(supabase, fotosB64, nomor) : []

  const { data: batch, error } = await supabase.from('po_batch_penerimaan').insert({
    nomor_batch: nomor,
    po_id: poId,
    po_item_id: poItemId,
    po_nomor: po.nomor_po,
    vendor_id: po.vendor_id,
    vendor_nama: po.vendor_nama,
    produk_id: item.produk_id,
    produk_kode: item.produk_kode,
    produk_nama: item.produk_nama,
    tanggal_terima: tanggal,
    qty_diterima: qtyDiterima,
    qty_lebih: qtyLebih,
    catatan: (formData.get('catatan') as string) || null,
    fotos: fotoUrls,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Update qty_diterima on the item
  const newItemQty = totalSudahDatang + qtyDiterima - qtyLebih
  await supabase.from('po_packaging_items').update({ qty_diterima: newItemQty }).eq('id', poItemId)

  // Update PO status based on all items
  const { data: allItems } = await supabase.from('po_packaging_items')
    .select('qty_po, qty_diterima').eq('po_id', poId)
  const allDone = (allItems ?? []).every((i: any) => i.qty_diterima >= i.qty_po)
  const anyDone = (allItems ?? []).some((i: any) => i.qty_diterima > 0)
  const newStatus = allDone ? 'selesai' : anyDone ? 'partial' : 'menunggu'
  await supabase.from('po_packaging').update({ status: newStatus }).eq('id', poId)

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, batchId: batch.id, qtyLebih }
}

export async function deleteBatch(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', id).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }

  // Reverse stok jika QC sudah selesai
  if (batch.status_qc === 'selesai' && (batch.qty_acc ?? 0) > 0) {
    const { data: stok } = await supabase.from('stok_packaging')
      .select('stok_qty').eq('produk_id', batch.produk_id).single()
    if (stok) {
      await supabase.from('stok_packaging')
        .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - batch.qty_acc) })
        .eq('produk_id', batch.produk_id)
    }
  }

  // Reverse qty_diterima pada po_packaging_items
  if (batch.po_item_id && (batch.qty_diterima - (batch.qty_lebih ?? 0)) > 0) {
    const { data: item } = await supabase.from('po_packaging_items')
      .select('qty_diterima').eq('id', batch.po_item_id).single()
    if (item) {
      const newQty = Math.max(0, item.qty_diterima - (batch.qty_diterima - (batch.qty_lebih ?? 0)))
      await supabase.from('po_packaging_items').update({ qty_diterima: newQty }).eq('id', batch.po_item_id)
    }
  }

  // Hapus reject records terkait batch ini
  await supabase.from('po_packaging_reject').delete().eq('batch_id', id)

  const { error } = await supabase.from('po_batch_penerimaan').delete().eq('id', id)
  if (error) return { error: error.message }

  // Update PO status
  const { data: allItems } = await supabase.from('po_packaging_items')
    .select('qty_po, qty_diterima').eq('po_id', batch.po_id)
  if (allItems) {
    const allDone = allItems.every((i: any) => i.qty_diterima >= i.qty_po)
    const anyDone = allItems.some((i: any) => i.qty_diterima > 0)
    const newStatus = allDone ? 'selesai' : anyDone ? 'partial' : 'menunggu'
    await supabase.from('po_packaging').update({ status: newStatus }).eq('id', batch.po_id)
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function editQCResult(batchId: number, newQtyAcc: number, newQtyReject: number, catatan?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status_qc !== 'selesai') return { error: 'QC belum selesai, gunakan form QC biasa' }

  const maxCheck = batch.qty_diterima - (batch.qty_lebih ?? 0)
  if (newQtyAcc + newQtyReject !== maxCheck)
    return { error: `Total ACC+Reject harus ${maxCheck} pcs` }

  // Adjust stok: diff dari qty_acc lama vs baru
  const oldAcc = batch.qty_acc ?? 0
  const diff = newQtyAcc - oldAcc
  if (diff !== 0) {
    const { data: stok } = await supabase.from('stok_packaging')
      .select('stok_qty').eq('produk_id', batch.produk_id).single()
    if (stok) {
      await supabase.from('stok_packaging')
        .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) + diff) })
        .eq('produk_id', batch.produk_id)
    }
  }

  // Update reject records
  await supabase.from('po_packaging_reject').delete().eq('batch_id', batchId).eq('jenis', 'reject')
  if (newQtyReject > 0) {
    await supabase.from('po_packaging_reject').insert({
      batch_id: batchId, nomor_batch: batch.nomor_batch,
      po_id: batch.po_id, po_nomor: batch.po_nomor,
      vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
      produk_id: batch.produk_id, produk_kode: batch.produk_kode, produk_nama: batch.produk_nama,
      tanggal_terima: batch.tanggal_terima,
      jenis: 'reject', qty: newQtyReject,
    })
  }

  await supabase.from('po_batch_penerimaan').update({
    qty_acc: newQtyAcc,
    qty_reject: newQtyReject,
    catatan_qc: catatan ?? batch.catatan_qc,
  }).eq('id', batchId)

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── QC ────────────────────────────────────────────────────────────────────────

export async function submitQC(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const batchId   = parseInt(formData.get('batch_id') as string)
  const qtyAcc    = parseInt(formData.get('qty_acc') as string)
  const qtyReject = parseInt(formData.get('qty_reject') as string)
  const qcTanggal = formData.get('qc_tanggal') as string

  if (isNaN(qtyAcc) || qtyAcc < 0)     return { error: 'Qty ACC tidak valid' }
  if (isNaN(qtyReject) || qtyReject < 0) return { error: 'Qty reject tidak valid' }
  if (!qcTanggal) return { error: 'Tanggal QC wajib diisi' }

  const { data: batch } = await supabase.from('po_batch_penerimaan')
    .select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status_qc === 'selesai') return { error: 'QC sudah diselesaikan' }

  const total = qtyAcc + qtyReject + (batch.qty_lebih ?? 0)
  if (total !== batch.qty_diterima)
    return { error: `Total ACC (${qtyAcc}) + Reject (${qtyReject}) + Lebihan (${batch.qty_lebih ?? 0}) harus sama dengan qty diterima (${batch.qty_diterima})` }

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

  if (qtyAcc > 0) {
    await supabase.rpc('increment_stok_packaging', { p_produk_id: batch.produk_id, p_qty: qtyAcc })
      .then(async (res: any) => {
        if (res.error) {
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

export async function deleteRejectItem(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { error } = await supabase.from('po_packaging_reject').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function resetRejectStatus(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Ambil sj_retur_id sebelum di-reset
  const { data: reject } = await supabase.from('po_packaging_reject')
    .select('sj_retur_id').eq('id', id).single()

  // Reset reject ke pending
  await supabase.from('po_packaging_reject').update({
    status_penanganan: 'pending',
    penanganan_keterangan: null,
    sj_retur_id: null,
    tanggal_retur: null,
  }).eq('id', id)

  // Jika punya SJ, cek apakah SJ masih punya item lain — kalau tidak ada, hapus SJ-nya
  if (reject?.sj_retur_id) {
    const { count } = await supabase.from('po_packaging_reject')
      .select('*', { count: 'exact', head: true })
      .eq('sj_retur_id', reject.sj_retur_id)
    if ((count ?? 0) === 0) {
      await supabase.from('sj_retur_packaging').delete().eq('id', reject.sj_retur_id)
    }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── SURAT JALAN RETUR ─────────────────────────────────────────────────────────

// items: [{ reject_id, qty_retur }] — qty_retur bisa < qty reject (partial)
export async function createSJRetur(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const vendorId   = parseInt(formData.get('vendor_id') as string)
  const tanggal    = formData.get('tanggal_retur') as string
  const itemsRaw   = formData.get('items') as string  // [{ reject_id, qty_retur }]

  if (!vendorId) return { error: 'Vendor wajib dipilih' }
  if (!tanggal)  return { error: 'Tanggal retur wajib diisi' }
  if (!itemsRaw) return { error: 'Pilih minimal satu item reject' }

  const items: { reject_id: number; qty_retur: number }[] = JSON.parse(itemsRaw)
  if (!items.length) return { error: 'Pilih minimal satu item reject' }
  for (const it of items) {
    if (!it.qty_retur || it.qty_retur <= 0) return { error: 'Qty retur harus lebih dari 0' }
  }

  const { data: vendor } = await supabase.from('vendor_packaging').select('nama').eq('id', vendorId).single()
  if (!vendor) return { error: 'Vendor tidak ditemukan' }

  const rejectIds = items.map(i => i.reject_id)
  const { data: rejects } = await supabase.from('po_packaging_reject')
    .select('*').in('id', rejectIds)
  if (!rejects || rejects.length !== rejectIds.length) return { error: 'Item reject tidak ditemukan' }

  for (const r of rejects) {
    if (r.status_penanganan === 'diretur') return { error: `${r.produk_nama} sudah diretur sebelumnya` }
  }

  // Validate qty_retur tidak melebihi qty reject
  for (const it of items) {
    const r = rejects.find((x: any) => x.id === it.reject_id)
    if (r && it.qty_retur > r.qty) return { error: `Qty retur ${r.produk_nama} (${it.qty_retur}) melebihi qty reject (${r.qty})` }
  }

  const totalQty = items.reduce((s, i) => s + i.qty_retur, 0)
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

  // Proses setiap item — jika partial, split reject
  for (const it of items) {
    const r = rejects.find((x: any) => x.id === it.reject_id)!
    if (it.qty_retur === r.qty) {
      // Full retur
      await supabase.from('po_packaging_reject').update({
        status_penanganan: 'diretur', sj_retur_id: sj.id, tanggal_retur: tanggal,
      }).eq('id', it.reject_id)
    } else {
      // Partial: update qty asli jadi qty_retur, buat sisa sebagai pending baru
      await supabase.from('po_packaging_reject').update({
        qty: it.qty_retur,
        status_penanganan: 'diretur', sj_retur_id: sj.id, tanggal_retur: tanggal,
      }).eq('id', it.reject_id)
      // Sisa yang tidak diretur → buat reject baru pending
      await supabase.from('po_packaging_reject').insert({
        batch_id: r.batch_id, nomor_batch: r.nomor_batch,
        po_id: r.po_id, po_nomor: r.po_nomor,
        vendor_id: r.vendor_id, vendor_nama: r.vendor_nama,
        produk_id: r.produk_id, produk_kode: r.produk_kode, produk_nama: r.produk_nama,
        tanggal_terima: r.tanggal_terima,
        jenis: r.jenis, qty: r.qty - it.qty_retur,
        status_penanganan: 'pending',
      })
    }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, sjId: sj.id }
}
