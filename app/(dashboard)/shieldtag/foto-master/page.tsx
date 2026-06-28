import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FotoMasterClient from './foto-master-client'

export const dynamic = 'force-dynamic'

const GRAMASI_LIST = ['0.1','0.5','1','2','3','5','10','20','25','50','100','250','500','1000']

export default async function FotoMasterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['owner', 'manager', 'spv', 'admin_pusat'].includes(role)) redirect('/shieldtag')

  const { data: masters } = await supabase.from('foto_produk_master')
    .select('gramasi, foto_urls, keterangan, updated_at, updated_by')
    .order('gramasi')

  // Build map, ensure all gramasi present
  const masterMap: Record<string, { foto_urls: string[]; keterangan: string | null; updated_at: string | null; updated_by: string | null }> = {}
  for (const g of GRAMASI_LIST) masterMap[g] = { foto_urls: [], keterangan: null, updated_at: null, updated_by: null }
  for (const m of masters ?? []) masterMap[m.gramasi] = m

  return (
    <FotoMasterClient
      masterMap={masterMap}
      gramasiList={GRAMASI_LIST}
      userRole={role}
    />
  )
}
