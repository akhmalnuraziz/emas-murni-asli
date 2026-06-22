'use client'

export default function PrintButtons() {
  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
      <button onClick={() => window.print()}
        className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold shadow">
        🖨️ Cetak / Simpan PDF
      </button>
      <button onClick={() => window.history.back()}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-bold">
        ← Kembali
      </button>
    </div>
  )
}
