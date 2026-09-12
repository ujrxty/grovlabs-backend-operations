'use client'

import { useRTBFilters } from './rtb-filter-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Filter, Calendar, Package, Globe, MapPin, Users } from 'lucide-react'

export function RTBFilterBar() {
  const { filters, setFilters, filterOptions } = useRTBFilters()

  const clearFilters = () => {
    setFilters({ dateRange: '7d' })
  }

  const activeFilters = [
    filters.offer && { key: 'offer', label: filters.offer },
    filters.trafficSource && { key: 'trafficSource', label: filters.trafficSource },
    filters.state && { key: 'state', label: filters.state },
    filters.buyer && { key: 'buyer', label: filters.buyer },
  ].filter(Boolean) as { key: string; label: string }[]

  const removeFilter = (key: string) => {
    setFilters({ ...filters, [key]: undefined })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </div>

        <Select
          value={filters.dateRange}
          onValueChange={(v) => setFilters({ ...filters, dateRange: v as any })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <Calendar className="h-3 w-3 mr-1.5 text-muted-foreground" />
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
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Package className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Offer" />
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
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Globe className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {filterOptions.traffic_sources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filterOptions.buyers.length > 0 && (
          <Select
            value={filters.buyer || 'all'}
            onValueChange={(v) => setFilters({ ...filters, buyer: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Users className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Buyer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buyers</SelectItem>
              {filterOptions.buyers.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filterOptions.states.length > 0 && (
          <Select
            value={filters.state || 'all'}
            onValueChange={(v) => setFilters({ ...filters, state: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <MapPin className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {filterOptions.states.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active:</span>
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              variant="secondary"
              className="text-xs px-2 py-0.5 cursor-pointer hover:bg-destructive/20"
              onClick={() => removeFilter(f.key)}
            >
              {f.label}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
