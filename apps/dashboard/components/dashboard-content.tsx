'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layouts/page-header'
import {
  PhoneCall,
  AlertTriangle,
  TrendingUp,
  Clock,
  Shield,
  ChevronDown,
  Calendar,
  RefreshCw,
  DollarSign,
  Wallet,
} from 'lucide-react'
import { DashboardStats, RecentFlag, RevenueBreakdownRow } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatMoney(amount: number): string {
  if (amount >= 1000) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return amount.toFixed(2)
}

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

function StatCard({ title, value, icon: Icon, description, color }: {
  title: string
  value: number | string
  icon: any
  description?: string
  color?: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold font-display tracking-tight mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color ?? 'bg-primary/10')}>
            <Icon className={cn('h-5 w-5', color ? 'text-white' : 'text-primary')} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
}

export function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState('today')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const fetchDashboard = useCallback((range: string, from?: string, to?: string) => {
    setLoading(true)
    let url = `/api/dashboard?range=${range}`
    if (range === 'custom' && from && to) {
      url += `&from=${from}&to=${to}`
    }
    fetch(url)
      .then((r) => r.json())
      .then((data: any) => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchDashboard('today')
  }, [])

  const handleRangeSelect = (value: string) => {
    setSelectedRange(value)
    setDropdownOpen(false)
    if (value === 'custom') {
      setShowCustomPicker(true)
      return
    }
    setShowCustomPicker(false)
    fetchDashboard(value)
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      fetchDashboard('custom', customFrom, customTo)
    }
  }

  const selectedLabel = TIME_RANGES.find((r) => r.value === selectedRange)?.label ?? 'Today'

  const profit = (stats?.revenue ?? 0) - (stats?.payout ?? 0)

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Dashboard" description="Real-time performance overview" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              className="min-w-[200px] justify-between text-sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {selectedLabel}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
            </Button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-[220px] rounded-lg border bg-white shadow-lg py-1 max-h-[400px] overflow-y-auto">
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.value}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors',
                        selectedRange === range.value && 'bg-primary/10 text-primary font-medium'
                      )}
                      onClick={() => handleRangeSelect(range.value)}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchDashboard(selectedRange, customFrom || undefined, customTo || undefined)}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Custom Date Picker */}
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
              <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>Apply</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue & Call Stats - ALL date-filtered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-16 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-semibold font-display tracking-tight mt-1">${formatMoney(stats?.revenue ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.revenueConversions ?? 0} converted calls</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Payout</p>
                    <p className="text-2xl font-semibold font-display tracking-tight mt-1">${formatMoney(stats?.payout ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margin: ${formatMoney(profit)} ({stats?.revenue ? ((profit / stats.revenue) * 100).toFixed(1) : '0'}%)
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <StatCard
              title="Total Calls"
              value={stats?.totalCalls ?? 0}
              icon={PhoneCall}
              description={`${stats?.conversions ?? 0} conversions (${stats?.totalCalls ? ((stats.conversions / stats.totalCalls) * 100).toFixed(1) : '0'}%)`}
            />
            <StatCard
              title="Flagged Calls"
              value={stats?.flaggedCalls ?? 0}
              icon={AlertTriangle}
              description={`${stats?.analyzedCalls ?? 0} QA analyzed`}
            />
          </>
        )}
      </div>

      {/* Account overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-12 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Active Offers" value={stats?.activeOffers ?? 0} icon={TrendingUp} description={`${stats?.pausedOffers ?? 0} paused · ${stats?.totalOffers ?? 0} total`} />
            <StatCard title="Active Vendors" value={stats?.activeVendors ?? 0} icon={PhoneCall} description={`${stats?.pausedVendors ?? 0} paused · ${stats?.totalVendors ?? 0} total`} />
            <StatCard title="Pending Apps" value={stats?.pendingApps ?? 0} icon={Clock} />
          </>
        )}
      </div>

      {/* Revenue by Buyer breakdown */}
      {!loading && (stats?.revenueByBuyer?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Revenue by Buyer
              <span className="text-sm font-normal text-muted-foreground">({selectedLabel})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Buyer</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Revenue</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Payout</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Margin</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Conversions</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Avg Rev/Call</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.revenueByBuyer ?? []).map((row: RevenueBreakdownRow) => {
                    const margin = row.revenue - row.payout
                    const avgRev = row.conversions > 0 ? row.revenue / row.conversions : 0
                    return (
                      <tr key={row.name} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-medium">{row.name}</td>
                        <td className="py-3 text-right font-mono text-sm text-emerald-600 font-medium">${formatMoney(row.revenue)}</td>
                        <td className="py-3 text-right font-mono text-sm text-blue-600">${formatMoney(row.payout)}</td>
                        <td className="py-3 text-right font-mono text-sm">
                          <span className={margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>${formatMoney(margin)}</span>
                        </td>
                        <td className="py-3 text-right">{row.conversions}</td>
                        <td className="py-3 text-right font-mono text-sm text-muted-foreground">${formatMoney(avgRev)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="pt-3">Total</td>
                    <td className="pt-3 text-right font-mono text-emerald-600">${formatMoney(stats?.revenue ?? 0)}</td>
                    <td className="pt-3 text-right font-mono text-blue-600">${formatMoney(stats?.payout ?? 0)}</td>
                    <td className="pt-3 text-right font-mono">
                      <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>${formatMoney(profit)}</span>
                    </td>
                    <td className="pt-3 text-right">{stats?.revenueConversions ?? 0}</td>
                    <td className="pt-3 text-right font-mono text-muted-foreground">
                      ${formatMoney((stats?.revenueConversions ?? 0) > 0 ? (stats?.revenue ?? 0) / (stats?.revenueConversions ?? 1) : 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Recent Flags
            {!loading && <span className="text-sm font-normal text-muted-foreground">({selectedLabel})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
              ))}
            </div>
          ) : (stats?.recentFlags?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No flags in this time period</p>
          ) : (
            <div className="space-y-3">
              {(stats?.recentFlags ?? []).map((flag: RecentFlag) => (
                <div key={flag?.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn('text-xs', severityColors?.[flag?.severity] ?? '')}>
                      {flag?.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{flag?.flag_type?.replace?.(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        Call: {flag?.call_id} | Campaign: {flag?.campaign}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {flag?.created_at ? new Date(flag.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">{flag?.duration ?? 0}s</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
