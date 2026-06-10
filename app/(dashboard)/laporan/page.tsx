import { createClient } from '@/lib/supabase/server'
import LaporanClient from '@/components/modules/laporan/laporan-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users_profile').select('role,name').eq('id', user?.id ?? '').single()

  const { data: batches } = await supabase
    .from('batch')
    .select('kode, nama_batch, tanggal, supplier, status, timbangan_akhir, bahan_dari_pusat, hpp_gr, total_hpp, created_at')
    .is('voided_at', null)
    .order('created_at', { ascending: false })

  return (
    <LaporanClient
      batches={batches ?? []}
      userRole={profile?.role ?? 'operator_produksi'}
      userName={profile?.name ?? ''}
    />
  )
}
