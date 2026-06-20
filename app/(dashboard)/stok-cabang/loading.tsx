export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 rounded-2xl" />
      {[1,2,3].map(i => (
        <div key={i} className="h-48 bg-slate-50 rounded-3xl border border-slate-100" />
      ))}
    </div>
  )
}
