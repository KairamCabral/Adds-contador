'use client'

import dynamic from 'next/dynamic'

export default dynamic(
  () => import('./sync-controls-inline').then(mod => mod.SyncControlsInline),
  {
    loading: () => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-slate-700 animate-pulse" />
        <div className="h-8 w-40 animate-pulse bg-slate-800 rounded-lg" />
        <div className="h-8 w-28 animate-pulse bg-slate-800 rounded-lg" />
      </div>
    ),
    ssr: false
  }
)
