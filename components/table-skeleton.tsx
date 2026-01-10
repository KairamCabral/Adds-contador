export function TableSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex gap-4 border-b border-slate-800 pb-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 flex-1 bg-slate-700/50 rounded animate-pulse" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {[...Array(6)].map((_, j) => (
            <div 
              key={j} 
              className="h-12 flex-1 bg-slate-800/50 rounded animate-pulse"
              style={{ animationDelay: `${(i * 0.05) + (j * 0.02)}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
