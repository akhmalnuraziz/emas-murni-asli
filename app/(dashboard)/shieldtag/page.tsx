import { createClient } from '@/lib/supabase/server'
import ShieldtagClient from '@/components/modules/shieldtag/shieldtag-client'

export default async function ShieldtagPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: shieldtags }, { data: packings }, { data: cabangList }] = await Promise.all([
    supabase.from('users_profile').select('role, name').eq('id', user?.id ?? '').single(),
    supabase.from('shieldtag').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('packing')
      .select('id, kode, batch_kode, gramasi, pcs_dipack, pcs, shieldtag_count, tanggal')
      .is('voided_at', null).neq('status_surat', 'void')
      .order('created_at', { ascending: false }),
    supabase.from('cabang').select('nama, kode').eq('aktif', true),
  ])

  return (
    <ShieldtagClient
      shieldtags={shieldtags ?? []}
      packings={packings ?? []}
      cabangList={cabangList ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
