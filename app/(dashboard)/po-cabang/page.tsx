import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoCabangClient from '@/components/modules/po-cabang/po-cabang-client'

export const dynamic = 'force-dynamic'

export default async function PoCabangPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: poList },
    { data: cabangList },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user.id).single(),
    supabase.from('po_cabang')
      .select('*, items:po_cabang_item(*)')
      .order('created_at', { ascending: false })
      .limit(100),
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
    />
  )
}
