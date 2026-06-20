import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KpiTimClient from '@/components/modules/kpi-tim/kpi-tim-client'

export const dynamic = 'force-dynamic'

export default async function KpiTimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: tims },
    { data: handovers },
    { data: cuttingItems },
    { data: pengaturanRows },
  ] = await Promise.all([
    supabase.from('users_profile').select('role').eq('id', user.id).single(),
    supabase.from('tim_produksi')
      .select('id, nama, warna, anggota:tim_anggota(id, nama, aktif)')
      .eq('aktif', true).is('voided_at', null).order('id'),
    // Stage handovers (pas_berat, annealing) with tim data
    supabase.from('stage_handover')
      .select('tahap, serah_gram, terima_gram, reject_gram, sisa_serbuk, tim_id, tim_nama, serah_tanggal, terima_tanggal, target_selesai, status')
      .eq('status', 'selesai').is('voided_at', null),
    // Cutting terima data per tim
    supabase.from('produksi_item')
      .select('tim_id, tim_nama, serah_gram, terima_gram, reject_cutting_gram, losses_cutting, tanggal_produksi, tanggal_selesai, target_selesai, status_cutting, gramasi')
      .eq('status_cutting', 'selesai').is('voided_at', null),
    supabase.from('pengaturan').select('key, value')
      .in('key', ['kpi_bobot_efisiensi', 'kpi_bobot_loss', 'kpi_bobot_kecepatan', 'ambang_gain_wajar']),
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

  // Process cutting records
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

  // Process stage handovers
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

  // Compute KPI score per tim (0–100, then map to 0–5 stars)
  const kpiList = (tims ?? []).map((tim: any) => {
    const stats = timMap.get(tim.id)
    if (!stats || stats.totalSerah === 0 || stats.count === 0) {
      return { ...tim, kpi: null, bintang: 0, stats: null }
    }

    // Efisiensi score: terima / (serah - gain_wajar). Gain kecil tidak dihukum.
    const gainGram     = stats.totalTerima - stats.totalSerah
    const efisiensiRaw = gainGram > ambangGain
      ? stats.totalTerima / stats.totalSerah          // ada gain besar (anomali)
      : (stats.totalTerima + stats.totalReject) / stats.totalSerah  // normal: terima+reject / serah
    const efisiensiScore = Math.min(100, efisiensiRaw * 100)

    // Loss score: lower loss = higher score
    const lossRate  = stats.totalLoss / stats.totalSerah
    const lossScore = Math.max(0, 100 - lossRate * 2000) // 0.05gr/serah = 0 penalty, >0.05 starts dropping

    // Kecepatan score: % on-time
    const totalTimed = stats.onTimeCount + stats.lateCount
    const kecepatanScore = totalTimed > 0
      ? (stats.onTimeCount / totalTimed) * 100
      : 70 // no target set → neutral 70

    const totalScore = efisiensiScore * bobotEfisiensi + lossScore * bobotLoss + kecepatanScore * bobotKecepatan
    const bintang    = Math.min(5, Math.max(1, Math.round(totalScore / 20)))

    return {
      ...tim,
      kpi: { efisiensiScore, lossScore, kecepatanScore, totalScore },
      bintang,
      stats: {
        totalSerah:   stats.totalSerah,
        totalTerima:  stats.totalTerima,
        totalLoss:    stats.totalLoss,
        lossRate:     lossRate * 100,
        count:        stats.count,
        onTimeCount:  stats.onTimeCount,
        lateCount:    stats.lateCount,
      },
    }
  })

  return (
    <KpiTimClient
      kpiList={kpiList}
      bobot={{ efisiensi: Math.round(bobotEfisiensi * 100), loss: Math.round(bobotLoss * 100), kecepatan: Math.round(bobotKecepatan * 100) }}
    />
  )
}
