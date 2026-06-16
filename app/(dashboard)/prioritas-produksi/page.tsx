import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PrioritasProduksiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white shadow-sm">
        <h2 className="text-xl font-bold tracking-tight">Prioritas Produksi</h2>
        <p className="text-slate-300 text-sm mt-1">Auto-ranking berdasar PO toko dan safety stock</p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-500 text-lg">★</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Modul Prioritas Produksi dalam pengembangan</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Sistem auto-ranking akan menampilkan item berdasarkan:
            </p>
            <ul className="text-xs text-slate-500 mt-2 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">P1</span>
                Ada PO toko yang belum terpenuhi
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">P2</span>
                Stok di bawah safety stock minimum
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">P3</span>
                Stok aman — produksi bebas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center flex-shrink-0">⚠</span>
                Bottleneck — numpuk di Siap Packing
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
