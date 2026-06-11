import { createClient } from '@/lib/supabase/server'
import MutasiClient from '@/components/modules/mutasi/mutasi-client'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: cabang } = await supabase
    .from('cabang')
    .select('kode, nama')
    .is('voided_at', null)
    .eq('aktif', true)
    .order('id')

  return <MutasiClient cabangList={cabang ?? []} />
}
