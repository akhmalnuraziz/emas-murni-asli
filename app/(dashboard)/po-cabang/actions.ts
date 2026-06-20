'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function generatePoKode(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('increment_counter', { counter_name: 'po_cabang' })
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `PO/${ym}/${String(data ?? 1).padStart(4, '0')}`
}

export async function createPO(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const cabangKode = formData.get('cabang_kode') as string
  const cabangNama = formData.get('cabang_nama') as string
  const tanggal    = formData.get('tanggal') as string
  const catatan    = formData.get('catatan') as string | null
  const itemsRaw   = formData.get('items') as string  // JSON array

  if (!cabangKode) return { error: 'Cabang wajib dipilih' }
  if (!tanggal)    return { error: 'Tanggal wajib diisi' }
  if (!itemsRaw)   return { error: 'Minimal satu item wajib diisi' }

  const items: { produk_nama: string; gramasi: string; qty_diminta: number; catatan_item?: string }[] = JSON.parse(itemsRaw)
  if (!items.length) return { error: 'Minimal satu item wajib diisi' }
  for (const it of items) {
    if (!it.gramasi) return { error: 'Gramasi item wajib diisi' }
    if (!it.qty_diminta || it.qty_diminta <= 0) return { error: 'Qty item wajib > 0' }
  }

  const kode = await generatePoKode(supabase)

  const { data: po, error } = await supabase.from('po_cabang').insert({
    kode, cabang_kode: cabangKode, cabang_nama: cabangNama,
    tanggal, status: 'pending', catatan: catatan || null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  const itemRows = items.map(it => ({
    po_id: po.id,
    produk_nama: it.produk_nama || `LM REI ${it.gramasi}GR`,
    gramasi: it.gramasi,
    qty_diminta: it.qty_diminta,
    catatan_item: it.catatan_item || null,
  }))
  const { error: itemErr } = await supabase.from('po_cabang_item').insert(itemRows)
  if (itemErr) return { error: itemErr.message }

  revalidatePath('/po-cabang')
  return { success: true, kode }
}

export async function updateStatusPO(poId: number, status: 'diproses' | 'selesai' | 'ditolak', catatanAdmin?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')) return { error: 'Tidak memiliki izin' }

  const now = new Date().toISOString()
  const update: any = { status, catatan_admin: catatanAdmin || null, updated_at: now }
  if (status === 'diproses') update.diproses_at = now
  if (status === 'selesai')  update.selesai_at  = now
  if (status === 'ditolak')  update.ditolak_at  = now

  const { error } = await supabase.from('po_cabang').update(update).eq('id', poId)
  if (error) return { error: error.message }
  revalidatePath('/po-cabang')
  return { success: true }
}

export async function updateQtyDikirim(itemId: number, qtyDikirim: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('po_cabang_item').update({ qty_dikirim: qtyDikirim }).eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath('/po-cabang')
  return { success: true }
}

export async function deletePO(poId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: po } = await supabase.from('po_cabang').select('status').eq('id', poId).single()
  if (po?.status === 'selesai') return { error: 'PO yang sudah selesai tidak bisa dihapus' }

  await supabase.from('po_cabang_item').delete().eq('po_id', poId)
  await supabase.from('po_cabang').delete().eq('id', poId)
  revalidatePath('/po-cabang')
  return { success: true }
}
