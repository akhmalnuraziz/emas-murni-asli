import { createClient } from '@/lib/supabase/server'
import ShieldtagClient from '@/components/modules/shieldtag/shieldtag-client'

export default async function ShieldtagPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: shieldtags },
    { data: packingsForReg },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('shieldtag')
      .select('*')
      .order('created_at', { ascending: false }),
    // Packings that still have unregistered slots
    supabase.from('packing')
      .select('id, kode, batch_kode, gramasi, pcs_dipack, shieldtag_count, tanggal, produksi_item(kode, nama_item)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
  ])

  // Filter packings with remaining slots
  const packingsWithSlots = (packingsForReg ?? []).filter((p: any) => {
    const remaining = (p.pcs_dipack ?? 0) - (p.shieldtag_count ?? 0)
    return remaining > 0
  }).map((p: any) => ({
    ...p,
    pcs_tersisa: (p.pcs_dipack ?? 0) - (p.shieldtag_count ?? 0),
  }))

  return (
    <ShieldtagClient
      shieldtags={shieldtags ?? []}
      packingsWithSlots={packingsWithSlots}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
