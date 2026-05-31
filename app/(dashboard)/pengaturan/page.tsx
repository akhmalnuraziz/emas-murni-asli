import { createClient } from '@/lib/supabase/server'
import PengaturanClient from '@/components/modules/pengaturan/pengaturan-client'

export default async function PengaturanPage() {
  const supabase = await createClient()

  const [
    { data: settings },
    { data: series },
    { data: produk },
    { data: cabang },
  ] = await Promise.all([
    supabase.from('pengaturan').select('*').order('key'),
    supabase.from('series').select('*').order('urutan'),
    supabase.from('produk').select('*, series(nama)').order('series_id').order('urutan'),
    supabase.from('cabang').select('*').is('voided_at', null).order('kode'),
  ])

  return (
    <PengaturanClient
      settings={settings ?? []}
      series={series ?? []}
      produk={produk ?? []}
      cabang={cabang ?? []}
    />
  )
}

