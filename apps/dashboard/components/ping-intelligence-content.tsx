'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Radio, AlertTriangle, Copy, Check, TrendingUp, TrendingDown, Zap, Power, Settings, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface PingStats {
  total_pings: number
  accepted: number
  rejected: number
  no_bid: number
  failed: number
  duplicates: number
  accept_rate: number
  total_bid_amount: number
  avg_bid: number
  avg_latency_ms: number
  unique_callers: number
}

interface SegmentStats {
  name: string
  pings: number
  accepted: number
  accept_rate: number
  total_bid: number
  avg_bid: number
  pct_of_total: number
}

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

interface DuplicateStats {
  total_pings: number
  duplicates: number
  duplicate_rate: number
  by_traffic_source: { name: string; pings: number; duplicates: number; dup_rate: number }[]
  by_offer: { name: string; pings: number; duplicates: number; dup_rate: number }[]
}

interface RejectReason {
  reason: string
  count: number
  pct: number
}

interface BuyerRelay {
  td_buyer_id: string
  name: string
  relay_enabled: boolean
  relay_url?: string
  original_ping_url?: string
  platform?: string
  stats?: {
    total_pings: number
    total_accepts: number
    total_rejects: number
    accept_rate: number
    avg_latency_ms: number
    last_ping_at: string | null
  }
}

interface RelayStats {
  total_relays: number
  active_relays: number
  total_pings: number
  total_accepts: number
  accept_rate: number
  avg_latency_ms: number
}

const PLATFORMS = [
  { value: 'trackdrive', label: 'TrackDrive' },
  { value: 'callgrid', label: 'CallGrid' },
  { value: 'retreaver', label: 'Retreaver' },
  { value: 'ringba', label: 'Ringba' },
  { value: 'custom', label: 'Custom' },
]

export function PingIntelligenceContent() {
  const [stats, setStats] = useState<PingStats | null>(null)
  const [liveFeed, setLiveFeed] = useState<LivePing[]>([])
  const [byOffer, setByOffer] = useState<SegmentStats[]>([])
  const [bySource, setBySource] = useState<SegmentStats[]>([])
  const [byState, setByState] = useState<SegmentStats[]>([])
  const [duplicateStats, setDuplicateStats] = useState<DuplicateStats | null>(null)
  const [rejectReasons, setRejectReasons] = useState<RejectReason[]>([])
  const [buyers, setBuyers] = useState<BuyerRelay[]>([])
  const [relayStats, setRelayStats] = useState<RelayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Enable relay dialog state
  const [enableDialog, setEnableDialog] = useState<{
    open: boolean
    buyer: BuyerRelay | null
    platform: string
    pingUrl: string
    conversionId: string
    saving: boolean
    loading: boolean
  }>({ open: false, buyer: null, platform: 'trackdrive', pingUrl: '', conversionId: '', saving: false, loading: false })

  const openEnableDialog = async (buyer: BuyerRelay) => {
    setEnableDialog({
      open: true,
      buyer,
      platform: 'trackdrive',
      pingUrl: '',
      conversionId: '',
      saving: false,
      loading: true,
    })

    try {
      const res = await fetch(`${QA_AGENT_URL}/ping-relay/buyers/${buyer.td_buyer_id}`)
      if (res.ok) {
        const data = await res.json()
        setEnableDialog(d => ({
          ...d,
          pingUrl: data.ping_url || '',
          platform: data.platform || 'custom',
          conversionId: data.conversion_id || '',
          loading: false,
        }))
      } else {
        setEnableDialog(d => ({ ...d, loading: false }))
      }
    } catch {
      setEnableDialog(d => ({ ...d, loading: false }))
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, liveRes, offerRes, sourceRes, stateRes, dupRes, rejectRes, buyersRes] = await Promise.all([
        fetch(`${QA_AGENT_URL}/pings/stats`),
        fetch(`${QA_AGENT_URL}/pings/live?limit=25`),
        fetch(`${QA_AGENT_URL}/pings/stats/by-offer`),
        fetch(`${QA_AGENT_URL}/pings/stats/by-source`),
        fetch(`${QA_AGENT_URL}/pings/stats/by-state`),
        fetch(`${QA_AGENT_URL}/pings/duplicates`),
        fetch(`${QA_AGENT_URL}/pings/reject-reasons`),
        fetch(`${QA_AGENT_URL}/ping-relay/buyers`),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (liveRes.ok) setLiveFeed(await liveRes.json())
      if (offerRes.ok) setByOffer(await offerRes.json())
      if (sourceRes.ok) setBySource(await sourceRes.json())
      if (stateRes.ok) setByState(await stateRes.json())
      if (dupRes.ok) setDuplicateStats(await dupRes.json())
      if (rejectRes.ok) setRejectReasons(await rejectRes.json())
      if (buyersRes.ok) {
        const data = await buyersRes.json()
        setBuyers(data.buyers || [])
        setRelayStats(data.stats || null)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleEnableRelay = async () => {
    if (!enableDialog.buyer || !enableDialog.pingUrl || !enableDialog.conversionId) return
    setEnableDialog(d => ({ ...d, saving: true }))

    try {
      const res = await fetch(`${QA_AGENT_URL}/ping-relay/relay/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          td_buyer_id: enableDialog.buyer.td_buyer_id,
          platform: enableDialog.platform,
          original_ping_url: enableDialog.pingUrl,
          td_conversion_id: enableDialog.conversionId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setEnableDialog({ open: false, buyer: null, platform: 'trackdrive', pingUrl: '', conversionId: '', saving: false, loading: false })
        fetchData()
      } else {
        toast.error(data.message || 'Failed to enable relay')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enable relay')
    }
    setEnableDialog(d => ({ ...d, saving: false }))
  }

  const handleDisableRelay = async (buyerId: string) => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/ping-relay/relay/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ td_buyer_id: buyerId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        fetchData()
      } else {
        toast.error(data.message || 'Failed to disable relay')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable relay')
    }
  }

  useEffect(() => {
    fetchData()
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000)
      return () => clearInterval(interval)
    }
  }, [fetchData, autoRefresh])

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

  if (loading && !stats) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading ping data...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-lime-500" />
            Ping Intelligence
          </h1>
          <p className="text-muted-foreground">Real-time ping monitoring and duplicate detection</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && 'border-lime-500 text-lime-500')}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="pt-4">
            <p className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total_pings.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">Total Pings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-500">{stats?.accept_rate || 0}%</div>
            <div className="text-xs text-muted-foreground">Accept Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-500">${stats?.total_bid_amount.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">Total Bid Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">${stats?.avg_bid.toFixed(2) || '0.00'}</div>
            <div className="text-xs text-muted-foreground">Avg Bid</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">{stats?.duplicates.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">Duplicates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.unique_callers.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">Unique Callers</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="relay" className="space-y-4">
        <TabsList>
          <TabsTrigger value="relay">Relay Setup</TabsTrigger>
          <TabsTrigger value="live">Live Feed</TabsTrigger>
          <TabsTrigger value="offers">By Offer</TabsTrigger>
          <TabsTrigger value="sources">By Source</TabsTrigger>
          <TabsTrigger value="states">By State</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="rejections">Rejections</TabsTrigger>
        </TabsList>

        <TabsContent value="relay" className="space-y-4">
          {/* Relay Stats */}
          {relayStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{relayStats.active_relays}</div>
                  <div className="text-xs text-muted-foreground">Active Relays</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{relayStats.total_pings.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Pings Relayed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-emerald-500">{relayStats.accept_rate}%</div>
                  <div className="text-xs text-muted-foreground">Accept Rate</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{relayStats.avg_latency_ms}ms</div>
                  <div className="text-xs text-muted-foreground">Avg Latency</div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-lime-500" />
                Buyer Relay Configuration
              </CardTitle>
              <CardDescription>
                Enable relay to capture ping data. When enabled, TrackDrive will ping through our system to the buyer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Relay Status</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyers.map((buyer) => (
                    <TableRow key={buyer.td_buyer_id}>
                      <TableCell className="font-medium">{buyer.name}</TableCell>
                      <TableCell>
                        {buyer.relay_enabled ? (
                          <Badge variant="outline">{buyer.platform}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {buyer.relay_enabled ? (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                            <Power className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {buyer.stats?.total_pings.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {buyer.stats ? (
                          <span className={cn(
                            buyer.stats.accept_rate >= 30 ? 'text-emerald-500' :
                            buyer.stats.accept_rate < 10 ? 'text-red-500' : ''
                          )}>
                            {buyer.stats.accept_rate}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {buyer.stats?.avg_latency_ms ? `${Math.round(buyer.stats.avg_latency_ms)}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {buyer.relay_enabled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisableRelay(buyer.td_buyer_id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEnableDialog(buyer)}
                          >
                            Enable Relay
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {buyers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No buyers found. Make sure TrackDrive credentials are configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-lime-500" />
                Live Ping Feed
              </CardTitle>
              <CardDescription>Real-time incoming pings</CardDescription>
            </CardHeader>
            <CardContent>
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
                  {liveFeed.map((ping) => (
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
                  {liveFeed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No pings received yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Offer</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Total Bid</TableHead>
                    <TableHead className="text-right">Avg Bid</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byOffer.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.accepted.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(row.accept_rate >= 30 ? 'text-emerald-500' : row.accept_rate < 10 ? 'text-red-500' : '')}>
                          {row.accept_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.total_bid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${row.avg_bid.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.pct_of_total}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Traffic Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Total Bid</TableHead>
                    <TableHead className="text-right">Avg Bid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySource.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.accepted.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(row.accept_rate >= 30 ? 'text-emerald-500' : row.accept_rate < 10 ? 'text-red-500' : '')}>
                          {row.accept_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.total_bid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${row.avg_bid.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by State</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Pings</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Accept Rate</TableHead>
                    <TableHead className="text-right">Total Bid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byState.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.accepted.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(row.accept_rate >= 30 ? 'text-emerald-500' : row.accept_rate < 10 ? 'text-red-500' : '')}>
                          {row.accept_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.total_bid.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-500">{duplicateStats?.duplicate_rate || 0}%</div>
                <div className="text-sm text-muted-foreground">Duplicate Rate</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {duplicateStats?.duplicates.toLocaleString() || 0} of {duplicateStats?.total_pings.toLocaleString() || 0} pings
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Duplicates by Traffic Source</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Pings</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateStats?.by_traffic_source.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500">{row.duplicates.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.dup_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {(!duplicateStats?.by_traffic_source || duplicateStats.by_traffic_source.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No duplicates detected
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Duplicates by Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offer</TableHead>
                      <TableHead className="text-right">Pings</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateStats?.by_offer.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.pings.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-orange-500">{row.duplicates.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.dup_rate}%</TableCell>
                      </TableRow>
                    ))}
                    {(!duplicateStats?.by_offer || duplicateStats.by_offer.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No duplicates detected
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rejections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rejection Reasons</CardTitle>
              <CardDescription>Breakdown of why pings are being rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">% of Rejections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectReasons.map((row) => (
                    <TableRow key={row.reason}>
                      <TableCell className="font-medium capitalize">{row.reason.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.pct}%</TableCell>
                    </TableRow>
                  ))}
                  {rejectReasons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No rejections recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enable Relay Dialog */}
      <Dialog open={enableDialog.open} onOpenChange={(open) => !enableDialog.saving && setEnableDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Relay for {enableDialog.buyer?.name}</DialogTitle>
            <DialogDescription>
              Configure the relay to capture ping data. We'll update TrackDrive automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={enableDialog.platform}
                onValueChange={(v) => setEnableDialog(d => ({ ...d, platform: v }))}
                disabled={enableDialog.loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the platform this buyer uses for their ping endpoint
              </p>
            </div>
            <div className="space-y-2">
              <Label>Original Ping URL</Label>
              <div className="relative">
                <Input
                  placeholder={enableDialog.loading ? 'Loading from TrackDrive...' : 'https://buyer-platform.com/api/ping/...'}
                  value={enableDialog.pingUrl}
                  onChange={(e) => setEnableDialog(d => ({ ...d, pingUrl: e.target.value }))}
                  disabled={enableDialog.loading}
                />
                {enableDialog.loading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {enableDialog.loading
                  ? 'Fetching buyer\'s current ping URL...'
                  : enableDialog.pingUrl
                    ? 'Auto-detected from TrackDrive. You can modify if needed.'
                    : 'Enter the buyer\'s ping URL (from their platform: CallGrid, Ringba, etc.)'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>TrackDrive Conversion ID</Label>
              <Input
                placeholder="e.g. 8750515"
                value={enableDialog.conversionId}
                onChange={(e) => setEnableDialog(d => ({ ...d, conversionId: e.target.value }))}
                disabled={enableDialog.loading}
              />
              <p className="text-xs text-muted-foreground">
                Find this in TrackDrive: Buyer → Edit → Ping/Post section URL (e.g. /buyer_conversions/<strong>8750515</strong>/edit)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnableDialog(d => ({ ...d, open: false }))} disabled={enableDialog.saving || enableDialog.loading}>
              Cancel
            </Button>
            <Button onClick={handleEnableRelay} disabled={enableDialog.saving || enableDialog.loading || !enableDialog.pingUrl || !enableDialog.conversionId}>
              {enableDialog.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enable Relay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
