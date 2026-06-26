import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KpiTimClient from '@/components/modules/kpi-tim/kpi-tim-client'

export const dynamic = 'force-dynamic'

export default async function KpiTimPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const period  = sp?.period ?? 'month'
  const todayStr = new Date().toISOString().split('T')[0]
  let dateFrom: string
  let dateTo: string = todayStr

  if (period === 'today') {
    dateFrom = todayStr
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'custom') {
    dateFrom = sp?.from ?? todayStr.slice(0, 7) + '-01'
    dateTo   = sp?.to ?? todayStr
  } else {
    dateFrom = todayStr.slice(0, 7) + '-01'
  }

  const [
    { data: tims },
    { data: handovers },
    { data: cuttingItems },
    { data: pengaturanRows },
  ] = await Promise.all([
    supabase.from('users_profile').select('role').eq('id', user.id).single(),
    supabase.from('tim_produksi')
      .select('id, nama, warna, anggota:tim_anggota(id, nama, aktif)')
      .eq('aktif', true).is('voided_at', null).order('id'),
    supabase.from('stage_handover')
      .select('tahap, serah_gram, terima_gram, reject_gram, sisa_serbuk, tim_id, tim_nama, serah_tanggal, terima_tanggal, target_selesai, status')
      .eq('status', 'selesai').is('voided_at', null)
      .gte('terima_tanggal', dateFrom).lte('terima_tanggal', dateTo),
    supabase.from('produksi_item')
      .select('tim_id, tim_nama, serah_gram, terima_gram, reject_cutting_gram, losses_cutting, tanggal_produksi, tanggal_selesai, target_selesai, status_cutting, gramasi')
      .eq('status_cutting', 'selesai').is('voided_at', null)
      .gte('tanggal_selesai', dateFrom).lte('tanggal_selesai', dateTo),
    supabase.from('pengaturan').select('key, value')
      .or(`key.in.(kpi_bobot_efisiensi,kpi_bobot_loss,kpi_bobot_kecepatan,ambang_gain_wajar),key.like.kpi_target_tim_%`),
  ])

  const pengaturan: Record<string, number> = {}
  for (const r of pengaturanRows ?? []) pengaturan[r.key] = Number(r.value)

  const bobotEfisiensi  = (pengaturan['kpi_bobot_efisiensi']  ?? 40) / 100
  const bobotLoss       = (pengaturan['kpi_bobot_loss']        ?? 35) / 100
  const bobotKecepatan  = (pengaturan['kpi_bobot_kecepatan']   ?? 25) / 100
  const ambangGain      = pengaturan['ambang_gain_wajar']       ?? 0.30

  // Aggregate per tim
  type TimStats = {
    totalSerah: number; totalTerima: number; totalReject: number; totalLoss: number
    count: number; onTimeCount: number; lateCount: number
  }
  const timMap = new Map<number, TimStats>()
  const getStats = (id: number) => {
    if (!timMap.has(id)) timMap.set(id, { totalSerah:0, totalTerima:0, totalReject:0, totalLoss:0, count:0, onTimeCount:0, lateCount:0 })
    return timMap.get(id)!
  }

  for (const c of cuttingItems ?? []) {
    if (!c.tim_id) continue
    const s = getStats(c.tim_id)
    const serah  = Number(c.serah_gram ?? 0)
    const terima = Number(c.terima_gram ?? 0)
    const reject = Number(c.reject_cutting_gram ?? 0)
    const loss   = Math.max(0, serah - terima - reject)
    s.totalSerah  += serah
    s.totalTerima += terima
    s.totalReject += reject
    s.totalLoss   += loss
    s.count       += 1
    if (c.target_selesai && c.tanggal_selesai) {
      if (c.tanggal_selesai <= c.target_selesai) s.onTimeCount++
      else s.lateCount++
    }
  }

  for (const h of handovers ?? []) {
    if (!h.tim_id) continue
    const s = getStats(h.tim_id)
    const serah  = Number(h.serah_gram ?? 0)
    const terima = Number(h.terima_gram ?? 0)
    const reject = Number(h.reject_gram ?? 0)
    const serbuk = Number(h.sisa_serbuk ?? 0)
    const loss   = Math.max(0, serah - terima - reject - serbuk)
    s.totalSerah  += serah
    s.totalTerima += terima
    s.totalReject += reject
    s.totalLoss   += loss
    s.count       += 1
    if (h.target_selesai && h.terima_tanggal) {
      if (h.terima_tanggal <= h.target_selesai) s.onTimeCount++
      else s.lateCount++
    }
  }

  const kpiList = (tims ?? []).map((tim: any) => {
    const stats = timMap.get(tim.id)
    const targetSerah = pengaturan[`kpi_target_tim_${tim.id}`] ?? 0

    if (!stats || stats.totalSerah === 0 || stats.count === 0) {
      return { ...tim, kpi: null, bintang: 0, stats: null, targetSerah }
    }

    const gainGram     = stats.totalTerima - stats.totalSerah
    const efisiensiRaw = gainGram > ambangGain
      ? stats.totalTerima / stats.totalSerah
      : (stats.totalTerima + stats.totalReject) / stats.totalSerah
    const efisiensiScore = Math.min(100, efisiensiRaw * 100)

    const lossRate  = stats.totalLoss / stats.totalSerah
    const lossScore = Math.max(0, 100 - lossRate * 2000)

    const totalTimed = stats.onTimeCount + stats.lateCount
    const kecepatanScore = totalTimed > 0
      ? (stats.onTimeCount / totalTimed) * 100
      : 70

    const totalScore = efisiensiScore * bobotEfisiensi + lossScore * bobotLoss + kecepatanScore * bobotKecepatan
    const bintang    = Math.min(5, Math.max(1, Math.round(totalScore / 20)))

    const achievementPct = targetSerah > 0 ? (stats.totalSerah / targetSerah * 100) : null

    return {
      ...tim,
      kpi: { efisiensiScore, lossScore, kecepatanScore, totalScore },
      bintang,
      stats: {
        totalSerah:     stats.totalSerah,
        totalTerima:    stats.totalTerima,
        totalLoss:      stats.totalLoss,
        lossRate:       lossRate * 100,
        count:          stats.count,
        onTimeCount:    stats.onTimeCount,
        lateCount:      stats.lateCount,
      },
      targetSerah,
      achievementPct,
    }
  })

  return (
    <KpiTimClient
      kpiList={kpiList}
      bobot={{ efisiensi: Math.round(bobotEfisiensi * 100), loss: Math.round(bobotLoss * 100), kecepatan: Math.round(bobotKecepatan * 100) }}
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  )
}
