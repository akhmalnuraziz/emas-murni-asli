import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PenjualanClient from '@/components/modules/penjualan/penjualan-client'

export const dynamic = 'force-dynamic'

export default async function PenjualanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: penjualanList },
    { data: cabangList },
    { data: channels },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user.id).single(),
    supabase.from('penjualan')
      .select('*, items:penjualan_item(*), payments:penjualan_payment(*)')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('cabang').select('kode, nama').eq('aktif', true).is('voided_at', null).order('nama'),
    supabase.from('marketplace_setting').select('channel, label, fee_persen').eq('aktif', true).order('id'),
  ])

  const CAN_SEE_RP = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  return (
    <PenjualanClient
      penjualanList={penjualanList ?? []}
      cabangList={cabangList ?? []}
      channels={channels ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      canSeeRp={CAN_SEE_RP}
    />
  )
}
