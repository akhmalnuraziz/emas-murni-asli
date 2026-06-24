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
  namaCustomer: string
  hpCustomer: string
  shieldtagKode: string
  gramasi: string
  kondisiEmas: string
  kondisiTag: string
  hasilInspeksi: string
  hargaBeli: number
  fotosB64: string[]
  catatan: string
  userName?: string
}): Promise<{ success: boolean; error?: string; kode?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  const userName = profile?.name ?? 'Unknown'

  try {
    const kode = await generateBuybackCode(supabase)
    const fotoUrls = params.fotosB64.length
      ? await uploadBase64Fotos(supabase, params.fotosB64, kode)
      : []

    const { error } = await supabase.from('buyback').insert({
      kode,
      tanggal: new Date().toISOString().slice(0, 10),
      nama_customer: params.namaCustomer,
      hp_customer: params.hpCustomer || null,
      shieldtag_kode: params.shieldtagKode || null,
      gramasi: params.gramasi || null,
      kondisi_emas: params.kondisiEmas,
      kondisi_tag: params.kondisiTag,
      hasil_inspeksi: params.hasilInspeksi,
      harga_beli: params.hargaBeli,
      foto: fotoUrls.length ? fotoUrls : null,
      catatan: params.catatan || null,
      status: 'pending',
      created_by: user.id,
    })

    if (error) return { success: false, error: error.message }

    if (params.shieldtagKode) {
      await supabase.from('shieldtag').update({ status: 'RETURNED' }).eq('kode', params.shieldtagKode)
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      user_name: userName,
      action: 'CREATE',
      module: 'buyback',
      record_key: kode,
      after_data: { nama_customer: params.namaCustomer, hasil_inspeksi: params.hasilInspeksi },
    })

    await createNotif({
      judul: `Buyback Baru: ${kode}`,
      pesan: `${params.namaCustomer} · ${params.gramasi}gr · Rp${params.hargaBeli.toLocaleString('id-ID')}`,
      tipe: 'info',
      link: '/buyback',
      untuk_role: ['owner', 'admin_pusat', 'spv'],
    })

    revalidatePath('/buyback')
    return { success: true, kode }
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
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? ''))
    return { success: false, error: 'Tidak ada akses' }
  const userName = profile?.name ?? 'Unknown'

  const STATUS_MAP = {
    ready_resell: 'ready_resell',
    repair: 'repair',
    reject: 'holding_reject',
    lebur: 'akan_dilebur',
  }

  const { error } = await supabase.from('buyback').update({
    status: STATUS_MAP[params.aksi],
    hasil_inspeksi: params.aksi,
    catatan: params.catatan || null,
    approved_by: userName,
    approved_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_name: userName,
    action: 'UPDATE',
    module: 'buyback',
    record_key: params.kode,
    after_data: { aksi: params.aksi },
    reason: params.catatan,
  })

  await createNotif({
    judul: `Buyback ${params.kode} Diproses`,
    pesan: `Status: ${params.aksi} · oleh ${userName}`,
    tipe: 'info',
    link: '/buyback',
    untuk_role: ['owner', 'admin_pusat', 'spv'],
  })

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
