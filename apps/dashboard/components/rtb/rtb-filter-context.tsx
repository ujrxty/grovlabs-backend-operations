'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface FilterOptions {
  offers: string[]
  traffic_sources: string[]
  states: string[]
  buyers: string[]
}

interface Filters {
  dateRange: 'today' | '7d' | '30d' | 'custom'
  startDate?: string
  endDate?: string
  offer?: string
  trafficSource?: string
  state?: string
  buyer?: string
}

interface RTBFilterContextValue {
  filters: Filters
  setFilters: (filters: Filters) => void
  filterOptions: FilterOptions
  loading: boolean
  buildQueryString: () => string
}

const RTBFilterContext = createContext<RTBFilterContextValue | null>(null)

export function useRTBFilters() {
  const ctx = useContext(RTBFilterContext)
  if (!ctx) throw new Error('useRTBFilters must be used within RTBFilterProvider')
  return ctx
}

function getDateRange(range: Filters['dateRange']): { start?: string; end?: string } {
  const now = new Date()
  const end = now.toISOString()

  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { start: start.toISOString(), end }
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { start: start.toISOString(), end }
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { start: start.toISOString(), end }
    }
    default:
      return {}
  }
}

export function RTBFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ dateRange: '7d' })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    offers: [],
    traffic_sources: [],
    states: [],
    buyers: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${QA_AGENT_URL}/pings/filters`)
      .then(res => res.json())
      .then(data => {
        setFilterOptions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    const { start, end } = filters.dateRange === 'custom'
      ? { start: filters.startDate, end: filters.endDate }
      : getDateRange(filters.dateRange)

    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (filters.offer) params.set('offer_name', filters.offer)
    if (filters.trafficSource) params.set('traffic_source', filters.trafficSource)
    if (filters.state) params.set('state', filters.state)

    return params.toString()
  }, [filters])

  return (
    <RTBFilterContext.Provider value={{ filters, setFilters, filterOptions, loading, buildQueryString }}>
      {children}
    </RTBFilterContext.Provider>
  )
}
