// Skeleton loading reusable — dipakai semua halaman dashboard
export default function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-violet-100/60" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded-lg bg-slate-200/70" />
          <div className="h-3 w-56 rounded-lg bg-slate-100" />
        </div>
      </div>

      {/* Search bar */}
      <div className="h-11 w-full rounded-2xl bg-white/60 border border-white/60" />

      {/* Filter chips */}
      <div className="flex gap-2">
        {[64, 80, 72, 88, 60].map((w, i) => (
          <div key={i} className="h-8 rounded-full bg-slate-100" style={{ width: w }} />
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-3xl p-4"
            style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-violet-100/50" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded-lg bg-slate-200/70" />
                <div className="h-3 w-48 rounded-lg bg-slate-100" />
                <div className="h-3 w-40 rounded-lg bg-slate-100" />
              </div>
              <div className="w-20 h-8 rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
