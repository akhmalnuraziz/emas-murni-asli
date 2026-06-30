'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

async function generateBuybackCode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'buyback' })
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `BB.GDCJ/${today}/${String(data ?? 1).padStart(4, '0')}`
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
      const path = `buyback/${safe}/${Date.now()}_${i}.jpg`
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

export async function createBuyback(params: {
  tanggal?: string
  namaCustomer?: string
  hpCustomer?: string
  shieldtagKodes: string[]  // empty array = no shieldtag
  gramasi: string
  kondisiEmas: string
  kondisiTag: string
  hargaBeli: number
  fotosB64: string[]
  catatan: string
}): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const userName = profile?.name ?? 'Unknown'

  try {
    const kode0 = await generateBuybackCode(supabase)
    const fotoUrls = params.fotosB64.length
      ? await uploadBase64Fotos(supabase, params.fotosB64, kode0)
      : []

    const tanggal = params.tanggal || new Date().toISOString().slice(0, 10)

    if (params.shieldtagKodes.length > 0) {
      const { data: existingTags } = await supabase.from('shieldtag')
        .select('kode').in('kode', params.shieldtagKodes).is('voided_at', null)
      const foundKodes = new Set((existingTags ?? []).map((t: any) => t.kode))
      const missing = params.shieldtagKodes.filter(k => !foundKodes.has(k))
      if (missing.length > 0) return { success: false, error: `ShieldTag tidak ditemukan: ${missing.join(', ')}` }
    }

    const targets = params.shieldtagKodes.length ? params.shieldtagKodes : [null]

    for (let i = 0; i < targets.length; i++) {
      const stKode = targets[i]
      const kode = i === 0 ? kode0 : await generateBuybackCode(supabase)

      const { error } = await supabase.from('buyback').insert({
        kode,
        tanggal,
        nama_customer: params.namaCustomer || null,
        hp_customer: params.hpCustomer || null,
        shieldtag_kode: stKode,
        gramasi: params.gramasi || null,
        kondisi_emas: params.kondisiEmas,
        kondisi_tag: params.kondisiTag,
        harga_beli: params.hargaBeli,
        foto: i === 0 && fotoUrls.length ? fotoUrls : null,
        catatan: params.catatan || null,
        status: 'pending',
        created_by: user.id,
      })
      if (error) return { success: false, error: error.message }

      if (stKode) {
        await supabase.from('shieldtag').update({ status: 'RETURNED' }).eq('kode', stKode)
      }
    }

    const label = params.namaCustomer
      ? `${params.namaCustomer} · ${params.gramasi}gr`
      : `${targets.length}x ${params.gramasi}gr`
    createNotif({
      judul: `Buyback/Barang Masuk: ${kode0}`,
      pesan: label,
      tipe: 'info',
      link: '/buyback',
      untuk_role: ['owner', 'manager', 'spv'],
    })

    revalidatePath('/buyback')
    return { success: true, count: targets.length }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function prossesBuyback(params: {
  id: number
  kode: string
  aksi: 'ready_resell' | 'repair' | 'reject' | 'lebur'
  catatan: string
  userName?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv'].includes(profile?.role ?? ''))
    return { success: false, error: 'Tidak ada akses' }
  const userName = profile?.name ?? 'Unknown'

  const STATUS_MAP = {
    ready_resell: 'ready_resell',
    repair: 'repair',
    reject: 'holding_reject',
    lebur: 'akan_dilebur',
  }

  const { data: bbRecord } = await supabase.from('buyback')
    .select('shieldtag_kode, gramasi').eq('id', params.id).single()

  const { error } = await supabase.from('buyback').update({
    status: STATUS_MAP[params.aksi],
    hasil_inspeksi: params.aksi,
    catatan: params.catatan || null,
    approved_by: userName,
    approved_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return { success: false, error: error.message }

  if (bbRecord?.shieldtag_kode) {
    const kode = bbRecord.shieldtag_kode
    if (params.aksi === 'ready_resell') {
      // ponytail: upsert bukan update — shieldtag buyback lama mungkin belum terdaftar di tabel
      await supabase.from('shieldtag')
        .upsert({
          kode,
          status: 'Aktif',
          lokasi: 'Gudang Pusat',
          gramasi: bbRecord.gramasi ?? null,
          tgl_regis: new Date().toISOString().slice(0, 10),
          registered_by: userName,
        }, { onConflict: 'kode' })
    } else {
      const lokasiMap: Record<string, string> = {
        repair: 'Buyback — Repair',
        reject: 'Buyback — Karantina',
        lebur: 'Buyback — Akan Dilebur',
      }
      await supabase.from('shieldtag')
        .update({ status: 'Karantina', lokasi: lokasiMap[params.aksi] ?? 'Karantina' })
        .eq('kode', kode)
    }
  }

  supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: userName,
    action: 'UPDATE',
    module: 'buyback',
    record_key: params.kode,
    after_data: { aksi: params.aksi },
    reason: params.catatan,
  })

  createNotif({
    judul: `Buyback ${params.kode} Diproses`,
    pesan: `Status: ${params.aksi} · oleh ${userName}`,
    tipe: 'info',
    link: '/buyback',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/buyback')
  return { success: true }
}

export async function editBuyback(id: number, params: {
  tanggal?: string
  namaCustomer?: string
  hpCustomer?: string
  shieldtagKode: string
  gramasi: string
  kondisiEmas: string
  kondisiTag: string
  hargaBeli: number
  catatan: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: existing } = await supabase.from('buyback')
    .select('status, shieldtag_kode').eq('id', id).single()
  if (!existing) return { success: false, error: 'Data tidak ditemukan' }
  if (existing.status !== 'pending') return { success: false, error: 'Hanya buyback pending yang bisa diedit' }

  const oldKode = existing.shieldtag_kode
  const newKode = params.shieldtagKode || null
  if (oldKode && oldKode !== newKode) {
    await supabase.from('shieldtag').update({ status: 'Terjual' }).eq('kode', oldKode).eq('status', 'RETURNED')
  }
  if (newKode && newKode !== oldKode) {
    await supabase.from('shieldtag').update({ status: 'RETURNED' }).eq('kode', newKode)
  }

  const { error } = await supabase.from('buyback').update({
    tanggal: params.tanggal || undefined,
    nama_customer: params.namaCustomer || null,
    hp_customer: params.hpCustomer || null,
    shieldtag_kode: newKode,
    gramasi: params.gramasi || null,
    kondisi_emas: params.kondisiEmas,
    kondisi_tag: params.kondisiTag,
    harga_beli: params.hargaBeli,
    catatan: params.catatan || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/buyback')
  return { success: true }
}

export async function deleteBuyback(id: number): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager'].includes(profile?.role ?? '')) return { success: false, error: 'Hanya Owner/Manager' }

  const { data: existing } = await supabase.from('buyback')
    .select('status, shieldtag_kode, kode').eq('id', id).single()
  if (!existing) return { success: false, error: 'Data tidak ditemukan' }
  if (existing.status !== 'pending') return { success: false, error: 'Hanya buyback pending yang bisa dihapus' }

  if (existing.shieldtag_kode) {
    await supabase.from('shieldtag')
      .update({ status: 'Terjual' })
      .eq('kode', existing.shieldtag_kode)
      .eq('status', 'RETURNED')
  }

  await supabase.from('buyback').update({
    voided_at: new Date().toISOString(),
    void_reason: 'DELETED_BY_USER',
  }).eq('id', id)

  revalidatePath('/buyback')
  return { success: true }
}

export async function getBuybackList() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('buyback')
    .select('*')
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  return { data: data ?? [], error: error?.message }
}
