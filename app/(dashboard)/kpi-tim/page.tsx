import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function KpiTimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tims } = await supabase
    .from('tim_produksi')
    .select('id, nama, warna, anggota:tim_anggota(id, nama, aktif)')
    .eq('aktif', true)
    .is('voided_at', null)
    .order('id')

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">KPI Tim ⭐</h2>
            <p className="text-violet-200 text-sm mt-1">
              Rating bintang per tim per proses · efisiensi 40% · loss 35% · kecepatan 25%
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{tims?.length ?? 0}</div>
            <div className="text-xs text-violet-300">Tim Aktif</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 text-lg">⭐</div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Modul KPI Tim sedang dalam pengembangan</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Rating bintang per tim per proses · dinormalisasi per baseline gramasi ·
              gain wajar tidak menurunkan bintang.
            </p>
          </div>
        </div>
      </div>
      {tims && tims.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tims as Array<{ id: number; nama: string; warna: string | null; anggota: Array<{ id: number; nama: string; aktif: boolean }> }>).map(tim => (
            <div key={tim.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: tim.warna ?? '#7F6DC6' }}>
                  {tim.nama?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{tim.nama}</p>
                  <p className="text-[11px] text-slate-400">{tim.anggota?.filter(a => a.aktif).length ?? 0} anggota</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {tim.anggota?.filter(a => a.aktif).map(a => (
                  <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">{a.nama}</span>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 italic">Belum ada data</span>
                <span className="text-amber-400 text-sm">★★★★★</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
