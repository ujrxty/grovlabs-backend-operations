'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Search, Loader2, Plus, Copy, ExternalLink, CheckCircle2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CampaignOpt {
  id: string
  name: string
  industry: string
  payout: number | null
  payout_type: string
  payout_display: string | null
}
interface VendorOpt {
  id: string
  company_name: string
  contact_name: string
  email: string
  status: string
  hasActiveLpa: boolean
  lpaCount: number
  existingCampaignIds: string[]
}

function payoutText(c: CampaignOpt) {
  if (c.payout_display) return c.payout_display
  if (c.payout != null) return `$${c.payout} / ${c.payout_type?.replace(/_/g, ' ')}`
  return c.payout_type?.replace(/_/g, ' ') ?? ''
}

export function AddCampaignDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [vendors, setVendors] = useState<VendorOpt[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([])
  const [vendorId, setVendorId] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [specialTerms, setSpecialTerms] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/vendors/add-campaign-options')
      .then((r) => r.json())
      .then((d) => { setVendors(d?.vendors ?? []); setCampaigns(d?.campaigns ?? []) })
      .catch(() => toast.error('Failed to load vendors & campaigns'))
      .finally(() => setLoading(false))
  }, [open])

  const reset = () => {
    setVendorId(''); setVendorSearch(''); setSelected({}); setSpecialTerms(''); setResult(null)
  }

  const vendor = vendors.find((v) => v.id === vendorId) || null
  const existing = new Set(vendor?.existingCampaignIds ?? [])
  const chosenIds = Object.keys(selected).filter((k) => selected[k])

  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch) return true
    const q = vendorSearch.toLowerCase()
    return v.company_name?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) || v.contact_name?.toLowerCase().includes(q)
  })

  const selectVendor = (id: string) => {
    setVendorId(id)
    setSelected({}) // reset campaign picks when vendor changes
  }

  const toggle = (cid: string) => setSelected((s) => ({ ...s, [cid]: !s[cid] }))

  const submit = async () => {
    if (!vendorId) { toast.error('Select a vendor first.'); return }
    if (chosenIds.length === 0) { toast.error('Select at least one campaign to add.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/vendors/${vendorId}/add-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_ids: chosenIds, special_terms: specialTerms }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        toast.error(data?.error || 'Failed to add campaign to vendor.')
      } else {
        setResult(data)
        toast.success('Insertion Order sent to the vendor.')
        onSuccess?.()
      }
    } catch {
      toast.error('Failed to add campaign to vendor.')
    }
    setSubmitting(false)
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy')
    )
  }

  const resultCampaigns: string[] = Array.isArray(result?.campaigns)
    ? result.campaigns.map((c: any) => (typeof c === 'string' ? c : (c?.name ?? c?.id ?? ''))).filter(Boolean)
    : []

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { setOpen(o); if (!o) reset() }}>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" /> Add Campaign
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Campaign to an Existing Vendor</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading vendors & campaigns...
          </div>
        ) : result ? (
          // ---- Success view ----
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Insertion Order issued & emailed to the vendor</p>
            </div>
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">IO Number</span>
                <span className="font-mono font-medium">{result?.io_number ?? '—'}</span>
              </div>
              {resultCampaigns.length > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Campaigns</span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {resultCampaigns.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result?.io_sign_url && (
                <div className="pt-1 space-y-1.5">
                  <span className="text-muted-foreground">Vendor sign link</span>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={result.io_sign_url} className="font-mono text-xs" />
                    <Button variant="outline" size="icon-sm" onClick={() => copy(result.io_sign_url)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon-sm" onClick={() => window.open(result.io_sign_url, '_blank', 'noopener,noreferrer')} title="Open link">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The vendor has been emailed this sign link. No new Lead Purchase Agreement is required — the master LPA already on file covers it.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={reset}>Add another</Button>
              <Button onClick={() => { setOpen(false); reset() }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          // ---- Form view ----
          <div className="space-y-5 py-1">
            {/* Vendor picker */}
            <div className="space-y-2">
              <Label>Vendor <span className="text-muted-foreground font-normal">(must already have a signed LPA on file)</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendor by company, contact, or email..."
                  value={vendorSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendorSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                {filteredVendors.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No eligible vendors found</div>
                ) : (
                  filteredVendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVendor(v.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors',
                        vendorId === v.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.company_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!v.hasActiveLpa && (
                          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700">LPA not active</Badge>
                        )}
                        {vendorId === v.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Campaign picker */}
            {vendor && (
              <div className="space-y-2">
                <Label>Campaigns to add</Label>
                <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                  {campaigns.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No active campaigns</div>
                  ) : (
                    campaigns.map((c) => {
                      const already = existing.has(c.id)
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5',
                            already ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/60'
                          )}
                        >
                          <Checkbox
                            checked={already ? false : !!selected[c.id]}
                            disabled={already}
                            onCheckedChange={() => !already && toggle(c.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.industry} · {payoutText(c)}</p>
                          </div>
                          {already && (
                            <Badge variant="outline" className="text-[10px] shrink-0">Already added</Badge>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecting more than one issues a single bundled Insertion Order. Campaigns the vendor already has an IO for are disabled.
                </p>
              </div>
            )}

            {/* Special terms */}
            {vendor && (
              <div className="space-y-2">
                <Label>Special terms <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Any special terms for this Insertion Order..."
                  value={specialTerms}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSpecialTerms(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
              <Button onClick={submit} disabled={submitting || !vendorId || chosenIds.length === 0} className="gap-1.5">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {chosenIds.length > 1 ? `Send Bundled IO (${chosenIds.length})` : 'Send Insertion Order'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
