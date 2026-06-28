import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Layers, TrendingDown, Tag, Package2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LaporanBatchListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: batches },
    { data: stSummary },
    { data: packSummary },
    { data: peleburanSummary },
  ] = await Promise.all([
    supabase.from('batch')
      .select('kode, tanggal, supplier, bahan_dari_pusat, timbangan_akhir, hpp_gr, status')
      .is('voided_at', null)
      .order('tanggal', { ascending: false })
      .limit(200),
    supabase.from('shieldtag').select('batch_kode, status').is('voided_at', null),
    supabase.from('packing').select('batch_kode, pcs_dipack').is('voided_at', null),
    supabase.from('peleburan').select('batch_kode, dikasih_gram, diterima_gram').is('voided_at', null),
  ])

  const stMap: Record<string, { aktif: number; terjual: number; transit: number; total: number }> = {}
  for (const s of stSummary ?? []) {
    const k = s.batch_kode ?? ''
    if (!stMap[k]) stMap[k] = { aktif: 0, terjual: 0, transit: 0, total: 0 }
    stMap[k].total++
    if (s.status === 'Aktif') stMap[k].aktif++
    else if (s.status === 'Terjual') stMap[k].terjual++
    else if (s.status === 'Transit') stMap[k].transit++
  }

  const packMap: Record<string, number> = {}
  for (const p of packSummary ?? []) {
    const k = p.batch_kode ?? ''
    packMap[k] = (packMap[k] ?? 0) + (p.pcs_dipack ?? 0)
  }

  const lebMap: Record<string, { dikasih: number; diterima: number }> = {}
  for (const l of peleburanSummary ?? []) {
    const k = l.batch_kode ?? ''
    if (!lebMap[k]) lebMap[k] = { dikasih: 0, diterima: 0 }
    lebMap[k].dikasih += Number(l.dikasih_gram ?? 0)
    lebMap[k].diterima += Number(l.diterima_gram ?? 0)
  }

  const totalBatch = batches?.length ?? 0
  const totalSelesai = batches?.filter(b => b.status === 'terkunci').length ?? 0
  const totalPcs = Object.values(packMap).reduce((s, v) => s + v, 0)
  const totalShieldtag = Object.values(stMap).reduce((s, v) => s + v.total, 0)

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ── */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Laporan Per Batch</h1>
        <p className="text-[13px] text-slate-400 mt-1">Ringkasan produksi dari setiap batch bahan baku emas</p>
      </div>

      {/* ── Summary KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Batch', value: totalBatch, icon: Layers, color: 'violet', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
          { label: 'Selesai', value: totalSelesai, icon: CheckCircle2, color: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
          { label: 'Total Packing', value: `${totalPcs.toLocaleString()} pcs`, icon: Package2, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
          { label: 'Shieldtag', value: totalShieldtag.toLocaleString(), icon: Tag, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
        ].map(({ label, value, icon: Icon, bg, text, border }) => (
          <div key={label} className={`rounded-2xl p-4 border ${bg} ${border} flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
              <Icon size={18} className={text} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">{label}</p>
              <p className={`text-[18px] font-bold tabular-nums ${text}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Batch cards grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(batches ?? []).map(b => {
          const st = stMap[b.kode] ?? { aktif: 0, terjual: 0, transit: 0, total: 0 }
          const pcs = packMap[b.kode] ?? 0
          const leb = lebMap[b.kode] ?? { dikasih: 0, diterima: 0 }
          const loss = leb.dikasih > 0 ? ((leb.dikasih - leb.diterima) / leb.dikasih * 100) : 0
          const isSelesai = b.status === 'terkunci'
          // shieldtag distribution bar widths
          const stTotal = st.total || 1
          const wAktif   = Math.round(st.aktif   / stTotal * 100)
          const wTerjual = Math.round(st.terjual  / stTotal * 100)
          const wTransit = Math.round(st.transit  / stTotal * 100)

          return (
            <Link key={b.kode} href={`/laporan/batch/${encodeURIComponent(b.kode)}`}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col">

              {/* Card top accent */}
              <div className={`h-1 w-full ${isSelesai ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`} />

              <div className="p-4 flex-1 flex flex-col gap-3">
                {/* Kode + status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[15px] text-slate-900 group-hover:text-violet-700 transition-colors">{b.kode}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {b.tanggal ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {b.supplier ? ` · ${b.supplier}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${isSelesai ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSelesai ? <CheckCircle2 size={9}/> : <Clock size={9}/>}
                    {b.status === 'terkunci' ? 'Selesai' : b.status === 'aktif' ? 'Aktif' : b.status ?? 'Proses'}
                  </span>
                </div>

                {/* Gram stats */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: 'Bahan Masuk', val: b.bahan_dari_pusat, color: 'text-slate-700' },
                    { label: 'Packing', val: pcs > 0 ? pcs + ' pcs' : null, raw: true, color: 'text-blue-700' },
                    { label: 'Loss Lebur', val: loss > 0 ? loss.toFixed(2) + '%' : null, raw: true, color: loss > 2 ? 'text-red-600' : 'text-green-600' },
                  ].map(({ label, val, raw, color }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[9px] font-medium text-slate-400 leading-tight">{label}</p>
                      <p className={`text-[13px] font-bold tabular-nums mt-0.5 ${color}`}>
                        {raw ? (val ?? '—') : val != null ? `${Number(val).toFixed(2)} gr` : '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Shieldtag distribution bar */}
                {st.total > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-medium text-slate-400">Shieldtag <span className="text-slate-600 font-semibold">{st.total}</span></p>
                      <div className="flex items-center gap-2 text-[9px] font-medium text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block"/>Aktif {st.aktif}</span>
                        {st.terjual > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400 inline-block"/>Terjual {st.terjual}</span>}
                        {st.transit > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block"/>Transit {st.transit}</span>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-slate-100 flex">
                      {wAktif   > 0 && <div className="bg-green-400  h-full transition-all" style={{ width: `${wAktif}%` }} />}
                      {wTerjual > 0 && <div className="bg-violet-400 h-full transition-all" style={{ width: `${wTerjual}%` }} />}
                      {wTransit > 0 && <div className="bg-blue-400   h-full transition-all" style={{ width: `${wTransit}%` }} />}
                    </div>
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Lihat detail laporan</p>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          )
        })}

        {(batches ?? []).length === 0 && (
          <div className="col-span-3 py-24 text-center text-slate-400">
            <Layers size={36} className="mx-auto mb-3 opacity-20"/>
            <p className="text-[14px] font-medium">Belum ada batch terdaftar</p>
          </div>
        )}
      </div>
    </div>
  )
}
