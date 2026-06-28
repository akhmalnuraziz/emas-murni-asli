import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ kode: string }> }): Promise<Metadata> {
  const { kode } = await params
  return {
    title: `Verifikasi Keaslian — ${kode} | PT Emas Murni Asli`,
    description: 'Scan QR untuk memverifikasi keaslian produk emas PT Emas Murni Asli',
    robots: 'noindex',
  }
}

export default async function CekKodePage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  const kodeUp = kode.toUpperCase()

  const supabase = await createClient()

  const { data: st } = await supabase
    .from('shieldtag')
    .select('kode, gramasi, status, batch_kode, tgl_regis, foto_produk, lokasi, shieldtag_history, voided_at')
    .eq('kode', kodeUp)
    .is('voided_at', null)
    .single()

  const found = !!st
  const terjual = st?.status === 'Terjual'

  // Cari tanggal terjual dari history
  let tglTerjual: string | null = null
  if (st?.shieldtag_history) {
    try {
      const hist = JSON.parse(st.shieldtag_history) as { tanggal: string; action: string }[]
      const entry = hist.find(h => h.action === 'Terjual' || h.action?.toLowerCase().includes('jual'))
      tglTerjual = entry?.tanggal ?? null
    } catch { /* ignore */ }
  }

  const gramasiNum = st ? parseFloat(st.gramasi ?? '0') : 0
  const gramasiLabel = gramasiNum >= 1000
    ? `${gramasiNum / 1000} kg`
    : gramasiNum >= 1
      ? `${gramasiNum} gram`
      : `${gramasiNum * 1000} mg`

  function fmt(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Background glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #c9a84c 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b8860b 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)' }} />
        {/* Shimmer lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(105deg, transparent, transparent 80px, rgba(212,175,55,0.03) 80px, rgba(212,175,55,0.03) 81px)',
        }} />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo placeholder — pakai teks branded */}
          <div className="inline-flex flex-col items-center gap-1 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1"
              style={{ background: 'linear-gradient(135deg, #c9a84c 0%, #f5e27a 50%, #c9a84c 100%)', boxShadow: '0 0 30px rgba(201,168,76,0.4)' }}>
              <span className="text-3xl font-black text-[#1a1400]">✦</span>
            </div>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-amber-400/70 uppercase">PT Emas Murni Asli</p>
          </div>
          <h1 className="text-[13px] font-medium tracking-[0.2em] uppercase text-slate-400">
            Verifikasi Keaslian Produk
          </h1>
        </div>

        {found ? (
          <div className="rounded-3xl overflow-hidden border border-amber-500/20"
            style={{ background: 'linear-gradient(160deg, #141210 0%, #0f0e0c 100%)', boxShadow: '0 0 60px rgba(201,168,76,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

            {/* Status banner */}
            <div className="px-6 py-4 flex items-center gap-3"
              style={{ background: terjual ? 'linear-gradient(90deg, rgba(30,30,20,0) 0%, rgba(30,30,20,0) 100%)' : 'linear-gradient(90deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c9a84c, #f5e27a)', boxShadow: '0 0 20px rgba(201,168,76,0.5)' }}>
                <span className="text-lg text-[#1a1400]">✓</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-amber-300 tracking-wide">
                  {terjual ? 'PRODUK TERVERIFIKASI' : '✦ PRODUK ASLI TERVERIFIKASI'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kode ini terdaftar resmi di sistem PT Emas Murni Asli
                </p>
              </div>
            </div>

            {/* Foto produk */}
            {st.foto_produk ? (
              <div className="flex justify-center py-6 px-6"
                style={{ background: 'linear-gradient(180deg, rgba(201,168,76,0.04) 0%, transparent 100%)' }}>
                <div className="relative w-44 h-56 rounded-2xl overflow-hidden border border-amber-500/20"
                  style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(201,168,76,0.1)' }}>
                  <Image src={st.foto_produk} alt="Foto produk" fill className="object-cover" />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-6 px-6">
                <div className="w-44 h-56 rounded-2xl flex flex-col items-center justify-center gap-2 border border-amber-500/10"
                  style={{ background: 'linear-gradient(135deg, #1a1810, #110f0c)' }}>
                  <span className="text-4xl opacity-30">✦</span>
                  <p className="text-[10px] text-slate-600 text-center px-4">Foto produk<br />belum tersedia</p>
                </div>
              </div>
            )}

            {/* Info grid */}
            <div className="px-6 pb-6 space-y-3">
              <InfoRow label="No. Sertifikat" value={kodeUp} highlight />
              <InfoRow label="Kemurnian" value="999.9 Fine Gold · 24 Karat" />
              <InfoRow label="Berat" value={gramasiLabel} highlight />
              <InfoRow label="Tanggal Produksi" value={fmt(st.tgl_regis)} />
              <InfoRow label="No. Batch" value={st.batch_kode ?? '—'} />
              <InfoRow label="Status" value={st.status ?? 'Aktif'} status={st.status} />
              {terjual && tglTerjual && (
                <InfoRow label="Tanggal Terjual" value={fmt(tglTerjual)} />
              )}
              <InfoRow label="Lokasi Terakhir" value={st.lokasi ?? '—'} />
            </div>

            {/* Footer seal */}
            <div className="mx-6 mb-6 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <span className="text-amber-400/60 text-lg flex-shrink-0">🛡</span>
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                Produk ini telah melalui proses quality control dan terdaftar secara resmi di sistem produksi PT Emas Murni Asli Indonesia.
              </p>
            </div>
          </div>

        ) : (

          <div className="rounded-3xl overflow-hidden border border-red-500/20"
            style={{ background: 'linear-gradient(160deg, #150f0f 0%, #0f0c0c 100%)', boxShadow: '0 0 60px rgba(239,68,68,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

            <div className="px-6 py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span className="text-3xl">⚠️</span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-red-400 mb-1">Produk Tidak Ditemukan</p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  Kode <span className="font-mono font-semibold text-slate-400">{kodeUp}</span> tidak terdaftar di sistem kami.
                </p>
              </div>
              <div className="rounded-2xl px-4 py-3 text-left"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <p className="text-[10.5px] text-red-400/70 leading-relaxed">
                  ⚠ Produk ini kemungkinan <strong>belum terdaftar</strong> atau <strong>bukan produk resmi</strong> PT Emas Murni Asli. Harap berhati-hati dan hubungi penjual untuk klarifikasi.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Kode QR yang di-scan */}
        <p className="text-center mt-6 text-[10px] font-mono text-slate-700 tracking-widest">
          {kodeUp}
        </p>

        {/* Footer */}
        <p className="text-center mt-3 text-[10px] text-slate-700">
          © PT Emas Murni Asli Indonesia · emas-murni-asli.vercel.app
        </p>
      </div>
    </main>
  )
}

function InfoRow({ label, value, highlight, status }: {
  label: string
  value: string
  highlight?: boolean
  status?: string
}) {
  const statusColor = status === 'Terjual'
    ? 'text-blue-400'
    : status === 'Void' || status === 'Rusak'
      ? 'text-red-400'
      : 'text-emerald-400'

  return (
    <div className="flex items-start justify-between gap-4 py-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[11px] text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-[12px] font-semibold text-right leading-tight ${status ? statusColor : highlight ? 'text-amber-300' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  )
}
