import { createAdminClient } from '@/lib/supabase/admin'

export async function fetchDashboardContext(): Promise<string> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'
  const todayFormatted = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const [
    { data: batchAktif },
    { data: produksiItems },
    { data: shieldtagAktif },
    { data: penjualan },
    { data: packing },
    { data: mutasi },
    { data: pengeluaran },
    { data: reject },
    { data: buyback },
  ] = await Promise.all([
    supabase.from('batch')
      .select('kode, tanggal, timbangan_akhir, bahan_siap_cetak, hpp_gr, status, supplier')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, current_status, total_gram, batch_kode')
      .is('voided_at', null)
      .limit(100),
    supabase.from('shieldtag')
      .select('kode, gramasi, hpp, status, lokasi')
      .eq('status', 'Aktif')
      .is('voided_at', null),
    supabase.from('penjualan')
      .select('id, tanggal, gramasi, pcs, harga_jual, nama_pembeli')
      .gte('tanggal', monthStart)
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .limit(50),
    supabase.from('packing')
      .select('kode, batch_kode, gramasi, pcs_dipack, tanggal')
      .gte('tanggal', today)
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('mutasi')
      .select('id, tujuan_cabang, pcs, tanggal_kirim, status_terima, gramasi')
      .eq('status_kirim', 'Sudah Dikirim')
      .is('voided_at', null)
      .order('tanggal_kirim', { ascending: false })
      .limit(15),
    supabase.from('pengeluaran')
      .select('nominal, kategori, keterangan')
      .gte('tanggal', monthStart)
      .is('voided_at', null),
    supabase.from('produksi_item')
      .select('id, kode, gramasi, berat_reject')
      .eq('status_reject', 'belum_dilebur')
      .gt('berat_reject', 0)
      .is('voided_at', null),
    supabase.from('buyback')
      .select('id, tanggal, berat, harga_beli')
      .gte('tanggal', monthStart)
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .limit(20),
  ])

  const lines: string[] = []
  lines.push(`== DATA ERP PT EMAS MURNI ASLI ==`)
  lines.push(`Tanggal: ${todayFormatted}`)

  // ── Batch ──
  lines.push(`\n== BATCH EMAS ==`)
  if (batchAktif && batchAktif.length > 0) {
    lines.push(`Jumlah batch: ${batchAktif.length}`)
    for (const b of batchAktif) {
      const berat = b.timbangan_akhir ? Number(b.timbangan_akhir).toFixed(2) + ' gr' : '-'
      const hpp = b.hpp_gr ? 'Rp ' + Number(b.hpp_gr).toLocaleString('id-ID') + '/gr' : '-'
      const tanggal = b.tanggal || '-'
      lines.push(`• ${b.kode} — Status: ${b.status || '-'} | Supplier: ${b.supplier || '-'} | Berat: ${berat} | HPP: ${hpp} | Tgl: ${tanggal}`)
    }
  } else {
    lines.push(`Tidak ada batch aktif`)
  }

  // ── Pipeline Produksi ──
  lines.push(`\n== PIPELINE PRODUKSI ==`)
  if (produksiItems && produksiItems.length > 0) {
    const pipeline: Record<string, number> = {}
    const gramByStatus: Record<string, Record<string, number>> = {}
    const itemsByStatus: Record<string, string[]> = {}
    for (const item of produksiItems) {
      const s = item.current_status || 'Unknown'
      pipeline[s] = (pipeline[s] ?? 0) + 1
      if (!gramByStatus[s]) gramByStatus[s] = {}
      if (!itemsByStatus[s]) itemsByStatus[s] = []
      const g = item.gramasi || '?'
      gramByStatus[s][g] = (gramByStatus[s][g] ?? 0) + 1
      if (itemsByStatus[s].length < 5) {
        itemsByStatus[s].push(`${item.kode} (${item.gramasi}gr, ${item.total_gram ? Number(item.total_gram).toFixed(2) + 'gr' : '-'})`)
      }
    }
    lines.push(`Total item: ${produksiItems.length}`)
    for (const [status, count] of Object.entries(pipeline)) {
      const gramDetail = Object.entries(gramByStatus[status])
        .map(([g, c]) => `${c}x${g}gr`)
        .join(', ')
      lines.push(`• ${status}: ${count} item — ${gramDetail}`)
      const examples = itemsByStatus[status] || []
      if (examples.length > 0) {
        lines.push(`  Contoh: ${examples.slice(0, 3).join(', ')}`)
      }
    }
  } else {
    lines.push(`Tidak ada item dalam produksi`)
  }

  // ── Shieldtag Aktif ──
  lines.push(`\n== SHIELDTAG AKTIF ==`)
  if (shieldtagAktif && shieldtagAktif.length > 0) {
    const byGramasi: Record<string, number> = {}
    const totalNilai = shieldtagAktif.reduce((s, t) => s + Number(t.hpp || 0), 0)
    for (const s of shieldtagAktif) {
      const g = s.gramasi || '?'
      byGramasi[g] = (byGramasi[g] ?? 0) + 1
    }
    lines.push(`Total: ${shieldtagAktif.length} pcs | Estimasi nilai: Rp ${totalNilai.toLocaleString('id-ID')}`)
    for (const [g, c] of Object.entries(byGramasi).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      lines.push(`• ${g}gr: ${c} pcs`)
    }
  } else {
    lines.push(`Tidak ada shieldtag aktif`)
  }

  // ── Penjualan Bulan Ini ──
  lines.push(`\n== PENJALANAN BULAN INI ==`)
  if (penjualan && penjualan.length > 0) {
    const totalPcs = penjualan.reduce((s, p) => s + (Number(p.pcs) || 0), 0)
    const totalOmzet = penjualan.reduce((s, p) => s + (Number(p.harga_jual) || 0), 0)
    const byGramasi: Record<string, { pcs: number; omzet: number }> = {}
    for (const p of penjualan) {
      const g = p.gramasi || '?'
      if (!byGramasi[g]) byGramasi[g] = { pcs: 0, omzet: 0 }
      byGramasi[g].pcs += Number(p.pcs) || 0
      byGramasi[g].omzet += Number(p.harga_jual) || 0
    }
    lines.push(`Total: ${totalPcs} pcs | Omzet: Rp ${totalOmzet.toLocaleString('id-ID')}`)
    for (const [g, v] of Object.entries(byGramasi).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      lines.push(`• ${g}gr: ${v.pcs} pcs — Rp ${v.omzet.toLocaleString('id-ID')}`)
    }
  } else {
    lines.push(`Belum ada penjualan bulan ini`)
  }

  // ── Packing Hari Ini ──
  lines.push(`\n== PACKING HARI INI ==`)
  if (packing && packing.length > 0) {
    const totalPcs = packing.reduce((s, p) => s + (Number(p.pcs_dipack) || 0), 0)
    const byGramasi: Record<string, number> = {}
    for (const p of packing) {
      const g = p.gramasi || '?'
      byGramasi[g] = (byGramasi[g] ?? 0) + Number(p.pcs_dipack || 0)
    }
    lines.push(`Total: ${totalPcs} pcs`)
    for (const [g, c] of Object.entries(byGramasi).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      lines.push(`• ${g}gr: ${c} pcs`)
    }
  } else {
    lines.push(`Belum ada packing hari ini`)
  }

  // ── Mutasi Transit ──
  lines.push(`\n== MUTASI TRANSIT KE CABANG ==`)
  if (mutasi && mutasi.length > 0) {
    for (const m of mutasi) {
      lines.push(`• ${m.tujuan_cabang || 'Cabang'}: ${m.pcs} pcs (${m.gramasi || '-'}gr) — Kirim: ${m.tanggal_kirim || '-'} | Diterima: ${m.status_terima || 'Belum'}`)
    }
  } else {
    lines.push(`Tidak ada mutasi dalam perjalanan`)
  }

  // ── Buyback ──
  lines.push(`\n== BUYBACK BULAN INI ==`)
  if (buyback && buyback.length > 0) {
    const totalBerat = buyback.reduce((s, b) => s + Number(b.berat || 0), 0)
    const totalBeli = buyback.reduce((s, b) => s + Number(b.harga_beli || 0), 0)
    lines.push(`Total: ${buyback.length} transaksi | ${totalBerat.toFixed(2)} gr | Rp ${totalBeli.toLocaleString('id-ID')}`)
  } else {
    lines.push(`Belum ada buyback bulan ini`)
  }

  // ── Reject ──
  lines.push(`\n== REJECT BELUM DILEBUR ==`)
  if (reject && reject.length > 0) {
    const totalGram = reject.reduce((s, r) => s + Number(r.berat_reject || 0), 0)
    lines.push(`Total: ${reject.length} item | ${totalGram.toFixed(2)} gr`)
    for (const r of reject.slice(0, 5)) {
      lines.push(`• ${r.kode} (${r.gramasi}gr) — ${Number(r.berat_reject).toFixed(2)} gr`)
    }
  } else {
    lines.push(`Tidak ada reject — semua sudah ditangani`)
  }

  // ── Pengeluaran ──
  lines.push(`\n== PENGELUARAN BULAN INI ==`)
  if (pengeluaran && pengeluaran.length > 0) {
    const total = pengeluaran.reduce((s, p) => s + Number(p.nominal || 0), 0)
    const byKategori: Record<string, number> = {}
    for (const p of pengeluaran) {
      const k = p.kategori || 'Lainnya'
      byKategori[k] = (byKategori[k] ?? 0) + Number(p.nominal || 0)
    }
    lines.push(`Total: Rp ${total.toLocaleString('id-ID')}`)
    for (const [k, v] of Object.entries(byKategori).sort((a, b) => b[1] - a[1])) {
      lines.push(`• ${k}: Rp ${v.toLocaleString('id-ID')}`)
    }
  } else {
    lines.push(`Belum ada pengeluaran bulan ini`)
  }

  return lines.join('\n') || '\nBelum ada data tersedia di sistem.'
}
