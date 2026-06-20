import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function FakturPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: p } = await supabase
    .from('penjualan')
    .select('*, items:penjualan_item(*), payments:penjualan_payment(*)')
    .eq('id', params.id)
    .is('voided_at', null)
    .single()

  if (!p) notFound()

  const { data: setting } = await supabase
    .from('pengaturan').select('value').eq('key', 'nama_toko').single()
  const namaToko = setting?.value ?? 'PT Emas Murni Asli'

  const tgl = new Date(p.tanggal).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const items: any[] = p.items ?? []
  const payments: any[] = p.payments ?? []
  const totalHarga = Number(p.total_harga_jual ?? p.harga_jual ?? 0)
  const nomorFaktur = p.no_faktur ?? p.nomor_invoice ?? `INV-${p.id}`

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print flex items-center gap-3 mb-6">
        <a href="/penjualan" className="text-sm text-slate-500 hover:text-slate-700">← Kembali</a>
        <button
          onClick={() => window.print()}
          className="ml-auto px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
        >
          🖨 Cetak Faktur
        </button>
      </div>

      {/* Invoice */}
      <div className="print-page bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#D4AF37,#B8960C)' }}>
                <span className="text-white text-[9px] font-black">EMA</span>
              </div>
              <span className="font-black text-slate-800 text-base">{namaToko}</span>
            </div>
            <p className="text-xs text-slate-400">Perhiasan Emas Murni</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Faktur Penjualan</p>
            <p className="text-lg font-black text-violet-700 font-mono">{nomorFaktur}</p>
            <p className="text-xs text-slate-500 mt-0.5">{tgl}</p>
          </div>
        </div>

        <hr className="border-slate-100 mb-5" />

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kepada</p>
            <p className="text-sm font-bold text-slate-800">{p.nama_customer || 'Pelanggan'}</p>
            {p.hp_customer && <p className="text-xs text-slate-500">{p.hp_customer}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Toko / Channel</p>
            <p className="text-sm font-semibold text-slate-700">{p.toko ?? p.cabang_nama ?? '—'}</p>
            {p.source && <p className="text-xs text-slate-500 capitalize">{p.source}</p>}
            {p.channel && <p className="text-xs text-slate-500">{p.channel}</p>}
            {p.no_invoice_mktpl && (
              <p className="text-xs text-slate-400 font-mono">Inv mktpl: {p.no_invoice_mktpl}</p>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-2xl overflow-hidden border border-slate-100 mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Produk</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16">Gramasi</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Harga</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item: any, i: number) => (
                <tr key={item.id ?? i} className="border-t border-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 text-sm">{item.produk_nama ?? 'Emas'}</p>
                    {item.shieldtag_kode && (
                      <p className="text-[10px] text-slate-400 font-mono">{item.shieldtag_kode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600">{item.gramasi ? `${item.gramasi} gr` : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {Number(item.harga_jual ?? 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-3 text-sm text-slate-500" colSpan={3}>
                    <span className="font-semibold text-slate-800">Emas {p.gramasi ? `${p.gramasi} gr` : ''}</span>
                    <span className="text-slate-500"> — {p.pcs ?? 1} pcs</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {totalHarga.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-100 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700 text-sm" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-black text-violet-700 text-base">
                  {totalHarga.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pembayaran</p>
            <div className="space-y-1.5">
              {payments.map((pay: any, i: number) => (
                <div key={pay.id ?? i} className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2">
                  <span className="text-xs font-semibold text-green-800 capitalize">{pay.metode ?? 'Cash'}</span>
                  <span className="text-sm font-bold text-green-700">
                    {Number(pay.jumlah ?? 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metode pembayaran fallback */}
        {payments.length === 0 && p.metode_pembayaran && (
          <div className="mb-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Metode Pembayaran</p>
            <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2">
              <span className="text-xs font-semibold text-green-800 capitalize">{p.metode_pembayaran}</span>
              <span className="text-sm font-bold text-green-700">
                {totalHarga.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}

        {p.catatan && (
          <div className="mb-5 bg-amber-50 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Catatan</p>
            <p className="text-xs text-amber-800">{p.catatan}</p>
          </div>
        )}

        {/* Footer */}
        <hr className="border-slate-100 mb-5" />
        <div className="grid grid-cols-2 gap-8 mt-2">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 mb-12">Penjual</p>
            <div className="border-t border-slate-300 pt-1.5">
              <p className="text-[10px] text-slate-500">{namaToko}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 mb-12">Pembeli</p>
            <div className="border-t border-slate-300 pt-1.5">
              <p className="text-[10px] text-slate-500">{p.nama_customer || '________________________'}</p>
            </div>
          </div>
        </div>
        <p className="text-center text-[9px] text-slate-300 mt-6">
          Terima kasih telah berbelanja di {namaToko}. Barang yang sudah dibeli tidak dapat dikembalikan kecuali cacat produksi.
        </p>
      </div>

      <script dangerouslySetInnerHTML={{ __html: '' }} />
    </>
  )
}
