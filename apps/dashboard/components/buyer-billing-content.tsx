'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Calendar,
  Loader2,
  Receipt,
  Building2,
  Check,
  Save,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BuyerOption {
  td_buyer_id: string
  user_buyer_id: string | null
  name: string
  email: string | null
  number: string | null
  paused: boolean | null
  lastCallAt: string | null
}

interface BuyerBillingContact {
  id: string
  td_buyer_id: string
  email: string
  label: string | null
  is_default: boolean
}

interface CallDetail {
  id: number
  date: string
  callerNumber: string
  city: string
  duration: number
  revenue: number
}

interface CampaignBreakdown {
  campaign: string
  offerId: number
  calls: number
  revenue: number
  avgDuration: number
  avgRevenue: number
  callDetails: CallDetail[]
}

interface BuyerReport {
  buyerIds: string[]
  periodStart: string
  periodEnd: string
  totalCalls: number
  totalRevenue: number
  campaignBreakdown: CampaignBreakdown[]
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

// Same bi-weekly quick presets as vendor billing (UTC-anchored)
function getBillingPeriods() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const currentDay = now.getUTCDate()

  const periodsToGenerate: { year: number; month: number; half: 'first' | 'second' }[] = []

  if (currentDay <= 15) {
    periodsToGenerate.push({ year: y, month: m, half: 'first' })
    let pm = m - 1
    let py = y
    if (pm < 0) { pm = 11; py-- }
    periodsToGenerate.push({ year: py, month: pm, half: 'second' })
    periodsToGenerate.push({ year: py, month: pm, half: 'first' })
    let pm2 = pm - 1
    let py2 = py
    if (pm2 < 0) { pm2 = 11; py2-- }
    periodsToGenerate.push({ year: py2, month: pm2, half: 'second' })
  } else {
    periodsToGenerate.push({ year: y, month: m, half: 'second' })
    periodsToGenerate.push({ year: y, month: m, half: 'first' })
    let pm = m - 1
    let py = y
    if (pm < 0) { pm = 11; py-- }
    periodsToGenerate.push({ year: py, month: pm, half: 'second' })
    periodsToGenerate.push({ year: py, month: pm, half: 'first' })
  }

  return periodsToGenerate.map((p) => {
    const monthName = new Date(Date.UTC(p.year, p.month, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    const lastDay = new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate()
    if (p.half === 'first') {
      return {
        label: `${monthName} 1-15, ${p.year}`,
        start: `${p.year}-${String(p.month + 1).padStart(2, '0')}-01`,
        end: `${p.year}-${String(p.month + 1).padStart(2, '0')}-15`,
      }
    }
    return {
      label: `${monthName} 16-${lastDay}, ${p.year}`,
      start: `${p.year}-${String(p.month + 1).padStart(2, '0')}-16`,
      end: `${p.year}-${String(p.month + 1).padStart(2, '0')}-${lastDay}`,
    }
  })
}

export function BuyerBillingContent() {
  const [buyers, setBuyers] = useState<BuyerOption[]>([])
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [selectedBuyers, setSelectedBuyers] = useState<BuyerOption[]>([])
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false)
  const [invoiceToName, setInvoiceToName] = useState('')
  const [periodStart, setPeriodStart] = useState(() => getBillingPeriods()[0].start)
  const [periodEnd, setPeriodEnd] = useState(() => getBillingPeriods()[0].end)
  const [report, setReport] = useState<BuyerReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailOverride, setEmailOverride] = useState('')
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [billingContacts, setBillingContacts] = useState<BuyerBillingContact[]>([])
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    fetch('/api/billing?action=buyers')
      .then((r) => r.json())
      .then((data) => {
        setBuyers(data.buyers || [])
        setLoadingBuyers(false)
      })
      .catch(() => setLoadingBuyers(false))
  }, [])

  // Fetch saved billing contacts for the currently-selected buyers
  useEffect(() => {
    if (selectedBuyers.length === 0) {
      setBillingContacts([])
      return
    }
    const ids = selectedBuyers.map((b) => b.td_buyer_id).join(',')
    fetch(`/api/billing/buyer-contacts?buyerIds=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((data) => setBillingContacts(data.contacts || []))
      .catch(() => setBillingContacts([]))
  }, [selectedBuyers])

  const generateReport = useCallback(() => {
    if (selectedBuyers.length === 0 || !periodStart || !periodEnd) return
    setLoadingReport(true)
    setReport(null)
    setExpandedCampaigns(new Set())

    const params = new URLSearchParams({
      periodStart,
      periodEnd,
      buyerIds: selectedBuyers.map((b) => b.td_buyer_id).join(','),
    })
    fetch(`/api/billing/buyer-report?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error)
        } else {
          setReport(data)
        }
        setLoadingReport(false)
      })
      .catch(() => {
        toast.error('Failed to generate invoice report')
        setLoadingReport(false)
      })
  }, [selectedBuyers, periodStart, periodEnd])

  const toggleBuyer = (buyer: BuyerOption) => {
    setSelectedBuyers((prev) => {
      const exists = prev.some((b) => b.td_buyer_id === buyer.td_buyer_id)
      if (exists) return prev.filter((b) => b.td_buyer_id !== buyer.td_buyer_id)
      return [...prev, buyer]
    })
  }

  const selectAllBuyers = () => {
    setSelectedBuyers((prev) => (prev.length === buyers.length ? [] : [...buyers]))
  }

  const toggleCampaign = (campaign: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev)
      if (next.has(campaign)) next.delete(campaign)
      else next.add(campaign)
      return next
    })
  }

  const expandAll = () => {
    if (!report) return
    if (expandedCampaigns.size === report.campaignBreakdown.length) {
      setExpandedCampaigns(new Set())
    } else {
      setExpandedCampaigns(new Set(report.campaignBreakdown.map((c) => c.campaign)))
    }
  }

  const handleEmailInvoice = () => {
    if (!report || selectedBuyers.length === 0) return
    // Prefill from saved default contacts; otherwise the first selected buyer with an email
    const defaults = billingContacts.filter((c) => c.is_default).map((c) => c.email)
    const firstWithEmail = selectedBuyers.find((b) => b.email)
    const prefill = defaults.length > 0 ? defaults.join(', ') : (firstWithEmail?.email || '')
    setEmailOverride(prefill)
    setInvoiceToName(defaultInvoiceName)
    setShowEmailConfirm(true)
  }

  // Add an email to the recipients field (from a saved contact chip)
  const addRecipient = (email: string) => {
    setEmailOverride((prev) => {
      const list = prev.split(/[,;]/).map((e) => e.trim()).filter(Boolean)
      if (list.includes(email)) return prev
      return [...list, email].join(', ')
    })
  }

  // Persist the currently-typed recipient email(s) as saved contacts for every selected buyer
  const saveTypedRecipients = async () => {
    if (selectedBuyers.length === 0) {
      toast.error('Select at least one buyer first')
      return
    }
    const list = emailOverride.split(/[,;]/).map((e) => e.trim()).filter(Boolean)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const valid = list.filter((e) => emailRegex.test(e))
    if (valid.length === 0) {
      toast.error('Enter at least one valid email to save')
      return
    }
    setSavingContact(true)
    try {
      const results = await Promise.all(
        selectedBuyers.flatMap((b) =>
          valid.map((email) =>
            fetch('/api/billing/buyer-contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ buyerId: b.td_buyer_id, email }),
            }).then((r) => r.json())
          )
        )
      )
      const saved = results.filter((d) => d.contact).map((d) => d.contact as BuyerBillingContact)
      setBillingContacts((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]))
        saved.forEach((c) => map.set(c.id, c))
        return Array.from(map.values())
      })
      const uniqueEmails = new Set(saved.map((c) => c.email)).size
      toast.success(`Saved ${uniqueEmails} email${uniqueEmails !== 1 ? 's' : ''} for next time`)
    } catch {
      toast.error('Failed to save contacts')
    } finally {
      setSavingContact(false)
    }
  }

  // Remove a saved billing contact (removes it for all currently-selected buyers)
  const removeContact = async (email: string) => {
    const ids = billingContacts.filter((c) => c.email === email).map((c) => c.id)
    if (ids.length === 0) return
    try {
      await Promise.all(
        ids.map((id) => fetch(`/api/billing/buyer-contacts?contactId=${id}`, { method: 'DELETE' }))
      )
      setBillingContacts((prev) => prev.filter((c) => c.email !== email))
    } catch {
      toast.error('Failed to remove contact')
    }
  }

  const sendEmailInvoice = async () => {
    if (!report || selectedBuyers.length === 0) return
    const recipientEmail = emailOverride.trim().replace(/[,;]\s*$/, '')
    const recipientList = recipientEmail
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
    if (recipientList.length === 0) {
      toast.error('Please enter at least one recipient email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const badEmails = recipientList.filter((e) => !emailRegex.test(e))
    if (badEmails.length > 0) {
      toast.error(`Invalid email address${badEmails.length > 1 ? 'es' : ''}: ${badEmails.join(', ')}`)
      return
    }
    setSendingEmail(true)
    setShowEmailConfirm(false)
    try {
      const res = await fetch('/api/billing/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: invoiceToName.trim() || defaultInvoiceName,
          buyerEmail: recipientList.join(','),
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          totalCalls: report.totalCalls,
          totalRevenue: report.totalRevenue,
          campaignBreakdown: report.campaignBreakdown,
        }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(
          data.message ||
            `Invoice sent to ${recipientList.length === 1 ? recipientList[0] : `${recipientList.length} recipients`}`
        )
      }
    } catch {
      toast.error('Failed to send invoice')
    } finally {
      setSendingEmail(false)
    }
  }

  const exportCSV = () => {
    if (!report || selectedBuyers.length === 0) return
    const rows: string[][] = []
    rows.push(['Date', 'Campaign', 'Caller ID', 'City', 'Duration (sec)', 'Amount Due'])
    for (const c of report.campaignBreakdown) {
      for (const call of c.callDetails) {
        rows.push([
          formatDateTime(call.date),
          c.campaign,
          call.callerNumber,
          call.city,
          String(call.duration),
          call.revenue.toFixed(2),
        ])
      }
    }
    rows.push([])
    rows.push(['', '', '', '', 'TOTAL', report.totalRevenue.toFixed(2)])

    const escapeCell = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }
    const csv = rows.map((r) => r.map(escapeCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = defaultInvoiceName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
    a.href = url
    a.download = `Invoice_${safeName}_${report.periodStart}_to_${report.periodEnd}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const periodLabel = periodStart && periodEnd ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}` : ''

  // Label + default invoice name based on the selected buyer(s)
  const buyersLabel =
    selectedBuyers.length === 0
      ? 'Select buyer(s)'
      : selectedBuyers.length === 1
      ? selectedBuyers[0].name
      : `${selectedBuyers.length} buyers selected`
  const defaultInvoiceName =
    selectedBuyers.length === 0
      ? ''
      : selectedBuyers.length <= 2
      ? selectedBuyers.map((b) => b.name).join(', ')
      : `${selectedBuyers[0].name} + ${selectedBuyers.length - 1} more`

  const applyQuickRange = (start: string, end: string) => {
    setPeriodStart(start)
    setPeriodEnd(end)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            {/* Buyer selector (multi-select) */}
            <div className="flex-1 min-w-[250px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Buyer(s)</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-between text-sm h-10"
                  onClick={() => setBuyerDropdownOpen(!buyerDropdownOpen)}
                  disabled={loadingBuyers}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    {loadingBuyers ? 'Loading buyers...' : buyersLabel}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', buyerDropdownOpen && 'rotate-180')} />
                </Button>
                {buyerDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBuyerDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg border bg-white shadow-lg py-1 max-h-[320px] overflow-y-auto">
                      {buyers.length === 0 && (
                        <div className="px-4 py-3 text-sm text-muted-foreground">No buyers found</div>
                      )}
                      {buyers.length > 0 && (
                        <button
                          className="w-full text-left px-4 py-2 text-xs font-medium text-primary border-b hover:bg-muted/50 transition-colors"
                          onClick={selectAllBuyers}
                        >
                          {selectedBuyers.length === buyers.length ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                      {buyers.map((b) => {
                        const checked = selectedBuyers.some((s) => s.td_buyer_id === b.td_buyer_id)
                        return (
                          <button
                            key={b.td_buyer_id}
                            className={cn(
                              'w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-start gap-2.5',
                              checked && 'bg-primary/5'
                            )}
                            onClick={() => toggleBuyer(b)}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                checked ? 'bg-primary border-primary text-white' : 'border-muted-foreground/40'
                              )}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{b.name}</span>
                                {b.paused && <span className="text-xs text-amber-600">(paused)</span>}
                              </span>
                              {b.email && <span className="block text-xs text-muted-foreground truncate">{b.email}</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Custom date range selector */}
            <div className="min-w-[240px]">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Invoice Period</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    aria-label="Start date"
                    value={periodStart}
                    max={periodEnd || undefined}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full h-10 rounded-lg border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <span className="text-muted-foreground text-sm">to</span>
                <div className="relative flex-1">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    aria-label="End date"
                    value={periodEnd}
                    min={periodStart || undefined}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full h-10 rounded-lg border bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {getBillingPeriods().slice(0, 4).map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyQuickRange(p.start, p.end)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-md border transition-colors hover:bg-muted/50',
                      periodStart === p.start && periodEnd === p.end
                        ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={generateReport}
              disabled={selectedBuyers.length === 0 || !periodStart || !periodEnd || loadingReport}
              className="h-10"
            >
              {loadingReport ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Receipt className="h-4 w-4 mr-2" /> Generate Invoice</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Due</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1 text-emerald-600">${formatMoney(report.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Amount owed by buyer</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Converted Calls</p>
                <p className="text-2xl font-semibold font-display tracking-tight mt-1">{report.totalCalls}</p>
                <p className="text-xs text-muted-foreground mt-1">Across {report.campaignBreakdown.length} campaign{report.campaignBreakdown.length !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Period</p>
                <p className="text-lg font-semibold font-display tracking-tight mt-1">{periodLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">{defaultInvoiceName}</p>
              </CardContent>
            </Card>
          </div>

          {/* Campaign Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Amount Due by Campaign
                  <span className="text-sm font-normal text-muted-foreground">
                    {defaultInvoiceName} · {periodLabel}
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  {expandedCampaigns.size === report.campaignBreakdown.length ? 'Collapse All' : 'Expand All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.campaignBreakdown.map((c) => (
                  <div key={c.campaign} className="border rounded-lg">
                    {/* Campaign Summary Row */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleCampaign(c.campaign)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedCampaigns.has(c.campaign) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <span className="font-medium">{c.campaign}</span>
                          <span className="text-sm text-muted-foreground ml-2">{c.calls} call{c.calls !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-muted-foreground">Avg Duration:</span>{' '}
                          <span className="font-mono">{formatDuration(c.avgDuration)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">Avg Amount:</span>{' '}
                          <span className="font-mono">${formatMoney(c.avgRevenue)}</span>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <span className="font-semibold font-mono text-emerald-600">${formatMoney(c.revenue)}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Call Details — NO vendor info, only Date / Caller ID / Amount */}
                    {expandedCampaigns.has(c.campaign) && (
                      <div className="border-t px-4 py-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Date</th>
                              <th className="pb-2 font-medium">Caller ID</th>
                              <th className="pb-2 font-medium">City</th>
                              <th className="pb-2 font-medium text-right">Duration</th>
                              <th className="pb-2 font-medium text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.callDetails.map((call) => (
                              <tr key={call.id} className="border-t border-dashed hover:bg-muted/30">
                                <td className="py-1.5 font-mono text-xs">{formatDateTime(call.date)}</td>
                                <td className="py-1.5 font-mono text-xs">{call.callerNumber}</td>
                                <td className="py-1.5 text-xs">{call.city}</td>
                                <td className="py-1.5 text-right font-mono text-xs">{formatDuration(call.duration)}</td>
                                <td className="py-1.5 text-right font-mono text-xs font-medium text-emerald-600">${formatMoney(call.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total Row */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg font-semibold">
                  <span>Total ({report.totalCalls} calls)</span>
                  <span className="font-mono text-emerald-600 text-lg">${formatMoney(report.totalRevenue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buyer Invoice Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Buyer Invoice</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invoice for <span className="font-medium text-foreground">{defaultInvoiceName}</span> covering converted calls in {periodLabel}.
                    Total due: <span className="font-semibold text-foreground">${formatMoney(report.totalRevenue)}</span>.
                    {selectedBuyers.length > 1 && <span className="block mt-1 text-xs">Combined across {selectedBuyers.length} buyer records.</span>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={exportCSV}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                  <Button size="sm" onClick={handleEmailInvoice} disabled={sendingEmail}>
                    {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    {sendingEmail ? 'Sending...' : 'Email Invoice'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Email Confirmation Dialog */}
      {showEmailConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEmailConfirm(false)}>
          <div className="bg-background rounded-xl shadow-xl border p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Send Invoice</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Send a detailed invoice for the selected buyer(s) ({periodLabel}).
            </p>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Invoice to (name shown on invoice)</label>
            <input
              type="text"
              value={invoiceToName}
              onChange={(e) => setInvoiceToName(e.target.value)}
              placeholder="Buyer / company name"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-background mb-3"
            />
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Recipient email(s)</label>
            <input
              type="text"
              value={emailOverride}
              onChange={(e) => setEmailOverride(e.target.value)}
              placeholder="buyer@email.com, accounting@email.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">Send to multiple people by separating emails with a comma.</p>
            <div className="mt-3">
              {billingContacts.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Saved contacts (click to add)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Map(billingContacts.map((c) => [c.email, c])).values()).map((c) => (
                      <span key={c.email} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 pl-2.5 pr-1 py-1 text-xs">
                        <button type="button" className="hover:text-primary" onClick={() => addRecipient(c.email)}>{c.email}</button>
                        <button type="button" className="rounded-full hover:bg-muted p-0.5" onClick={() => removeContact(c.email)} title="Remove saved contact">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={saveTypedRecipients} disabled={savingContact} className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                <Save className="h-3 w-3" /> Save these email(s) for next time
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total due: <strong className="text-emerald-600">${report ? formatMoney(report.totalRevenue) : '0.00'}</strong> · {report ? report.totalCalls : 0} calls
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => setShowEmailConfirm(false)}>Cancel</Button>
              <Button size="sm" onClick={sendEmailInvoice}>
                <Mail className="h-4 w-4 mr-2" /> Send Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !loadingReport && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Generate a Buyer Invoice</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Select a buyer and invoice period above to generate a detailed invoice.
              Invoices show all converted calls grouped by campaign with amount due per call.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
