'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Eye, ChevronLeft, ChevronRight, CheckCircle, Clock, XCircle, FileText, Download, Loader2, PenLine, Ban } from 'lucide-react'
import { InsertionOrder, LeadPurchaseAgreement } from '@/lib/types'
import { AddCampaignDialog } from '@/components/add-campaign-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ioStatusColors: Record<string, string> = {
  pending_vendor: 'bg-yellow-100 text-yellow-800',
  pending_counter: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  terminated: 'bg-red-100 text-red-800',
  voided: 'bg-gray-100 text-gray-600',
}

const ioStatusLabels: Record<string, string> = {
  pending_vendor: 'Pending Vendor',
  pending_counter: 'Pending Counter',
  active: 'Active',
  terminated: 'Terminated',
  voided: 'Voided',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <CheckCircle className="h-3.5 w-3.5 text-green-600" />
  if (status === 'terminated') return <XCircle className="h-3.5 w-3.5 text-red-500" />
  if (status === 'pending_counter') return <PenLine className="h-3.5 w-3.5 text-blue-500" />
  return <Clock className="h-3.5 w-3.5 text-yellow-600" />
}

export function IOContent() {
  const [orders, setOrders] = useState<InsertionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [viewIO, setViewIO] = useState<InsertionOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [countersigning, setCountersigning] = useState(false)
  const [voiding, setVoiding] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      const res = await fetch(`/api/insertion-orders?${params.toString()}`)
      const data = await res.json()
      setOrders(data?.orders ?? [])
      setTotalPages(data?.pages ?? 1)
    } catch {
      toast.error('Failed to load insertion orders')
    }
    setLoading(false)
  }, [search, statusFilter, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const viewDetails = async (io: InsertionOrder) => {
    setViewIO(io)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/insertion-orders/${io.id}`)
      const data = await res.json()
      setDetail(data)
    } catch {
      toast.error('Failed to load IO details')
    }
    setDetailLoading(false)
  }

  const downloadAgreement = (agreementId: string) => {
    const a = document.createElement('a')
    a.href = `/api/agreements/${agreementId}/download`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const countersignAgreement = async (agreementId: string) => {
    if (!confirm('Are you sure you want to countersign this Lead Purchase Agreement?')) return
    setCountersigning(true)
    try {
      const res = await fetch(`/api/agreements/${agreementId}/countersign`, { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('Agreement countersigned successfully')
        // Refresh detail
        if (viewIO) viewDetails(viewIO)
        fetchOrders()
      }
    } catch {
      toast.error('Failed to countersign agreement')
    }
    setCountersigning(false)
  }

  const voidIO = async (ioId: string, ioNumber: string) => {
    if (!confirm(`Are you sure you want to cancel ${ioNumber}? This will void the IO and any pending agreements attached to it. This cannot be undone.`)) return
    setVoiding(true)
    try {
      const res = await fetch(`/api/insertion-orders/${ioId}/void`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        toast.error(data?.error || 'Failed to void insertion order.')
      } else {
        const msg = data?.voided_agreements
          ? `${ioNumber} voided (${data.voided_agreements} pending agreement${data.voided_agreements > 1 ? 's' : ''} also voided)`
          : `${ioNumber} voided`
        toast.success(msg)
        setViewIO(null); setDetail(null)
        fetchOrders()
      }
    } catch {
      toast.error('Failed to void insertion order.')
    }
    setVoiding(false)
  }

  const getLpa = (io: InsertionOrder): LeadPurchaseAgreement | null => {
    return io.lead_purchase_agreements?.[0] ?? null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insertion Orders"
        description="View and manage insertion orders and lead purchase agreements"
        actions={<AddCampaignDialog onSuccess={fetchOrders} />}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by IO number or vendor..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1) }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_vendor">Pending Vendor</SelectItem>
            <SelectItem value="pending_counter">Pending Counter</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>IO Status</TableHead>
                <TableHead>LPA Status</TableHead>
                <TableHead>Vendor Signed</TableHead>
                <TableHead>Counter Signed</TableHead>
                <TableHead className="w-[60px]">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_: any, i: number) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__: any, j: number) => (
                      <TableCell key={j}><div className="h-4 animate-pulse bg-muted rounded w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (orders?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No insertion orders found</TableCell>
                </TableRow>
              ) : (
                (orders ?? []).map((io: InsertionOrder) => {
                  const lpa = getLpa(io)
                  return (
                    <TableRow key={io?.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{io?.io_number}</TableCell>
                      <TableCell>{io?.vendor?.company_name ?? '—'}</TableCell>
                      <TableCell>{io?.campaign?.name ?? '—'}</TableCell>
                      <TableCell>${io?.payout} / {io?.payout_type?.replace?.(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', ioStatusColors?.[io?.status] ?? '')}>
                          {ioStatusLabels?.[io?.status] ?? io?.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lpa ? (
                          <Badge variant="outline" className={cn('text-xs', ioStatusColors?.[lpa.status] ?? '')}>
                            {ioStatusLabels?.[lpa.status] ?? lpa.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {io?.vendor_signed_at ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3" />
                            {new Date(io.vendor_signed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {io?.counter_signed_at ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3" />
                            {new Date(io.counter_signed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => viewDetails(io)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!viewIO} onOpenChange={(open: boolean) => { if (!open) { setViewIO(null); setDetail(null) } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>IO Details: {viewIO?.io_number}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : detail ? (
            <div className="space-y-5">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{detail?.vendor?.company_name ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Campaign:</span> <span className="font-medium">{detail?.campaign?.name ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Payout:</span> <span className="font-medium">${detail?.payout} / {detail?.payout_type?.replace?.(/_/g, ' ')}</span></div>
                <div><span className="text-muted-foreground">Billing:</span> <span className="font-medium capitalize">{detail?.billing_cycle}</span></div>
                <div><span className="text-muted-foreground">Min Duration:</span> <span className="font-medium">{detail?.min_duration ? `${detail.min_duration}s` : 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={cn('text-xs', ioStatusColors?.[detail?.status] ?? '')}>{ioStatusLabels?.[detail?.status] ?? detail?.status}</Badge></div>
                <div><span className="text-muted-foreground">Effective:</span> <span className="font-medium">{detail?.effective_date ? new Date(detail.effective_date).toLocaleDateString() : 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Expiry:</span> <span className="font-medium">{detail?.expiry_date ? new Date(detail.expiry_date).toLocaleDateString() : 'N/A'}</span></div>
              </div>

              {/* Documents Side by Side */}
              <div className="border-t pt-5">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-600" /> Documents
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* IO Document Card */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Insertion Order</p>
                      <Badge variant="outline" className={cn('text-xs', ioStatusColors?.[detail?.status] ?? '')}>
                        {ioStatusLabels?.[detail?.status] ?? detail?.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{detail?.io_number}</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={detail?.vendor_signed_at ? 'active' : 'pending_vendor'} />
                        <span className={detail?.vendor_signed_at ? 'text-green-700' : 'text-muted-foreground'}>
                          Vendor: {detail?.vendor_signed_at ? `${detail?.vendor_sign_name} · ${new Date(detail.vendor_signed_at).toLocaleDateString()}` : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={detail?.counter_signed_at ? 'active' : 'pending_vendor'} />
                        <span className={detail?.counter_signed_at ? 'text-green-700' : 'text-muted-foreground'}>
                          Counter: {detail?.counter_signed_at ? `${detail?.counter_sign_by} · ${new Date(detail.counter_signed_at).toLocaleDateString()}` : 'Pending'}
                        </span>
                      </div>
                    </div>
                    {/* IO doesn't have an external download endpoint — terms are in-DB */}
                  </div>

                  {/* LPA Document Card */}
                  {(() => {
                    const lpa = detail?.lead_purchase_agreements?.[0]
                    return (
                      <div className={cn('rounded-lg border p-4 space-y-3', !lpa && 'opacity-60')}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Lead Purchase Agreement</p>
                          {lpa ? (
                            <Badge variant="outline" className={cn('text-xs', ioStatusColors?.[lpa.status] ?? '')}>
                              {ioStatusLabels?.[lpa.status] ?? lpa.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Not Created</Badge>
                          )}
                        </div>
                        {lpa ? (
                          <>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center gap-1.5">
                                <StatusIcon status={lpa.vendor_signed_at ? 'active' : 'pending_vendor'} />
                                <span className={lpa.vendor_signed_at ? 'text-green-700' : 'text-muted-foreground'}>
                                  Vendor: {lpa.vendor_signed_at ? `${lpa.vendor_sign_name} · ${new Date(lpa.vendor_signed_at).toLocaleDateString()}` : 'Pending'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon status={lpa.counter_signed_at ? 'active' : 'pending_vendor'} />
                                <span className={lpa.counter_signed_at ? 'text-green-700' : 'text-muted-foreground'}>
                                  Counter: {lpa.counter_signed_at ? `${lpa.counter_sign_by} · ${new Date(lpa.counter_signed_at).toLocaleDateString()}` : 'Pending'}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              {(lpa.status === 'active' || lpa.vendor_signed_at) && (
                                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => downloadAgreement(lpa.id)}>
                                  <Download className="h-3 w-3 mr-1.5" /> Download
                                </Button>
                              )}
                              {lpa.status === 'pending_counter' && (
                                <Button size="sm" className="text-xs h-7" onClick={() => countersignAgreement(lpa.id)} disabled={countersigning}>
                                  {countersigning ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <PenLine className="h-3 w-3 mr-1.5" />}
                                  Countersign
                                </Button>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">No Lead Purchase Agreement has been created for this IO yet.</p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* IO Signature Status (legacy detail) */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">IO Signature Status</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Vendor Signature</p>
                    {detail?.vendor_signed_at ? (
                      <div className="mt-1">
                        <p className="font-medium text-green-600">Signed by {detail?.vendor_sign_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(detail.vendor_signed_at).toLocaleString()}</p>
                      </div>
                    ) : <p className="mt-1 text-yellow-600">Pending</p>}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Counter Signature</p>
                    {detail?.counter_signed_at ? (
                      <div className="mt-1">
                        <p className="font-medium text-green-600">Signed by {detail?.counter_sign_by}</p>
                        <p className="text-xs text-muted-foreground">{new Date(detail.counter_signed_at).toLocaleString()}</p>
                      </div>
                    ) : <p className="mt-1 text-yellow-600">Pending</p>}
                  </div>
                </div>
              </div>

              {detail?.terms && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Terms</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">{detail.terms}</pre>
                </div>
              )}
              {detail?.special_terms && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Special Terms</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap">{detail.special_terms}</pre>
                </div>
              )}

              {/* Cancel IO action — only for pending IOs */}
              {(detail?.status === 'pending_vendor' || detail?.status === 'pending_counter') && (
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    disabled={voiding}
                    onClick={() => voidIO(detail.id, detail.io_number)}
                  >
                    {voiding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    Cancel This IO
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">Voids this IO and any pending agreements attached to it. Sign links will be invalidated.</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
