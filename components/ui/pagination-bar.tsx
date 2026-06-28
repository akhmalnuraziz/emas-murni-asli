'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  page: number
  total: number
  pageSize: number
  paramKey?: string
  label?: string
}

export default function PaginationBar({ page, total, pageSize, paramKey = 'page', label = 'data' }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const goTo = (p: number) => {
    const params = new URLSearchParams(sp.toString())
    params.set(paramKey, String(p))
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-[11px] text-slate-400">{total.toLocaleString('id-ID')} {label} · Hal {page} dari {totalPages}</p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => goTo(page - 1)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          ← Sebelumnya
        </button>
        <button disabled={page >= totalPages} onClick={() => goTo(page + 1)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Berikutnya →
        </button>
      </div>
    </div>
  )
}
