import { createClient } from '@/lib/supabase/server'
import LaporanClient from '@/components/modules/laporan/laporan-client'
import { getBatchList } from '@/app/(dashboard)/laporan/actions'

export default async function LaporanPage() {
  const supabase = await createClient()
  const [batchList, { data: cabangList }, { data: settingGudang }] = await Promise.all([
    getBatchList(),
    supabase.from('cabang').select('kode,nama').eq('aktif',true).order('kode'),
    supabase.from('pengaturan').select('value').eq('key','nama_gudang').single(),
  ])
  return (
    <LaporanClient
      batchList={batchList}
      cabangList={cabangList ?? []}
      namaGudang={settingGudang?.value ?? 'Gudang CJ'}
    />
  )
}
