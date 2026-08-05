'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  MapPin, PhoneOff, Ban, Building2, Hash, RotateCcw, Clock, PlayCircle,
  ChevronRight, TrendingDown, Layers,
} from 'lucide-react'
import { outcomeLabel } from '@/lib/non-conversion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ALL = '__all__'

interface GapCall {
  id: string
  trackdrive_call_id: string
  caller_number: string | null
  caller_city: string | null
  caller_state: string | null
  vendor_name: string | null
  campaign_name: string | null
  outcome_reason: string
  duration: number
  recording_url: string | null
  review_date: string
  created_at: string
}
interface Cluster {
  key: string
  buyer: string
  state: string
  areaCode: string
  city: string | null
  count: number
  noCarrier: number
  outOfArea: number
  calls: GapCall[]
}
interface Summary {
  total: number; noCarrier: number; outOfArea: number
  buyers: number; states: number; areaCodes: number
}
interface GapData {
  summary: Summary
  clusters: Cluster[]
  byState: { name: string; count: number }[]
  byHour: { hour: number; count: number }[]
  facets: { buyers: string[]; states: string[] }
}

function formatDuration(seconds: number): string {
  const m = Math.floor((seconds ?? 0) / 60)
  const s = (seconds ?? 0) % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function hourLabel(h: number): string {
  const period = h >= 12 ? 'pm' : 'am'
  const hr12 = h % 12 === 0 ? 12 : h % 12
  return `${hr12}${period}`
}

export function CoverageGapsView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [buyer, setBuyer] = useState('')
  const [state, setState] = useState('')
  const [data, setData] = useState<GapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null)

  const fetchData = useCallback(async () => {
    if (!dateFrom && !dateTo) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (buyer) params.set('buyer', buyer)
      if (state) params.set('state', state)
      const res = await fetch(`/api/non-conversion/coverage-gaps?${params.toString()}`)
      const d = await res.json()
      setData(d)
    } catch {
      toast.error('Failed to load coverage gaps')
    }
    setLoading(false)
  }, [dateFrom, dateTo, buyer, state])

  useEffect(() => { fetchData() }, [fetchData])

  const summary = data?.summary
  const clusters = data?.clusters ?? []
  const byHour = useMemo(() => (data?.byHour ?? []).filter((h) => h.count > 0), [data])
  const maxHour = useMemo(() => Math.max(1, ...byHour.map((h) => h.count)), [byHour])
  const byState = data?.byState ?? []

  const cards = [
    { label: 'Turned-away calls', value: summary?.total ?? 0, icon: TrendingDown, cls: 'text-primary', bg: 'bg-primary/10' },
    { label: 'No carrier available', value: summary?.noCarrier ?? 0, icon: PhoneOff, cls: 'text-red-600', bg: 'bg-red-100 dark:bg-red-950' },
    { label: 'Rejected out of area', value: summary?.outOfArea ?? 0, icon: Ban, cls: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
    { label: 'Distinct area codes', value: summary?.areaCodes ?? 0, icon: Hash, cls: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-950' },
  ]

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="flex items-start gap-3 rounded-xl border bg-primary/5 border-primary/20 px-4 py-3">
        <Layers className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Calls a buyer <span className="font-medium text-foreground">bid on but couldn&apos;t service</span> — either
          {' '}&ldquo;No carrier available&rdquo; or rejected as out-of-area. Clustered by
          {' '}<span className="font-medium text-foreground">buyer, state, and area code</span> to reveal the
          repeatable dead zones where you keep getting turned away. Rank the worst offenders and connect more of those calls.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Buyer</Label>
          <Select value={buyer || ALL} onValueChange={(v) => setBuyer(v === ALL ? '' : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All buyers" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All buyers</SelectItem>
              {(data?.facets?.buyers ?? []).map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">State</Label>
          <Select value={state || ALL} onValueChange={(v) => setState(v === ALL ? '' : v)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All states" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All states</SelectItem>
              {(data?.facets?.states ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(buyer || state) && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => { setBuyer(''); setState('') }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', c.bg)}>
                  <Icon className={cn('h-5 w-5', c.cls)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time-of-day pattern */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Time-of-day pattern
              <span className="ml-auto text-xs font-normal text-muted-foreground">approx. ET</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 animate-pulse bg-muted rounded" />)}</div>
            ) : byHour.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
            ) : (
              byHour.map((h) => (
                <div key={h.hour} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground text-right shrink-0">{hourLabel(h.hour)}</span>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/70"
                      style={{ width: `${Math.max(6, (h.count / maxHour) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs font-semibold tabular-nums text-right shrink-0">{h.count}</span>
                </div>
              ))
            )}
            {byHour.length > 0 && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Based on when each call was logged — close to call time, not exact-to-the-minute.
              </p>
            )}
          </CardContent>
        </Card>

        {/* By state */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> Worst states
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 animate-pulse bg-muted rounded" />)}</div>
            ) : byState.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
            ) : (
              byState.map((s) => (
                <div key={s.name} className="flex items-center justify-between border-b last:border-0 py-1.5">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant="secondary" className="tabular-nums">{s.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dead-zone ranking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" /> Dead-zone ranking
            <span className="ml-auto text-xs font-normal text-muted-foreground">Buyer · State · Area code — click a row to see the calls</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Area code</TableHead>
                <TableHead>Top city</TableHead>
                <TableHead className="text-center">No carrier</TableHead>
                <TableHead className="text-center">Out of area</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 animate-pulse bg-muted rounded w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : clusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No turned-away calls found for these filters</TableCell>
                </TableRow>
              ) : (
                clusters.map((c) => (
                  <TableRow key={c.key} className="hover:bg-muted/40 cursor-pointer" onClick={() => setActiveCluster(c)}>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate" title={c.buyer}>{c.buyer}</TableCell>
                    <TableCell className="text-sm">{c.state === 'Unknown' ? <span className="text-muted-foreground">—</span> : c.state}</TableCell>
                    <TableCell className="font-mono text-sm">{c.areaCode === 'Unknown' ? <span className="text-muted-foreground font-sans">—</span> : c.areaCode}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate" title={c.city ?? ''}>{c.city || '—'}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.noCarrier || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.outOfArea || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="tabular-nums">{c.count}</Badge></TableCell>
                    <TableCell className="text-center"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drill-down dialog */}
      <Dialog open={!!activeCluster} onOpenChange={(open) => { if (!open) setActiveCluster(null) }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {activeCluster?.buyer}
              {activeCluster?.state && activeCluster.state !== 'Unknown' && (
                <Badge variant="outline">{activeCluster.state}</Badge>
              )}
              {activeCluster?.areaCode && activeCluster.areaCode !== 'Unknown' && (
                <Badge variant="outline" className="font-mono">Area {activeCluster.areaCode}</Badge>
              )}
              <Badge variant="secondary">{activeCluster?.count} call{activeCluster?.count === 1 ? '' : 's'}</Badge>
            </DialogTitle>
          </DialogHeader>
          {activeCluster && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caller ID</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Listen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCluster.calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{call.caller_number || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{[call.caller_city, call.caller_state].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate" title={call.vendor_name ?? ''}>{call.vendor_name || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{outcomeLabel(call.outcome_reason)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{call.review_date}</TableCell>
                      <TableCell className="text-center">
                        {call.recording_url ? (
                          <a href={call.recording_url} target="_blank" rel="noopener noreferrer" title="Listen to recording">
                            <Button variant="ghost" size="icon-sm" className="text-primary"><PlayCircle className="h-4 w-4" /></Button>
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
