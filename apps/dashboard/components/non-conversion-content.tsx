'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, Eye, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, PlayCircle, PhoneOff, Users, Building2, Globe, ListChecks, RotateCcw,
  Clock, RefreshCw, CircleDot, Map,
} from 'lucide-react'
import { NonConversionReview, NonConversionBreakdownRow, NonConversionSummary } from '@/lib/types'
import { outcomeLabel, faultSideLabel, faultSideBadgeClass, FAULT_SIDES, OUTCOME_REASONS, todayPST } from '@/lib/non-conversion'
import { CoverageGapsView } from '@/components/coverage-gaps-view'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatDuration(seconds: number): string {
  const m = Math.floor((seconds ?? 0) / 60)
  const s = (seconds ?? 0) % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const ALL = '__all__'

interface Facets { buyers: string[]; vendors: string[]; campaigns: string[] }
interface Schedule {
  lastDataAt: string | null
  nextRunAt: string | null
  activeNow: boolean
  startHour: number
  endHour: number
  tzLabel: string
}

function fmtClock(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch {
    return null
  }
}

function fmtRelative(iso: string | null | undefined): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = Date.now() - then
  const past = diffMs >= 0
  const mins = Math.round(Math.abs(diffMs) / 60000)
  if (mins < 1) return 'just now'
  const label = (() => {
    if (mins < 60) return `${mins} min`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'}`
    const days = Math.round(hrs / 24)
    return `${days} day${days === 1 ? '' : 's'}`
  })()
  return past ? `${label} ago` : `in ${label}`
}

function hourLabel(h: number): string {
  const period = h >= 12 ? 'pm' : 'am'
  const hr12 = h % 12 === 0 ? 12 : h % 12
  return `${hr12}${period}`
}

export function NonConversionContent() {
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'reviews' | 'gaps'>('reviews')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [buyer, setBuyer] = useState('')
  const [vendor, setVendor] = useState('')
  const [campaign, setCampaign] = useState('')
  const [faultSide, setFaultSide] = useState('')
  const [outcomeReason, setOutcomeReason] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [reviews, setReviews] = useState<NonConversionReview[]>([])
  const [summary, setSummary] = useState<NonConversionSummary>({ total: 0, buyer: 0, vendor: 0, external: 0, neutral: 0 })
  const [byBuyer, setByBuyer] = useState<NonConversionBreakdownRow[]>([])
  const [byVendor, setByVendor] = useState<NonConversionBreakdownRow[]>([])
  const [facets, setFacets] = useState<Facets>({ buyers: [], vendors: [], campaigns: [] })
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [viewId, setViewId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NonConversionReview | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Initialise date range to today (PST) after mount to avoid hydration edge cases
  useEffect(() => {
    const today = todayPST()
    setDateFrom(today)
    setDateTo(today)
    setReady(true)
  }, [])

  const buildParams = useCallback((forExport = false) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    if (buyer) params.set('buyer', buyer)
    if (vendor) params.set('vendor', vendor)
    if (campaign) params.set('campaign', campaign)
    if (faultSide) params.set('fault_side', faultSide)
    if (outcomeReason) params.set('outcome_reason', outcomeReason)
    if (search) params.set('search', search)
    if (!forExport) {
      params.set('page', String(page))
      params.set('limit', '25')
    }
    return params
  }, [dateFrom, dateTo, buyer, vendor, campaign, faultSide, outcomeReason, search, page])

  const fetchData = useCallback(async (silent = false) => {
    if (!ready) return
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/non-conversion?${buildParams().toString()}`)
      const data = await res.json()
      setReviews(data?.reviews ?? [])
      setSummary(data?.summary ?? { total: 0, buyer: 0, vendor: 0, external: 0, neutral: 0 })
      setByBuyer(data?.byBuyer ?? [])
      setByVendor(data?.byVendor ?? [])
      setFacets(data?.facets ?? { buyers: [], vendors: [], campaigns: [] })
      if (data?.schedule) setSchedule(data.schedule)
      setTotal(data?.total ?? 0)
      setTotalPages(data?.pages ?? 1)
    } catch {
      if (!silent) toast.error('Failed to load reviews')
    }
    if (!silent) setLoading(false)
  }, [ready, buildParams])

  useEffect(() => { fetchData() }, [fetchData])

  // The QA bot writes new non-conversion rows hourly (8am–6pm PST). Silently
  // refresh in the background every 10 minutes so intra-day data stays current.
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => { fetchData(true) }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [ready, fetchData])

  // Load single-call detail when dialog opens
  useEffect(() => {
    if (!viewId) { setDetail(null); return }
    setDetailLoading(true)
    fetch(`/api/non-conversion/${viewId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d?.review ?? null))
      .catch(() => toast.error('Failed to load call detail'))
      .finally(() => setDetailLoading(false))
  }, [viewId])

  const resetFilters = () => {
    setBuyer(''); setVendor(''); setCampaign(''); setFaultSide(''); setOutcomeReason(''); setSearch(''); setPage(1)
  }

  const handleExport = () => {
    const url = `/api/non-conversion/export?${buildParams(true).toString()}`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Export started')
  }

  const externalNeutral = (summary.external ?? 0) + (summary.neutral ?? 0)

  const cards = [
    { label: 'Total Reviewed', value: summary.total, icon: ListChecks, cls: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Buyer Fault', value: summary.buyer, icon: Building2, cls: 'text-red-600', bg: 'bg-red-100 dark:bg-red-950' },
    { label: 'Vendor Fault', value: summary.vendor, icon: Users, cls: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
    { label: 'External / Neutral', value: externalNeutral, icon: Globe, cls: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-950' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Non-Conversion QA"
        description="AI review of non-converted calls — why each failed and who is at fault"
        actions={
          view === 'reviews' ? (
            <Button onClick={handleExport} variant="outline" className="gap-2" disabled={total === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* QA data freshness status */}
      {schedule && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-xs">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
            schedule.activeNow
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-600'
          )}>
            <CircleDot className={cn('h-3 w-3', schedule.activeNow && 'animate-pulse')} />
            {schedule.activeNow ? 'QA bot active' : 'QA bot idle'}
          </span>

          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Data last updated:
            <span className="font-medium text-foreground">
              {fmtClock(schedule.lastDataAt) ?? 'No data yet'}
              {schedule.lastDataAt && (
                <span className="text-muted-foreground font-normal"> ({fmtRelative(schedule.lastDataAt)})</span>
              )}
            </span>
          </span>

          <span className="hidden sm:inline text-muted-foreground/40">·</span>

          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Next update:
            <span className="font-medium text-foreground">
              {fmtClock(schedule.nextRunAt) ?? '—'}
              {schedule.nextRunAt && (
                <span className="text-muted-foreground font-normal"> ({fmtRelative(schedule.nextRunAt)})</span>
              )}
            </span>
          </span>

          <span className="ml-auto text-muted-foreground/80">
            Runs hourly {hourLabel(schedule.startHour)}–{hourLabel(schedule.endHour)} {schedule.tzLabel}
          </span>
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From (PST)</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-[170px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To (PST)</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-[170px]" />
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => { const t = todayPST(); setDateFrom(t); setDateTo(t); setPage(1) }}>
          <RotateCcw className="h-3.5 w-3.5" /> Today
        </Button>
      </div>

      {/* View toggle */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        <button
          onClick={() => setView('reviews')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'reviews' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ListChecks className="h-4 w-4" /> Call Reviews
        </button>
        <button
          onClick={() => setView('gaps')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'gaps' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Map className="h-4 w-4" /> Coverage Gaps
        </button>
      </div>

      {view === 'gaps' ? (
        <CoverageGapsView dateFrom={dateFrom} dateTo={dateTo} />
      ) : (
      <>
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

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownPanel title="By Buyer" icon={Building2} rows={byBuyer} loading={loading} />
        <BreakdownPanel title="By Vendor" icon={Users} rows={byVendor} loading={loading} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search caller number, call ID, number called..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2 text-muted-foreground shrink-0">
              <RotateCcw className="h-3.5 w-3.5" /> Reset filters
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <FilterSelect label="Buyer" value={buyer} onChange={(v) => { setBuyer(v); setPage(1) }} options={facets.buyers} />
            <FilterSelect label="Vendor" value={vendor} onChange={(v) => { setVendor(v); setPage(1) }} options={facets.vendors} />
            <FilterSelect label="Campaign" value={campaign} onChange={(v) => { setCampaign(v); setPage(1) }} options={facets.campaigns} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fault Side</Label>
              <Select value={faultSide || ALL} onValueChange={(v) => { setFaultSide(v === ALL ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All fault sides</SelectItem>
                  {FAULT_SIDES.map((f) => <SelectItem key={f} value={f}>{faultSideLabel(f)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Outcome Reason</Label>
              <Select value={outcomeReason || ALL} onValueChange={(v) => { setOutcomeReason(v === ALL ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>All reasons</SelectItem>
                  {OUTCOME_REASONS.map((r) => <SelectItem key={r} value={r}>{outcomeLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Caller ID</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Dur.</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Fault</TableHead>
                <TableHead className="text-center">Listen</TableHead>
                <TableHead className="w-[50px] text-center">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 animate-pulse bg-muted rounded w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">No non-converted calls found for these filters</TableCell>
                </TableRow>
              ) : (
                reviews.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow className="hover:bg-muted/40">
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}>
                          {expanded[r.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{r.caller_number || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{[r.caller_city, r.caller_state].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={r.vendor_name}>{r.vendor_name || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={r.buyer_name ?? ''}>{r.buyer_name || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={r.campaign_name ?? ''}>{r.campaign_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDuration(r.duration)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{outcomeLabel(r.outcome_reason)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs capitalize', faultSideBadgeClass(r.fault_side))}>{faultSideLabel(r.fault_side)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.recording_url ? (
                          <a href={r.recording_url} target="_blank" rel="noopener noreferrer" title="Listen to recording">
                            <Button variant="ghost" size="icon-sm" className="text-primary"><PlayCircle className="h-4 w-4" /></Button>
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon-sm" onClick={() => setViewId(r.id)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                    {expanded[r.id] && (
                      <TableRow className="bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={10} className="text-sm text-muted-foreground py-3">
                          <span className="font-medium text-foreground">What happened: </span>{r.what_happened}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} call{total === 1 ? '' : 's'}</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
      </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!viewId} onOpenChange={(open) => { if (!open) setViewId(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneOff className="h-5 w-5 text-primary" /> Call Review
            </DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('capitalize', faultSideBadgeClass(detail.fault_side))}>{faultSideLabel(detail.fault_side)} fault</Badge>
                <Badge variant="outline">{outcomeLabel(detail.outcome_reason)}</Badge>
                <span className="text-xs text-muted-foreground">{detail.review_date}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Caller ID:</span> <span className="font-mono">{detail.caller_number || '—'}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span>{[detail.caller_city, detail.caller_state].filter(Boolean).join(', ') || '—'}</span></div>
                <div><span className="text-muted-foreground">Number Called:</span> <span className="font-mono">{detail.number_called || '—'}</span></div>
                <div><span className="text-muted-foreground">Duration:</span> <span className="font-mono">{formatDuration(detail.duration)}</span></div>
                <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{detail.vendor_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Buyer:</span> <span className="font-medium">{detail.buyer_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Campaign:</span> <span className="font-medium">{detail.campaign_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Call Status:</span> <span className="capitalize">{detail.call_status || '—'}</span></div>
                <div><span className="text-muted-foreground">Call ID:</span> <span className="font-mono text-xs">{detail.trackdrive_call_id}</span></div>
                <div><span className="text-muted-foreground">Buyer Answered:</span> <span>{detail.buyer_leg_answered === null ? '—' : detail.buyer_leg_answered ? 'Yes' : 'No'}</span></div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">What happened</p>
                <p className="text-sm bg-muted p-3 rounded-lg">{detail.what_happened}</p>
              </div>

              {detail.fix_suggestion && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fix suggestion</p>
                  <p className="text-sm bg-primary/5 border border-primary/20 p-3 rounded-lg">{detail.fix_suggestion}</p>
                </div>
              )}

              {detail.recording_url && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Recording</p>
                  <audio controls preload="none" src={detail.recording_url} className="w-full h-10">
                    Your browser does not support audio playback.
                  </audio>
                  <a href={detail.recording_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2"><ExternalLink className="h-4 w-4" /> Open recording</Button>
                  </a>
                </div>
              )}

              {detail.raw_ai_response && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Full AI analysis</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-56 overflow-y-auto">
                    {JSON.stringify(detail.raw_ai_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function BreakdownPanel({ title, icon: Icon, rows, loading }: { title: string; icon: any; rows: NonConversionBreakdownRow[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[360px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse bg-muted rounded" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
        ) : (
          rows.map((row) => (
            <div key={row.name} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium truncate pr-2" title={row.name}>{row.name}</span>
                <Badge variant="secondary" className="shrink-0">{row.total}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.reasons.map((r) => (
                  <span key={r.reason} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                    <span className="text-muted-foreground">{outcomeLabel(r.reason)}</span>
                    <span className="font-semibold tabular-nums">{r.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
