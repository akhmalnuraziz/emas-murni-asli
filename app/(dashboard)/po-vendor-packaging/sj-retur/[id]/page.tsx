import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrintButtons from './PrintButtons'

export const dynamic = 'force-dynamic'

export default async function SJReturPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sjId = parseInt(id)
  const { data: sj } = await supabase.from('sj_retur_packaging').select('*').eq('id', sjId).single()
  if (!sj) return <div className="p-8 text-center text-red-500">SJ Retur tidak ditemukan</div>

  const { data: items } = await supabase.from('sj_retur_packaging_items')
    .select('*').eq('sj_retur_id', sjId).order('created_at')

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtNum = (n: number) => n.toLocaleString('id-ID')

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } body { margin: 0; } .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; } }
        body { background: #f8f9fa; font-family: 'Inter', sans-serif; }
      `}</style>

      <PrintButtons />

      <div className="page max-w-[700px] mx-auto my-8 bg-white rounded-2xl shadow-lg p-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800">SURAT JALAN RETUR</h1>
            <p className="text-sm text-slate-500 mt-1">PT Emas Murni Asli</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-orange-600">{sj.nomor_sj}</p>
            <p className="text-sm text-slate-500">{fmtDate(sj.tanggal_retur)}</p>
          </div>
        </div>

        <hr className="border-slate-200 mb-6"/>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Kepada Vendor</p>
            <p className="font-bold text-slate-800">{sj.vendor_nama}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Retur</p>
            <p className="font-bold text-slate-800">{fmtDate(sj.tanggal_retur)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Qty Retur</p>
            <p className="font-bold text-slate-800">{fmtNum(sj.total_qty)} pcs</p>
          </div>
          {sj.tanggal_jatuh_tempo_ganti && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Jatuh Tempo Penggantian</p>
              <p className="font-bold text-amber-600">{fmtDate(sj.tanggal_jatuh_tempo_ganti)}</p>
            </div>
          )}
          {sj.catatan && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Catatan</p>
              <p className="text-slate-700 text-sm">{sj.catatan}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Daftar Barang Diretur</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: '#f8f4ff' }}>
                <th className="text-left p-2 text-[11px] font-bold text-violet-700 border border-violet-100">No</th>
                <th className="text-left p-2 text-[11px] font-bold text-violet-700 border border-violet-100">Produk</th>
                <th className="text-left p-2 text-[11px] font-bold text-violet-700 border border-violet-100">Kategori &amp; Alasan</th>
                <th className="text-left p-2 text-[11px] font-bold text-violet-700 border border-violet-100">No PO / Batch</th>
                <th className="text-right p-2 text-[11px] font-bold text-violet-700 border border-violet-100">Qty Retur</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item: any, i: number) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td className="p-2 border border-slate-100 text-slate-500 text-[11px] align-top">{i + 1}</td>
                  <td className="p-2 border border-slate-100 font-semibold text-slate-800 text-[12px] align-top">{item.produk_nama}</td>
                  <td className="p-2 border border-slate-100 align-top">
                    {item.kategori_nama ? (
                      <p className="text-[11px] font-bold text-red-600">🏷️ {item.kategori_nama}</p>
                    ) : null}
                    {item.alasan_manual ? (
                      <p className="text-[10px] text-slate-700 mt-0.5">{item.alasan_manual}</p>
                    ) : null}
                    {!item.kategori_nama && !item.alasan_manual && (
                      <p className="text-[10px] text-slate-400 italic">— tanpa kategori —</p>
                    )}
                    {item.catatan ? (
                      <p className="text-[10px] text-slate-400 mt-0.5">Catatan: {item.catatan}</p>
                    ) : null}
                  </td>
                  <td className="p-2 border border-slate-100 align-top">
                    <p className="font-mono text-[10px] text-violet-700">{item.po_nomor}</p>
                    <p className="font-mono text-[10px] text-slate-500">{item.nomor_batch}</p>
                    <p className="text-[10px] text-slate-400">{fmtDate(item.tanggal_terima)}</p>
                  </td>
                  <td className="p-2 border border-slate-100 font-bold text-right text-slate-800 text-[12px] align-top">
                    {fmtNum(item.qty_retur)}
                    {item.qty_diganti > 0 && (
                      <p className="text-[9px] font-normal text-green-600 mt-0.5">{fmtNum(item.qty_diganti)} diganti</p>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#f8f4ff' }}>
                <td colSpan={4} className="p-2.5 border border-violet-100 font-bold text-right text-violet-700 text-[12px]">Total</td>
                <td className="p-2.5 border border-violet-100 font-black text-right text-violet-700 text-[12px]">{fmtNum(sj.total_qty)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature block */}
        <div className="grid grid-cols-3 gap-6 mt-12">
          {['Dibuat Oleh', 'Diterima Vendor', 'Mengetahui'].map(label => (
            <div key={label} className="text-center">
              <div className="h-16 border-b border-slate-300 mb-2"/>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">PT Emas Murni Asli</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-300">Dokumen ini dicetak dari sistem ERP PT Emas Murni Asli · {sj.nomor_sj}</p>
        </div>
      </div>
    </>
  )
}
