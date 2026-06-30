'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotif } from '@/app/(dashboard)/notifikasi/actions'

async function generateReturKode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'retur_penjualan' })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `RTR/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

export async function createRetur(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const tanggal      = formData.get('tanggal') as string
  const alasan       = formData.get('alasan') as string
  const kondisi      = formData.get('kondisi') as string
  const noFakturAsal = formData.get('no_faktur_asal') as string | null
  const namaCustomer = formData.get('nama_customer') as string | null
  const hpCustomer   = formData.get('hp_customer') as string | null
  const kodeTagRaw   = formData.get('shieldtag_kodes') as string | null
  const catatanAdmin = formData.get('catatan_admin') as string | null

  if (!tanggal) return { error: 'Tanggal wajib diisi' }
  if (!alasan)  return { error: 'Alasan wajib diisi' }
  if (!kondisi) return { error: 'Kondisi wajib dipilih' }

  const shieldtagKodes = kodeTagRaw
    ? kodeTagRaw.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
    : []

  // Lookup penjualan if no_faktur provided
  let penjualanId: number | null = null
  let totalNilai = 0
  if (noFakturAsal) {
    const { data: pj } = await supabase.from('penjualan')
      .select('id, total_harga_jual').eq('no_faktur', noFakturAsal).is('voided_at', null).single()
    if (pj) {
      penjualanId = pj.id
      totalNilai = Number(pj.total_harga_jual ?? 0)
    }
  }

  const kode = await generateReturKode(supabase)

  const { data: retur, error } = await supabase.from('retur_penjualan').insert({
    kode, tanggal, alasan, kondisi,
    no_faktur_asal: noFakturAsal || null,
    nama_customer: namaCustomer || null,
    hp_customer: hpCustomer || null,
    shieldtag_kodes: shieldtagKodes,
    total_nilai: totalNilai,
    penjualan_id: penjualanId,
    catatan_admin: catatanAdmin || null,
    status: 'pending',
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  createNotif({
    judul: `Retur Masuk — ${kode}`,
    pesan: `${namaCustomer ?? 'Customer'} · ${kondisi} · ${alasan.slice(0, 60)}`,
    tipe: 'warning',
    link: '/retur-penjualan',
    untuk_role: ['owner', 'manager', 'spv'],
  })

  revalidatePath('/retur-penjualan')
  return { success: true, kode }
}

export async function updateStatusRetur(
  returId: number,
  status: 'diproses' | 'selesai' | 'ditolak',
  catatanAdmin?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: retur } = await supabase.from('retur_penjualan')
    .select('shieldtag_kodes').eq('id', returId).single()

  const { error } = await supabase.from('retur_penjualan').update({
    status, catatan_admin: catatanAdmin || null, updated_at: new Date().toISOString(),
  }).eq('id', returId)
  if (error) return { error: error.message }

  // Selesai → kembalikan shieldtag ke stok gudang
  if (status === 'selesai' && retur?.shieldtag_kodes?.length) {
    await supabase.from('shieldtag')
      .update({ status: 'Aktif', lokasi: 'Gudang Pusat' })
      .in('kode', retur.shieldtag_kodes)
    revalidatePath('/inventory')
  }

  revalidatePath('/retur-penjualan')
  return { success: true }
}

export async function editRetur(returId: number, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const { data: retur } = await supabase.from('retur_penjualan').select('status').eq('id', returId).single()
  if (!retur) return { error: 'Retur tidak ditemukan' }
  if (retur.status === 'selesai') return { error: 'Retur yang sudah selesai tidak bisa diedit' }

  const { error } = await supabase.from('retur_penjualan').update({
    tanggal:        formData.get('tanggal') as string,
    alasan:         formData.get('alasan') as string,
    kondisi:        formData.get('kondisi') as string,
    nama_customer:  (formData.get('nama_customer') as string) || null,
    hp_customer:    (formData.get('hp_customer') as string) || null,
    catatan_admin:  (formData.get('catatan_admin') as string) || null,
  }).eq('id', returId)

  if (error) return { error: error.message }
  revalidatePath('/retur-penjualan')
  return { success: true }
}

export async function deleteRetur(returId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'manager'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Manager' }

  await supabase.from('retur_penjualan').update({ voided_at: new Date().toISOString() }).eq('id', returId)
  revalidatePath('/retur-penjualan')
  return { success: true }
}
