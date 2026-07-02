import type { SupabaseClient } from '@supabase/supabase-js'

export async function generateScrapKode(supabase: SupabaseClient): Promise<string> {
  const { data: counterData } = await supabase.rpc('increment_counter', { counter_name: 'scrap' })
  return `SCR${String(counterData ?? 1).padStart(4, '0')}`
}

export function scrapStatusFrom(berat: number, terpakai: number): string {
  if (terpakai <= 0.0001) return 'tersedia'
  if (berat - terpakai > 0.0001) return 'sebagian'
  return 'terpakai'
}

// Upsert scrap dari serbuk produksi — keyed sumber_ref supaya edit terima Pas Berat tersinkron
export async function syncSerbukScrap(supabase: SupabaseClient, p: {
  sumberRef: string
  batchKode: string | null
  gramasi: string | null
  berat: number
  tanggal: string
  admin: string | null
  createdBy: string
}): Promise<{ error?: string }> {
  const { data: existing } = await supabase.from('scrap_inventory')
    .select('id, berat_terpakai').eq('sumber_ref', p.sumberRef).is('voided_at', null).maybeSingle()

  if (existing) {
    const terpakai = Number(existing.berat_terpakai ?? 0)
    if (p.berat < terpakai - 0.001)
      return { error: `Serbuk sudah terpakai ${terpakai.toFixed(3)}gr di peleburan — berat tidak bisa di bawah itu` }
    if (p.berat <= 0.0001 && terpakai <= 0.0001) {
      await supabase.from('scrap_inventory').update({
        voided_at: new Date().toISOString(), void_reason: 'SERBUK_DIEDIT_KE_NOL',
      }).eq('id', existing.id)
      return {}
    }
    await supabase.from('scrap_inventory').update({
      berat_gram: p.berat,
      berat_sisa: Math.max(0, p.berat - terpakai),
      status: scrapStatusFrom(p.berat, terpakai),
      tanggal: p.tanggal,
      batch_kode: p.batchKode,
      gramasi: p.gramasi,
    }).eq('id', existing.id)
    return {}
  }

  if (p.berat <= 0.0001) return {}
  const kode = await generateScrapKode(supabase)
  await supabase.from('scrap_inventory').insert({
    kode,
    sumber_ref: p.sumberRef,
    sumber_proses: 'serbuk_produksi',
    batch_kode: p.batchKode,
    gramasi: p.gramasi,
    berat_gram: p.berat,
    berat_sisa: p.berat,
    berat_terpakai: 0,
    status: 'tersedia',
    tanggal: p.tanggal,
    admin_input: p.admin,
    catatan: 'Otomatis dari serbuk produksi',
    created_by: p.createdBy,
  })
  return {}
}

// Void scrap yang bersumber dari ref tertentu (mis. handover di-void).
// Diblokir jika sudah terpakai di peleburan.
export async function voidScrapBySumberRef(supabase: SupabaseClient, sumberRef: string, reason: string): Promise<{ error?: string }> {
  const { data: row } = await supabase.from('scrap_inventory')
    .select('id, kode, berat_terpakai').eq('sumber_ref', sumberRef).is('voided_at', null).maybeSingle()
  if (!row) return {}
  if (Number(row.berat_terpakai ?? 0) > 0.0001)
    return { error: `Scrap ${row.kode} sudah terpakai di peleburan — batalkan peleburannya dulu` }
  await supabase.from('scrap_inventory').update({
    voided_at: new Date().toISOString(), void_reason: reason,
  }).eq('id', row.id)
  return {}
}
