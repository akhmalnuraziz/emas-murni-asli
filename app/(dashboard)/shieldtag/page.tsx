import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShieldtagClient from '@/components/modules/shieldtag/shieldtag-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function ShieldtagPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const q = sp.q?.trim().toUpperCase() ?? ''
  const status = sp.status ?? 'Semua'
  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('shieldtag')
    .select('id, kode, gramasi, status, batch_kode, packing_id, lokasi, tgl_regis, voided_at, hpp', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (q) query = query.or(`kode.ilike.${q}%,batch_kode.ilike.${q}%`)
  if (status !== 'Semua') query = query.eq('status', status)

  query = query.range(offset, offset + PAGE_SIZE - 1)

  const [
    { data: profile },
    { data: shieldtags, count },
    { data: packingsForReg },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user.id).single(),
    query,
    supabase.from('packing')
      .select('id, kode, batch_kode, gramasi, pcs_dipack, pcs_reject, shieldtag_count, tanggal, produksi_item(kode, nama_item)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
  ])

  const packingsWithSlots = (packingsForReg ?? []).filter((p: any) => {
    const maxSt = (p.pcs_dipack ?? 0) - (p.pcs_reject ?? 0)
    const remaining = maxSt - (p.shieldtag_count ?? 0)
    return remaining > 0
  }).map((p: any) => ({
    ...p,
    pcs_tersisa: (p.pcs_dipack ?? 0) - (p.pcs_reject ?? 0) - (p.shieldtag_count ?? 0),
  }))

  return (
    <ShieldtagClient
      shieldtags={shieldtags ?? []}
      packingsWithSlots={packingsWithSlots}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      currentQ={q}
      currentStatus={status}
    />
  )
}
