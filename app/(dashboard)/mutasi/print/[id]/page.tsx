import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PrintSJPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mutasi } = await supabase
    .from('mutasi')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!mutasi) notFound()

  // Get shieldtag details for the SJ
  const kodes: string[] = mutasi.shieldtag_kodes ?? []
  const { data: tags } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, batch_kode, hpp')
    .in('kode', kodes)
    .order('gramasi')

  // Group by gramasi for summary table
  const gramasiMap: Record<string, { kodes: string[]; hpp_total: number }> = {}
  for (const t of tags ?? []) {
    const g = t.gramasi ?? '?'
    if (!gramasiMap[g]) gramasiMap[g] = { kodes: [], hpp_total: 0 }
    gramasiMap[g].kodes.push(t.kode)
    gramasiMap[g].hpp_total += Number(t.hpp ?? 0)
  }

  const tanggal = mutasi.tanggal_kirim ?? mutasi.tanggal ?? mutasi.created_at
  const tglFormatted = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const totalHpp = (tags ?? []).reduce((s, t) => s + Number(t.hpp ?? 0), 0)

  return (
    <html lang="id">
      <head>
        <title>Surat Jalan – {mutasi.kode}</title>
        <meta charSet="utf-8" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
          .page { max-width: 794px; margin: 0 auto; padding: 32px 40px; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #111; }
          .company { }
          .company h1 { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
          .company p { font-size: 11px; color: #555; margin-top: 2px; }
          .sj-title { text-align: right; }
          .sj-title h2 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .sj-title p { font-size: 11px; color: #555; margin-top: 2px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .meta-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
          .meta-box h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .meta-row .key { color: #666; font-size: 11px; }
          .meta-row .val { font-weight: 700; font-size: 11px; text-align: right; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          table th { background: #f3f4f6; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #555; padding: 8px 10px; border: 1px solid #e5e7eb; }
          table td { padding: 7px 10px; border: 1px solid #e5e7eb; font-size: 11px; vertical-align: top; }
          table tr:nth-child(even) td { background: #fafafa; }
          .kode-list { font-family: monospace; font-size: 10px; color: #444; line-height: 1.8; }
          .total-row td { font-weight: 700; background: #f3f4f6 !important; }
          .sign-area { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 24px; }
          .sign-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
          .sign-box h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #888; margin-bottom: 6px; }
          .sign-space { height: 60px; }
          .sign-line { border-top: 1px solid #aaa; margin-top: 4px; padding-top: 4px; font-size: 11px; font-weight: 600; }
          .catatan { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; }
          .catatan h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #888; margin-bottom: 4px; }
          .catatan p { font-size: 11px; color: #333; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .badge-dikirim { background: #dbeafe; color: #1d4ed8; }
          .badge-diterima { background: #d1fae5; color: #065f46; }
          .badge-transit { background: #fef3c7; color: #92400e; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            @page { margin: 16px; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Print button - no-print */}
          <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="#" id="btn-print"
              style={{ padding: '8px 20px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              🖨️ Print / Save PDF
            </a>
            <a href="/mutasi"
              style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              ← Kembali
            </a>
          </div>

          {/* Header */}
          <div className="header">
            <div className="company">
              <h1>PT Emas Murni Asli</h1>
              <p>Produsen Perhiasan Emas · Cirebon, Jawa Barat</p>
            </div>
            <div className="sj-title">
              <h2>Surat Jalan</h2>
              <p>Dokumen pengiriman barang</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="meta">
            <div className="meta-box">
              <h3>Detail Pengiriman</h3>
              <div className="meta-row">
                <span className="key">No. Surat Jalan</span>
                <span className="val" style={{ fontFamily: 'monospace' }}>{mutasi.kode}</span>
              </div>
              {mutasi.nomor && (
                <div className="meta-row">
                  <span className="key">No. Referensi</span>
                  <span className="val">{mutasi.nomor}</span>
                </div>
              )}
              <div className="meta-row">
                <span className="key">Tanggal Kirim</span>
                <span className="val">{tglFormatted}</span>
              </div>
              <div className="meta-row">
                <span className="key">Status</span>
                <span className="val">
                  <span className={`badge badge-${mutasi.status ?? 'dikirim'}`}>{mutasi.status ?? 'dikirim'}</span>
                </span>
              </div>
              <div className="meta-row">
                <span className="key">Total PCS</span>
                <span className="val">{kodes.length} pcs</span>
              </div>
            </div>
            <div className="meta-box">
              <h3>Asal & Tujuan</h3>
              <div className="meta-row">
                <span className="key">Dari</span>
                <span className="val">{mutasi.dari_lokasi ?? 'Gudang Pusat'}</span>
              </div>
              <div className="meta-row">
                <span className="key">Ke</span>
                <span className="val">{mutasi.ke_lokasi ?? mutasi.cabang_tujuan ?? '—'}</span>
              </div>
              <div className="meta-row">
                <span className="key">Pengirim</span>
                <span className="val">{mutasi.pengirim_name ?? '—'}</span>
              </div>
              {mutasi.penerima_name && (
                <div className="meta-row">
                  <span className="key">Penerima</span>
                  <span className="val">{mutasi.penerima_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ringkasan per gramasi */}
          <p className="section-title">Ringkasan Barang</p>
          <table>
            <thead>
              <tr>
                <th>Gramasi</th>
                <th style={{ textAlign: 'center' }}>Jumlah PCS</th>
                <th>Kode Shieldtag</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gramasiMap)
                .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                .map(([g, val]) => (
                <tr key={g}>
                  <td style={{ fontWeight: 700 }}>{g} gr</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{val.kodes.length}</td>
                  <td>
                    <div className="kode-list">
                      {val.kodes.join('  ·  ')}
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>TOTAL</td>
                <td style={{ textAlign: 'center' }}>{kodes.length}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          {/* Catatan */}
          {mutasi.catatan && (
            <div className="catatan">
              <h3>Catatan</h3>
              <p>{mutasi.catatan}</p>
            </div>
          )}

          {/* Tanda tangan */}
          <div className="sign-area">
            <div className="sign-box">
              <h3>Pengirim</h3>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>Gudang Pusat PT Emas Murni Asli</p>
              <div className="sign-space" />
              <div className="sign-line">{mutasi.pengirim_name ?? '(............................)'}</div>
              <p style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Tanggal: {tglFormatted}</p>
            </div>
            <div className="sign-box">
              <h3>Penerima</h3>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{mutasi.ke_lokasi ?? mutasi.cabang_tujuan ?? '—'}</p>
              <div className="sign-space" />
              <div className="sign-line">{mutasi.penerima_name ?? '(............................)'}</div>
              <p style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Tanggal: {mutasi.tanggal_terima ? new Date(mutasi.tanggal_terima).toLocaleDateString('id-ID') : '....../....../......'}</p>
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('btn-print').addEventListener('click', function(e) {
            e.preventDefault();
            window.print();
          });
        `}} />
      </body>
    </html>
  )
}
