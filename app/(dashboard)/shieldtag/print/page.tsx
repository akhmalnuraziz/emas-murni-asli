import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ShieldtagLabelPrint from '@/components/modules/shieldtag/shieldtag-label-print'

export const dynamic = 'force-dynamic'

export default async function ShieldtagPrintPage({
  searchParams,
}: {
  searchParams?: Promise<{ kodes?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const kodesRaw = sp?.kodes ?? ''
  if (!kodesRaw) notFound()

  const kodes = kodesRaw.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
  if (!kodes.length) notFound()

  const { data: tags } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, status, hpp, packing_id, created_at')
    .in('kode', kodes)
    .is('voided_at', null)

  if (!tags?.length) notFound()

  const { data: setting } = await supabase
    .from('pengaturan').select('value').eq('key', 'nama_toko').single()
  const namaToko = setting?.value ?? 'PT Emas Murni Asli'

  return <ShieldtagLabelPrint tags={tags} namaToko={namaToko} />
}
