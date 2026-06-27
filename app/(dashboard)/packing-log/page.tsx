import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PackingLogClient from '@/components/modules/packing-log/packing-log-client'

export const dynamic = 'force-dynamic'

export default async function PackingLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: packingList },
    { data: siapPacking },
    { data: shieldtagRows },
    { data: timsRaw },
    { data: adminListRaw },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('packing')
      .select('*, produksi_item(id, kode, nama_item, gramasi, pcs_good, pcs, current_status, batch_kode)')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase.from('produksi_item')
      .select('id, kode, nama_item, gramasi, pcs_good, pcs, batch_kode, current_status, packing!left(pcs_dipack, voided_at)')
      .eq('current_status', 'Siap Packing')
      .is('voided_at', null),
    supabase.from('shieldtag')
      .select('kode, status, packing_id, lokasi')
      .not('packing_id', 'is', null)
      .is('voided_at', null)
      .order('kode')
      .limit(5000),
    supabase.from('tim_produksi').select('id, nama, anggota:tim_anggota(id, nama, aktif)').eq('aktif', true).order('nama'),
    supabase.from('users_profile').select('id, name').eq('aktif', true).order('name'),
  ])

  // Kelompokkan shieldtag per packing_id untuk tracking
  const shieldtagByPacking: Record<number, { kode: string; status: string; lokasi: string | null }[]> = {}
  for (const st of shieldtagRows ?? []) {
    if (st.packing_id == null) continue
    if (!shieldtagByPacking[st.packing_id]) shieldtagByPacking[st.packing_id] = []
    shieldtagByPacking[st.packing_id].push({ kode: st.kode, status: st.status, lokasi: st.lokasi })
  }

  // Hitung pcs_tersisa untuk setiap item siap packing
  const siapPackingItems = (siapPacking ?? []).map((item: any) => {
    const activePacking = (item.packing ?? []).filter((p: any) => !p.voided_at)
    const totalPacked = activePacking.reduce((s: number, p: any) => s + (p.pcs_dipack || 0), 0)
    const pcsTersisa = (item.pcs_good ?? item.pcs) - totalPacked
    return { ...item, pcs_tersisa: pcsTersisa }
  }).filter((item: any) => item.pcs_tersisa > 0)

  const tims = (timsRaw ?? []).map((t: any) => ({ id: t.id, nama: t.nama, anggota: t.anggota ?? [] }))
  const adminList = (adminListRaw ?? []).map((u: any) => ({ id: u.id, nama: u.name }))

  return (
    <PackingLogClient
      packingList={packingList ?? []}
      siapPackingItems={siapPackingItems}
      shieldtagByPacking={shieldtagByPacking}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
      tims={tims}
      adminList={adminList}
    />
  )
}

