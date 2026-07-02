import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PelangganClient from '@/components/modules/pelanggan/pelanggan-client'

export const dynamic = 'force-dynamic'

export default async function PelangganPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profile').select('role, name').eq('id', user.id).single()
  // ROLE_CHECK_DISABLED: if (!['owner', 'admin_pusat', 'spv', 'accounting'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: penjualanList } = await supabase
    .from('penjualan')
    .select('id, no_faktur, tanggal, nama_customer, hp_customer, ktp_customer, channel, cabang_nama, pcs, gramasi, total_harga_jual, total_profit')
    .is('voided_at', null)
    .not('nama_customer', 'is', null)
    .order('tanggal', { ascending: false })

  // Aggregate by customer phone (or name if no phone)
  const map = new Map<string, {
    key: string
    nama: string
    hp: string | null
    ktp: string | null
    txCount: number
    totalPcs: number
    totalBelanja: number
    lastTanggal: string
    channels: Set<string>
    transactions: any[]
  }>()

  for (const p of penjualanList ?? []) {
    const key = p.hp_customer?.trim() || p.nama_customer?.trim() || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        key,
        nama: p.nama_customer ?? '—',
        hp: p.hp_customer ?? null,
        ktp: p.ktp_customer ?? null,
        txCount: 0,
        totalPcs: 0,
        totalBelanja: 0,
        lastTanggal: p.tanggal,
        channels: new Set(),
        transactions: [],
      })
    }
    const c = map.get(key)!
    c.txCount++
    c.totalPcs += Number(p.pcs ?? 0)
    c.totalBelanja += Number(p.total_harga_jual ?? 0)
    if (p.tanggal > c.lastTanggal) c.lastTanggal = p.tanggal
    if (p.channel) c.channels.add(p.channel)
    c.transactions.push(p)
  }

  const pelangganList = [...map.values()]
    .map(c => ({ ...c, channels: [...c.channels] }))
    .sort((a, b) => b.totalBelanja - a.totalBelanja)

  const canSeeRp = ['owner', 'admin_pusat', 'accounting'].includes(profile?.role ?? '')

  return (
    <PelangganClient
      pelangganList={pelangganList}
      userRole={profile?.role ?? ''}
      canSeeRp={canSeeRp}
    />
  )
}
