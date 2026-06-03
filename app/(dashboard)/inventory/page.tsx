import { createClient } from '@/lib/supabase/server'
import InventoryClient from '@/components/modules/inventory/inventory-client'

export default async function InventoryPage() {
  const supabase = await createClient()

  // ── Nama gudang dari pengaturan ──────────────────────────────────────────
  const { data: settingGudang } = await supabase
    .from('pengaturan').select('value').eq('key', 'nama_gudang').single()
  const namaGudang = settingGudang?.value ?? 'Gudang CJ'

  // ── Stok Gudang CJ ───────────────────────────────────────────────────────
  // Sumber: packing dengan status_surat = 'sudah_cetak' (surat dicetak)
  // Per produk: total pcs, ST aktif, ST pending
  const { data: packingData } = await supabase
    .from('packing')
    .select(`
      id, pcs_dipack, gramasi, batch_kode, status_surat,
      produksi_item:produksi_item_id (
        nama_item, gramasi,
        produk:produk_id ( id, nama, gramasi, series:series_id(nama) )
      ),
      shieldtag (kode, status, lokasi, tgl_regis, hpp, voided_at)
    `)
    .is('voided_at', null)

  // Agregasi per produk
  const produkMap: Record<string, any> = {}
  for (const pk of (packingData ?? [])) {
    const pi = pk.produksi_item as any
    const pd = pi?.produk as any
    const key = pd ? String(pd.id) : (pi?.gramasi ?? pk.gramasi)
    const produkNama = pd?.nama ?? pi?.nama_item ?? `${pk.gramasi} gr`
    const gramasi = pd?.gramasi ?? pi?.gramasi ?? pk.gramasi
    const seriesNama = pd?.series?.nama ?? 'Reguler'

    if (!produkMap[key]) {
      produkMap[key] = {
        produk_nama: produkNama,
        gramasi,
        series_nama: seriesNama,
        total_pcs: 0,
        st_aktif: 0,
        st_pending: 0,
        shieldtags: [],
      }
    }

    const tags = (pk.shieldtag as any[]).filter(st => !st.voided_at)
    const stAktif = tags.filter(st => st.status === 'Aktif').length
    // Pieces yang BELUM ber-shieldtag = pcs dipack - jumlah shieldtag terdaftar
    const registered = tags.length
    const pendingST  = Math.max(0, pk.pcs_dipack - registered)
    // Stok fisik di gudang = Aktif (siap jual) + belum di-ST. Yang terjual/transit/di-cabang TIDAK dihitung.
    const fisikGudang = stAktif + pendingST

    produkMap[key].total_pcs  += fisikGudang
    produkMap[key].st_aktif   += stAktif
    produkMap[key].st_pending += pendingST
    produkMap[key].shieldtags.push(...tags.filter(st => st.status === 'Aktif').map(st => ({
      kode: st.kode,
      gramasi,
      status: st.status,
      lokasi: st.lokasi,
      tgl_regis: st.tgl_regis,
      hpp: st.hpp,
    })))
  }

  // Sort by gramasi numeric
  const gudangItems = Object.values(produkMap).sort((a: any, b: any) =>
    parseFloat(a.gramasi) - parseFloat(b.gramasi)
  )

  // ── Stok Cabang ──────────────────────────────────────────────────────────
  // Sumber: shieldtag status = 'Terdistribusi' grouped by lokasi
  const { data: cabangList } = await supabase
    .from('cabang').select('kode, nama').eq('aktif', true).order('kode')

  const { data: cabangTags } = await supabase
    .from('shieldtag')
    .select(`
      kode, gramasi, status, lokasi, tgl_regis, hpp, voided_at,
      packing:packing_id (
        produksi_item:produksi_item_id (
          nama_item, gramasi,
          produk:produk_id ( nama, gramasi, series:series_id(nama) )
        )
      )
    `)
    .eq('status', 'Terdistribusi')
    .is('voided_at', null)

  // Build cabang stok
  const cabangStok = (cabangList ?? []).map(cab => {
    const tags = (cabangTags ?? []).filter(st => st.lokasi === cab.nama || st.lokasi === cab.kode)

    // Group by produk
    const itemMap: Record<string, any> = {}
    for (const st of tags) {
      const pi = (st.packing as any)?.produksi_item as any
      const pd = pi?.produk as any
      const key = pd?.nama ?? pi?.nama_item ?? `${st.gramasi} gr`
      if (!itemMap[key]) {
        itemMap[key] = {
          produk_nama: pd?.nama ?? pi?.nama_item ?? `${st.gramasi} gr`,
          gramasi: pd?.gramasi ?? pi?.gramasi ?? st.gramasi,
          pcs: 0,
          shieldtags: [],
        }
      }
      itemMap[key].pcs++
      itemMap[key].shieldtags.push({ kode: st.kode, gramasi: st.gramasi, status: st.status, lokasi: st.lokasi, tgl_regis: st.tgl_regis, hpp: st.hpp })
    }

    return {
      kode: cab.kode,
      nama: cab.nama,
      items: Object.values(itemMap).sort((a: any, b: any) => parseFloat(a.gramasi) - parseFloat(b.gramasi)),
    }
  })

  return (
    <InventoryClient
      namaGudang={namaGudang}
      gudangItems={gudangItems}
      cabangStok={cabangStok}
    />
  )
}

