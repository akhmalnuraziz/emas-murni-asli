import { createClient } from '@/lib/supabase/server'
import PenjualanClient from '@/components/modules/penjualan/penjualan-client'

export default async function PenjualanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: penjualanList }] = await Promise.all([
    supabase.from('users_profile').select('role,name').eq('id', user?.id ?? '').single(),
    supabase.from('penjualan')
      .select('id, nomor_invoice, no_faktur, tanggal, channel, source, nama_customer, hp_customer, pcs, total_harga_jual, harga_jual, total_profit, profit, status, voided_at, customer:customer_id(nama, no_hp)')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <PenjualanClient
      penjualanList={penjualanList ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
    />
  )
}
