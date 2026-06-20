import { createClient } from '@/lib/supabase/server'
import { getStokSemuaCabang } from './actions'
import StokCabangClient from '@/components/modules/stok-cabang/stok-cabang-client'

export const dynamic = 'force-dynamic'

export default async function StokCabangPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile')
    .select('name, role').eq('id', user?.id ?? '').single()

  const { data: stokData } = await getStokSemuaCabang()

  const canAdjust = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  return (
    <StokCabangClient
      stokData={stokData}
      userRole={profile?.role ?? ''}
      canAdjust={canAdjust}
    />
  )
}
