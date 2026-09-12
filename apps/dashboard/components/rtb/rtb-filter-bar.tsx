'use client'

import { useRTBFilters } from './rtb-filter-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function RTBFilterBar() {
  const { filters, setFilters, filterOptions } = useRTBFilters()

  const clearFilters = () => {
    setFilters({ dateRange: '7d' })
  }

  const hasActiveFilters = filters.offer || filters.trafficSource || filters.state || filters.buyer

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      <Select
        value={filters.dateRange}
        onValueChange={(v) => setFilters({ ...filters, dateRange: v as any })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
        </SelectContent>
      </Select>

      {filterOptions.offers.length > 0 && (
        <Select
          value={filters.offer || 'all'}
          onValueChange={(v) => setFilters({ ...filters, offer: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Offers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offers</SelectItem>
            {filterOptions.offers.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filterOptions.traffic_sources.length > 0 && (
        <Select
          value={filters.trafficSource || 'all'}
          onValueChange={(v) => setFilters({ ...filters, trafficSource: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {filterOptions.traffic_sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {filterOptions.states.length > 0 && (
        <Select
          value={filters.state || 'all'}
          onValueChange={(v) => setFilters({ ...filters, state: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {filterOptions.states.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
