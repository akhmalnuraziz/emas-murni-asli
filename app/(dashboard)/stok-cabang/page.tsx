import { createClient } from '@/lib/supabase/server'
import { getStokSemuaCabang } from './actions'
import StokCabangClient from '@/components/modules/stok-cabang/stok-cabang-client'

export const dynamic = 'force-dynamic'

export default async function StokCabangPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile')
    .select('name, role, cabang_kode').eq('id', user?.id ?? '').single()

  const isKepala    = profile?.role === 'kepala_cabang'
  const cabangKode  = profile?.cabang_kode ?? undefined
  // kepala_cabang hanya lihat cabangnya sendiri
  const filter      = isKepala ? cabangKode : undefined
  const canAdjust   = ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  const { data: stokData } = await getStokSemuaCabang(filter)

  return (
    <StokCabangClient
      stokData={stokData}
      userRole={profile?.role ?? ''}
      canAdjust={canAdjust}
      isCabangView={isKepala}
    />
  )
}
