'use client'

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Calendar, ChevronDown, ChevronRight, RefreshCw, Search, Users, PhoneCall,
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, ArrowUpDown,
} from 'lucide-react'

const TIME_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
] as const

interface Campaign {
  campaign: string
  buyer: string
  calls: number
  conversions: number
  convPct: number
  revenue: number
  payout: number
  profit: number
  rpc: number
  dupePct: number
  avgDuration: number
  noAnswers: number
}
interface Vendor {
  trafficSourceId: string
  vendor: string
  calls: number
  conversions: number
  convPct: number
  revenue: number
  payout: number
  profit: number
  rpc: number
  dupePct: number
  avgDuration: number
  noAnswers: number
  connectedCalls: number
  status: 'good' | 'neutral' | 'warning'
  campaigns: Campaign[]
}
interface Alert {
  trafficSourceId: string
  vendor: string
  severity: 'warning' | 'critical'
  messages: string[]
  revenue: number
  payout: number
  profit: number
}
interface Scorecard {
  summary: {
    activeVendors: number
    totalCalls: number
    totalConversions: number
    totalRevenue: number
    totalPayout: number
    totalProfit: number
    profitable: number
    unprofitable: number
    alertCount: number
  }
  alerts: Alert[]
  vendors: Vendor[]
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dur = (s: number) => {
  if (!s) return '0s'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

type SortKey = 'calls' | 'conversions' | 'convPct' | 'revenue' | 'payout' | 'profit' | 'rpc' | 'dupePct' | 'avgDuration'
type FilterKind = 'all' | 'profitable' | 'warning' | 'unprofitable'

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-semibold font-display tracking-tight mt-1', tone)}>{value}</p>
          </div>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10')}>
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  good: { label: 'Good', cls: 'bg-emerald-100 text-emerald-700' },
  neutral: { label: 'Neutral', cls: 'bg-slate-100 text-slate-600' },
  warning: { label: 'Warning', cls: 'bg-amber-100 text-amber-700' },
}

export function VendorsContent() {
  const [data, setData] = useState<Scorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState('today')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const fetchData = useCallback((range: string, from?: string, to?: string) => {
    setLoading(true)
    let url = `/api/vendors/scorecard?range=${range}`
    if (range === 'custom' && from && to) url += `&from=${from}&to=${to}`
    fetch(url)
      .then((r) => r.json())
      .then((d: Scorecard) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData('today') }, [fetchData])

  const handleRangeSelect = (value: string) => {
    setSelectedRange(value)
    setDropdownOpen(false)
    if (value === 'custom') { setShowCustomPicker(true); return }
    setShowCustomPicker(false)
    fetchData(value)
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const selectedLabel = TIME_RANGES.find((r) => r.value === selectedRange)?.label ?? 'Today'

  const vendors = useMemo(() => {
    let list = data?.vendors ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((v) => v.vendor.toLowerCase().includes(q))
    }
    if (filter === 'profitable') list = list.filter((v) => v.profit > 0)
    else if (filter === 'unprofitable') list = list.filter((v) => v.profit < 0)
    else if (filter === 'warning') list = list.filter((v) => v.status === 'warning')
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return sorted
  }, [data, search, filter, sortKey, sortDir])

  const s = data?.summary

  const SortTh = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th
      className={cn('px-3 py-2.5 font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap', right ? 'text-right' : 'text-left')}
      onClick={() => toggleSort(k)}
    >
      <span className={cn('inline-flex items-center gap-1', right && 'justify-end')}>
        {label}
        <ArrowUpDown className={cn('h-3 w-3', sortKey === k ? 'text-primary' : 'text-muted-foreground/40')} />
      </span>
    </th>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Vendor Scorecard" description="Performance analysis & alerts for all traffic sources" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" className="min-w-[190px] justify-between text-sm" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {selectedLabel}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
            </Button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-[220px] rounded-lg border bg-background shadow-lg py-1 max-h-[400px] overflow-y-auto">
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.value}
                      className={cn('w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors', selectedRange === range.value && 'bg-primary/10 text-primary font-medium')}
                      onClick={() => handleRangeSelect(range.value)}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchData(selectedRange, customFrom || undefined, customTo || undefined)} title="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Custom picker */}
      {showCustomPicker && selectedRange === 'custom' && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" />
              </div>
              <Button size="sm" onClick={() => customFrom && customTo && fetchData('custom', customFrom, customTo)} disabled={!customFrom || !customTo}>Apply</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading || !s ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}><CardContent className="pt-5 pb-5"><div className="h-12 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard label="Active Vendors" value={s.activeVendors} icon={Users} />
            <StatCard label="Total Calls" value={s.totalCalls.toLocaleString()} icon={PhoneCall} />
            <StatCard label="Total Revenue" value={money(s.totalRevenue)} icon={DollarSign} tone="text-emerald-600" />
            <StatCard label="Profitable" value={s.profitable} icon={TrendingUp} tone="text-emerald-600" />
            <StatCard label="Unprofitable" value={s.unprofitable} icon={TrendingDown} tone={s.unprofitable > 0 ? 'text-red-600' : undefined} />
            <StatCard label="Alerts" value={s.alertCount} icon={AlertTriangle} tone={s.alertCount > 0 ? 'text-amber-600' : undefined} />
          </>
        )}
      </div>

      {/* Alerts panel */}
      {!loading && data && data.alerts?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="font-display font-semibold text-sm">Performance Alerts</h3>
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{data.alerts.length}</Badge>
            </div>
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <div key={a.trafficSourceId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white border border-amber-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500')} />
                      <span className="font-medium text-sm truncate">{a.vendor}</span>
                    </div>
                    <ul className="mt-1 ml-4 space-y-0.5">
                      {a.messages.map((m, i) => (
                        <li key={i} className="text-xs text-muted-foreground list-disc list-outside">{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-right"><span className="text-muted-foreground">Rev </span><span className="font-mono text-emerald-600">{money(a.revenue)}</span></div>
                    <div className="text-right"><span className="text-muted-foreground">Pay </span><span className="font-mono">{money(a.payout)}</span></div>
                    <div className="text-right"><span className="text-muted-foreground">Profit </span><span className={cn('font-mono', a.profit < 0 ? 'text-red-600' : 'text-emerald-600')}>{money(a.profit)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1.5">
          {([['all', 'All'], ['profitable', 'Profitable'], ['warning', 'Warning'], ['unprofitable', 'Unprofitable']] as [FilterKind, string][]).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', filter === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70')}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <SortTh label="Calls" k="calls" right />
                  <SortTh label="Conv" k="conversions" right />
                  <SortTh label="Conv %" k="convPct" right />
                  <SortTh label="Revenue" k="revenue" right />
                  <SortTh label="Payout" k="payout" right />
                  <SortTh label="Profit" k="profit" right />
                  <SortTh label="RPC" k="rpc" right />
                  <SortTh label="Dupe %" k="dupePct" right />
                  <SortTh label="Avg Dur" k="avgDuration" right />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={11} className="px-3 py-3"><div className="h-6 animate-pulse bg-muted rounded" /></td></tr>
                  ))
                ) : vendors.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">No vendors with call data for this period.</td></tr>
                ) : (
                  vendors.map((v) => {
                    const isOpen = !!expanded[v.trafficSourceId]
                    const sb = statusBadge[v.status]
                    return (
                      <Fragment key={v.trafficSourceId}>
                        <tr
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpanded((p) => ({ ...p, [v.trafficSourceId]: !p[v.trafficSourceId] }))}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span className="font-medium truncate max-w-[220px]" title={v.vendor}>{v.vendor}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3"><Badge className={cn('font-medium hover:opacity-100', sb.cls)}>{sb.label}</Badge></td>
                          <td className="px-3 py-3 text-right font-mono">{v.calls.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right font-mono">{v.conversions.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right font-mono">{v.convPct.toFixed(1)}%</td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-600">{money(v.revenue)}</td>
                          <td className="px-3 py-3 text-right font-mono">{money(v.payout)}</td>
                          <td className={cn('px-3 py-3 text-right font-mono', v.profit < 0 ? 'text-red-600' : 'text-emerald-600')}>{money(v.profit)}</td>
                          <td className={cn('px-3 py-3 text-right font-mono font-semibold', v.rpc <= 5 ? 'text-red-600' : 'text-foreground')}>{money(v.rpc)}</td>
                          <td className="px-3 py-3 text-right font-mono">{v.dupePct.toFixed(1)}%</td>
                          <td className="px-3 py-3 text-right font-mono">{dur(v.avgDuration)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/20 border-b">
                            <td colSpan={11} className="px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">RPC by Campaign</p>
                              {v.campaigns.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No campaign data.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border bg-white">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b bg-muted/40 text-muted-foreground">
                                        <th className="px-3 py-2 text-left font-medium">Campaign</th>
                                        <th className="px-3 py-2 text-left font-medium">Buyer</th>
                                        <th className="px-3 py-2 text-right font-medium">Calls</th>
                                        <th className="px-3 py-2 text-right font-medium">Conv</th>
                                        <th className="px-3 py-2 text-right font-medium">Conv %</th>
                                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                        <th className="px-3 py-2 text-right font-medium">Payout</th>
                                        <th className="px-3 py-2 text-right font-medium">Profit</th>
                                        <th className="px-3 py-2 text-right font-medium">Avg Dur</th>
                                        <th className="px-3 py-2 text-right font-medium">RPC</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {v.campaigns.map((c, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                          <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={c.campaign}>{c.campaign}</td>
                                          <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={c.buyer}>{c.buyer}</td>
                                          <td className="px-3 py-2 text-right font-mono">{c.calls}</td>
                                          <td className="px-3 py-2 text-right font-mono">{c.conversions}</td>
                                          <td className="px-3 py-2 text-right font-mono">{c.convPct.toFixed(1)}%</td>
                                          <td className="px-3 py-2 text-right font-mono text-emerald-600">{money(c.revenue)}</td>
                                          <td className="px-3 py-2 text-right font-mono">{money(c.payout)}</td>
                                          <td className={cn('px-3 py-2 text-right font-mono', c.profit < 0 ? 'text-red-600' : 'text-emerald-600')}>{money(c.profit)}</td>
                                          <td className="px-3 py-2 text-right font-mono">{dur(c.avgDuration)}</td>
                                          <td className="px-3 py-2 text-right">
                                            <span className="inline-flex items-center gap-1.5 justify-end">
                                              <span className={cn('font-mono font-semibold', c.rpc <= 5 ? 'text-red-600' : 'text-foreground')}>{money(c.rpc)}</span>
                                              {c.calls >= 10 && c.rpc <= 5 && (
                                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">LOW</Badge>
                                              )}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
