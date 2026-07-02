'use server'

import { createClient } from '@/lib/supabase/server'

export async function fetchBackupData(table: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', data: null }
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'manager', 'admin_accounting'].includes(profile?.role ?? ''))
  // ROLE_CHECK_DISABLED: return { error: 'Tidak ada akses', data: null }
  // ROLE_CHECK_DISABLED: 
  const ALLOWED = [
    'batch', 'peleburan', 'produksi_item', 'packing_log', 'shieldtag',
    'penjualan', 'penjualan_item', 'penjualan_payment',
    'buyback', 'mutasi', 'pengeluaran', 'scrap_inventory',
    'po_packaging', 'po_batch_penerimaan',
    'users_profile', 'cabang', 'tim_produksi',
  ]
  if (!ALLOWED.includes(table)) return { error: 'Tabel tidak diizinkan', data: null }

  const { data, error } = await supabase.from(table).select('*').order('id').limit(10000)
  if (error) return { error: error.message, data: null }
  return { data, error: null }
}
