'use client'

import QRCode from 'react-qr-code'
import { useEffect } from 'react'

interface Tag {
  kode: string
  gramasi: string
  status: string
  hpp: number | null
  packing_id: number | null
  created_at: string
}

export default function ShieldtagLabelPrint({
  tags,
  namaToko,
}: {
  tags: Tag[]
  namaToko: string
}) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; font-family: 'Arial', sans-serif; }
        .no-print { display: flex; gap: 12px; padding: 16px; background: #f8f4ff; border-bottom: 1px solid #e2e8f0; }
        .btn { padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
        .btn-print { background: #7C3AED; color: white; }
        .btn-close { background: #e2e8f0; color: #475569; }
        .grid { display: flex; flex-wrap: wrap; gap: 0; }
        .label {
          width: 62mm;
          height: 38mm;
          border: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 6px;
          page-break-inside: avoid;
          overflow: hidden;
        }
        .qr-wrap { flex-shrink: 0; }
        .info { flex: 1; min-width: 0; }
        .gramasi { font-size: 18px; font-weight: 900; color: #1e1b4b; line-height: 1; }
        .gramasi-unit { font-size: 10px; font-weight: 700; color: #7c3aed; }
        .kode { font-size: 8.5px; font-family: monospace; font-weight: 700; color: #374151; margin-top: 3px; letter-spacing: 0.3px; }
        .toko { font-size: 7px; color: #9ca3af; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .divider { border-top: 1px dashed #e5e7eb; margin: 3px 0; }
        .status { font-size: 7px; font-weight: 700; color: #16a34a; text-transform: uppercase; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 5mm; size: A4; }
          .label { border: 0.5pt solid #aaa; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-print" onClick={() => window.print()}>🖨️ Print Label</button>
        <button className="btn btn-close" onClick={() => window.close()}>✕ Tutup</button>
        <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>{tags.length} label · ukuran 62×38mm</span>
      </div>

      <div className="grid">
        {tags.map(tag => (
          <div key={tag.kode} className="label">
            <div className="qr-wrap">
              <QRCode
                value={`https://emas-murni-asli.vercel.app/cek/${tag.kode}`}
                size={72}
                level="M"
                style={{ display: 'block' }}
              />
            </div>
            <div className="info">
              <div className="gramasi">
                {parseFloat(tag.gramasi ?? '0') % 1 === 0
                  ? parseInt(tag.gramasi)
                  : parseFloat(tag.gramasi ?? '0')}
                <span className="gramasi-unit"> GR</span>
              </div>
              <div className="kode">{tag.kode}</div>
              <div className="divider" />
              <div className="toko">{namaToko}</div>
              <div className="status">✓ {tag.status}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
