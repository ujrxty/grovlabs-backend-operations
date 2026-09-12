'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Zap, Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface LivePing {
  id: string
  received_at: string
  caller_state: string
  offer_name: string
  traffic_source: string
  status: string
  winning_bid: number | null
  winning_buyer_name: string | null
  publisher_payout: number | null
  margin: number | null
  is_duplicate: boolean
  processing_time_ms: number | null
  caller_phone?: string
  converted?: boolean
  call_duration?: number | null
}

interface LiveFilters {
  status: string
  offer: string
  source: string
  buyer: string
  state: string
  search: string
}

export default function LiveFeedPage() {
  const [pings, setPings] = useState<LivePing[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<LiveFilters>({
    status: 'all',
    offer: 'all',
    source: 'all',
    buyer: 'all',
    state: 'all',
    search: '',
  })
  const [page, setPage] = useState(1)
  const pageSize = 50

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/live?limit=500`)
      if (res.ok) {
        const data = await res.json()
        setPings(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    if (autoRefresh) {
      const interval = setInterval(fetchData, 3000)
      return () => clearInterval(interval)
    }
  }, [fetchData, autoRefresh])

  const uniqueOffers = useMemo(() => [...new Set(pings.map(p => p.offer_name).filter(Boolean))], [pings])
  const uniqueSources = useMemo(() => [...new Set(pings.map(p => p.traffic_source).filter(Boolean))], [pings])
  const uniqueBuyers = useMemo(() => [...new Set(pings.map(p => p.winning_buyer_name).filter(Boolean) as string[])], [pings])
  const uniqueStates = useMemo(() => [...new Set(pings.map(p => p.caller_state).filter(Boolean))].sort(), [pings])

  const filteredPings = useMemo(() => {
    return pings.filter(p => {
      if (filters.status !== 'all') {
        if (filters.status === 'duplicate' && !p.is_duplicate) return false
        if (filters.status !== 'duplicate' && p.status !== filters.status) return false
      }
      if (filters.offer !== 'all' && p.offer_name !== filters.offer) return false
      if (filters.source !== 'all' && p.traffic_source !== filters.source) return false
      if (filters.buyer !== 'all' && p.winning_buyer_name !== filters.buyer) return false
      if (filters.state !== 'all' && p.caller_state !== filters.state) return false
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const searchable = [
          p.offer_name,
          p.traffic_source,
          p.winning_buyer_name,
          p.caller_state,
          p.caller_phone,
          p.id
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(search)) return false
      }
      return true
    })
  }, [pings, filters])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])

  const totalPages = Math.ceil(filteredPings.length / pageSize)
  const paginatedPings = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPings.slice(start, start + pageSize)
  }, [filteredPings, page, pageSize])

  const activeFilterCount = [
    filters.status !== 'all',
    filters.offer !== 'all',
    filters.source !== 'all',
    filters.buyer !== 'all',
    filters.state !== 'all',
  ].filter(Boolean).length

  const clearFilters = () => {
    setFilters({
      status: 'all',
      offer: 'all',
      source: 'all',
      buyer: 'all',
      state: 'all',
      search: '',
    })
  }

  const statusBadge = (status: string, isDuplicate: boolean) => {
    if (isDuplicate) {
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 text-xs">Dup</Badge>
    }
    switch (status) {
      case 'accepted':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">Won</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">Rej</Badge>
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">Pend</Badge>
      case 'no_bid':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30 text-xs">No Bid</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const stats = useMemo(() => {
    const accepted = pings.filter(p => p.status === 'accepted').length
    const duplicates = pings.filter(p => p.is_duplicate).length
    const converted = pings.filter(p => p.converted).length
    const totalRevenue = pings.filter(p => p.winning_bid).reduce((sum, p) => sum + (p.winning_bid ?? 0), 0)
    const totalPayout = pings.filter(p => p.publisher_payout).reduce((sum, p) => sum + (p.publisher_payout ?? 0), 0)
    const totalMargin = totalRevenue - totalPayout
    return { total: pings.length, accepted, duplicates, converted, totalRevenue, totalPayout, totalMargin }
  }, [pings])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className={cn('h-5 w-5', autoRefresh ? 'text-lime-500 animate-pulse' : 'text-muted-foreground')} />
            <span className="font-semibold">Live Feed</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{stats.total} pings</span>
            <span className="text-emerald-500">{stats.accepted} won</span>
            {stats.converted > 0 && <span className="text-blue-500">{stats.converted} conv</span>}
            {stats.duplicates > 0 && <span className="text-orange-500">{stats.duplicates} dups</span>}
            <span className="text-lime-500">${stats.totalRevenue.toFixed(0)} rev</span>
            <span className="text-amber-500">${stats.totalPayout.toFixed(0)} cost</span>
            <span className={stats.totalMargin >= 0 ? 'text-emerald-500' : 'text-red-500'}>${stats.totalMargin.toFixed(0)} margin</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-48 h-8 pl-8 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn('h-8', activeFilterCount > 0 && 'border-lime-500')}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn('h-8', autoRefresh && 'border-lime-500 text-lime-500')}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1.5', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="accepted">Won</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="duplicate">Duplicates</SelectItem>
                  <SelectItem value="no_bid">No Bid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.offer} onValueChange={(v) => setFilters({ ...filters, offer: v })}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Offer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offers</SelectItem>
                  {uniqueOffers.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.source} onValueChange={(v) => setFilters({ ...filters, source: v })}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.buyer} onValueChange={(v) => setFilters({ ...filters, buyer: v })}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Buyer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buyers</SelectItem>
                  {uniqueBuyers.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {uniqueStates.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground">
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[80px]">Time</TableHead>
                <TableHead className="w-[100px]">Caller</TableHead>
                <TableHead className="w-[40px]">ST</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[55px]">Status</TableHead>
                <TableHead className="w-[65px] text-right">Rev</TableHead>
                <TableHead className="w-[65px] text-right">Pay</TableHead>
                <TableHead className="w-[55px] text-right">Margin</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead className="w-[45px] text-right">ms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPings.map((ping) => (
                <TableRow key={ping.id} className={cn(
                  ping.is_duplicate && 'opacity-50 bg-orange-500/5',
                  ping.converted && 'bg-emerald-500/5'
                )}>
                  <TableCell className="font-mono text-xs py-2">{formatTime(ping.received_at)}</TableCell>
                  <TableCell className="font-mono text-xs py-2">{ping.caller_phone?.replace(/^\+1/, '') || '-'}</TableCell>
                  <TableCell className="py-2 text-xs">{ping.caller_state || '-'}</TableCell>
                  <TableCell className="max-w-[130px] truncate py-2 text-sm">{ping.offer_name || '-'}</TableCell>
                  <TableCell className="max-w-[100px] truncate py-2 text-sm">{ping.traffic_source || '-'}</TableCell>
                  <TableCell className="py-2">{statusBadge(ping.status, ping.is_duplicate)}</TableCell>
                  <TableCell className="font-mono text-xs text-right py-2">
                    {ping.winning_bid ? (
                      <span className="text-emerald-500">${ping.winning_bid.toFixed(2)}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right py-2">
                    {ping.publisher_payout ? (
                      <span className="text-amber-500">${ping.publisher_payout.toFixed(2)}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right py-2">
                    {ping.margin != null ? (
                      <span className={ping.margin >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        ${ping.margin.toFixed(2)}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate py-2 text-xs">{ping.winning_buyer_name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs text-right py-2">
                    {ping.processing_time_ms ? (
                      <span className={ping.processing_time_ms > 500 ? 'text-amber-500' : 'text-muted-foreground'}>
                        {ping.processing_time_ms}
                      </span>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedPings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    {loading ? 'Loading...' : activeFilterCount > 0 ? 'No pings match filters' : 'No pings received yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredPings.length)} of {filteredPings.length} pings
          {filteredPings.length !== pings.length && ` (${pings.length} total)`}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
