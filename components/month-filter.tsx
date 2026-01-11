'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface MonthFilterProps {
  initialStart?: string
  initialEnd?: string
  onClear?: () => void
}

type MonthPreset = {
  label: string
  value: string
  start: string
  end: string
}

// Helper para formatar data no formato YYYY-MM-DD sem conversão UTC
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function MonthFilter({ initialStart, initialEnd }: MonthFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Gerar lista de meses (últimos 12 meses) - memoizado para evitar recriações
  const monthOptions = useMemo((): MonthPreset[] => {
    const options: MonthPreset[] = []
    const now = new Date()
    
    // Últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth()
      
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0) // último dia do mês
      
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const label = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      
      options.push({
        label,
        value: `${year}-${String(month + 1).padStart(2, '0')}`,
        start: formatLocalDate(start),
        end: formatLocalDate(end)
      })
    }
    
    return options
  }, [])

  // Atalhos rápidos - memoizado para evitar recriações
  const quickFilters = useMemo((): MonthPreset[] => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    return [
      {
        label: 'Este mês',
        value: 'current',
        start: formatLocalDate(new Date(year, month, 1)),
        end: formatLocalDate(new Date(year, month + 1, 0))
      },
      {
        label: 'Mês passado',
        value: 'last',
        start: formatLocalDate(new Date(year, month - 1, 1)),
        end: formatLocalDate(new Date(year, month, 0))
      },
      {
        label: 'Últimos 3 meses',
        value: 'last3',
        start: formatLocalDate(new Date(year, month - 2, 1)),
        end: formatLocalDate(new Date(year, month + 1, 0))
      }
    ]
  }, [])

  // Detectar qual mês está selecionado baseado nos filtros atuais
  useEffect(() => {
    if (initialStart && initialEnd) {
      const matched = monthOptions.find(
        opt => opt.start === initialStart && opt.end === initialEnd
      )
      if (matched) {
        setSelectedMonth(matched.label)
      } else {
        // Formatar datas sem conversão UTC
        const formatDisplay = (dateStr: string) => dateStr.split('-').reverse().join('/')
        setSelectedMonth(`${formatDisplay(initialStart)} - ${formatDisplay(initialEnd)}`)
      }
    } else {
      setSelectedMonth('')
    }
  }, [initialStart, initialEnd, monthOptions])

  const applyFilter = (start: string, end: string, label: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('start', start)
    params.set('end', end)
    params.delete('page') // reset para página 1
    
    setSelectedMonth(label)
    setIsOpen(false)
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('start')
    params.delete('end')
    params.delete('page')
    
    setSelectedMonth('')
    setIsOpen(false)
    router.push(`${pathname}?${params.toString()}`)
  }

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative">
      {/* Botão Principal */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
          selectedMonth
            ? 'border-sky-600/50 bg-sky-600/10 text-sky-300 hover:bg-sky-600/20'
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750'
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{selectedMonth || 'Selecionar mês'}</span>
        <svg 
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div 
            className="fixed z-[9999] w-80 rounded-lg border border-slate-700 bg-slate-800/95 backdrop-blur-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
            {/* Atalhos Rápidos */}
            <div className="border-b border-slate-700 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Atalhos rápidos
              </div>
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => applyFilter(filter.start, filter.end, filter.label)}
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600 hover:text-white"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Meses */}
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecionar mês específico
              </div>
              <div className="space-y-1">
                {monthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyFilter(option.start, option.end, option.label)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedMonth === option.label
                        ? 'bg-sky-600/20 text-sky-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ações */}
            {selectedMonth && (
              <div className="border-t border-slate-700 p-3">
                <button
                  type="button"
                  onClick={clearFilter}
                  className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-300"
                >
                  Limpar filtro
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
