import { createClient } from '@/lib/supabase/server'
import ShieldtagClient from '@/components/modules/shieldtag/shieldtag-client'

export default async function ShieldtagPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: shieldtags },
    { data: packings },
  ] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('shieldtag')
      .select('*')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('packing')
      .select('id, kode, gramasi, pcs_dipack, shieldtag_count, batch_kode, tanggal, produksi_item(kode, nama_item)')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
  ])

  // Hanya packing yang masih punya slot shieldtag tersisa
  const packingsForReg = (packings ?? []).filter((p: any) => {
    const registered = p.shieldtag_count ?? 0
    return registered < (p.pcs_dipack ?? 0)
  })

  return (
    <ShieldtagClient
      shieldtags={shieldtags ?? []}
      packingsForReg={packingsForReg}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
