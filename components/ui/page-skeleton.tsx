export default function PageSkeleton() {
  return (
    <div className="space-y-5 pb-8">
      {/* Header row */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="skeleton h-5 w-44 rounded-lg" />
          <div className="skeleton h-3 w-28 rounded" />
        </div>
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="skeleton h-2.5 w-20 rounded" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
            <div className="skeleton h-7 w-20 rounded-lg" />
            <div className="skeleton h-2.5 w-14 rounded" />
          </div>
        ))}
      </div>

      {/* Main content block */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-7 w-20 rounded-lg" />
        </div>
        <div className="skeleton h-40 w-full rounded-lg" />
      </div>

      {/* Table rows */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <div className="skeleton h-4 w-32 rounded" />
        </div>
        <div className="divide-y divide-slate-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
              <div className="flex-1" />
              <div className="skeleton h-5 w-14 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
