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
  hideAlasan,
}: {
  lossGram: number; toleransiGram: number; proses: string
  alasan: string; setAlasan: (v: string) => void
  operatorNama: string; setOperatorNama: (v: string) => void
  adminNama: string; setAdminNama: (v: string) => void
  setTtdOperator: (v: string | null) => void
  setTtdAdmin: (v: string | null) => void
  hideAlasan?: boolean
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-red-200">
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-red-50 border-b border-red-100">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-red-600">Loss melebihi toleransi!</p>
          <p className="text-[11px] text-red-500 mt-0.5">
            Loss <b>{lossGram.toFixed(3)} gr</b> &gt; toleransi <b>{toleransiGram.toFixed(3)} gr</b> untuk proses {proses}.
            Wajib alasan + tanda tangan operator & admin untuk melanjutkan.
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3 bg-white">
        {!hideAlasan && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Alasan Loss <span className="text-red-400">*</span></label>
            <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2}
              placeholder="Cth: Sudah dicari namun tidak ditemukan, kemungkinan serbuk tercecer saat proses..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all resize-none" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input value={operatorNama} onChange={e => setOperatorNama(e.target.value)} placeholder="Nama operator"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 mb-1.5 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all placeholder:text-slate-400" />
            <SignaturePad label="TTD Operator *" onChange={setTtdOperator} />
          </div>
          <div>
            <input value={adminNama} onChange={e => setAdminNama(e.target.value)} placeholder="Nama admin/manager"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 mb-1.5 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 transition-all placeholder:text-slate-400" />
            <SignaturePad label="TTD Admin/Manager *" onChange={setTtdAdmin} />
          </div>
        </div>
      </div>
    </div>
  )
}
