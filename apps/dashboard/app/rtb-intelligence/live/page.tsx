'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Zap } from 'lucide-react'
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
  is_duplicate: boolean
  processing_time_ms: number | null
}

export default function LiveFeedPage() {
  const [pings, setPings] = useState<LivePing[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/pings/live?limit=50`)
      if (res.ok) setPings(await res.json())
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

  const filteredPings = pings.filter(p => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'duplicate') return p.is_duplicate
    return p.status === statusFilter
  })

  const statusBadge = (status: string, isDuplicate: boolean) => {
    if (isDuplicate) {
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">Duplicate</Badge>
    }
    switch (status) {
      case 'accepted':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Accepted</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Rejected</Badge>
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Pending</Badge>
      case 'no_bid':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">No Bid</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="duplicate">Duplicates</SelectItem>
              <SelectItem value="no_bid">No Bid</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && 'border-lime-500 text-lime-500')}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bid</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPings.map((ping) => (
                <TableRow key={ping.id} className={cn(ping.is_duplicate && 'opacity-60')}>
                  <TableCell className="font-mono text-xs">{formatTime(ping.received_at)}</TableCell>
                  <TableCell>{ping.caller_state || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{ping.offer_name || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{ping.traffic_source || '-'}</TableCell>
                  <TableCell>{statusBadge(ping.status, ping.is_duplicate)}</TableCell>
                  <TableCell className="font-mono">
                    {ping.winning_bid ? `$${ping.winning_bid.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate">{ping.winning_buyer_name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {ping.processing_time_ms ? `${ping.processing_time_ms}ms` : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredPings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {loading ? 'Loading...' : 'No pings received yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
