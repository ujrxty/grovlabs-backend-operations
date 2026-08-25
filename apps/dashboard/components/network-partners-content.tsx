'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Plus, RefreshCw, Search, Building2, FileText, ArrowLeftRight,
  ChevronDown, ChevronRight, Send, CheckCircle, Clock, ExternalLink,
  Inbox, Check, X,
} from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface NetworkPartner {
  id: string
  legal_name: string
  organized_in?: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address_line1?: string
  address_line2?: string
  can_buy: boolean
  can_sell: boolean
  status: string
  notes?: string
  created_at: string
  network_ios?: NetworkIO[]
}

interface NetworkIO {
  id: string
  io_number: string
  grovlabs_role: 'buyer' | 'seller'
  industry?: string
  lead_type?: string
  geo?: string
  payment_terms?: string
  compensation_type?: string
  compensation_amount?: number
  status: string
  created_at: string
  network_signed_at?: string
  counter_signed_at?: string
}

interface N2NApplication {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  organized_in?: string
  website?: string
  wants_to_buy: boolean
  wants_to_sell: boolean
  verticals?: string
  estimated_volume?: string
  traffic_sources?: string
  current_partners?: string
  comments?: string
  status: string
  created_at: string
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' },
  inactive: { label: 'Inactive', cls: 'bg-slate-500/10 text-slate-500 dark:bg-slate-500/20' },
  pending_network: { label: 'Pending Signature', cls: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' },
  pending_counter: { label: 'Pending Countersign', cls: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20' },
}

const roleBadge: Record<string, { label: string; cls: string }> = {
  buyer: { label: 'GrovLabs Buys', cls: 'bg-purple-500/10 text-purple-500 dark:bg-purple-500/20' },
  seller: { label: 'GrovLabs Sells', cls: 'bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20' },
}

export function NetworkPartnersContent() {
  const [partners, setPartners] = useState<NetworkPartner[]>([])
  const [applications, setApplications] = useState<N2NApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingApps, setLoadingApps] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [showAddIO, setShowAddIO] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<NetworkPartner | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('partners')

  const [partnerForm, setPartnerForm] = useState({
    legal_name: '',
    organized_in: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    address_line1: '',
    address_line2: '',
    can_buy: false,
    can_sell: false,
    notes: '',
  })

  const [ioForm, setIOForm] = useState({
    grovlabs_role: 'buyer' as 'buyer' | 'seller',
    industry: '',
    lead_type: '',
    geo: '',
    daily_cap: '',
    concurrency: '',
    payment_terms: '',
    compensation_type: '',
    compensation_amount: '',
    minimum_duration: '',
    hours_of_operation: '',
    payout_threshold: '',
    other_terms: '',
  })

  const fetchPartners = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/partners`)
      if (res.ok) {
        const data = await res.json()
        setPartners(data)
      }
    } catch (e) {
      console.error('Failed to fetch partners:', e)
    }
    setLoading(false)
  }, [])

  const fetchApplications = useCallback(async () => {
    setLoadingApps(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/applications`)
      if (res.ok) {
        const data = await res.json()
        setApplications(data)
      }
    } catch (e) {
      console.error('Failed to fetch applications:', e)
    }
    setLoadingApps(false)
  }, [])

  useEffect(() => {
    fetchPartners()
    fetchApplications()
  }, [fetchPartners, fetchApplications])

  const filtered = partners.filter(p =>
    p.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_email.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddPartner = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partnerForm),
      })
      if (res.ok) {
        setShowAddPartner(false)
        setPartnerForm({
          legal_name: '', organized_in: '', contact_name: '', contact_phone: '',
          contact_email: '', address_line1: '', address_line2: '',
          can_buy: false, can_sell: false, notes: '',
        })
        fetchPartners()
      }
    } catch (e) {
      console.error('Failed to add partner:', e)
    }
    setSubmitting(false)
  }

  const handleAddIO = async () => {
    if (!selectedPartner) return
    setSubmitting(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/ios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_id: selectedPartner.id,
          ...ioForm,
          compensation_amount: ioForm.compensation_amount ? parseFloat(ioForm.compensation_amount) : undefined,
          minimum_duration: ioForm.minimum_duration ? parseInt(ioForm.minimum_duration) : undefined,
          payout_threshold: ioForm.payout_threshold ? parseFloat(ioForm.payout_threshold) : undefined,
        }),
      })
      if (res.ok) {
        setShowAddIO(false)
        setIOForm({
          grovlabs_role: 'buyer', industry: '', lead_type: '', geo: '',
          daily_cap: '', concurrency: '', payment_terms: '', compensation_type: '',
          compensation_amount: '', minimum_duration: '', hours_of_operation: '',
          payout_threshold: '', other_terms: '',
        })
        fetchPartners()
      }
    } catch (e) {
      console.error('Failed to add IO:', e)
    }
    setSubmitting(false)
  }

  const handleSendSignRequest = async (ioId: string) => {
    try {
      await fetch(`${QA_AGENT_URL}/n2n/ios/${ioId}/send-sign-request`, { method: 'POST' })
      fetchPartners()
    } catch (e) {
      console.error('Failed to send sign request:', e)
    }
  }

  const handleCountersign = async (ioId: string) => {
    try {
      await fetch(`${QA_AGENT_URL}/n2n/ios/${ioId}/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_name: 'Usman Javed', sign_title: 'CEO' }),
      })
      fetchPartners()
    } catch (e) {
      console.error('Failed to countersign:', e)
    }
  }

  const handleApproveApp = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: 'Dashboard' }),
      })
      if (res.ok) {
        fetchApplications()
        fetchPartners()
      }
    } catch (e) {
      console.error('Failed to approve:', e)
    }
    setSubmitting(false)
  }

  const handleRejectApp = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/n2n/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: 'Dashboard' }),
      })
      if (res.ok) {
        fetchApplications()
      }
    } catch (e) {
      console.error('Failed to reject:', e)
    }
    setSubmitting(false)
  }

  const pendingApps = applications.filter(a => a.status === 'pending')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network Partners"
        description="Manage N2N partners who both buy and sell leads/calls"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="partners" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Partners ({partners.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Applications
            {pendingApps.length > 0 && (
              <Badge className="ml-1 bg-amber-500/10 text-amber-500">{pendingApps.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loadingApps}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loadingApps && 'animate-spin')} />
              Refresh
            </Button>
          </div>
          {loadingApps ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : applications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No applications yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const isPending = app.status === 'pending'
                return (
                  <Card key={app.id} className={cn(!isPending && 'opacity-60')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{app.company_name}</span>
                            <Badge className={cn(
                              app.status === 'pending' && 'bg-amber-500/10 text-amber-500',
                              app.status === 'approved' && 'bg-emerald-500/10 text-emerald-500',
                              app.status === 'rejected' && 'bg-red-500/10 text-red-500'
                            )}>
                              {app.status}
                            </Badge>
                            {app.wants_to_buy && <Badge variant="outline">Wants to Buy</Badge>}
                            {app.wants_to_sell && <Badge variant="outline">Wants to Sell</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {app.contact_name} &middot; {app.contact_email} &middot; {app.contact_phone}
                          </p>
                          {app.verticals && (
                            <p className="text-sm text-muted-foreground">Verticals: {app.verticals}</p>
                          )}
                          {app.estimated_volume && (
                            <p className="text-sm text-muted-foreground">Volume: {app.estimated_volume}</p>
                          )}
                          {app.comments && (
                            <p className="text-sm text-muted-foreground">Notes: {app.comments}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Submitted: {new Date(app.created_at).toLocaleString()}
                          </p>
                        </div>
                        {isPending && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => handleRejectApp(app.id)}
                              disabled={submitting}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveApp(app.id)}
                              disabled={submitting}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="partners" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchPartners} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowAddPartner(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No network partners found
            </CardContent>
          </Card>
        ) : (
          filtered.map((partner) => {
            const isExpanded = expanded[partner.id]
            const badge = statusBadge[partner.status] || statusBadge.inactive
            return (
              <Card key={partner.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [partner.id]: !prev[partner.id] }))}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{partner.legal_name}</span>
                      <Badge className={badge.cls}>{badge.label}</Badge>
                      {partner.can_buy && (
                        <Badge variant="outline" className="text-xs">Can Buy</Badge>
                      )}
                      {partner.can_sell && (
                        <Badge variant="outline" className="text-xs">Can Sell</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {partner.contact_name} &middot; {partner.contact_email}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {partner.network_ios?.length || 0} IOs
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Insertion Orders
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPartner(partner)
                          setShowAddIO(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New IO
                      </Button>
                    </div>

                    {partner.network_ios && partner.network_ios.length > 0 ? (
                      <div className="space-y-2">
                        {partner.network_ios.map((io) => {
                          const ioBadge = statusBadge[io.status] || statusBadge.pending_network
                          const role = roleBadge[io.grovlabs_role] || roleBadge.buyer
                          return (
                            <div
                              key={io.id}
                              className="flex items-center gap-4 p-3 bg-background rounded-lg border"
                            >
                              <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm">{io.io_number}</span>
                                  <Badge className={role.cls}>{role.label}</Badge>
                                  <Badge className={ioBadge.cls}>{ioBadge.label}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {io.industry || 'No industry'} &middot; {io.lead_type || 'No lead type'} &middot; {io.geo || 'No geo'}
                                  {io.compensation_amount && ` &middot; $${io.compensation_amount}`}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(`${QA_AGENT_URL}/n2n/ios/${io.id}/download`, '_blank')
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                {io.status === 'pending_network' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSendSignRequest(io.id)
                                    }}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Send
                                  </Button>
                                )}
                                {io.status === 'pending_counter' && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCountersign(io.id)
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Countersign
                                  </Button>
                                )}
                                {io.status === 'active' && (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Executed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No IOs yet
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Partner Dialog */}
      <Dialog open={showAddPartner} onOpenChange={setShowAddPartner}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Network Partner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Legal Name *</Label>
                <Input
                  value={partnerForm.legal_name}
                  onChange={(e) => setPartnerForm(p => ({ ...p, legal_name: e.target.value }))}
                  placeholder="Company Inc."
                />
              </div>
              <div className="space-y-2">
                <Label>Organized In</Label>
                <Input
                  value={partnerForm.organized_in}
                  onChange={(e) => setPartnerForm(p => ({ ...p, organized_in: e.target.value }))}
                  placeholder="Delaware"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name *</Label>
                <Input
                  value={partnerForm.contact_name}
                  onChange={(e) => setPartnerForm(p => ({ ...p, contact_name: e.target.value }))}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input
                  type="email"
                  value={partnerForm.contact_email}
                  onChange={(e) => setPartnerForm(p => ({ ...p, contact_email: e.target.value }))}
                  placeholder="john@company.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Phone *</Label>
                <Input
                  value={partnerForm.contact_phone}
                  onChange={(e) => setPartnerForm(p => ({ ...p, contact_phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label>Address Line 1</Label>
                <Input
                  value={partnerForm.address_line1}
                  onChange={(e) => setPartnerForm(p => ({ ...p, address_line1: e.target.value }))}
                  placeholder="123 Main St"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input
                value={partnerForm.address_line2}
                onChange={(e) => setPartnerForm(p => ({ ...p, address_line2: e.target.value }))}
                placeholder="Suite 100, City, ST 12345"
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can_buy"
                  checked={partnerForm.can_buy}
                  onCheckedChange={(c) => setPartnerForm(p => ({ ...p, can_buy: !!c }))}
                />
                <Label htmlFor="can_buy">Can Buy (we sell to them)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can_sell"
                  checked={partnerForm.can_sell}
                  onCheckedChange={(c) => setPartnerForm(p => ({ ...p, can_sell: !!c }))}
                />
                <Label htmlFor="can_sell">Can Sell (we buy from them)</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={partnerForm.notes}
                onChange={(e) => setPartnerForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Internal notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPartner(false)}>Cancel</Button>
            <Button onClick={handleAddPartner} disabled={submitting || !partnerForm.legal_name || !partnerForm.contact_email}>
              {submitting ? 'Adding...' : 'Add Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add IO Dialog */}
      <Dialog open={showAddIO} onOpenChange={setShowAddIO}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create IO for {selectedPartner?.legal_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>GrovLabs Role *</Label>
              <Select
                value={ioForm.grovlabs_role}
                onValueChange={(v) => setIOForm(p => ({ ...p, grovlabs_role: v as 'buyer' | 'seller' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer (we buy from them)</SelectItem>
                  <SelectItem value="seller">Seller (we sell to them)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry / Vertical</Label>
                <Input
                  value={ioForm.industry}
                  onChange={(e) => setIOForm(p => ({ ...p, industry: e.target.value }))}
                  placeholder="Medicare, Solar, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Type</Label>
                <Input
                  value={ioForm.lead_type}
                  onChange={(e) => setIOForm(p => ({ ...p, lead_type: e.target.value }))}
                  placeholder="Inbound Calls, Live Transfers"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Geo</Label>
                <Input
                  value={ioForm.geo}
                  onChange={(e) => setIOForm(p => ({ ...p, geo: e.target.value }))}
                  placeholder="US, CA, TX, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={ioForm.payment_terms}
                  onChange={(e) => setIOForm(p => ({ ...p, payment_terms: e.target.value }))}
                  placeholder="Net 15, Weekly, etc."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Cap</Label>
                <Input
                  value={ioForm.daily_cap}
                  onChange={(e) => setIOForm(p => ({ ...p, daily_cap: e.target.value }))}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Concurrency</Label>
                <Input
                  value={ioForm.concurrency}
                  onChange={(e) => setIOForm(p => ({ ...p, concurrency: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compensation Type</Label>
                <Input
                  value={ioForm.compensation_type}
                  onChange={(e) => setIOForm(p => ({ ...p, compensation_type: e.target.value }))}
                  placeholder="Per Call, Per Lead, Rev Share"
                />
              </div>
              <div className="space-y-2">
                <Label>Compensation Amount ($)</Label>
                <Input
                  type="number"
                  value={ioForm.compensation_amount}
                  onChange={(e) => setIOForm(p => ({ ...p, compensation_amount: e.target.value }))}
                  placeholder="50.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Duration (seconds)</Label>
                <Input
                  type="number"
                  value={ioForm.minimum_duration}
                  onChange={(e) => setIOForm(p => ({ ...p, minimum_duration: e.target.value }))}
                  placeholder="90"
                />
              </div>
              <div className="space-y-2">
                <Label>Payout Threshold ($)</Label>
                <Input
                  type="number"
                  value={ioForm.payout_threshold}
                  onChange={(e) => setIOForm(p => ({ ...p, payout_threshold: e.target.value }))}
                  placeholder="500.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hours of Operation</Label>
              <Input
                value={ioForm.hours_of_operation}
                onChange={(e) => setIOForm(p => ({ ...p, hours_of_operation: e.target.value }))}
                placeholder="9am-9pm EST Mon-Sat"
              />
            </div>
            <div className="space-y-2">
              <Label>Other Terms</Label>
              <Textarea
                value={ioForm.other_terms}
                onChange={(e) => setIOForm(p => ({ ...p, other_terms: e.target.value }))}
                placeholder="Additional terms..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIO(false)}>Cancel</Button>
            <Button onClick={handleAddIO} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create IO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
