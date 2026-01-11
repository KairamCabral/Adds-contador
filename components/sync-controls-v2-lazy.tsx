'use client'

import dynamic from 'next/dynamic'

export default dynamic(
  () => import('./sync-controls-v2').then(mod => mod.SyncControlsV2),
  {
    loading: () => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-700 animate-pulse" />
          <div className="h-4 w-32 rounded bg-slate-700 animate-pulse" />
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="h-8 w-full rounded bg-slate-700 animate-pulse mb-3" />
          <div className="h-8 w-full rounded bg-slate-700 animate-pulse mb-3" />
          <div className="h-10 w-full rounded bg-slate-700 animate-pulse" />
        </div>
      </div>
    ),
    ssr: false
  }
)
