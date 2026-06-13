'use client'

import { AlertTriangle } from 'lucide-react'
import SignaturePad from './signature-pad'

// Panel approval yang muncul saat loss > toleransi.
// Mengelola: alasan, TTD operator, TTD admin. Memberi tahu parent apakah sudah lengkap.
export default function LossApprovalPanel({
  lossGram, toleransiGram, proses,
  alasan, setAlasan,
  operatorNama, setOperatorNama,
  adminNama, setAdminNama,
  setTtdOperator, setTtdAdmin,
}: {
  lossGram: number; toleransiGram: number; proses: string
  alasan: string; setAlasan: (v: string) => void
  operatorNama: string; setOperatorNama: (v: string) => void
  adminNama: string; setAdminNama: (v: string) => void
  setTtdOperator: (v: string | null) => void
  setTtdAdmin: (v: string | null) => void
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
      <div className="px-4 py-3 flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)' }}>
        <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-600">Loss melebihi toleransi!</p>
          <p className="text-xs text-red-500 mt-0.5">
            Loss <b>{lossGram.toFixed(3)} gr</b> &gt; toleransi <b>{toleransiGram.toFixed(3)} gr</b> untuk proses {proses}.
            Wajib alasan + tanda tangan operator & admin untuk melanjutkan.
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3 bg-white">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Alasan Loss <span className="text-red-400">*</span></label>
          <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2}
            placeholder="Cth: Sudah dicari namun tidak ditemukan, kemungkinan serbuk tercecer saat proses..."
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 border border-gray-200 resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input value={operatorNama} onChange={e => setOperatorNama(e.target.value)} placeholder="Nama operator"
              className="w-full h-9 px-3 mb-1.5 bg-gray-50 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200" />
            <SignaturePad label="TTD Operator *" onChange={setTtdOperator} />
          </div>
          <div>
            <input value={adminNama} onChange={e => setAdminNama(e.target.value)} placeholder="Nama admin/manager"
              className="w-full h-9 px-3 mb-1.5 bg-gray-50 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 border border-gray-200" />
            <SignaturePad label="TTD Admin/Manager *" onChange={setTtdAdmin} />
          </div>
        </div>
      </div>
    </div>
  )
}
