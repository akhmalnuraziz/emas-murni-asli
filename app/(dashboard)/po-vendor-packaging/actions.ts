'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function genNomor(supabase: any, counter: string, prefix: string): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: counter })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `${prefix}/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

// Generate nomor dengan reset per bulan: PREFIX/001/MM/YY (urutan 3 digit, reset tiap year_month)
async function genNomorBulanan(supabase: any, counter: string, prefix: string): Promise<string> {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear() % 100).padStart(2, '0')
  const ym = `${now.getFullYear()}${mm}`
  const { data } = await supabase.rpc('increment_monthly_counter', { p_counter: counter, p_ym: ym })
  return `${prefix}/${String(data ?? 1).padStart(3, '0')}/${mm}/${yy}`
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

// ── MASTER KATEGORI REJECT ────────────────────────────────────────────────────

export async function createKategoriReject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama kategori wajib diisi' }

  const { count } = await supabase.from('reject_kategori_packaging').select('*', { count: 'exact', head: true })
  const kode = `RJK${String((count ?? 0) + 1).padStart(3, '0')}`

  const { error } = await supabase.from('reject_kategori_packaging').insert({
    kode, nama, aktif: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function updateKategoriReject(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const nama = (formData.get('nama') as string)?.trim()
  if (!nama) return { error: 'Nama kategori wajib diisi' }

  const { error } = await supabase.from('reject_kategori_packaging').update({
    nama,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function toggleKategoriRejectAktif(id: number, aktif: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('reject_kategori_packaging').update({ aktif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function deleteKategoriReject(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  // Soft delete kalau sudah pernah dipakai, hard delete kalau belum
  const { count } = await supabase.from('po_packaging_reject')
    .select('*', { count: 'exact', head: true }).eq('kategori_id', id)
  if ((count ?? 0) > 0) {
    await supabase.from('reject_kategori_packaging').update({
      voided_at: new Date().toISOString(), aktif: false,
    }).eq('id', id)
  } else {
    await supabase.from('reject_kategori_packaging').delete().eq('id', id)
  }
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
  if (!nomorPO) nomorPO = await genNomorBulanan(supabase, 'po_packaging', 'PO.VP')

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
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager yang bisa menghapus PO' }
  // ROLE_CHECK_DISABLED: 
  // 1. Cari semua batch terkait PO ini (batch awal + batch pengganti yang link ke PO ini)
  const { data: allBatches } = await supabase.from('po_batch_penerimaan')
    .select('id, status_qc, is_pengganti').eq('po_id', id)
  const bIds = (allBatches ?? []).map((b: any) => b.id)

  // 2. Reverse stok semua batch QC selesai (termasuk pengganti) — pakai child items per produk
  if (bIds.length > 0) {
    const { data: childItems } = await supabase.from('po_batch_items')
      .select('batch_id, produk_id, qty_acc').in('batch_id', bIds)
    const batchQCMap: Record<number, string> = Object.fromEntries((allBatches ?? []).map((b: any) => [b.id, b.status_qc]))
    for (const ci of childItems ?? []) {
      if (batchQCMap[ci.batch_id] === 'selesai' && (ci.qty_acc ?? 0) > 0) {
        const { data: stok } = await supabase.from('stok_packaging')
          .select('stok_qty').eq('produk_id', ci.produk_id).single()
        if (stok) {
          await supabase.from('stok_packaging')
            .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - ci.qty_acc) })
            .eq('produk_id', ci.produk_id)
        }
      }
    }
  }

  // 3. Cascade hapus SJ Retur via snapshot — robust meski reject sudah dihapus duluan
  await cascadeDeleteSJForScope(supabase, 'po_id', id)

  // 4. Delete cascade: reject → batch → items → po
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
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  if (!reason) return { error: 'Alasan void wajib diisi' }

  const { count } = await supabase.from('po_batch_penerimaan').select('*', { count: 'exact', head: true }).eq('po_id', id)
  if ((count ?? 0) > 0) return { error: 'Tidak bisa void PO yang sudah ada batch penerimaannya' }

  await supabase.from('po_packaging').update({ voided_at: new Date().toISOString(), void_reason: reason, status: 'void' }).eq('id', id)
  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── HELPER: Cascade delete SJ Retur via snapshot kolom di sj_retur_packaging_items ─

/**
 * Hapus SJ Retur yang scope-nya habis (semua item berasal dari scope yang sedang dihapus).
 * Pakai snapshot `po_id` / `batch_id` di `sj_retur_packaging_items` — TIDAK bergantung pada
 * `po_packaging_reject` yang mungkin sudah dihapus.
 *
 * scopeKey: kolom yang dipakai untuk cek scope (po_id atau batch_id).
 * scopeVal: nilainya. Bisa array (mis. semua batch ID di sebuah PO).
 *
 * Untuk tiap SJ kandidat:
 *  - Hitung items dengan scopeKey == scopeVal (in scope) dan items dengan scopeKey != scopeVal (out of scope).
 *  - Kalau tidak ada out-of-scope → SJ otomatis kosong setelah delete → hapus SJ.
 *  - Kalau ada out-of-scope → biarkan, tapi hapus items yang in-scope (cleanup parsial).
 *
 * Sebelum hapus SJ, juga reverse stok + hapus batch pengganti yang link ke SJ tsb.
 */
async function cascadeDeleteSJForScope(supabase: any, scopeKey: 'po_id' | 'batch_id', scopeVal: number | number[]) {
  const vals = Array.isArray(scopeVal) ? scopeVal : [scopeVal]
  if (vals.length === 0) return

  // Cari SJ yang punya item di scope ini
  const { data: hits } = await supabase.from('sj_retur_packaging_items')
    .select('sj_retur_id').in(scopeKey, vals)
  const sjIds = [...new Set((hits ?? []).map((h: any) => h.sj_retur_id).filter(Boolean))]
  if (sjIds.length === 0) return

  for (const sjId of sjIds) {
    // Hitung items di SJ ini yang DI LUAR scope
    const { data: outOfScope } = await supabase.from('sj_retur_packaging_items')
      .select('id').eq('sj_retur_id', sjId).not(scopeKey, 'in', `(${vals.join(',')})`).limit(1)

    if ((outOfScope?.length ?? 0) === 0) {
      // SJ akan kosong → hapus SJ (cascade ke sj_retur_packaging_items)

      // Reverse stok + hapus batch pengganti yang link ke SJ ini (pakai child items)
      const { data: pengBatches } = await supabase.from('po_batch_penerimaan')
        .select('id, status_qc')
        .eq('is_pengganti', true).eq('sj_retur_id_origin', sjId)
      const pengIds = (pengBatches ?? []).map((b: any) => b.id)
      if (pengIds.length > 0) {
        const { data: pengChild } = await supabase.from('po_batch_items')
          .select('batch_id, produk_id, qty_acc').in('batch_id', pengIds)
        const pengQCMap: Record<number, string> = Object.fromEntries(
          (pengBatches ?? []).map((b: any) => [b.id, b.status_qc])
        )
        for (const ci of pengChild ?? []) {
          if (pengQCMap[ci.batch_id] === 'selesai' && (ci.qty_acc ?? 0) > 0) {
            const { data: stok } = await supabase.from('stok_packaging')
              .select('stok_qty').eq('produk_id', ci.produk_id).single()
            if (stok) {
              await supabase.from('stok_packaging')
                .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - ci.qty_acc) })
                .eq('produk_id', ci.produk_id)
            }
          }
        }
        await supabase.from('po_packaging_reject').delete().in('batch_id', pengIds)
        await supabase.from('po_batch_penerimaan').delete().in('id', pengIds)
      }

      await supabase.from('sj_retur_packaging').delete().eq('id', sjId)
    } else {
      // SJ campuran dari scope lain → hapus items in-scope dan recompute total_qty
      await supabase.from('sj_retur_packaging_items').delete().eq('sj_retur_id', sjId).in(scopeKey, vals)
      const { data: remaining } = await supabase.from('sj_retur_packaging_items')
        .select('qty_retur, qty_diganti').eq('sj_retur_id', sjId)
      const newTotal  = (remaining ?? []).reduce((s: number, r: any) => s + (r.qty_retur || 0), 0)
      const newGanti  = (remaining ?? []).reduce((s: number, r: any) => s + (r.qty_diganti || 0), 0)
      let status = 'menunggu_ganti'
      if (newGanti >= newTotal && newTotal > 0) status = 'selesai_diganti'
      else if (newGanti > 0) status = 'sebagian_diganti'
      await supabase.from('sj_retur_packaging').update({
        total_qty: newTotal, total_qty_diganti: newGanti, status,
      }).eq('id', sjId)
    }
  }
}

// ── HELPER: Recompute status SJ Retur ──────────────────────────────────────────

async function recomputeSJStatus(supabase: any, sjId: number) {
  const { data: items } = await supabase.from('sj_retur_packaging_items')
    .select('qty_retur, qty_diganti').eq('sj_retur_id', sjId)
  if (!items) return
  const totalRetur  = items.reduce((s: number, i: any) => s + (i.qty_retur || 0), 0)
  const totalGanti  = items.reduce((s: number, i: any) => s + (i.qty_diganti || 0), 0)
  let status = 'menunggu_ganti'
  if (totalGanti >= totalRetur && totalRetur > 0) status = 'selesai_diganti'
  else if (totalGanti > 0) status = 'sebagian_diganti'
  await supabase.from('sj_retur_packaging').update({
    total_qty_diganti: totalGanti, status,
  }).eq('id', sjId)
}

// ── BATCH PENERIMAAN ──────────────────────────────────────────────────────────

// Multi-produk: items: [{ po_item_id, qty_diterima }]
export async function createBatchPenerimaan(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const poId      = parseInt(formData.get('po_id') as string)
  const tanggal   = formData.get('tanggal_terima') as string
  const itemsRaw  = formData.get('items') as string

  if (!poId)     return { error: 'PO wajib dipilih' }
  if (!tanggal)  return { error: 'Tanggal terima wajib diisi' }
  if (!itemsRaw) return { error: 'Minimal satu produk harus diisi' }

  const itemsInput: { po_item_id: number; qty_diterima: number }[] = JSON.parse(itemsRaw)
  if (!itemsInput.length) return { error: 'Minimal satu produk harus diisi' }
  for (const it of itemsInput) {
    if (!it.po_item_id) return { error: 'Item produk wajib dipilih' }
    if (!it.qty_diterima || it.qty_diterima <= 0) return { error: 'Qty diterima setiap produk wajib > 0' }
  }

  const { data: po } = await supabase.from('po_packaging')
    .select('nomor_po, vendor_id, vendor_nama, status').eq('id', poId).single()
  if (!po) return { error: 'PO tidak ditemukan' }
  if (po.status === 'void') return { error: 'PO sudah divoid' }

  // Ambil semua po_items terkait sekaligus
  const itemIds = itemsInput.map(i => i.po_item_id)
  const { data: poItems } = await supabase.from('po_packaging_items')
    .select('id, produk_id, produk_kode, produk_nama, qty_po, qty_diterima').in('id', itemIds)
  if (!poItems || poItems.length !== itemIds.length) return { error: 'Satu atau lebih item PO tidak ditemukan' }

  // Hitung sisa per po_item (mengikutsertakan penerimaan sebelumnya)
  const { data: prevBatches } = await supabase.from('po_batch_items')
    .select('po_item_id, qty_diterima, qty_lebih').in('po_item_id', itemIds)
  const sisaMap: Record<number, number> = {}
  for (const pi of poItems) {
    const taken = (prevBatches ?? []).filter((b: any) => b.po_item_id === pi.id)
      .reduce((s: number, b: any) => s + (b.qty_diterima - (b.qty_lebih ?? 0)), 0)
    sisaMap[pi.id] = pi.qty_po - taken
  }

  // Hitung qty_lebih per item
  const itemRows = itemsInput.map(it => {
    const sisa = sisaMap[it.po_item_id] ?? 0
    const qtyLebih = Math.max(0, it.qty_diterima - sisa)
    const pi = poItems.find((p: any) => p.id === it.po_item_id)!
    return {
      po_item_id: it.po_item_id,
      produk_id: pi.produk_id,
      produk_kode: pi.produk_kode,
      produk_nama: pi.produk_nama,
      qty_diterima: it.qty_diterima,
      qty_lebih: qtyLebih,
    }
  })

  const nomorManual = (formData.get('nomor_batch') as string)?.trim()
  const nomor = nomorManual || await genNomorBulanan(supabase, 'batch_penerimaan', 'BATCH')

  const { data: dupBatch } = await supabase.from('po_batch_penerimaan').select('id').eq('nomor_batch', nomor).single()
  if (dupBatch) return { error: `Nomor batch "${nomor}" sudah digunakan` }

  const fotosRaw = formData.get('fotos_b64') as string
  const fotosB64 = fotosRaw ? JSON.parse(fotosRaw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadFotos(supabase, fotosB64, nomor) : []

  // Buat header batch — kolom produk_* di-set dari item pertama (legacy backward-compat, untuk single-item lihat batch lama)
  const headerProduk = itemRows[0]
  const totalDiterima = itemRows.reduce((s, r) => s + r.qty_diterima, 0)
  const totalLebih    = itemRows.reduce((s, r) => s + r.qty_lebih, 0)

  const { data: batch, error } = await supabase.from('po_batch_penerimaan').insert({
    nomor_batch: nomor,
    po_id: poId,
    po_item_id: itemRows.length === 1 ? headerProduk.po_item_id : null,
    po_nomor: po.nomor_po,
    vendor_id: po.vendor_id,
    vendor_nama: po.vendor_nama,
    produk_id: headerProduk.produk_id,
    produk_kode: headerProduk.produk_kode,
    produk_nama: headerProduk.produk_nama,
    tanggal_terima: tanggal,
    qty_diterima: totalDiterima,
    qty_lebih: totalLebih,
    catatan: (formData.get('catatan') as string) || null,
    fotos: fotoUrls,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Insert child items
  const childInsert = itemRows.map(r => ({
    batch_id: batch.id,
    po_item_id: r.po_item_id,
    produk_id: r.produk_id,
    produk_kode: r.produk_kode,
    produk_nama: r.produk_nama,
    qty_diterima: r.qty_diterima,
    qty_lebih: r.qty_lebih,
  }))
  const { error: childErr } = await supabase.from('po_batch_items').insert(childInsert)
  if (childErr) {
    await supabase.from('po_batch_penerimaan').delete().eq('id', batch.id)
    return { error: childErr.message }
  }

  // Update qty_diterima di setiap po_packaging_items
  for (const r of itemRows) {
    const pi = poItems.find((p: any) => p.id === r.po_item_id)!
    const taken = (prevBatches ?? []).filter((b: any) => b.po_item_id === r.po_item_id)
      .reduce((s: number, b: any) => s + (b.qty_diterima - (b.qty_lebih ?? 0)), 0)
    const newQty = taken + r.qty_diterima - r.qty_lebih
    await supabase.from('po_packaging_items').update({ qty_diterima: newQty }).eq('id', r.po_item_id)
  }

  // Update PO status
  const { data: allItems } = await supabase.from('po_packaging_items')
    .select('qty_po, qty_diterima').eq('po_id', poId)
  const allDone = (allItems ?? []).every((i: any) => i.qty_diterima >= i.qty_po)
  const anyDone = (allItems ?? []).some((i: any) => i.qty_diterima > 0)
  const newStatus = allDone ? 'selesai' : anyDone ? 'partial' : 'menunggu'
  await supabase.from('po_packaging').update({ status: newStatus }).eq('id', poId)

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, batchId: batch.id }
}

// ── EDIT BATCH PENERIMAAN (qty/tanggal/catatan) — nomor batch TIDAK berubah ──────
// Hanya untuk batch yang BELUM di-QC. Total qty_diterima di PO ikut ter-update.
export async function editBatchPenerimaan(batchId: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Penerimaan tidak ditemukan' }
  if (batch.is_pengganti) return { error: 'Batch pengganti tidak bisa diedit di sini' }
  if (batch.status_qc === 'selesai') return { error: 'QC sudah selesai — tidak bisa edit qty. Gunakan Edit QC atau hapus batch.' }

  const tanggal  = formData.get('tanggal_terima') as string
  const itemsRaw = formData.get('items') as string
  if (!tanggal)  return { error: 'Tanggal terima wajib diisi' }
  if (!itemsRaw) return { error: 'Minimal satu produk harus diisi' }

  const itemsInput: { po_item_id: number; qty_diterima: number }[] = JSON.parse(itemsRaw)
  if (!itemsInput.length) return { error: 'Minimal satu produk harus diisi' }
  for (const it of itemsInput) {
    if (!it.po_item_id) return { error: 'Item produk wajib dipilih' }
    if (!it.qty_diterima || it.qty_diterima <= 0) return { error: 'Qty diterima setiap produk wajib > 0' }
  }

  const itemIds = itemsInput.map(i => i.po_item_id)
  const { data: poItems } = await supabase.from('po_packaging_items')
    .select('id, produk_id, produk_kode, produk_nama, qty_po').in('id', itemIds)
  if (!poItems || poItems.length !== itemIds.length) return { error: 'Satu atau lebih item PO tidak ditemukan' }

  // qty yang sudah diambil oleh batch LAIN (exclude batch ini) per po_item
  const { data: allBatchItems } = await supabase.from('po_batch_items')
    .select('po_item_id, qty_diterima, qty_lebih, batch_id').in('po_item_id', itemIds)
  const otherTaken: Record<number, number> = {}
  for (const pi of poItems) {
    otherTaken[pi.id] = (allBatchItems ?? [])
      .filter((b: any) => b.po_item_id === pi.id && b.batch_id !== batchId)
      .reduce((s: number, b: any) => s + (b.qty_diterima - (b.qty_lebih ?? 0)), 0)
  }

  // Hitung ulang qty_lebih untuk batch ini & qty_diterima final per po_item
  const itemRows = itemsInput.map(it => {
    const pi = poItems.find((p: any) => p.id === it.po_item_id)!
    const sisa = pi.qty_po - (otherTaken[pi.id] ?? 0)
    const qtyLebih = Math.max(0, it.qty_diterima - sisa)
    return {
      po_item_id: it.po_item_id,
      produk_id: pi.produk_id, produk_kode: pi.produk_kode, produk_nama: pi.produk_nama,
      qty_diterima: it.qty_diterima, qty_lebih: qtyLebih,
    }
  })

  // Ganti child items batch ini
  await supabase.from('po_batch_items').delete().eq('batch_id', batchId)
  const { error: childErr } = await supabase.from('po_batch_items').insert(
    itemRows.map(r => ({
      batch_id: batchId, po_item_id: r.po_item_id,
      produk_id: r.produk_id, produk_kode: r.produk_kode, produk_nama: r.produk_nama,
      qty_diterima: r.qty_diterima, qty_lebih: r.qty_lebih,
    }))
  )
  if (childErr) return { error: childErr.message }

  // Update header batch (qty total, tanggal, catatan) — nomor_batch TETAP
  const header = itemRows[0]
  await supabase.from('po_batch_penerimaan').update({
    po_item_id: itemRows.length === 1 ? header.po_item_id : null,
    produk_id: header.produk_id, produk_kode: header.produk_kode, produk_nama: header.produk_nama,
    tanggal_terima: tanggal,
    qty_diterima: itemRows.reduce((s, r) => s + r.qty_diterima, 0),
    qty_lebih: itemRows.reduce((s, r) => s + r.qty_lebih, 0),
    catatan: (formData.get('catatan') as string) || null,
  }).eq('id', batchId)

  // Update qty_diterima final di po_packaging_items
  for (const r of itemRows) {
    const net = r.qty_diterima - r.qty_lebih
    await supabase.from('po_packaging_items')
      .update({ qty_diterima: (otherTaken[r.po_item_id] ?? 0) + net })
      .eq('id', r.po_item_id)
  }

  // Update status PO
  const { data: allItems } = await supabase.from('po_packaging_items')
    .select('qty_po, qty_diterima').eq('po_id', batch.po_id)
  const allDone = (allItems ?? []).every((i: any) => i.qty_diterima >= i.qty_po)
  const anyDone = (allItems ?? []).some((i: any) => i.qty_diterima > 0)
  await supabase.from('po_packaging')
    .update({ status: allDone ? 'selesai' : anyDone ? 'partial' : 'menunggu' })
    .eq('id', batch.po_id)

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── BATCH PENGGANTI (dari SJ Retur) ────────────────────────────────────────────

// Multi-item: items: [{ sj_item_id, qty_diterima }]
// Batch pengganti boleh berisi beberapa item dari SJ yang sama.
export async function createBatchPengganti(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const sjId     = parseInt(formData.get('sj_retur_id') as string)
  const tanggal  = formData.get('tanggal_terima') as string
  const itemsRaw = formData.get('items') as string

  if (!sjId)     return { error: 'SJ Retur wajib dipilih' }
  if (!tanggal)  return { error: 'Tanggal terima wajib diisi' }
  if (!itemsRaw) return { error: 'Minimal satu produk harus dipilih' }

  const itemsInput: { sj_item_id: number; qty_diterima: number }[] = JSON.parse(itemsRaw)
  if (!itemsInput.length) return { error: 'Minimal satu produk harus dipilih' }
  for (const it of itemsInput) {
    if (!it.sj_item_id) return { error: 'SJ item wajib dipilih' }
    if (!it.qty_diterima || it.qty_diterima <= 0) return { error: 'Qty diterima setiap produk wajib > 0' }
  }

  const { data: sj } = await supabase.from('sj_retur_packaging')
    .select('id, vendor_id, vendor_nama, status').eq('id', sjId).single()
  if (!sj) return { error: 'SJ Retur tidak ditemukan' }
  if (sj.status === 'selesai_diganti') return { error: 'SJ ini sudah selesai diganti' }

  const sjItemIds = itemsInput.map(i => i.sj_item_id)
  const { data: sjItems } = await supabase.from('sj_retur_packaging_items')
    .select('*').in('id', sjItemIds)
  if (!sjItems || sjItems.length !== sjItemIds.length) return { error: 'Satu atau lebih item SJ tidak ditemukan' }

  // Validasi tiap item: harus dari SJ yang sama + qty tidak melebihi sisa perlu ganti
  for (const it of itemsInput) {
    const si = sjItems.find((s: any) => s.id === it.sj_item_id)!
    if (si.sj_retur_id !== sjId) return { error: 'Item SJ tidak cocok dengan SJ Retur' }
    const sisa = (si.qty_retur ?? 0) - (si.qty_diganti ?? 0)
    if (sisa <= 0) return { error: `${si.produk_nama} sudah sepenuhnya diganti` }
    if (it.qty_diterima > sisa) return { error: `${si.produk_nama}: qty (${it.qty_diterima}) melebihi sisa (${sisa})` }
  }

  // Siklus_ke: max(siklus) + 1 dari batch pengganti yang sudah ada untuk SJ ini
  const { data: prevBatches } = await supabase.from('po_batch_penerimaan')
    .select('siklus_ke').eq('sj_retur_id_origin', sjId).order('siklus_ke', { ascending: false }).limit(1)
  const siklusKe = ((prevBatches?.[0]?.siklus_ke ?? 1)) + 1

  const nomorManual = (formData.get('nomor_batch') as string)?.trim()
  const nomor = nomorManual || await genNomorBulanan(supabase, 'sj_tbp', 'SJ.TBP')

  const { data: dupBatch } = await supabase.from('po_batch_penerimaan').select('id').eq('nomor_batch', nomor).single()
  if (dupBatch) return { error: `Nomor batch "${nomor}" sudah digunakan` }

  const fotosRaw = formData.get('fotos_b64') as string
  const fotosB64 = fotosRaw ? JSON.parse(fotosRaw) : []
  const fotoUrls = fotosB64.length > 0 ? await uploadFotos(supabase, fotosB64, nomor) : []

  const headerItem = sjItems.find((s: any) => s.id === itemsInput[0].sj_item_id)!
  const totalDiterima = itemsInput.reduce((s, i) => s + i.qty_diterima, 0)

  const { data: batch, error } = await supabase.from('po_batch_penerimaan').insert({
    nomor_batch: nomor,
    po_id: headerItem.po_id,
    po_item_id: null,
    po_nomor: headerItem.po_nomor,
    vendor_id: sj.vendor_id,
    vendor_nama: sj.vendor_nama,
    produk_id: headerItem.produk_id,
    produk_kode: headerItem.produk_kode,
    produk_nama: headerItem.produk_nama,
    tanggal_terima: tanggal,
    qty_diterima: totalDiterima,
    qty_lebih: 0,
    catatan: (formData.get('catatan') as string) || null,
    fotos: fotoUrls,
    is_pengganti: true,
    sj_retur_id_origin: sjId,
    sj_item_id_origin: itemsInput.length === 1 ? itemsInput[0].sj_item_id : null,
    siklus_ke: siklusKe,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Insert po_batch_items child
  const childInsert = itemsInput.map(it => {
    const si = sjItems.find((s: any) => s.id === it.sj_item_id)!
    return {
      batch_id: batch.id,
      po_item_id: null,
      produk_id: si.produk_id,
      produk_kode: si.produk_kode,
      produk_nama: si.produk_nama,
      qty_diterima: it.qty_diterima,
      qty_lebih: 0,
      sj_item_id_origin: it.sj_item_id,
    }
  })
  const { error: childErr } = await supabase.from('po_batch_items').insert(childInsert)
  if (childErr) {
    await supabase.from('po_batch_penerimaan').delete().eq('id', batch.id)
    return { error: childErr.message }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, batchId: batch.id }
}

export async function deleteBatch(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', id).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }

  // Ambil child items (multi-produk per batch)
  const { data: bItems } = await supabase.from('po_batch_items').select('*').eq('batch_id', id)
  const items = bItems ?? []

  // Reverse stok per produk (kalau QC selesai dan qty_acc > 0)
  if (batch.status_qc === 'selesai') {
    for (const bi of items) {
      if ((bi.qty_acc ?? 0) > 0) {
        const { data: stok } = await supabase.from('stok_packaging')
          .select('stok_qty').eq('produk_id', bi.produk_id).single()
        if (stok) {
          await supabase.from('stok_packaging')
            .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - bi.qty_acc) })
            .eq('produk_id', bi.produk_id)
        }
      }
    }
  }

  // Reverse qty_diterima di po_packaging_items per child item (kecuali batch pengganti)
  if (!batch.is_pengganti) {
    for (const bi of items) {
      if (!bi.po_item_id) continue
      const net = bi.qty_diterima - (bi.qty_lebih ?? 0)
      if (net <= 0) continue
      const { data: poi } = await supabase.from('po_packaging_items')
        .select('qty_diterima').eq('id', bi.po_item_id).single()
      if (poi) {
        const newQty = Math.max(0, poi.qty_diterima - net)
        await supabase.from('po_packaging_items').update({ qty_diterima: newQty }).eq('id', bi.po_item_id)
      }
    }
  }

  // Cascade SJ via snapshot batch_id (robust meski reject sudah dihapus)
  await cascadeDeleteSJForScope(supabase, 'batch_id', id)

  // Hapus reject records sisa
  await supabase.from('po_packaging_reject').delete().eq('batch_id', id)

  // Batch pengganti: reverse qty_diganti per SJ item menggunakan sj_item_id_origin di batch_items
  if (batch.is_pengganti && batch.status_qc === 'selesai') {
    const affectedSJ = new Set<number>()
    for (const bi of items) {
      if ((bi.qty_acc ?? 0) <= 0) continue
      const sjItemId = bi.sj_item_id_origin ?? (items.length === 1 ? batch.sj_item_id_origin : null)
      if (!sjItemId) continue
      const { data: sjItem } = await supabase.from('sj_retur_packaging_items')
        .select('qty_diganti, sj_retur_id').eq('id', sjItemId).single()
      if (!sjItem) continue
      await supabase.from('sj_retur_packaging_items')
        .update({ qty_diganti: Math.max(0, (sjItem.qty_diganti ?? 0) - (bi.qty_acc ?? 0)) })
        .eq('id', sjItemId)
      affectedSJ.add(sjItem.sj_retur_id)
    }
    for (const sjId of affectedSJ) await recomputeSJStatus(supabase, sjId)
  }

  const { error } = await supabase.from('po_batch_penerimaan').delete().eq('id', id)
  if (error) return { error: error.message }

  // Update PO status (hanya untuk batch awal, bukan pengganti)
  if (!batch.is_pengganti) {
    const { data: allItems } = await supabase.from('po_packaging_items')
      .select('qty_po, qty_diterima').eq('po_id', batch.po_id)
    if (allItems) {
      const allDone = allItems.every((i: any) => i.qty_diterima >= i.qty_po)
      const anyDone = allItems.some((i: any) => i.qty_diterima > 0)
      const newStatus = allDone ? 'selesai' : anyDone ? 'partial' : 'menunggu'
      await supabase.from('po_packaging').update({ status: newStatus }).eq('id', batch.po_id)
    }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// Edit QC per-item. Format formData sama dengan submitQC.
export async function editQCResult(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  const batchId  = parseInt(formData.get('batch_id') as string)
  const itemsRaw = formData.get('items') as string
  const catatan  = (formData.get('catatan_qc') as string) || null
  if (!batchId)  return { error: 'Batch ID hilang' }
  if (!itemsRaw) return { error: 'Data QC kosong' }

  type RejectRow = { qty: number; kategori_id?: number; alasan_manual?: string; catatan?: string }
  type ItemQC    = { batch_item_id: number; qty_acc: number; rejects: RejectRow[] }
  const items: ItemQC[] = JSON.parse(itemsRaw)

  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status_qc !== 'selesai') return { error: 'QC belum selesai, gunakan form QC biasa' }

  // Guard: jangan edit kalau ada reject yang sudah diretur/dikirim SJ
  const { data: lockedReject } = await supabase.from('po_packaging_reject')
    .select('id').eq('batch_id', batchId).neq('jenis', 'lebihan')
    .not('sj_retur_id', 'is', null).limit(1)
  if (lockedReject && lockedReject.length > 0) {
    return { error: 'Tidak bisa edit QC: reject batch ini sudah masuk SJ Retur. Reset/hapus SJ Retur dulu.' }
  }

  const { data: batchItems } = await supabase.from('po_batch_items').select('*').eq('batch_id', batchId)
  if (!batchItems || batchItems.length === 0) return { error: 'Batch tidak punya item' }

  // Validasi per item
  for (const bi of batchItems) {
    const itemQC = items.find(i => i.batch_item_id === bi.id)
    if (!itemQC) return { error: `Item ${bi.produk_nama} hilang di payload` }
    const qtyReject = itemQC.rejects.reduce((s, r) => s + (r.qty || 0), 0)
    const total = itemQC.qty_acc + qtyReject + (bi.qty_lebih ?? 0)
    if (total !== bi.qty_diterima) {
      return { error: `${bi.produk_nama}: total = ${total} ≠ qty diterima ${bi.qty_diterima}` }
    }
    for (const r of itemQC.rejects) {
      if (!r.qty || r.qty <= 0) return { error: `Reject ${bi.produk_nama}: qty harus > 0` }
      if (!r.kategori_id && !r.alasan_manual?.trim()) return { error: `Reject ${bi.produk_nama}: kategori atau alasan wajib` }
    }
  }

  // Validasi sisa SJ per item untuk batch pengganti
  if (batch.is_pengganti) {
    for (const bi of batchItems) {
      const itemQC = items.find(i => i.batch_item_id === bi.id)
      if (!itemQC) continue
      const sjItemId = bi.sj_item_id_origin ?? (batchItems.length === 1 ? batch.sj_item_id_origin : null)
      if (!sjItemId) continue
      const { data: sjItem } = await supabase.from('sj_retur_packaging_items')
        .select('qty_retur, qty_diganti').eq('id', sjItemId).single()
      if (!sjItem) continue
      const sisaLuar = (sjItem.qty_retur ?? 0) - ((sjItem.qty_diganti ?? 0) - (bi.qty_acc ?? 0))
      if (itemQC.qty_acc > sisaLuar) {
        return { error: `${bi.produk_nama}: qty ACC (${itemQC.qty_acc}) melebihi sisa (${sisaLuar})` }
      }
    }
  }

  // Resolve kategori_nama snapshot
  const allRejectRows = items.flatMap(i => i.rejects)
  const katIds = allRejectRows.map(r => r.kategori_id).filter(Boolean) as number[]
  let katMap: Record<number, string> = {}
  if (katIds.length > 0) {
    const { data: kats } = await supabase.from('reject_kategori_packaging')
      .select('id, nama').in('id', katIds)
    katMap = Object.fromEntries((kats ?? []).map((k: any) => [k.id, k.nama]))
  }

  // Hapus reject jenis='reject' lama (lebihan tetap dipertahankan)
  await supabase.from('po_packaging_reject').delete().eq('batch_id', batchId).eq('jenis', 'reject')

  let totalAccNew = 0
  let totalRejectNew = 0
  let diffPerProduk: Record<number, number> = {}

  for (const itemQC of items) {
    const bi = batchItems.find((b: any) => b.id === itemQC.batch_item_id)!
    const oldAcc = bi.qty_acc ?? 0
    const diff = itemQC.qty_acc - oldAcc
    diffPerProduk[bi.produk_id] = (diffPerProduk[bi.produk_id] ?? 0) + diff

    const qtyReject = itemQC.rejects.reduce((s, r) => s + (r.qty || 0), 0)
    await supabase.from('po_batch_items').update({
      qty_acc: itemQC.qty_acc, qty_reject: qtyReject,
    }).eq('id', bi.id)

    totalAccNew    += itemQC.qty_acc
    totalRejectNew += qtyReject

    // Insert reject baru per kategori
    const rejectRecords: any[] = []
    for (const r of itemQC.rejects) {
      rejectRecords.push({
        batch_id: batchId, batch_item_id: bi.id, nomor_batch: batch.nomor_batch,
        po_id: batch.po_id, po_nomor: batch.po_nomor,
        vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
        produk_id: bi.produk_id, produk_kode: bi.produk_kode, produk_nama: bi.produk_nama,
        tanggal_terima: batch.tanggal_terima,
        jenis: 'reject', qty: r.qty,
        kategori_id: r.kategori_id || null,
        kategori_nama: r.kategori_id ? (katMap[r.kategori_id] ?? null) : null,
        alasan_manual: r.alasan_manual?.trim() || null,
        catatan: r.catatan?.trim() || null,
      })
    }
    if (rejectRecords.length > 0) {
      await supabase.from('po_packaging_reject').insert(rejectRecords)
    }
  }

  // Adjust stok per produk berdasarkan diff
  for (const [produkIdStr, diff] of Object.entries(diffPerProduk)) {
    if (diff === 0) continue
    const produkId = parseInt(produkIdStr)
    const { data: stok } = await supabase.from('stok_packaging')
      .select('stok_qty').eq('produk_id', produkId).single()
    if (stok) {
      await supabase.from('stok_packaging')
        .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) + diff), updated_at: new Date().toISOString() })
        .eq('produk_id', produkId)
    }
  }

  // Update batch header
  await supabase.from('po_batch_penerimaan').update({
    qty_acc: totalAccNew, qty_reject: totalRejectNew,
    catatan_qc: catatan ?? batch.catatan_qc,
  }).eq('id', batchId)

  // Batch pengganti: sync qty_diganti per SJ item (diff per batch_item)
  if (batch.is_pengganti) {
    const affectedSJ = new Set<number>()
    for (const bi of batchItems) {
      const itemQC = items.find(i => i.batch_item_id === bi.id)
      if (!itemQC) continue
      const diff = itemQC.qty_acc - (bi.qty_acc ?? 0)
      if (diff === 0) continue
      const sjItemId = bi.sj_item_id_origin ?? (batchItems.length === 1 ? batch.sj_item_id_origin : null)
      if (!sjItemId) continue
      const { data: sjItem } = await supabase.from('sj_retur_packaging_items')
        .select('qty_diganti, sj_retur_id').eq('id', sjItemId).single()
      if (!sjItem) continue
      await supabase.from('sj_retur_packaging_items')
        .update({ qty_diganti: Math.max(0, (sjItem.qty_diganti ?? 0) + diff) })
        .eq('id', sjItemId)
      affectedSJ.add(sjItem.sj_retur_id)
    }
    for (const sjId of affectedSJ) await recomputeSJStatus(supabase, sjId)
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── QC (per-item) ─────────────────────────────────────────────────────────────
//
// items: [{
//   batch_item_id, qty_acc,
//   rejects: [{ qty, kategori_id?, alasan_manual?, catatan? }]
// }]

export async function submitQC(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const batchId   = parseInt(formData.get('batch_id') as string)
  const qcTanggal = formData.get('qc_tanggal') as string
  const itemsRaw  = formData.get('items') as string
  if (!batchId)   return { error: 'Batch ID hilang' }
  if (!qcTanggal) return { error: 'Tanggal QC wajib diisi' }
  if (!itemsRaw)  return { error: 'Data QC kosong' }

  type RejectRow = { qty: number; kategori_id?: number; alasan_manual?: string; catatan?: string }
  type ItemQC    = { batch_item_id: number; qty_acc: number; rejects: RejectRow[] }
  const items: ItemQC[] = JSON.parse(itemsRaw)
  if (!items.length) return { error: 'Tidak ada item untuk QC' }

  const { data: batch } = await supabase.from('po_batch_penerimaan').select('*').eq('id', batchId).single()
  if (!batch) return { error: 'Batch tidak ditemukan' }
  if (batch.status_qc === 'selesai') return { error: 'QC sudah diselesaikan' }

  // Ambil child items dari batch ini
  const { data: batchItems } = await supabase.from('po_batch_items').select('*').eq('batch_id', batchId)
  if (!batchItems || batchItems.length === 0) return { error: 'Batch tidak punya item' }

  // Validasi: tiap batch_item harus dapat record QC
  for (const bi of batchItems) {
    const itemQC = items.find(i => i.batch_item_id === bi.id)
    if (!itemQC) return { error: `Item ${bi.produk_nama} belum di-QC` }
    if (isNaN(itemQC.qty_acc) || itemQC.qty_acc < 0) return { error: `Qty ACC ${bi.produk_nama} tidak valid` }
    const qtyReject = itemQC.rejects.reduce((s, r) => s + (r.qty || 0), 0)
    const total = itemQC.qty_acc + qtyReject + (bi.qty_lebih ?? 0)
    if (total !== bi.qty_diterima) {
      return { error: `${bi.produk_nama}: ACC (${itemQC.qty_acc}) + Reject (${qtyReject}) + Lebihan (${bi.qty_lebih ?? 0}) = ${total} ≠ qty diterima ${bi.qty_diterima}` }
    }
    for (const r of itemQC.rejects) {
      if (!r.qty || r.qty <= 0) return { error: `Reject ${bi.produk_nama}: qty harus > 0` }
      if (!r.kategori_id && !r.alasan_manual?.trim()) return { error: `Reject ${bi.produk_nama}: pilih kategori atau isi alasan` }
    }
  }

  // Batch pengganti: validasi qty_acc per item tidak melebihi sisa SJ item
  if (batch.is_pengganti) {
    for (const bi of batchItems) {
      const itemQC = items.find(i => i.batch_item_id === bi.id)
      if (!itemQC || itemQC.qty_acc <= 0) continue
      const sjItemId = bi.sj_item_id_origin ?? (batchItems.length === 1 ? batch.sj_item_id_origin : null)
      if (!sjItemId) continue
      const { data: sjItem } = await supabase.from('sj_retur_packaging_items')
        .select('qty_retur, qty_diganti').eq('id', sjItemId).single()
      if (!sjItem) continue
      const sisa = (sjItem.qty_retur ?? 0) - (sjItem.qty_diganti ?? 0)
      if (itemQC.qty_acc > sisa) return { error: `${bi.produk_nama}: qty ACC (${itemQC.qty_acc}) melebihi sisa (${sisa})` }
    }
  }

  // Upload TTD
  let ttdOpUrl: string | null = null
  let ttdAdminUrl: string | null = null
  const ttdOpB64    = formData.get('ttd_operator') as string
  const ttdAdminB64 = formData.get('ttd_admin') as string
  if (ttdOpB64 && ttdOpB64.startsWith('data:'))     ttdOpUrl    = await uploadSignature(supabase, ttdOpB64, `${batch.nomor_batch}_op`)
  if (ttdAdminB64 && ttdAdminB64.startsWith('data:')) ttdAdminUrl = await uploadSignature(supabase, ttdAdminB64, `${batch.nomor_batch}_admin`)

  const totalAcc    = items.reduce((s, i) => s + (i.qty_acc || 0), 0)
  const totalReject = items.reduce((s, i) => s + i.rejects.reduce((ss, r) => ss + (r.qty || 0), 0), 0)

  // Update header batch
  const { error: hdrErr } = await supabase.from('po_batch_penerimaan').update({
    qty_acc: totalAcc,
    qty_reject: totalReject,
    status_qc: 'selesai',
    status: 'selesai',
    qc_tanggal: qcTanggal,
    qc_operator_nama: (formData.get('operator_nama') as string) || null,
    qc_admin_nama: (formData.get('admin_nama') as string) || null,
    ttd_qc_operator_url: ttdOpUrl,
    ttd_qc_admin_url: ttdAdminUrl,
    catatan_qc: (formData.get('catatan_qc') as string) || null,
  }).eq('id', batchId)
  if (hdrErr) return { error: hdrErr.message }

  // Resolve kategori_nama snapshot
  const allRejectRows = items.flatMap(i => i.rejects)
  const katIds = allRejectRows.map(r => r.kategori_id).filter(Boolean) as number[]
  let katMap: Record<number, string> = {}
  if (katIds.length > 0) {
    const { data: kats } = await supabase.from('reject_kategori_packaging')
      .select('id, nama').in('id', katIds)
    katMap = Object.fromEntries((kats ?? []).map((k: any) => [k.id, k.nama]))
  }

  // Per item: update qty_acc/qty_reject child, increment stok, insert reject records
  for (const itemQC of items) {
    const bi = batchItems.find((b: any) => b.id === itemQC.batch_item_id)!
    const qtyReject = itemQC.rejects.reduce((s, r) => s + (r.qty || 0), 0)

    await supabase.from('po_batch_items').update({
      qty_acc: itemQC.qty_acc, qty_reject: qtyReject,
    }).eq('id', bi.id)

    // Increment stok untuk produk ini
    if (itemQC.qty_acc > 0) {
      const { error: rpcErr } = await supabase.rpc('increment_stok_packaging', { p_produk_id: bi.produk_id, p_qty: itemQC.qty_acc })
      if (rpcErr) {
        const { data: stok } = await supabase.from('stok_packaging')
          .select('stok_qty').eq('produk_id', bi.produk_id).single()
        if (stok) {
          await supabase.from('stok_packaging')
            .update({ stok_qty: (stok.stok_qty ?? 0) + itemQC.qty_acc, updated_at: new Date().toISOString() })
            .eq('produk_id', bi.produk_id)
        }
      }
    }

    // Insert reject records per kategori
    const rejectRecords: any[] = []
    for (const r of itemQC.rejects) {
      rejectRecords.push({
        batch_id: batchId, batch_item_id: bi.id, nomor_batch: batch.nomor_batch,
        po_id: batch.po_id, po_nomor: batch.po_nomor,
        vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
        produk_id: bi.produk_id, produk_kode: bi.produk_kode, produk_nama: bi.produk_nama,
        tanggal_terima: batch.tanggal_terima,
        jenis: 'reject', qty: r.qty,
        kategori_id: r.kategori_id || null,
        kategori_nama: r.kategori_id ? (katMap[r.kategori_id] ?? null) : null,
        alasan_manual: r.alasan_manual?.trim() || null,
        catatan: r.catatan?.trim() || null,
      })
    }
    if ((bi.qty_lebih ?? 0) > 0) {
      rejectRecords.push({
        batch_id: batchId, batch_item_id: bi.id, nomor_batch: batch.nomor_batch,
        po_id: batch.po_id, po_nomor: batch.po_nomor,
        vendor_id: batch.vendor_id, vendor_nama: batch.vendor_nama,
        produk_id: bi.produk_id, produk_kode: bi.produk_kode, produk_nama: bi.produk_nama,
        tanggal_terima: batch.tanggal_terima,
        jenis: 'lebihan', qty: bi.qty_lebih,
      })
    }
    if (rejectRecords.length > 0) {
      await supabase.from('po_packaging_reject').insert(rejectRecords)
    }
  }

  // Batch pengganti: update qty_diganti per SJ item (per batch_item)
  if (batch.is_pengganti) {
    const affectedSJ = new Set<number>()
    for (const bi of batchItems) {
      const itemQC = items.find(i => i.batch_item_id === bi.id)
      if (!itemQC || itemQC.qty_acc <= 0) continue
      const sjItemId = bi.sj_item_id_origin ?? (batchItems.length === 1 ? batch.sj_item_id_origin : null)
      if (!sjItemId) continue
      const { data: sjItem } = await supabase.from('sj_retur_packaging_items')
        .select('qty_diganti, sj_retur_id').eq('id', sjItemId).single()
      if (!sjItem) continue
      await supabase.from('sj_retur_packaging_items')
        .update({ qty_diganti: (sjItem.qty_diganti ?? 0) + itemQC.qty_acc })
        .eq('id', sjItemId)
      affectedSJ.add(sjItem.sj_retur_id)
    }
    for (const sjId of affectedSJ) await recomputeSJStatus(supabase, sjId)
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// ── REJECT ITEM ────────────────────────────────────────────────────────────────

export async function deleteRejectItem(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  // Ambil sj_retur_id sebelum delete, biar bisa cleanup SJ items + SJ kosong setelahnya
  const { data: reject } = await supabase.from('po_packaging_reject')
    .select('sj_retur_id').eq('id', id).single()
  const sjId: number | null = reject?.sj_retur_id ?? null

  const { error } = await supabase.from('po_packaging_reject').delete().eq('id', id)
  if (error) return { error: error.message }

  // Hapus SJ item snapshot yang refer ke reject ini, lalu cleanup SJ kalau kosong
  if (sjId) {
    await supabase.from('sj_retur_packaging_items').delete().eq('reject_id', id)
    const { data: remaining } = await supabase.from('sj_retur_packaging_items')
      .select('qty_retur, qty_diganti').eq('sj_retur_id', sjId)
    if (!remaining || remaining.length === 0) {
      // Hapus batch pengganti yang link ke SJ ini juga (reverse stok)
      const { data: pengBatches } = await supabase.from('po_batch_penerimaan')
        .select('id, produk_id, qty_acc, status_qc')
        .eq('is_pengganti', true).eq('sj_retur_id_origin', sjId)
      for (const pb of pengBatches ?? []) {
        if (pb.status_qc === 'selesai' && (pb.qty_acc ?? 0) > 0) {
          const { data: stok } = await supabase.from('stok_packaging')
            .select('stok_qty').eq('produk_id', pb.produk_id).single()
          if (stok) {
            await supabase.from('stok_packaging')
              .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - pb.qty_acc) })
              .eq('produk_id', pb.produk_id)
          }
        }
      }
      const pengIds = (pengBatches ?? []).map((b: any) => b.id)
      if (pengIds.length > 0) {
        await supabase.from('po_packaging_reject').delete().in('batch_id', pengIds)
        await supabase.from('po_batch_penerimaan').delete().in('id', pengIds)
      }
      await supabase.from('sj_retur_packaging').delete().eq('id', sjId)
    } else {
      const newTotal = remaining.reduce((s: number, r: any) => s + (r.qty_retur || 0), 0)
      const newGanti = remaining.reduce((s: number, r: any) => s + (r.qty_diganti || 0), 0)
      let status = 'menunggu_ganti'
      if (newGanti >= newTotal && newTotal > 0) status = 'selesai_diganti'
      else if (newGanti > 0) status = 'sebagian_diganti'
      await supabase.from('sj_retur_packaging').update({
        total_qty: newTotal, total_qty_diganti: newGanti, status,
      }).eq('id', sjId)
    }
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

export async function resetRejectStatus(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: reject } = await supabase.from('po_packaging_reject')
    .select('sj_retur_id').eq('id', id).single()

  // Hapus item SJ yang nge-reference reject ini
  if (reject?.sj_retur_id) {
    await supabase.from('sj_retur_packaging_items').delete().eq('reject_id', id)
  }

  // Reset reject ke pending
  await supabase.from('po_packaging_reject').update({
    status_penanganan: 'pending',
    penanganan_keterangan: null,
    sj_retur_id: null,
    tanggal_retur: null,
  }).eq('id', id)

  // Jika SJ tidak punya item lain — hapus SJ + total_qty 0
  if (reject?.sj_retur_id) {
    const { count } = await supabase.from('sj_retur_packaging_items')
      .select('*', { count: 'exact', head: true })
      .eq('sj_retur_id', reject.sj_retur_id)
    if ((count ?? 0) === 0) {
      await supabase.from('sj_retur_packaging').delete().eq('id', reject.sj_retur_id)
    } else {
      // Refresh total_qty
      const { data: remaining } = await supabase.from('sj_retur_packaging_items')
        .select('qty_retur').eq('sj_retur_id', reject.sj_retur_id)
      const total = (remaining ?? []).reduce((s: number, r: any) => s + r.qty_retur, 0)
      await supabase.from('sj_retur_packaging').update({ total_qty: total }).eq('id', reject.sj_retur_id)
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
  const tglJatuhTempo = (formData.get('tanggal_jatuh_tempo_ganti') as string) || null
  const itemsRaw   = formData.get('items') as string

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

  for (const it of items) {
    const r = rejects.find((x: any) => x.id === it.reject_id)
    if (r && it.qty_retur > r.qty) return { error: `Qty retur ${r.produk_nama} (${it.qty_retur}) melebihi qty reject (${r.qty})` }
  }

  const totalQty = items.reduce((s, i) => s + i.qty_retur, 0)
  const nomorManual = (formData.get('nomor_sj') as string)?.trim()
  let nomor: string
  if (nomorManual) {
    const { data: dup } = await supabase.from('sj_retur_packaging').select('id').eq('nomor_sj', nomorManual).single()
    if (dup) return { error: `Nomor SJ "${nomorManual}" sudah digunakan` }
    nomor = nomorManual
  } else {
    nomor = await genNomorBulanan(supabase, 'sj_retur_packaging', 'SJ.RTR')
  }

  const { data: sj, error } = await supabase.from('sj_retur_packaging').insert({
    nomor_sj: nomor,
    tanggal_retur: tanggal,
    tanggal_jatuh_tempo_ganti: tglJatuhTempo,
    vendor_id: vendorId,
    vendor_nama: vendor.nama,
    total_qty: totalQty,
    total_qty_diganti: 0,
    status: 'menunggu_ganti',
    catatan: (formData.get('catatan') as string) || null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Per item: update reject + insert item snapshot
  for (const it of items) {
    const r = rejects.find((x: any) => x.id === it.reject_id)!
    let finalRejectId = it.reject_id

    if (it.qty_retur === r.qty) {
      await supabase.from('po_packaging_reject').update({
        status_penanganan: 'diretur', sj_retur_id: sj.id, tanggal_retur: tanggal,
      }).eq('id', it.reject_id)
    } else {
      // Partial: update qty asli jadi qty_retur, buat sisa sebagai pending baru
      await supabase.from('po_packaging_reject').update({
        qty: it.qty_retur,
        status_penanganan: 'diretur', sj_retur_id: sj.id, tanggal_retur: tanggal,
      }).eq('id', it.reject_id)
      await supabase.from('po_packaging_reject').insert({
        batch_id: r.batch_id, nomor_batch: r.nomor_batch,
        po_id: r.po_id, po_nomor: r.po_nomor,
        vendor_id: r.vendor_id, vendor_nama: r.vendor_nama,
        produk_id: r.produk_id, produk_kode: r.produk_kode, produk_nama: r.produk_nama,
        tanggal_terima: r.tanggal_terima,
        jenis: r.jenis, qty: r.qty - it.qty_retur,
        kategori_id: r.kategori_id, kategori_nama: r.kategori_nama,
        alasan_manual: r.alasan_manual, catatan: r.catatan,
        status_penanganan: 'pending',
      })
    }

    // Snapshot item ke sj_retur_packaging_items
    await supabase.from('sj_retur_packaging_items').insert({
      sj_retur_id: sj.id, reject_id: finalRejectId,
      produk_id: r.produk_id, produk_kode: r.produk_kode, produk_nama: r.produk_nama,
      po_id: r.po_id, po_nomor: r.po_nomor,
      batch_id: r.batch_id, nomor_batch: r.nomor_batch,
      tanggal_terima: r.tanggal_terima,
      jenis: r.jenis || 'reject',
      qty_retur: it.qty_retur, qty_diganti: 0,
      kategori_id: r.kategori_id, kategori_nama: r.kategori_nama,
      alasan_manual: r.alasan_manual, catatan: r.catatan,
    })
  }

  revalidatePath('/po-vendor-packaging')
  return { success: true, nomor, sjId: sj.id }
}

// Edit metadata SJ Retur (tanggal, jatuh tempo, catatan). Items tidak bisa diedit.
export async function updateSJRetur(id: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'spv'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager/SPV' }
  // ROLE_CHECK_DISABLED: 
  const tanggal = formData.get('tanggal_retur') as string
  const tglJatuhTempo = (formData.get('tanggal_jatuh_tempo_ganti') as string) || null
  const catatan = (formData.get('catatan') as string) || null

  if (!tanggal) return { error: 'Tanggal retur wajib diisi' }

  const { error } = await supabase.from('sj_retur_packaging').update({
    tanggal_retur: tanggal,
    tanggal_jatuh_tempo_ganti: tglJatuhTempo,
    catatan,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}

// Hapus SJ Retur: reset rejects yang terlibat ke pending, cleanup batch pengganti, hapus SJ.
export async function deleteSJRetur(id: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }
  // ROLE_CHECK_DISABLED: 
  // 1. Reset rejects yang masih hidup balik ke pending
  await supabase.from('po_packaging_reject').update({
    status_penanganan: 'pending',
    penanganan_keterangan: null,
    sj_retur_id: null,
    tanggal_retur: null,
  }).eq('sj_retur_id', id)

  // 2. Reverse stok + hapus batch pengganti yang link ke SJ ini (pakai child items)
  const { data: pengBatches } = await supabase.from('po_batch_penerimaan')
    .select('id, status_qc')
    .eq('is_pengganti', true).eq('sj_retur_id_origin', id)
  const pengIds = (pengBatches ?? []).map((b: any) => b.id)
  if (pengIds.length > 0) {
    const { data: pengChild } = await supabase.from('po_batch_items')
      .select('batch_id, produk_id, qty_acc').in('batch_id', pengIds)
    const pengQCMap: Record<number, string> = Object.fromEntries((pengBatches ?? []).map((b: any) => [b.id, b.status_qc]))
    for (const ci of pengChild ?? []) {
      if (pengQCMap[ci.batch_id] === 'selesai' && (ci.qty_acc ?? 0) > 0) {
        const { data: stok } = await supabase.from('stok_packaging')
          .select('stok_qty').eq('produk_id', ci.produk_id).single()
        if (stok) {
          await supabase.from('stok_packaging')
            .update({ stok_qty: Math.max(0, (stok.stok_qty ?? 0) - ci.qty_acc) })
            .eq('produk_id', ci.produk_id)
        }
      }
    }
    await supabase.from('po_packaging_reject').delete().in('batch_id', pengIds)
    await supabase.from('po_batch_penerimaan').delete().in('id', pengIds)
  }

  // 3. Hapus SJ (cascade ke sj_retur_packaging_items)
  const { error } = await supabase.from('sj_retur_packaging').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/po-vendor-packaging')
  return { success: true }
}
