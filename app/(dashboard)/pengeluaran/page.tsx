import { createClient } from '@/lib/supabase/server'
import PengeluaranClient from '@/components/modules/pengeluaran/pengeluaran-client'

export const dynamic = 'force-dynamic'

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams?: { period?: string; from?: string; to?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const period   = searchParams?.period ?? 'month'
  const todayStr = new Date().toISOString().split('T')[0]
  let dateFrom: string
  let dateTo: string = todayStr

  if (period === 'today') {
    dateFrom = todayStr
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'custom') {
    dateFrom = searchParams?.from ?? todayStr.slice(0, 7) + '-01'
    dateTo   = searchParams?.to ?? todayStr
  } else {
    dateFrom = todayStr.slice(0, 7) + '-01'
  }

  const [
    { data: profile },
    { data: pengeluaranList },
    { data: kategoriList },
  ] = await Promise.all([
    supabase.from('users_profile').select('role').eq('id', user?.id ?? '').single(),
    supabase.from('pengeluaran')
      .select('*, kategori:kategori_pengeluaran(id, nama, warna)')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
      .is('voided_at', null)
      .order('tanggal', { ascending: false }),
    supabase.from('kategori_pengeluaran')
      .select('*')
      .order('nama'),
  ])

  const canManage = ['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')

  return (
    <PengeluaranClient
      pengeluaranList={pengeluaranList ?? []}
      kategoriList={kategoriList ?? []}
      canManage={canManage}
      userRole={profile?.role ?? ''}
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  )
}
