'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PCKG_PREFIX = 'PCKG.GDCJ'

async function generatePackingCode(supabase: any): Promise<string> {
  const { count } = await supabase.from('packing').select('*', { count: 'exact', head: true })
  return `${PCKG_PREFIX}/${String((count ?? 0) + 1).padStart(4, '0')}`
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
  const pic = formData.get('pic') as string
  const catatan = formData.get('catatan') as string

  if (!produksiItemId) return { error: 'Item produksi wajib dipilih' }
  if (!pcsDispack || pcsDispack <= 0) return { error: 'PCS yang dipack wajib diisi' }
  if (!totalGramAktual || totalGramAktual <= 0) return { error: 'Total gram aktual wajib diisi' }
  if (!tanggal) return { error: 'Tanggal packing wajib diisi' }

  const { data: produksi } = await supabase
    .from('produksi_item')
    .select('*, packing!left(pcs_dipack, voided_at)')
    .eq('id', produksiItemId).single()
  if (!produksi) return { error: 'Item produksi tidak ditemukan' }
  if (produksi.current_status !== 'Siap Packing') return { error: 'Item harus dalam status Siap Packing' }

  // Hitung sisa PCS yang belum dipacking
  const activePacking = (produksi.packing ?? []).filter((p: any) => !p.voided_at)
  const totalSudahDipack = activePacking.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
  const pcsTersisa = (produksi.pcs_good ?? produksi.pcs) - totalSudahDipack

  if (pcsDispack > pcsTersisa) {
    return { error: `PCS yang dipack (${pcsDispack}) melebihi sisa PCS (${pcsTersisa})` }
  }

  const gramasi = parseFloat(produksi.gramasi)
  const totalGramTarget = gramasi * pcsDispack
  const selisih = totalGramAktual - totalGramTarget

  const kode = await generatePackingCode(supabase)

  const { data: packing, error } = await supabase.from('packing').insert({
    kode,
    produksi_item_id: produksiItemId,
    batch_kode: produksi.batch_kode,
    gramasi: produksi.gramasi,
    pcs: pcsDispack,
    pcs_dipack: pcsDispack,
    total_gram: totalGramAktual,
    total_gram_aktual: totalGramAktual,
    selisih_gram: selisih,
    tanggal,
    pic: pic || profile?.name || null,
    pic_packing: pic || profile?.name || null,
    catatan: catatan || null,
    status_surat: 'belum_cetak',
    shieldtag_count: 0,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }

  // Jika semua PCS sudah dipacking → update status ke Sudah Packing
  const newTotalPacked = totalSudahDipack + pcsDispack
  if (newTotalPacked >= (produksi.pcs_good ?? produksi.pcs)) {
    await supabase.from('produksi_item')
      .update({ current_status: 'Sudah Packing' })
      .eq('id', produksiItemId)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'CREATE_PACKING', module: 'PACKING',
    record_key: kode, record_id: String(packing.id), after_data: packing,
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true, kode }
}

export async function editPacking(packingId: number, packingKode: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()

  const { data: existing } = await supabase.from('packing').select('*, produksi_item(*)').eq('id', packingId).single()
  if (!existing) return { error: 'Packing tidak ditemukan' }

  const pcsDispack = parseInt(formData.get('pcs_dipack') as string)
  const totalGramAktual = parseFloat(formData.get('total_gram_aktual') as string)
  const tanggal = formData.get('tanggal') as string
  const pic = formData.get('pic') as string
  const catatan = formData.get('catatan') as string

  const gramasi = parseFloat(existing.gramasi)
  const totalGramTarget = gramasi * pcsDispack
  const selisih = totalGramAktual - totalGramTarget

  await supabase.from('packing').update({
    pcs: pcsDispack, pcs_dipack: pcsDispack,
    total_gram: totalGramAktual, total_gram_aktual: totalGramAktual,
    selisih_gram: selisih, tanggal,
    pic: pic || null, pic_packing: pic || null,
    catatan: catatan || null,
  }).eq('id', packingId)

  // Re-check status produksi
  const produksiId = existing.produksi_item_id
  const { data: allPacking } = await supabase.from('packing')
    .select('pcs_dipack').eq('produksi_item_id', produksiId).is('voided_at', null)
  const totalPacked = (allPacking ?? []).reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
  const produksi = existing.produksi_item
  const pcsGood = produksi?.pcs_good ?? produksi?.pcs ?? 0
  const newStatus = totalPacked >= pcsGood ? 'Sudah Packing' : 'Siap Packing'
  await supabase.from('produksi_item').update({ current_status: newStatus }).eq('id', produksiId)

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'EDIT_PACKING', module: 'PACKING',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}

export async function voidPacking(packingId: number, packingKode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('name, role').eq('id', user.id).single()
  if (!['owner', 'admin_pusat'].includes(profile?.role ?? '')) return { error: 'Hanya Owner/Admin Pusat' }

  const { data: existing } = await supabase.from('packing').select('produksi_item_id').eq('id', packingId).single()

  await supabase.from('packing').update({
    voided_at: new Date().toISOString(),
    void_reason: 'VOIDED_BY_USER',
  }).eq('id', packingId)

  // Revert status produksi ke Siap Packing
  if (existing?.produksi_item_id) {
    await supabase.from('produksi_item')
      .update({ current_status: 'Siap Packing' })
      .eq('id', existing.produksi_item_id)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, user_name: profile?.name, user_role: profile?.role,
    action: 'VOID_PACKING', module: 'PACKING',
    record_key: packingKode, record_id: String(packingId),
  })

  revalidatePath('/packing-log')
  revalidatePath('/produksi')
  return { success: true }
}

export async function markPrinted(packingId: number) {
  const supabase = await createClient()
  await supabase.from('packing').update({ status_surat: 'sudah_cetak' }).eq('id', packingId)
  revalidatePath('/packing-log')
  return { success: true }
}
