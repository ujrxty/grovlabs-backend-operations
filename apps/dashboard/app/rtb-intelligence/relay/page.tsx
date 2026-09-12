'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Settings, Power, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface BuyerRelay {
  td_buyer_id: string
  name: string
  relay_enabled: boolean
  relay_url?: string
  original_ping_url?: string
  platform?: string
  bid_floor?: number | null
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

export default function RelayPage() {
  const [buyers, setBuyers] = useState<BuyerRelay[]>([])
  const [relayStats, setRelayStats] = useState<RelayStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [enableDialog, setEnableDialog] = useState<{
    open: boolean
    buyer: BuyerRelay | null
    platform: string
    pingUrl: string
    conversionId: string
    saving: boolean
    loading: boolean
  }>({ open: false, buyer: null, platform: 'trackdrive', pingUrl: '', conversionId: '', saving: false, loading: false })

  const [bidFloorEdit, setBidFloorEdit] = useState<{ buyerId: string; value: string } | null>(null)
  const [savingBidFloor, setSavingBidFloor] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${QA_AGENT_URL}/ping-relay/buyers`)
      if (res.ok) {
        const data = await res.json()
        setBuyers(data.buyers || [])
        setRelayStats(data.stats || null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const handleSaveBidFloor = async (buyerId: string, value: string) => {
    const bidFloor = value.trim() === '' ? null : parseFloat(value)
    if (value.trim() !== '' && (isNaN(bidFloor!) || bidFloor! < 0)) {
      toast.error('Invalid bid floor value')
      return
    }

    setSavingBidFloor(buyerId)
    try {
      const res = await fetch(`${QA_AGENT_URL}/ping-relay/relay/bid-floor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ td_buyer_id: buyerId, bid_floor: bidFloor }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setBidFloorEdit(null)
        fetchData()
      } else {
        toast.error(data.message || 'Failed to set bid floor')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set bid floor')
    }
    setSavingBidFloor(null)
  }

  return (
    <div className="p-6 space-y-6">
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
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
              <CardTitle className="text-base">Buyer Relay Configuration</CardTitle>
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
                    <TableHead className="text-right">Bid Floor</TableHead>
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
                        {buyer.relay_enabled ? (
                          bidFloorEdit?.buyerId === buyer.td_buyer_id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-20 h-7 text-right text-sm"
                                value={bidFloorEdit.value}
                                onChange={(e) => setBidFloorEdit({ buyerId: buyer.td_buyer_id, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveBidFloor(buyer.td_buyer_id, bidFloorEdit.value)
                                  if (e.key === 'Escape') setBidFloorEdit(null)
                                }}
                                autoFocus
                                disabled={savingBidFloor === buyer.td_buyer_id}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleSaveBidFloor(buyer.td_buyer_id, bidFloorEdit.value)}
                                disabled={savingBidFloor === buyer.td_buyer_id}
                              >
                                {savingBidFloor === buyer.td_buyer_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : '✓'}
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="hover:text-foreground text-muted-foreground cursor-pointer"
                              onClick={() => setBidFloorEdit({
                                buyerId: buyer.td_buyer_id,
                                value: buyer.bid_floor?.toString() || ''
                              })}
                            >
                              {buyer.bid_floor ? `$${buyer.bid_floor.toFixed(2)}` : 'Set'}
                            </button>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
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
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No buyers found. Make sure TrackDrive credentials are configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

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
            </div>
            <div className="space-y-2">
              <Label>Original Ping URL</Label>
              <div className="relative">
                <Input
                  placeholder={enableDialog.loading ? 'Loading...' : 'https://buyer-platform.com/api/ping/...'}
                  value={enableDialog.pingUrl}
                  onChange={(e) => setEnableDialog(d => ({ ...d, pingUrl: e.target.value }))}
                  disabled={enableDialog.loading}
                />
                {enableDialog.loading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
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
                Find in TrackDrive: Buyer → Edit → Ping/Post URL (e.g. /buyer_conversions/<strong>ID</strong>/edit)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnableDialog(d => ({ ...d, open: false }))} disabled={enableDialog.saving}>
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
