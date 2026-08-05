'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Save, X, Megaphone, DollarSign, Clock, MapPin, Phone, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  description: string | null
  payout: string
  payout_display: string | null
  payout_type: string
  billing_cycle: string
  min_duration: number | null
  geographic_focus: string | null
  allowed_traffic: string | null
  restricted_traffic: string | null
  requirements: string | null
  compliance_notes: string | null
  is_active: boolean
  sort_order: number
}

const emptyCampaign: Partial<Campaign> = {
  name: '',
  industry: '',
  call_type: 'Inbound',
  description: '',
  payout: '0',
  payout_display: '',
  payout_type: 'per_call',
  billing_cycle: 'weekly',
  min_duration: 60,
  geographic_focus: 'United States',
  allowed_traffic: '',
  restricted_traffic: '',
  requirements: '',
  compliance_notes: '',
  is_active: true,
  sort_order: 0,
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingCampaign({ ...emptyCampaign })
    setDialogOpen(true)
  }

  const openEditDialog = (campaign: Campaign) => {
    setEditingCampaign({ ...campaign })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingCampaign(null)
  }

  const saveCampaign = async () => {
    if (!editingCampaign?.name?.trim()) return
    setSaving(true)
    try {
      const isNew = !editingCampaign.id
      const res = await fetch('/api/campaigns', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCampaign),
      })
      if (res.ok) {
        await fetchCampaigns()
        closeDialog()
      }
    } catch (error) {
      console.error('Failed to save campaign:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return
    try {
      await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
      await fetchCampaigns()
    } catch (error) {
      console.error('Failed to delete campaign:', error)
    }
  }

  const updateField = (field: string, value: any) => {
    setEditingCampaign((prev) => prev ? { ...prev, [field]: value } : null)
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage your campaigns and payouts</p>
        </div>
        <Button onClick={openCreateDialog} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Get started by creating your first campaign</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="relative group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight">{campaign.name}</CardTitle>
                    <CardDescription>{campaign.industry}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={campaign.is_active ? 'default' : 'secondary'} className={campaign.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(campaign)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteCampaign(campaign.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-700">{campaign.payout_display || `$${campaign.payout}`}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {campaign.payout_type === 'per_call' ? 'Per Call' : campaign.payout_type === 'per_minute' ? 'Per Min' : campaign.payout_type}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{campaign.call_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{campaign.min_duration || 60}s min</span>
                  </div>
                </div>
                {campaign.geographic_focus && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{campaign.geographic_focus}</span>
                  </div>
                )}
                {campaign.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-2 border-t">
                    {campaign.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign?.id ? 'Edit Campaign' : 'Create Campaign'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={editingCampaign?.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Medicare Advantage"
                />
              </div>
              <div className="space-y-2">
                <Label>Industry *</Label>
                <Input
                  value={editingCampaign?.industry || ''}
                  onChange={(e) => updateField('industry', e.target.value)}
                  placeholder="Insurance"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Payout ($)</Label>
                <Input
                  type="number"
                  value={editingCampaign?.payout || '0'}
                  onChange={(e) => updateField('payout', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payout Display</Label>
                <Input
                  value={editingCampaign?.payout_display || ''}
                  onChange={(e) => updateField('payout_display', e.target.value)}
                  placeholder="$45/qualified call"
                />
              </div>
              <div className="space-y-2">
                <Label>Payout Type</Label>
                <Select
                  value={editingCampaign?.payout_type || 'per_call'}
                  onValueChange={(v) => updateField('payout_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_call">Per Call</SelectItem>
                    <SelectItem value="per_minute">Per Minute</SelectItem>
                    <SelectItem value="cpa">CPA</SelectItem>
                    <SelectItem value="revenue_share">Revenue Share</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Call Type</Label>
                <Select
                  value={editingCampaign?.call_type || 'Inbound'}
                  onValueChange={(v) => updateField('call_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                    <SelectItem value="Outbound">Outbound</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select
                  value={editingCampaign?.billing_cycle || 'weekly'}
                  onValueChange={(v) => updateField('billing_cycle', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min Duration (sec)</Label>
                <Input
                  type="number"
                  value={editingCampaign?.min_duration || 60}
                  onChange={(e) => updateField('min_duration', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editingCampaign?.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of the campaign..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Geographic Focus</Label>
              <Input
                value={editingCampaign?.geographic_focus || ''}
                onChange={(e) => updateField('geographic_focus', e.target.value)}
                placeholder="United States"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allowed Traffic</Label>
                <Textarea
                  value={editingCampaign?.allowed_traffic || ''}
                  onChange={(e) => updateField('allowed_traffic', e.target.value)}
                  placeholder="Paid search, social media..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Restricted Traffic</Label>
                <Textarea
                  value={editingCampaign?.restricted_traffic || ''}
                  onChange={(e) => updateField('restricted_traffic', e.target.value)}
                  placeholder="No robocalls, no cold calling..."
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea
                value={editingCampaign?.requirements || ''}
                onChange={(e) => updateField('requirements', e.target.value)}
                placeholder="Caller must be 65+..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Compliance Notes</Label>
              <Textarea
                value={editingCampaign?.compliance_notes || ''}
                onChange={(e) => updateField('compliance_notes', e.target.value)}
                placeholder="TCPA compliant required..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={editingCampaign?.is_active ?? true}
                onCheckedChange={(v) => updateField('is_active', v)}
              />
              <Label>Campaign is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={saveCampaign} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardShell>
  )
}
