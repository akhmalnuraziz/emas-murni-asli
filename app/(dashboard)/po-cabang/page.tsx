import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoCabangClient from '@/components/modules/po-cabang/po-cabang-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function PoCabangPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE

  const { data: profile } = await supabase.from('users_profile')
    .select('role, name, cabang_kode').eq('id', user.id).single()

  const isKepala = profile?.role === 'kepala_cabang'

  let poQuery = supabase.from('po_cabang')
    .select('*, items:po_cabang_item(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (isKepala && profile?.cabang_kode) {
    poQuery = poQuery.eq('cabang_kode', profile.cabang_kode) as any
  }

  const [
    { data: poList, count: poTotal },
    { data: cabangList },
  ] = await Promise.all([
    poQuery,
    supabase.from('cabang')
      .select('kode, nama')
      .eq('aktif', true)
      .is('voided_at', null)
      .order('nama'),
  ])

  return (
    <PoCabangClient
      poList={poList ?? []}
      cabangList={cabangList ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      page={page}
      total={poTotal ?? 0}
      pageSize={PAGE_SIZE}
    />
  )
}
