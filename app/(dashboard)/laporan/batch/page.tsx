import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ArrowRight, CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fg(n: number | null | undefined, d = 2) {
  return n != null ? Number(n).toFixed(d) : '—'
}

export default async function LaporanBatchListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: batches },
    { data: stSummary },
    { data: packSummary },
  ] = await Promise.all([
    supabase.from('batch')
      .select('kode, tanggal, supplier, bahan_dari_pusat, timbangan_akhir, hpp_gr, status, catatan')
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .limit(200),
    // shieldtag count per batch
    supabase.from('shieldtag')
      .select('batch_kode, status')
      .is('voided_at', null),
    // packing pcs per batch
    supabase.from('packing')
      .select('batch_kode, pcs_dipack')
      .is('voided_at', null),
  ])

  // Build summary maps
  const stMap: Record<string, { aktif: number; transit: number; terjual: number; total: number }> = {}
  for (const s of stSummary ?? []) {
    const k = s.batch_kode ?? ''
    if (!stMap[k]) stMap[k] = { aktif: 0, transit: 0, terjual: 0, total: 0 }
    stMap[k].total++
    if (s.status === 'Aktif') stMap[k].aktif++
    else if (s.status === 'Transit') stMap[k].transit++
    else if (s.status === 'Terjual') stMap[k].terjual++
  }

  const packMap: Record<string, number> = {}
  for (const p of packSummary ?? []) {
    const k = p.batch_kode ?? ''
    packMap[k] = (packMap[k] ?? 0) + (p.pcs_dipack ?? 0)
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-slate-800">Laporan Per Batch</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{batches?.length ?? 0} batch terdaftar</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Batch</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Supplier</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Bahan Masuk</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Packing</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Shieldtag</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-[11px] uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(batches ?? []).map(b => {
                const st = stMap[b.kode] ?? { aktif: 0, transit: 0, terjual: 0, total: 0 }
                const pcs = packMap[b.kode] ?? 0
                const isSelesai = b.status === 'Selesai'
                return (
                  <tr key={b.kode} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-800">{b.kode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.supplier ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {fg(b.bahan_dari_pusat, 3)} gr
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-slate-800">{pcs > 0 ? `${pcs} pcs` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {st.total > 0 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="tabular-nums font-semibold text-slate-800">{st.total}</span>
                          {st.aktif > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 font-medium">{st.aktif} aktif</span>}
                          {st.terjual > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium">{st.terjual} terjual</span>}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isSelesai ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isSelesai ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
                        {b.status ?? 'Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/laporan/batch/${encodeURIComponent(b.kode)}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-600 hover:text-violet-800 opacity-0 group-hover:opacity-100 transition-all">
                        Detail <ArrowRight size={12}/>
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(batches ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-[13px]">
                  <FileText size={28} className="mx-auto mb-2 opacity-30"/>
                  Belum ada batch terdaftar
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
