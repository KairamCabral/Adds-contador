'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

type Column = {
  key: string
  label: string
}

type VirtualizedTableProps = {
  rows: Record<string, unknown>[]
  columns: Column[]
  formatValue: (value: unknown) => ReactNode
  rowHeight?: number
  height?: string
}

export function VirtualizedTable({ 
  rows, 
  columns, 
  formatValue,
  rowHeight = 48,
  height = '600px'
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Renderizar 5 linhas extras acima/abaixo do viewport
  })
  
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 flex border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        {columns.map((col) => (
          <div
            key={col.key}
            className="flex-1 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div 
        ref={parentRef} 
        className="overflow-auto"
        style={{ height }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            
            return (
              <div
                key={virtualRow.index}
                className="absolute top-0 left-0 w-full flex border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="flex-1 px-4 py-3 text-sm text-slate-200"
                  >
                    {formatValue(row[col.key])}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
