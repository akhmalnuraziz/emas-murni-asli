import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStokSemuaCabang } from './actions'
import StokPoCabangTabs from '@/components/modules/stok-cabang/stok-po-cabang-tabs'

export const dynamic = 'force-dynamic'

const PO_PAGE_SIZE = 20

export default async function StokCabangPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profile')
    .select('name, role, cabang_kode').eq('id', user?.id ?? '').single()

  const sp = await searchParams
  const isKepala    = profile?.role === 'kepala_cabang'
  const cabangKode  = profile?.cabang_kode ?? undefined
  const filter      = isKepala ? cabangKode : undefined
  const canAdjust   = true // ROLE_CHECK_DISABLED: ['owner', 'admin_pusat', 'spv'].includes(profile?.role ?? '')

  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (page - 1) * PO_PAGE_SIZE

  let poQuery = supabase.from('po_cabang')
    .select('*, items:po_cabang_item(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PO_PAGE_SIZE - 1)
  if (isKepala && cabangKode) poQuery = poQuery.eq('cabang_kode', cabangKode) as any

  const [
    { data: stokData },
    { data: poList, count: poTotal },
    { data: cabangList },
  ] = await Promise.all([
    getStokSemuaCabang(filter),
    poQuery,
    supabase.from('cabang').select('kode, nama').eq('aktif', true).is('voided_at', null).order('nama'),
  ])

  return (
    <StokPoCabangTabs
      stokProps={{
        stokData: stokData ?? [],
        userRole: profile?.role ?? '',
        canAdjust,
        isCabangView: isKepala,
      }}
      poProps={{
        poList: poList ?? [],
        cabangList: cabangList ?? [],
        userRole: profile?.role ?? 'operator_produksi',
        userName: profile?.name ?? '',
        page,
        total: poTotal ?? 0,
        pageSize: PO_PAGE_SIZE,
      }}
    />
  )
}
