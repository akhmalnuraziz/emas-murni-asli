'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

const GUDANG_LOKASI = 'Gudang Pusat'

// ─── Ambil shieldtag yang TERSEDIA untuk dimutasi (aktif + di gudang) ──────────
export async function fetchShieldtagSiapMutasi(gramasi?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Unauthorized' }

  let q = supabase.from('shieldtag')
    .select('id, kode, gramasi, batch_kode, status, lokasi')
    .is('voided_at', null)
    .eq('status', 'Aktif')
    .eq('lokasi', GUDANG_LOKASI)
    .order('gramasi')
  if (gramasi) q = q.eq('gramasi', gramasi)

  const { data } = await q
  return { rows: data ?? [] }
}

// ─── Generate kode mutasi: MTSI.GDCJ/<CABANG>/0001 ─────────────────────────────
async function generateKodeMutasi(supabase: any, cabangKode: string): Promise<string> {
  const prefix = `MTSI.GDCJ/${cabangKode}/`
  const { data } = await supabase.from('mutasi')
    .select('kode').like('kode', `${prefix}%`).order('id', { ascending: false }).limit(1)
  let next = 1
  if (data && data.length > 0 && data[0].kode) {
    const last = String(data[0].kode).split('/').pop() ?? '0'
    next = (parseInt(last, 10) || 0) + 1
  }
  return prefix + String(next).padStart(4, '0')
}

// ─── KIRIM mutasi ke cabang ────────────────────────────────────────────────────
// Gate: hanya shieldtag aktif di gudang. Update stok_cabang (+pcs) & po (max 0).
export async function kirimMutasiCabang(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).maybeSingle()

  const cabangKode    = formData.get('cabang_kode') as string
  const tanggalKirim  = (formData.get('tanggal_kirim') as string) || new Date().toISOString().split('T')[0]
  const catatan       = (formData.get('catatan') as string) || null
  const noSurat       = (formData.get('no_surat') as string) || null
  const shieldtagRaw  = formData.get('shieldtag_kodes') as string
  const poIdsRaw      = formData.get('po_ids') as string | null
  const poIds: number[] = poIdsRaw ? JSON.parse(poIdsRaw) : []
  const poId          = poIds[0] ?? null  // backward compat

  if (!cabangKode) return { error: 'Cabang tujuan wajib dipilih' }
  let shieldtagKodes: string[] = []
  try { shieldtagKodes = JSON.parse(shieldtagRaw || '[]') } catch { shieldtagKodes = [] }
  if (shieldtagKodes.length === 0) return { error: 'Pilih minimal 1 shieldtag untuk dimutasi' }

  // VALIDASI GATE: semua shieldtag harus aktif + di gudang (belum tershieldtag = tidak akan ada di sini)
  const { data: tags } = await supabase.from('shieldtag')
    .select('id, kode, gramasi, status, lokasi, voided_at')
    .in('kode', shieldtagKodes)

  if (!tags || tags.length !== shieldtagKodes.length) {
    return { error: 'Sebagian shieldtag tidak ditemukan' }
  }
  const invalid = tags.filter((t: any) => t.voided_at || t.status !== 'Aktif' || t.lokasi !== GUDANG_LOKASI)
  if (invalid.length > 0) {
    return { error: `${invalid.length} shieldtag tidak bisa dimutasi (harus berstatus Aktif & berada di Gudang Pusat). Pastikan barang sudah tershieldtag.` }
  }

  const totalPcs = tags.length

  // VALIDASI GATE: gramasi shieldtag yang dipilih harus sesuai dengan yang diminta PO
  // (cegah kirim barang 50gr untuk memenuhi PO yang minta 1gr)
  if (poIds.length > 0) {
    const { data: poItemsCheck } = await supabase.from('po_cabang_item')
      .select('gramasi, po_id').in('po_id', poIds)
    const gramasiDiminta = new Set((poItemsCheck ?? []).map((i: any) => String(i.gramasi)))
    const gramasiSalah = tags.filter((t: any) => !gramasiDiminta.has(String(t.gramasi)))
    if (gramasiSalah.length > 0) {
      const salahList = [...new Set(gramasiSalah.map((t: any) => t.gramasi))].join(', ')
      return { error: `Gramasi shieldtag (${salahList}gr) tidak sesuai dengan yang diminta PO ini (${[...gramasiDiminta].join(', ')}gr)` }
    }
  }

  // Ambil cabang nama
  const { data: cabang } = await supabase.from('cabang').select('nama').eq('kode', cabangKode).maybeSingle()

  // Generate kode
  const kode = await generateKodeMutasi(supabase, cabangKode)

  // Upload foto kirim
  const fotosB64Raw = formData.get('fotos_b64') as string
  let fotoUrls: string[] = []
  if (fotosB64Raw) {
    try {
      const fotosB64 = JSON.parse(fotosB64Raw)
      if (Array.isArray(fotosB64) && fotosB64.length > 0) {
        fotoUrls = await uploadBase64Fotos(supabase, fotosB64, `mutasi-${kode.replace(/\//g, '-')}`)
      }
    } catch { /* ignore */ }
  }

  // Insert mutasi
  const { data: mutasi, error: mErr } = await supabase.from('mutasi').insert({
    kode,
    nomor: noSurat,
    tanggal: tanggalKirim,
    tanggal_kirim: tanggalKirim,
    cabang_tujuan: cabangKode,
    ke_kode: cabangKode,
    ke_lokasi: cabang?.nama ?? cabangKode,
    dari_lokasi: GUDANG_LOKASI,
    dari_kode: '',
    shieldtag_kodes: shieldtagKodes,
    pcs: totalPcs,
    pcs_dikirim: totalPcs,
    status: 'dikirim',
    catatan,
    foto_kirim: fotoUrls,
    pengirim_name: profile?.name ?? null,
    pengirim_by: user.id,
    created_by: user.id,
    po_id: poId ?? null,
    po_ids: poIds.length > 0 ? poIds : null,
  }).select('id').single()

  if (mErr) return { error: 'Gagal membuat mutasi: ' + mErr.message }

  // Update qty_dikirim di semua PO yang di-link
  if (poIds.length > 0) {
    const gramasiQtyMap: Record<string, number> = {}
    for (const t of tags) gramasiQtyMap[t.gramasi] = (gramasiQtyMap[t.gramasi] ?? 0) + 1

    for (const pid of poIds) {
      const { data: poItems } = await supabase.from('po_cabang_item')
        .select('id, gramasi, qty_diminta, qty_dikirim').eq('po_id', pid)
      for (const item of poItems ?? []) {
        const qtyBaru = (Number(item.qty_dikirim ?? 0)) + (gramasiQtyMap[item.gramasi] ?? 0)
        await supabase.from('po_cabang_item').update({ qty_dikirim: qtyBaru }).eq('id', item.id)
      }
    }
  }

  // Update shieldtag: status Transit, lokasi cabang, link mutasi
  // NOTE: stok_cabang TIDAK ditulis manual di sini. stok_cabang adalah computed VIEW
  // (Stock Balance Engine) — stok_ready dihitung live dari lokasi+status shieldtag,
  // po_pcs dihitung live dari po_cabang/po_cabang_item. Saat status shieldtag berubah
  // jadi 'Transit', barang tidak terhitung 'Aktif' di gudang ATAU di cabang sampai
  // pihak cabang konfirmasi terima via terimaMutasiCabang().
  await supabase.from('shieldtag').update({
    status: 'Transit',
    lokasi: cabang?.nama ?? cabangKode,
    mutasi_id: mutasi.id,
    tgl_dist: tanggalKirim,
  }).in('kode', shieldtagKodes)

  // Audit
  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'KIRIM_MUTASI', module: 'MUTASI',
    record_key: kode, record_id: String(mutasi.id),
    after_data: { cabang: cabangKode, pcs: totalPcs, shieldtags: shieldtagKodes },
  })

  // Notif ke kepala_cabang tujuan + gudang
  createNotif({
    judul: `Mutasi dikirim ke ${cabang?.nama ?? cabangKode}`,
    pesan: `${kode} — ${totalPcs} pcs dalam perjalanan`,
    tipe: 'info',
    link: '/mutasi',
    untuk_role: ['owner', 'manager', 'spv', 'admin_gudang'],
  })

  // Cek stok rendah per gramasi setelah pengiriman — ambil safety stock dari pengaturan
  const { data: safetyRows } = await supabase.from('pengaturan').select('key, value')
    .or('key.eq.safety_stock_global,key.like.safety_stock_%')
  const safetyMap: Record<string, number> = {}
  for (const r of safetyRows ?? []) safetyMap[r.key] = Number(r.value ?? 10)
  const safetyGlobal = safetyMap['safety_stock_global'] ?? 10

  const gramasiDikirim = [...new Set(tags.map((t: any) => t.gramasi))]
  for (const g of gramasiDikirim) {
    const SAFETY = safetyMap[`safety_stock_${g}`] ?? safetyGlobal
    const { count } = await supabase.from('shieldtag')
      .select('*', { count: 'exact', head: true })
      .eq('gramasi', g).eq('status', 'Aktif').eq('lokasi', 'Gudang Pusat').is('voided_at', null)
    if ((count ?? 0) < SAFETY) {
      createNotif({
        judul: `Stok ${g}gr di bawah safety stock`,
        pesan: `Sisa ${count ?? 0} pcs di Gudang Pusat (min. ${SAFETY} pcs). Segera produksi.`,
        tipe: 'warning',
        link: '/prioritas-produksi',
        untuk_role: ['owner', 'manager', 'spv'],
      })
    }
  }

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  revalidatePath('/shieldtag')
  revalidatePath('/po-cabang')
  revalidatePath('/stok-cabang')
  return { success: true, kode }
}

// ─── TERIMA mutasi di cabang (2-party sign-off: pengirim + penerima) ──────────
// Penerima mencocokkan fisik barang vs shieldtag_kodes yang dikirim. Yang tidak
// dicocokkan/ditemukan otomatis terdeteksi sebagai short-shipment (shieldtag_kodes_hilang).
// Shieldtag yang dikonfirmasi diterima: status Transit → Aktif (kini stok di cabang).
// Shieldtag yang hilang/short-ship: status TETAP 'Transit' (tidak diotak-atik otomatis)
// supaya admin_pusat bisa investigasi dulu sebelum diputuskan (void / ditemukan kembali) —
// sesuai prinsip "deteksi, bukan auto-resolve".
export async function terimaMutasiCabang(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).maybeSingle()

  const mutasiId      = parseInt(formData.get('mutasi_id') as string, 10)
  const tanggalTerima = (formData.get('tanggal_terima') as string) || new Date().toISOString().split('T')[0]
  const catatan       = (formData.get('catatan') as string) || null
  const alasanHilang  = (formData.get('alasan_hilang') as string) || null
  const diterimaRaw   = formData.get('diterima_kodes') as string

  if (!mutasiId) return { error: 'Mutasi tidak valid' }
  let diterimaKodes: string[] = []
  try { diterimaKodes = JSON.parse(diterimaRaw || '[]') } catch { diterimaKodes = [] }

  const { data: mutasi } = await supabase.from('mutasi')
    .select('id, kode, shieldtag_kodes, status_terima, voided_at, po_id, po_ids, cabang_tujuan')
    .eq('id', mutasiId).maybeSingle()

  if (!mutasi || mutasi.voided_at) return { error: 'Mutasi tidak ditemukan' }
  if (mutasi.status_terima === 'Sudah Diterima') return { error: 'Mutasi ini sudah dikonfirmasi diterima sebelumnya' }

  const sentKodes: string[] = mutasi.shieldtag_kodes ?? []
  if (sentKodes.length === 0) return { error: 'Mutasi ini tidak memiliki data shieldtag' }

  // diterimaKodes harus subset dari sentKodes
  diterimaKodes = diterimaKodes.filter(k => sentKodes.includes(k))
  const hilangKodes = sentKodes.filter(k => !diterimaKodes.includes(k))
  const isShort = hilangKodes.length > 0

  if (isShort && !alasanHilang) {
    return { error: `${hilangKodes.length} shieldtag tidak dicocokkan. Isi alasan/keterangan kehilangan sebelum konfirmasi.` }
  }

  // Upload foto terima
  const fotosB64Raw = formData.get('fotos_b64') as string
  let fotoUrls: string[] = []
  if (fotosB64Raw) {
    try {
      const fotosB64 = JSON.parse(fotosB64Raw)
      if (Array.isArray(fotosB64) && fotosB64.length > 0) {
        fotoUrls = await uploadBase64Fotos(supabase, fotosB64, `terima-${mutasi.kode.replace(/\//g, '-')}`)
      }
    } catch { /* ignore */ }
  }

  // Shieldtag yang dikonfirmasi fisik diterima: Transit → Aktif (jadi stok riil di cabang)
  if (diterimaKodes.length > 0) {
    await supabase.from('shieldtag').update({
      status: 'Aktif',
    }).in('kode', diterimaKodes).eq('status', 'Transit')
  }
  // Shieldtag di hilangKodes TIDAK disentuh — tetap 'Transit' menunggu investigasi admin.

  const { error: uErr } = await supabase.from('mutasi').update({
    status_terima: 'Sudah Diterima',
    tanggal_terima: tanggalTerima,
    pcs_diterima: diterimaKodes.length,
    shieldtag_kodes_diterima: diterimaKodes,
    shieldtag_kodes_hilang: hilangKodes,
    alasan_hilang: isShort ? alasanHilang : null,
    foto_terima: fotoUrls,
    keterangan_tambahan: catatan,
    confirmed_by: profile?.name ?? null,
    confirmed_at: new Date().toISOString(),
    status: isShort ? 'SHORT_SHIP' : 'SELESAI',
  }).eq('id', mutasiId)

  if (uErr) return { error: 'Gagal menyimpan konfirmasi terima: ' + uErr.message }

  // Auto-selesai semua PO yang terpenuhi
  const linkedPoIds: number[] = (mutasi.po_ids as number[] | null) ?? (mutasi.po_id ? [mutasi.po_id] : [])
  if (linkedPoIds.length > 0 && !isShort) {
    for (const pid of linkedPoIds) {
      const { data: poItems } = await supabase.from('po_cabang_item')
        .select('qty_diminta, qty_dikirim').eq('po_id', pid)
      const semuaTerpenuhi = (poItems ?? []).every(it =>
        (Number(it.qty_dikirim ?? 0)) >= Number(it.qty_diminta)
      )
      if (semuaTerpenuhi) {
        await supabase.from('po_cabang').update({
          status: 'selesai', selesai_at: new Date().toISOString(),
          catatan_admin: 'Otomatis selesai — semua item terpenuhi via mutasi',
        }).eq('id', pid).neq('status', 'selesai')
        createNotif({
          judul: `PO selesai otomatis`,
          pesan: `Semua item PO dari ${mutasi.cabang_tujuan} sudah diterima.`,
          tipe: 'success', link: '/po-cabang',
          untuk_role: ['owner', 'manager', 'spv', 'admin_gudang'],
        })
      }
    }
  }

  supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'TERIMA_MUTASI', module: 'MUTASI',
    record_key: mutasi.kode, record_id: String(mutasiId),
    after_data: { diterima: diterimaKodes, hilang: hilangKodes, pcs_diterima: diterimaKodes.length },
  })
  if (isShort) {
    supabase.from('audit_log').insert({
      user_id: user.id, user_name: profile?.name, user_role: profile?.role,
      action: 'SHORT_SHIP_DETECTED', module: 'MUTASI',
      record_key: mutasi.kode, record_id: String(mutasiId),
      after_data: { shieldtag_kodes_hilang: hilangKodes },
      reason: alasanHilang,
    })
  }

  // Notif terima normal → admin_pusat + gudang
  createNotif({
    judul: `Mutasi ${mutasi.kode} diterima`,
    pesan: `${diterimaKodes.length} pcs dikonfirmasi diterima oleh ${profile?.name ?? 'penerima'}`,
    tipe: 'success',
    link: '/mutasi',
    untuk_role: ['owner', 'manager', 'spv', 'admin_gudang'],
  })

  // Notif short-shipment → owner + admin_pusat (lebih urgent)
  if (isShort) {
    createNotif({
      judul: `⚠️ Short-Shipment: ${mutasi.kode}`,
      pesan: `${hilangKodes.length} shieldtag tidak ditemukan saat penerimaan. Perlu investigasi.`,
      tipe: 'warning',
      link: '/mutasi',
      untuk_role: ['owner', 'manager'],
    })
  }

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  revalidatePath('/shieldtag')
  revalidatePath('/po-cabang')
  revalidatePath('/stok-cabang')
  return { success: true, isShort, hilangCount: hilangKodes.length }
}

// ─── Fetch mutasi yang masih menunggu konfirmasi terima ───────────────────────
export async function fetchMutasiPendingTerima() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Unauthorized' }
  const { data } = await supabase.from('mutasi')
    .select('*')
    .is('voided_at', null)
    .eq('status_terima', 'Belum Diterima')
    .order('tanggal_kirim', { ascending: false })
    .limit(100)
  return { rows: data ?? [] }
}

// ─── Fetch stok cabang (current state per cabang) ─────────────────────────────
export async function fetchStokCabang(cabangKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Unauthorized' }
  const { data } = await supabase.from('stok_cabang')
    .select('*').eq('cabang_kode', cabangKode).order('gramasi')
  return { rows: data ?? [] }
}

// ─── Fetch daftar mutasi ──────────────────────────────────────────────────────
export async function fetchMutasiList(page: number = 1, pageSize: number = 20) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], total: 0, error: 'Unauthorized' }
  const from = (page - 1) * pageSize
  const { data, count } = await supabase.from('mutasi')
    .select('*', { count: 'exact' })
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  return { rows: data ?? [], total: count ?? 0 }
}

// ─── Fetch PO cabang yang siap dilayani (pending/diproses) per cabang ────────
export async function fetchPoCabangSiap(cabangKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('po_cabang')
    .select('id, kode, status, items:po_cabang_item(gramasi, qty_diminta, qty_dikirim)')
    .eq('cabang_kode', cabangKode)
    .in('status', ['pending', 'diproses'])
    .order('created_at', { ascending: false })
  return data ?? []
}

// ─── Foto upload helper ───────────────────────────────────────────────────────
async function uploadBase64Fotos(supabase: any, fotosB64: string[], prefix: string): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < fotosB64.length && i < 10; i++) {
    const b64 = fotosB64[i]
    const match = b64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) continue
    const ext = match[1].split('/')[1]
    const bytes = Buffer.from(match[2], 'base64')
    const path = `${prefix}-${Date.now()}-${i}.${ext}`
    const { error } = await supabase.storage.from('emas-fotos').upload(path, bytes, {
      contentType: match[1], upsert: false,
    })
    if (!error) {
      const { data } = supabase.storage.from('emas-fotos').getPublicUrl(path)
      if (data?.publicUrl) urls.push(data.publicUrl)
    }
  }
  return urls
}
