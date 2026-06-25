'use server'
import { createClient } from '@/lib/supabase/server'

const PRIVILEGED = ['owner', 'manager', 'admin_accounting', 'spv']

export async function fetchBatchReport(batchKode: string) {
  if (!batchKode) return { error: 'Kode batch kosong' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  if (!profile) return { error: 'Unauthorized' }

  const [
    { data: batch, error: batchErr },
    { data: peleburan },
    { data: produksiItems },
  ] = await Promise.all([
    supabase.from('batch').select('*').eq('kode', batchKode).single(),
    supabase.from('peleburan')
      .select('*')
      .eq('batch_kode', batchKode)
      .is('voided_at', null)
      .order('created_at'),
    supabase.from('produksi_item')
      .select('*, produksi_event(*), packing!left(id,kode,tanggal,pcs,pcs_dipack,total_gram,shieldtag_count,catatan,voided_at,gramasi), stage_handover(*)')
      .eq('batch_kode', batchKode)
      .is('voided_at', null)
      .order('created_at'),
  ])

  if (batchErr) return { error: batchErr.message }

  // Sembunyikan HPP dari role non-privileged
  const canSeeHpp = PRIVILEGED.includes(profile.role ?? '')
  const safeBatch = canSeeHpp ? batch : { ...batch, hpp_gr: undefined, hpp_total: undefined }

  return { batch: safeBatch, peleburan: peleburan ?? [], produksiItems: produksiItems ?? [] }
}
