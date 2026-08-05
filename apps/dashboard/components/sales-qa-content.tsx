'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import {
  ChevronDown, ChevronRight, Building2, TrendingUp,
  DollarSign, PlayCircle, Quote, CreditCard, Loader2, Calendar,
  Download, Clock, ThumbsUp, XCircle, History, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  CATEGORY_LABELS, CAMPAIGN_CATEGORIES, categoryLabel, OUTCOME_ORDER, outcomeLabel,
  outcomeBadgeClass, followThroughBadgeClass,
  todayPhoenix, daysAgoPhoenix, startOfMonthPhoenix,
  SalesQaCampaign, SalesQaCall,
} from '@/lib/sales-qa'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ALL = '__all__'

interface Summary {
  total: number; quotesIssued: number; quoteRate: number
  sales: number; highFollowThrough: number; revenue: number
}

interface Headline {
  total_quotes_given: number
  sale_completed: number
  buyer_intent: number
  quote_declined: number
  undecided_reviewing: number
}

const EMPTY_HEADLINE: Headline = {
  total_quotes_given: 0, sale_completed: 0, buyer_intent: 0, quote_declined: 0, undecided_reviewing: 0,
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last14', label: 'Last 14 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom range' },
]

function rangeForPreset(key: string): { from: string; to: string } {
  const today = todayPhoenix()
  switch (key) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = daysAgoPhoenix(1); return { from: y, to: y } }
    case 'last7': return { from: daysAgoPhoenix(6), to: today }
    case 'last14': return { from: daysAgoPhoenix(13), to: today }
    case 'last30': return { from: daysAgoPhoenix(29), to: today }
    case 'month': return { from: startOfMonthPhoenix(), to: today }
    default: return { from: today, to: today }
  }
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}
function money(n: number | null | undefined): string {
  const v = n ?? 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDuration(seconds: number): string {
  const m = Math.floor((seconds ?? 0) / 60)
  const s = Math.round((seconds ?? 0) % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SalesQAContent() {
  const [ready, setReady] = useState(false)
  const [preset, setPreset] = useState('last7')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')
  const [buyer, setBuyer] = useState('')
  const [buyers, setBuyers] = useState<string[]>([])

  const [summary, setSummary] = useState<Summary>({ total: 0, quotesIssued: 0, quoteRate: 0, sales: 0, highFollowThrough: 0, revenue: 0 })
  const [headline, setHeadline] = useState<Headline>(EMPTY_HEADLINE)
  const [campaigns, setCampaigns] = useState<SalesQaCampaign[]>([])
  const [loading, setLoading] = useState(true)

  // Lazy-loaded per-vendor call lists, keyed by `${category}|${vendor}`
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [callsCache, setCallsCache] = useState<Record<string, SalesQaCall[]>>({})
  const [callsLoading, setCallsLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const r = rangeForPreset('last7')
    setDateFrom(r.from); setDateTo(r.to); setReady(true)
  }, [])

  const applyPreset = (key: string) => {
    setPreset(key)
    if (key !== 'custom') {
      const r = rangeForPreset(key)
      setDateFrom(r.from); setDateTo(r.to)
    }
  }

  const fetchData = useCallback(async () => {
    if (!ready || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (category) params.set('category', category)
      if (buyer) params.set('buyer', buyer)
      const res = await fetch(`/api/sales-qa?${params.toString()}`)
      const data = await res.json()
      setSummary(data?.summary ?? { total: 0, quotesIssued: 0, quoteRate: 0, sales: 0, highFollowThrough: 0, revenue: 0 })
      setHeadline(data?.headline ?? EMPTY_HEADLINE)
      setCampaigns(data?.campaigns ?? [])
      if (Array.isArray(data?.buyers)) setBuyers(data.buyers)
      // Collapse any open rows when the query changes
      setExpanded({}); setCallsCache({})
    } catch {
      toast.error('Failed to load sales monitoring data')
    }
    setLoading(false)
  }, [ready, dateFrom, dateTo, category, buyer])

  useEffect(() => { fetchData() }, [fetchData])

  const handleExport = () => {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo })
    if (category) params.set('category', category)
    if (buyer) params.set('buyer', buyer)
    const a = document.createElement('a')
    a.href = `/api/sales-qa/export?${params.toString()}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Export started')
  }

  const toggleVendor = async (cat: string, vendor: string) => {
    const key = `${cat}|${vendor}`
    const isOpen = !!expanded[key]
    setExpanded((p) => ({ ...p, [key]: !isOpen }))
    if (isOpen || callsCache[key]) return
    setCallsLoading((p) => ({ ...p, [key]: true }))
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo, category: cat, vendor })
      if (buyer) params.set('buyer', buyer)
      const res = await fetch(`/api/sales-qa/calls?${params.toString()}`)
      const data = await res.json()
      setCallsCache((p) => ({ ...p, [key]: data?.calls ?? [] }))
    } catch {
      toast.error('Failed to load calls')
    }
    setCallsLoading((p) => ({ ...p, [key]: false }))
  }

  const cards = [
    { label: 'Quotes given', value: loading ? '—' : headline.total_quotes_given, icon: Quote, cls: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Sales completed', value: loading ? '—' : headline.sale_completed, icon: CreditCard, cls: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950' },
    { label: 'Buyer intent', value: loading ? '—' : headline.buyer_intent, icon: ThumbsUp, cls: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-950' },
    { label: 'Undecided / reviewing', value: loading ? '—' : headline.undecided_reviewing, icon: Clock, cls: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-950' },
    { label: 'Declined', value: loading ? '—' : headline.quote_declined, icon: XCircle, cls: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
    { label: 'Revenue', value: loading ? '—' : money(summary.revenue), icon: DollarSign, cls: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950' },
  ]

  const visibleCampaigns = campaigns.filter((c) => c.total > 0 || !loading)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Monitoring"
        description="Billable calls that received an actual dollar-amount quote: how the caller responded to the price — by campaign and vendor"
        actions={
          <div className="flex items-center gap-2">
            <SnapshotHistoryDialog />
            <Button onClick={handleExport} variant="outline" className="gap-2" disabled={loading}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Date range + category */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Range</Label>
          <Select value={preset} onValueChange={applyPreset}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset('custom') }} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset('custom') }} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Campaign</Label>
          <Select value={category || ALL} onValueChange={(v) => setCategory(v === ALL ? '' : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All campaigns</SelectItem>
              {CAMPAIGN_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Buyer</Label>
          <Select value={buyer || ALL} onValueChange={(v) => setBuyer(v === ALL ? '' : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All buyers</SelectItem>
              {buyers.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground pb-2">Dates in Eastern time (ET)</span>
      </div>

      {/* Headline funnel tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', c.bg)}>
                  <Icon className={cn('h-5 w-5', c.cls)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Per-campaign sections */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-64 animate-pulse bg-muted rounded-xl" />)}
        </div>
      ) : visibleCampaigns.every((c) => c.total === 0) ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No quoted calls for this range</CardContent></Card>
      ) : (
        visibleCampaigns.map((camp) => (
          <CampaignSection
            key={camp.category}
            camp={camp}
            expanded={expanded}
            callsCache={callsCache}
            callsLoading={callsLoading}
            onToggle={toggleVendor}
          />
        ))
      )}
    </div>
  )
}

function FunnelBar({ outcomes, total }: { outcomes: Record<string, number>; total: number }) {
  if (total === 0) return null
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {OUTCOME_ORDER.map((o) => {
        const n = outcomes[o] ?? 0
        if (n === 0) return null
        const colorMap: Record<string, string> = {
          sale_completed: 'bg-emerald-500',
          quote_accepted_deferred: 'bg-teal-500',
          quote_pending_approval: 'bg-sky-500',
          quote_received_reviewing: 'bg-violet-500',
          quote_declined: 'bg-amber-500',
          no_quote_issued: 'bg-slate-300',
        }
        return <div key={o} className={cn('h-full', colorMap[o])} style={{ width: `${(n / total) * 100}%` }} title={`${outcomeLabel(o)}: ${n}`} />
      })}
    </div>
  )
}

function FunnelPills({ outcomes }: { outcomes: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {OUTCOME_ORDER.map((o) => {
        const n = outcomes[o] ?? 0
        if (n === 0) return null
        return (
          <span key={o} className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', outcomeBadgeClass(o))}>
            {outcomeLabel(o)} <span className="tabular-nums font-semibold">{n}</span>
          </span>
        )
      })}
    </div>
  )
}

function CampaignSection({
  camp, expanded, callsCache, callsLoading, onToggle,
}: {
  camp: SalesQaCampaign
  expanded: Record<string, boolean>
  callsCache: Record<string, SalesQaCall[]>
  callsLoading: Record<string, boolean>
  onToggle: (cat: string, vendor: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> {categoryLabel(camp.category)}
          </CardTitle>
          <Badge variant="secondary" className="tabular-nums">{camp.total} call{camp.total === 1 ? '' : 's'}</Badge>
          <span className="text-xs text-muted-foreground">Agreed <span className="font-semibold text-foreground tabular-nums">{pct(camp.total > 0 ? camp.followThrough.high / camp.total : 0)}</span></span>
          <span className="text-xs text-muted-foreground">Revenue <span className="font-semibold text-emerald-600 tabular-nums">{money(camp.revenue)}</span></span>
          <div className="w-full sm:w-auto sm:ml-auto sm:min-w-[220px]">
            <FunnelBar outcomes={camp.outcomes} total={camp.total} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {camp.total === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No calls for this campaign in range</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead className="text-center">Agreed</TableHead>
                  <TableHead>Outcome funnel</TableHead>
                  <TableHead className="text-center">Avg dur</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {camp.vendors.map((v) => {
                  const key = `${camp.category}|${v.vendor_name}`
                  const isOpen = !!expanded[key]
                  return (
                    <Fragment key={key}>
                      <TableRow className="hover:bg-muted/40 cursor-pointer" onClick={() => onToggle(camp.category, v.vendor_name)}>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[240px] truncate" title={v.vendor_name}>
                          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {v.vendor_name}</span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{v.total}</TableCell>
                        <TableCell className="text-center tabular-nums font-semibold">{pct(v.total > 0 ? v.followThrough.high / v.total : 0)}</TableCell>
                        <TableCell><FunnelPills outcomes={v.outcomes} /></TableCell>
                        <TableCell className="text-center font-mono text-xs">{fmtDuration(v.avgDuration)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{money(v.revenue)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={6} className="py-3">
                            <VendorCalls loading={!!callsLoading[key]} calls={callsCache[key]} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VendorCalls({ loading, calls }: { loading: boolean; calls: SalesQaCall[] | undefined }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading calls…
      </div>
    )
  }
  if (!calls || calls.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">No calls found</p>
  }
  return (
    <div className="space-y-2">
      {calls.map((c) => (
        <div key={c.trackdrive_call_id} className="rounded-lg border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className={cn('text-[11px]', outcomeBadgeClass(c.outcome_category))}>{outcomeLabel(c.outcome_category)}</Badge>
            <Badge variant="outline" className={cn('text-[11px] capitalize', followThroughBadgeClass(c.follow_through_likelihood))}>Follow-through: {c.follow_through_likelihood}</Badge>
            {c.quote_amount && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                <Quote className="h-3.5 w-3.5 text-muted-foreground" /> {c.quote_amount}{c.quote_type && c.quote_type !== 'other' ? <span className="text-muted-foreground"> · {c.quote_type.replace(/_/g, ' ')}</span> : null}
              </span>
            )}
            {c.payment_mentioned && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><CreditCard className="h-3.5 w-3.5" /> Payment discussed</span>
            )}
            <span className="text-xs text-muted-foreground">{[c.caller_city, c.caller_state].filter(Boolean).join(', ') || '—'}</span>
            <span className="text-xs text-muted-foreground">· {fmtDuration(c.duration)}</span>
            <span className="text-xs text-muted-foreground">· {c.review_date}</span>
            {typeof c.revenue === 'number' && <span className="text-xs text-emerald-600 font-medium">· {money(c.revenue)}</span>}
            {c.recording_url && (
              <a href={c.recording_url} target="_blank" rel="noopener noreferrer" className="ml-auto" title="Listen to recording">
                <Button variant="ghost" size="icon-sm" className="text-primary"><PlayCircle className="h-4 w-4" /></Button>
              </a>
            )}
          </div>
          <p className="text-sm text-foreground">{c.what_happened}</p>
          {c.caller_response && (
            <p className="mt-2 text-sm text-foreground">
              <span className="font-medium text-muted-foreground">Caller response to quote: </span>{c.caller_response}
            </p>
          )}
          {c.key_quote && (
            <p className="mt-1.5 text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">“{c.key_quote}”</p>
          )}
        </div>
      ))}
    </div>
  )
}

interface Snapshot {
  id: string
  snapshot_date: string
  review_month: string
  campaign_category: string
  total_quotes_given: number
  sale_completed: number
  buyer_intent: number
  quote_declined: number
  undecided_reviewing: number
  revenue: number
}

function monthLabel(m: string): string {
  // m is "YYYY-MM"
  const [y, mo] = m.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const idx = parseInt(mo, 10) - 1
  return idx >= 0 && idx < 12 ? `${names[idx]} ${y}` : m
}

// Small cell that shows a number and, if it changed vs the older snapshot,
// an up/down arrow. Highlights the value so re-classifications stand out.
function ChangeCell({ value, prev, money: isMoney }: { value: number; prev: number | null; money?: boolean }) {
  const changed = prev !== null && prev !== value
  const up = prev !== null && value > prev
  const text = isMoney ? money(value) : value.toLocaleString('en-US')
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', changed && 'font-semibold')}>
      {text}
      {changed && (
        <span className={cn('inline-flex items-center text-[10px]', up ? 'text-emerald-600' : 'text-amber-600')}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {isMoney ? '' : Math.abs(value - (prev ?? 0))}
        </span>
      )}
    </span>
  )
}

function SnapshotHistoryDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Snapshot[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [month, setMonth] = useState('')
  const [cat, setCat] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sales-qa/snapshots')
      const data = await res.json()
      const r: Snapshot[] = data?.rows ?? []
      setRows(r)
      setMonths(data?.months ?? [])
      setCats(data?.campaigns ?? [])
      // Default to the most recent month + first campaign that has data.
      const firstMonth = (data?.months ?? [])[0] ?? ''
      setMonth((m) => m || firstMonth)
      const catsForMonth = Array.from(new Set(r.filter((x) => x.review_month === firstMonth).map((x) => x.campaign_category))).sort()
      setCat((c) => c || catsForMonth[0] || (data?.campaigns ?? [])[0] || '')
    } catch {
      toast.error('Failed to load history')
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  // Snapshots for the current selection, newest capture first.
  const series = rows
    .filter((r) => r.review_month === month && r.campaign_category === cat)
    .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History className="h-4 w-4" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Snapshot history
          </DialogTitle>
          <DialogDescription>
            Daily captures of the funnel per campaign. Arrows show how a number changed from the previous capture — useful for spotting when the QA review re-classified past calls.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Month reviewed</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                {months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Campaign</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Campaign" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-lg border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : series.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No snapshots recorded yet for this selection. Daily captures accrue automatically from here on.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Captured</TableHead>
                  <TableHead className="text-center">Quotes</TableHead>
                  <TableHead className="text-center">Sales</TableHead>
                  <TableHead className="text-center">Intent</TableHead>
                  <TableHead className="text-center">Undecided</TableHead>
                  <TableHead className="text-center">Declined</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((s, i) => {
                  const prev = series[i + 1] ?? null // older capture
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm font-medium whitespace-nowrap">{s.snapshot_date}</TableCell>
                      <TableCell className="text-center"><ChangeCell value={s.total_quotes_given} prev={prev ? prev.total_quotes_given : null} /></TableCell>
                      <TableCell className="text-center"><ChangeCell value={s.sale_completed} prev={prev ? prev.sale_completed : null} /></TableCell>
                      <TableCell className="text-center"><ChangeCell value={s.buyer_intent} prev={prev ? prev.buyer_intent : null} /></TableCell>
                      <TableCell className="text-center"><ChangeCell value={s.undecided_reviewing} prev={prev ? prev.undecided_reviewing : null} /></TableCell>
                      <TableCell className="text-center"><ChangeCell value={s.quote_declined} prev={prev ? prev.quote_declined : null} /></TableCell>
                      <TableCell className="text-right text-emerald-600"><ChangeCell value={s.revenue} prev={prev ? prev.revenue : null} money /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
