'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const invalid = tags.filter(t => t.voided_at || t.status !== 'Aktif' || t.lokasi !== GUDANG_LOKASI)
  if (invalid.length > 0) {
    return { error: `${invalid.length} shieldtag tidak bisa dimutasi (harus berstatus Aktif & berada di Gudang Pusat). Pastikan barang sudah tershieldtag.` }
  }

  // Hitung total per gramasi
  const perGramasi = new Map<string, number>()
  for (const t of tags) {
    perGramasi.set(t.gramasi, (perGramasi.get(t.gramasi) ?? 0) + 1)
  }
  const totalPcs = tags.length

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
  }).select('id').single()

  if (mErr) return { error: 'Gagal membuat mutasi: ' + mErr.message }

  // Update shieldtag: status Transit, lokasi cabang, link mutasi
  await supabase.from('shieldtag').update({
    status: 'Transit',
    lokasi: cabang?.nama ?? cabangKode,
    mutasi_id: mutasi.id,
    tgl_dist: tanggalKirim,
  }).in('kode', shieldtagKodes)

  // Update stok_cabang & po per gramasi
  for (const [gramasi, kirimPcs] of perGramasi.entries()) {
    const { data: existing } = await supabase.from('stok_cabang')
      .select('id, stok_ready, po_pcs')
      .eq('cabang_kode', cabangKode).eq('gramasi', gramasi).maybeSingle()

    const poLama   = existing?.po_pcs ?? 0
    const stokLama = existing?.stok_ready ?? 0
    // PO ke-cover dulu sampai 0, sisanya nambah stok ready
    const poBaru   = Math.max(0, poLama - kirimPcs)
    const stokBaru = stokLama + kirimPcs

    if (existing) {
      await supabase.from('stok_cabang').update({
        stok_ready: stokBaru, po_pcs: poBaru,
        updated_at: new Date().toISOString(), updated_by: user.id,
      }).eq('id', existing.id)
    } else {
      await supabase.from('stok_cabang').insert({
        cabang_kode: cabangKode, gramasi, stok_ready: stokBaru, po_pcs: poBaru,
        updated_by: user.id,
      })
    }

    // Log
    await supabase.from('stok_cabang_log').insert({
      cabang_kode: cabangKode, gramasi, perubahan: kirimPcs,
      stok_sebelum: stokLama, stok_sesudah: stokBaru,
      tipe: 'mutasi_masuk', catatan: `Mutasi ${kode}`,
      tanggal: tanggalKirim, created_by: user.id, created_name: profile?.name ?? null,
    })
  }

  // Audit
  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'KIRIM_MUTASI', module: 'MUTASI',
    record_key: kode, record_id: String(mutasi.id),
    after_data: { cabang: cabangKode, pcs: totalPcs, shieldtags: shieldtagKodes },
  })

  revalidatePath('/mutasi')
  revalidatePath('/inventory')
  revalidatePath('/shieldtag')
  return { success: true, kode }
}

// ─── Edit stok cabang manual (stok hari ini) ──────────────────────────────────
export async function updateStokCabangManual(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).maybeSingle()

  const cabangKode = formData.get('cabang_kode') as string
  const gramasi    = formData.get('gramasi') as string
  const stokBaru   = parseInt(formData.get('stok_ready') as string)
  const poBaru     = parseInt(formData.get('po_pcs') as string || '0') || 0
  const catatan    = (formData.get('catatan') as string) || null

  if (!cabangKode || !gramasi) return { error: 'Cabang & gramasi wajib' }
  if (isNaN(stokBaru) || stokBaru < 0) return { error: 'Stok tidak valid' }

  const { data: existing } = await supabase.from('stok_cabang')
    .select('id, stok_ready').eq('cabang_kode', cabangKode).eq('gramasi', gramasi).maybeSingle()
  const stokLama = existing?.stok_ready ?? 0

  if (existing) {
    await supabase.from('stok_cabang').update({
      stok_ready: stokBaru, po_pcs: poBaru,
      updated_at: new Date().toISOString(), updated_by: user.id,
    }).eq('id', existing.id)
  } else {
    await supabase.from('stok_cabang').insert({
      cabang_kode: cabangKode, gramasi, stok_ready: stokBaru, po_pcs: poBaru, updated_by: user.id,
    })
  }

  await supabase.from('stok_cabang_log').insert({
    cabang_kode: cabangKode, gramasi, perubahan: stokBaru - stokLama,
    stok_sebelum: stokLama, stok_sesudah: stokBaru,
    tipe: 'edit_manual', catatan,
    created_by: user.id, created_name: profile?.name ?? null,
  })

  revalidatePath('/mutasi')
  return { success: true }
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
export async function fetchMutasiList() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], error: 'Unauthorized' }
  const { data } = await supabase.from('mutasi')
    .select('*').is('voided_at', null).order('created_at', { ascending: false }).limit(100)
  return { rows: data ?? [] }
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
