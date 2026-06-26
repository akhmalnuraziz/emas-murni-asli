import { createAdminClient } from '@/lib/supabase/admin'

export async function fetchDashboardContext(): Promise<string> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  const [
    { data: batchAktif },
    { data: batchTerbaru },
    { data: produksiItems },
    { data: shieldtagAktif },
    { data: penjualan },
    { data: packing },
    { data: mutasi },
    { data: pengeluaran },
    { data: reject },
  ] = await Promise.all([
    supabase.from('batch')
      .select('kode, tanggal, timbangan_akhir, bahan_siap_cetak, hpp_gr, status, supplier')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('batch')
      .select('kode, tanggal, status')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, current_status, total_gram, batch_kode')
      .is('voided_at', null)
      .limit(50),
    supabase.from('shieldtag')
      .select('kode, gramasi, hpp, status, lokasi')
      .eq('status', 'Aktif')
      .is('voided_at', null)
      .limit(20),
    supabase.from('penjualan')
      .select('id, tanggal, gramasi, pcs, harga_jual')
      .gte('tanggal', monthStart)
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .limit(20),
    supabase.from('packing')
      .select('kode, batch_kode, gramasi, pcs_dipack, tanggal')
      .gte('tanggal', today)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('mutasi')
      .select('id, tujuan_cabang, pcs, tanggal_kirim, status_terima')
      .eq('status_kirim', 'Sudah Dikirim')
      .is('voided_at', null)
      .order('tanggal_kirim', { ascending: false })
      .limit(10),
    supabase.from('pengeluaran')
      .select('nominal, kategori, keterangan')
      .gte('tanggal', monthStart)
      .is('voided_at', null)
      .limit(20),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, berat_reject')
      .eq('status_reject', 'belum_dilebur')
      .gt('berat_reject', 0)
      .is('voided_at', null),
  ])

  const lines: string[] = []

  // Batch
  if (batchAktif && batchAktif.length > 0) {
    lines.push(`\n### BATCH (10 terbaru)`)
    for (const b of batchAktif) {
      lines.push(`- ${b.kode} | Status: ${b.status || '-'} | Supplier: ${b.supplier || '-'} | Berat: ${b.timbangan_akhir ? Number(b.timbangan_akhir).toFixed(2) + ' gr' : '-'} | HPP/gr: ${b.hpp_gr ? 'Rp ' + Number(b.hpp_gr).toLocaleString('id-ID') : '-'}`)
    }
  }

  // Pipeline produksi
  if (produksiItems && produksiItems.length > 0) {
    const pipeline: Record<string, number> = {}
    const gramByStatus: Record<string, Record<string, number>> = {}
    for (const item of produksiItems) {
      const s = item.current_status || 'Unknown'
      pipeline[s] = (pipeline[s] ?? 0) + 1
      if (!gramByStatus[s]) gramByStatus[s] = {}
      const g = item.gramasi || '?'
      gramByStatus[s][g] = (gramByStatus[s][g] ?? 0) + 1
    }
    lines.push(`\n### PIPELINE PRODUKSI (${produksiItems.length} item total)`)
    for (const [status, count] of Object.entries(pipeline)) {
      const gramDetail = Object.entries(gramByStatus[status])
        .map(([g, c]) => `${c}x${g}gr`)
        .join(', ')
      lines.push(`- ${status}: ${count} item (${gramDetail})`)
    }
  }

  // Shieldtag aktif
  if (shieldtagAktif && shieldtagAktif.length > 0) {
    const byGramasi: Record<string, number> = {}
    for (const s of shieldtagAktif) {
      const g = s.gramasi || '?'
      byGramasi[g] = (byGramasi[g] ?? 0) + 1
    }
    lines.push(`\n### SHIELDTAG AKTIF`)
    lines.push(`Total: ${shieldtagAktif.length} item`)
    for (const [g, c] of Object.entries(byGramasi)) {
      lines.push(`- ${g}gr: ${c} pcs`)
    }
  }

  // Penjualan bulan ini
  if (penjualan && penjualan.length > 0) {
    const totalPcs = penjualan.reduce((s, p) => s + (Number(p.pcs) || 0), 0)
    const totalOmzet = penjualan.reduce((s, p) => s + (Number(p.harga_jual) || 0), 0)
    lines.push(`\n### PENJALANAN BULAN INI`)
    lines.push(`Total: ${totalPcs} pcs | Omzet: Rp ${totalOmzet.toLocaleString('id-ID')}`)
  }

  // Packing hari ini
  if (packing && packing.length > 0) {
    const totalPcs = packing.reduce((s, p) => s + (Number(p.pcs_dipack) || 0), 0)
    const byGramasi: Record<string, number> = {}
    for (const p of packing) {
      const g = p.gramasi || '?'
      byGramasi[g] = (byGramasi[g] ?? 0) + Number(p.pcs_dipack || 0)
    }
    lines.push(`\n### PACKING HARI INI`)
    lines.push(`Total: ${totalPcs} pcs`)
    for (const [g, c] of Object.entries(byGramasi)) {
      lines.push(`- ${g}gr: ${c} pcs`)
    }
  }

  // Mutasi transit
  if (mutasi && mutasi.length > 0) {
    lines.push(`\n### MUTASI TRANSIT`)
    for (const m of mutasi) {
      lines.push(`- ${m.tujuan_cabang || '?'}: ${m.pcs} pcs | Kirim: ${m.tanggal_kirim || '-'} | Status: ${m.status_terima || '-'}`)
    }
  }

  // Reject
  if (reject && reject.length > 0) {
    const totalGram = reject.reduce((s, r) => s + Number(r.berat_reject || 0), 0)
    lines.push(`\n### REJECT BELUM DILEBUR`)
    lines.push(`Total: ${reject.length} item | ${totalGram.toFixed(2)} gr`)
  }

  // Pengeluaran
  if (pengeluaran && pengeluaran.length > 0) {
    const total = pengeluaran.reduce((s, p) => s + Number(p.nominal || 0), 0)
    lines.push(`\n### PENGELUARAN BULAN INI`)
    lines.push(`Total: Rp ${total.toLocaleString('id-ID')}`)
    const byKategori: Record<string, number> = {}
    for (const p of pengeluaran) {
      const k = p.kategori || 'Lainnya'
      byKategori[k] = (byKategori[k] ?? 0) + Number(p.nominal || 0)
    }
    for (const [k, v] of Object.entries(byKategori)) {
      lines.push(`- ${k}: Rp ${v.toLocaleString('id-ID')}`)
    }
  }

  return lines.join('\n') || '\nBelum ada data tersedia.'
}
